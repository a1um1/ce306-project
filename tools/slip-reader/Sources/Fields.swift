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
You read Thai bank transfer and donation slips. The input is OCR text from one slip,
top to bottom. Extract only values that are printed in the text. If a value is not
printed, return an empty string (or 0 for the amount); never guess, and never reuse
values from these instructions.

- amount: the transferred amount in THB, not the fee.
- dateText: convert date and time to ISO format.
- transactionId: the transfer reference printed on the slip. Thai labels are
  "เลขที่รายการ:", "เลขที่อ้างอิง", "รหัสอ้างอิง", "Ref", "Reference". Take the value
  that belongs to one of those labels, usually the longest alphanumeric string.
  Never use a Biller ID, "รหัสอ้างอิงหน่วยรับบริจาค", a tax id, a phone number, or an
  account number.
- sender: the person or company who paid. It is beside "จาก" / "ผู้โอน", or in the
  block above the sender's bank. Never take a bank name, an app name, a slip title,
  or an amount.
- recipient: the person or company who received the money. It is beside "ไปที่" /
  "ไปยัง" / "ผู้รับ", or in the last name block before the reference. Return the name
  only: drop account numbers, Biller IDs and anything in brackets.

Bank names and channels look like ธ.กสิกรไทย, กรุงไทย, Krungthai, Bangkok Bank, ttb,
ธ.ก.ส., BAAC, พร้อมเพย์. They are never a person's name.
A donation slip often shows two id numbers: the foundation/biller id near "Biller ID"
or "รหัสอ้างอิงหน่วยรับบริจาค" (e.g. 0993000273940) is not the transaction reference.
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
                text("transactionId", "Transfer reference from เลขที่รายการ, เลขที่อ้างอิง or รหัสอ้างอิง. Empty when absent; never a Biller ID, tax id or account number."),
                text("dateText", "Date and time in ISO format, e.g. 2023-09-10T09:24:00.000Z. Convert from the printed format."),
                .init(
                    name: "amount",
                    description: "Transferred amount in THB, not the fee. 0 when not printed.",
                    schema: .init(type: Double.self)
                ),
                text("sender", "Payer name only; never a bank name, app name, slip title or amount."),
                text("recipient", "Payee name only; never a bank name, Biller ID, account number or bracketed code."),
            ]
        ),
        dependencies: []
    )
}

@Generable
struct Slip {
    @Guide(description: "Transfer reference from เลขที่รายการ, เลขที่อ้างอิง or รหัสอ้างอิง. Empty when absent; never a Biller ID, tax id or account number.")
    var transactionId: String

    @Guide(description:  "Date and time In ISO format, e.g. 2023-09-10T09:24:00.000Z. Convert from the printed format.")
    var dateText: String

    @Guide(description: "Transferred amount in THB, not the fee. 0 when not printed.")
    var amount: String

		@Guide(description: "Payer name only; never a bank name, app name, slip title or amount.")
		var sender: String

		@Guide(description: "Payee name only; never a bank name, Biller ID, account number or bracketed code.")
		var recipient: String
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
    let ocrText = obs.map(\.text).joined(separator: "\n")
    guard !ocrText.isEmpty else { throw SlipError.noText }

    let options = GenerationOptions(samplingMode: .greedy, maximumResponseTokens: 120)
    let slip = try await session.respond(
        to: "OCR text:\n\(ocrText)",
				generating: Slip.self,
        options: options
    ).content

    let id = slip.transactionId
		let dateText = slip.dateText
		let amount = slip.amount
		let sender = slip.sender
		let recipient = slip.recipient
	
		let amountValue = Double(
			amount.replacingOccurrences(of: ",", with: "")
						.trimmingCharacters(in: .whitespaces)
	) ?? 0

    return [
        "file": (file as NSString).lastPathComponent,
				"raw": ocrText,
        "transactionId": id,
        "dateTime": dateText,
        "amount": max(0, amountValue),
        "currency": "THB",
        "sender": ["name": sender] as [String: Any],
        "recipient": ["name": recipient] as [String: Any],
    ]
}
