// Slip fields from OCR text: Apple's on-device foundation model does the
// reading, so there are no per-bank zones or regex heuristics to maintain.
//
// The model generates against a runtime GenerationSchema instead of a
// @Generable struct: the FoundationModels macro plugin ships only with full
// Xcode, so Command Line Tools cannot compile the macros. The schema is the
// same guarantee — the model can only return these seven fields.
//
// Dates are the one deterministic step: the model copies the printed date line
// and the Buddhist-era conversion below is mechanical. Asking the model to do
// that arithmetic misread times in testing.
import Foundation
import FoundationModels

enum SlipError: LocalizedError {
    case noText
    case modelUnavailable(String)

    var errorDescription: String? {
        switch self {
        case .noText:
            return "no text recognized"
        case .modelUnavailable(let reason):
            return "foundation model unavailable (\(reason))"
        }
    }
}

let instructions = """
You read Thai bank transfer slips. The input is OCR text from one slip, top to bottom.
Extract only what the text shows; never invent or complete a value.
Amounts are in THB: the transferred amount, not the fee.
A slip has a sender block right after the date/time and a recipient block right before the
"เลขที่รายการ:" line. Each block is the name line, then that party's bank, account and code lines.
The name is the first line of the block; a bank name (e.g. ธ.กสิกรไทย) or an account number is
never a name, and the recipient is never a bank. On top-up slips a trailing "รายละเอียด:" line holds
the recipient name; use it when the recipient block only shows a wallet or channel.

Example OCR text:
จ่ายบิลสำเร็จ
10 ก.ย. 69 09:24 น.
นาย ก
ธ.กสิกรไทย
xxx-x-x3641-x
THE PIZZA COMPANY
THEPIZZACOMPANY
68YTJW08CFA8BVW9XYR
เลขที่รายการ:
016253092413CPM01291
จำนวน:
198.00 บาท
ค่าธรรมเนียม:
0.00 บาท
Here the sender is "นาย ก" and the recipient is "THE PIZZA COMPANY"; "ธ.กสิกรไทย" is the sender's bank.
"""

// The fields the model is allowed to produce, described for it in the schema.
private func slipSchema() throws -> GenerationSchema {
    func text(_ name: String, _ description: String) -> DynamicGenerationSchema.Property {
        .init(name: name, description: description, schema: .init(type: String.self))
    }

    return try GenerationSchema(
        root: DynamicGenerationSchema(
            name: "Slip",
            description: "Fields read from one Thai bank transfer slip.",
            properties: [
                text("transactionId", "Reference printed on the slip, e.g. 016253092413CPM01291."),
                text("dateText", "Date and time line copied exactly as printed, including the Thai month."),
                .init(
                    name: "amount",
                    description: "Transferred amount in THB, not the fee.",
                    schema: .init(type: Double.self)
                ),
                .init(name: "fee", description: "Fee in THB, 0 when the slip shows none.", schema: .init(type: Double.self)),
                text("sender", "Sender name."),
                text("recipient", "Recipient name; a bank name or account number is never the recipient."),
                text("title", "Slip type as printed, e.g. จ่ายบิลสำเร็จ."),
            ]
        ),
        dependencies: []
    )
}

private let thaiMonths: [String: Int] = [
    "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
    "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
]

// Buddhist-era year -> CE. Two-digit years are BE (69 = 2569); four-digit BE
// years also appear on some slips.
private func ceYear(_ year: Int) -> Int {
    let be = year < 100 ? year + 2500 : year
    return be > 2400 ? be - 543 : be
}

private func stamp(_ year: Int, _ month: Int, _ day: Int, _ hour: Int, _ minute: Int) -> String? {
    guard (1...12).contains(month), (1...31).contains(day), (0...23).contains(hour), (0...59).contains(minute) else {
        return nil
    }
    let ce = ceYear(year)
    guard (1900...2200).contains(ce) else { return nil }
    return String(format: "%04d-%02d-%02dT%02d:%02d:00+07:00", ce, month, day, hour, minute)
}

private func matches(_ text: String, _ pattern: String) -> [String]? {
    guard let re = try? NSRegularExpression(pattern: pattern) else { return nil }
    guard let match = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
    return (1..<match.numberOfRanges).map { index in
        guard let range = Range(match.range(at: index), in: text) else { return "" }
        return String(text[range])
    }
}

// "15 ก.ย. 69 11:31 น." or "15/09/69 11:31".
func dateTime(from raw: String) -> String? {
    if let parts = matches(raw, "(\\d{1,2})\\s+(\\S+)\\s+(\\d{2,4})\\s+(\\d{1,2}):(\\d{2})"),
       parts.count == 5,
       let month = thaiMonths[parts[1]],
       let day = Int(parts[0]), let year = Int(parts[2]),
       let hour = Int(parts[3]), let minute = Int(parts[4]) {
        return stamp(year, month, day, hour, minute)
    }
    if let parts = matches(raw, "(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\s+(\\d{1,2}):(\\d{2})"),
       parts.count == 5,
       let day = Int(parts[0]), let month = Int(parts[1]), let year = Int(parts[2]),
       let hour = Int(parts[3]), let minute = Int(parts[4]) {
        return stamp(year, month, day, hour, minute)
    }
    return nil
}

func extract(file: String, obs: [Obs]) async throws -> [String: Any] {
    let ocrText = obs.sorted { $0.box.midY > $1.box.midY }.map(\.text).joined(separator: "\n")
    guard !ocrText.isEmpty else { throw SlipError.noText }

    let model = SystemLanguageModel.default
    guard case .available = model.availability else {
        throw SlipError.modelUnavailable(String(describing: model.availability))
    }

    let session = LanguageModelSession(model: model, instructions: instructions)
    // Low temperature: the same slip should read the same way every import.
    let options = GenerationOptions(temperature: 0.2)
    let slip = try await session.respond(
        to: "OCR text:\n\(ocrText)",
        schema: try slipSchema(),
        options: options
    ).content

    let id = try slip.value(String.self, forProperty: "transactionId")
    let dateText = try slip.value(String.self, forProperty: "dateText")
    let amount = try slip.value(Double.self, forProperty: "amount")
    let fee = try slip.value(Double.self, forProperty: "fee")
    let sender = try slip.value(String.self, forProperty: "sender")
    let recipient = try slip.value(String.self, forProperty: "recipient")
    let title = try slip.value(String.self, forProperty: "title")

    let date = dateTime(from: dateText) ?? dateTime(from: ocrText)
    return [
        "file": (file as NSString).lastPathComponent,
        "type": title,
        "transactionId": id,
        "dateTime": date ?? NSNull(),
        "amount": max(0, amount),
        "fee": max(0, fee),
        "currency": "THB",
        "sender": ["name": sender, "accounts": []] as [String: Any],
        "recipient": ["name": recipient] as [String: Any],
    ]
}
