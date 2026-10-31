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
                text("dateText", "Date and time line converted to standard iso date time format"),
                .init(
                    name: "amount",
                    description: "Transferred amount in THB, not the fee.",
                    schema: .init(type: Double.self)
                ),
                text("sender", "Sender name, the first line of the sender block."),
                text("recipient", "Recipient name; a bank name or account number is never the recipient."),
            ]
        ),
        dependencies: []
    )
}


private func matches(_ text: String, _ pattern: String) -> [String]? {
    guard let re = try? NSRegularExpression(pattern: pattern) else { return nil }
    guard let match = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
    return (1..<match.numberOfRanges).map { index in
        guard let range = Range(match.range(at: index), in: text) else { return "" }
        return String(text[range])
    }
}

func extract(file: String, obs: [Obs], session: LanguageModelSession) async throws -> [String: Any] {
    let ocrText = obs.sorted { $0.box.midY > $1.box.midY }.map(\.text).joined(separator: "\n")
    guard !ocrText.isEmpty else { throw SlipError.noText }

    let options = GenerationOptions(samplingMode: .greedy, maximumResponseTokens: 120)
    let slip = try await session.respond(
        to: "OCR text:\n\(ocrText)",
        schema: try slipSchema(),
        options: options
    ).content

    let id = try slip.value(String.self, forProperty: "transactionId")
    let dateText = try slip.value(String.self, forProperty: "dateText")
    let amount = try slip.value(Double.self, forProperty: "amount")
    let sender = try slip.value(String.self, forProperty: "sender")
    let recipient = try slip.value(String.self, forProperty: "recipient")
	
    return [
        "file": (file as NSString).lastPathComponent,
				"raw": ocrText,
        "transactionId": id,
        "dateTime": dateText,
        "amount": max(0, amount),
        "currency": "THB",
        "sender": ["name": sender] as [String: Any],
        "recipient": ["name": recipient] as [String: Any],
    ]
}
