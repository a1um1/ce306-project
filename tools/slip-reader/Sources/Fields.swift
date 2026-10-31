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
Extract fields from OCR text of one bank transfer slip (Thai or English).
Copy values exactly as printed. Return "" (or 0 for amount) if absent; never guess.
Two names appear on the slip. The upper name is the sender (payer). The lower name is the recipient (payee).
If "จาก"/"From" or "ไปที่"/"ไปยัง"/"To" labels are printed, they override the position.
Each name is usually followed by a bank name and a masked account number; those are never part of the name.
A bank, app name, Biller ID or account number is never a name.
Transaction ID is the unique transfer reference, never a Biller ID or tax id.
Dates: output ISO 8601 with +07:00, like 2026-05-26T18:01:00+07:00.
Convert 12-hour AM/PM to 24-hour. A 2-digit year is 20xx (26 = 2026).
Thai Buddhist years (พ.ศ.) subtract 543: 2569 = 2026.
"""

@Generable
struct Slip {
    @Guide(description: "Transfer reference (Transaction ID, เลขที่รายการ, Ref)")
    var transactionId: String
    @Guide(description: "Date and time as ISO 8601 with +07:00. Empty if absent")
    var dateText: String
    @Guide(description: "Transferred amount in THB (Amount, จำนวนเงิน). Ignore Fee. 0 if absent")
    var amount: String
    @Guide(description: "Payer: the FIRST (upper) name on the slip. Name only")
    var sender: String
    @Guide(description: "Payee: the SECOND (lower) name on the slip. Name only")
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
	do {
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
	} catch let e as LanguageModelSession.GenerationError {
			print("GenerationError: \(e)")
			throw e
	}
}
