// Field extraction: OCR observations -> structured slip fields (+ regions to highlight).
import Foundation

func parse(file: String, obs: [Obs]) -> [String: Any] {
    let inImg = obs // sorted top-to-bottom by y descending where needed

    // title = topmost line
    let title = inImg.max { $0.box.midY < $1.box.midY }?.text ?? ""

    // date: "10 ก.ย. 69 17:05 น."
    var dateRaw = ""
    var dateTime: Any = NSNull()
    var dateObs: Obs? = nil
    if let d = inImg.first(where: { !matches($0.text, "(\\d{1,2})\\s+(\\S+)\\s+(\\d{2})\\s+(\\d{1,2}):(\\d{2})").isEmpty }) {
        dateRaw = d.text
        dateObs = d
        if let m = matches(d.text, "(\\d{1,2})\\s+(\\S+)\\s+(\\d{2})\\s+(\\d{1,2}):(\\d{2})").first,
           let dayR = Range(m.range(at: 1), in: d.text),
           let monR = Range(m.range(at: 2), in: d.text),
           let yrR = Range(m.range(at: 3), in: d.text),
           let hrR = Range(m.range(at: 4), in: d.text),
           let mnR = Range(m.range(at: 5), in: d.text),
           let mon = thaiMonths[String(d.text[monR])] {
            let day = Int(d.text[dayR])!, yy = Int(d.text[yrR])!
            let ce = yy < 100 ? yy + 2500 - 543 : yy - 543 // Buddhist year -> CE
            dateTime = String(format: "%04d-%02d-%02dT%02d:%02d:00+07:00", ce, mon, day, Int(d.text[hrR])!, Int(d.text[mnR])!)
        }
    }

    // transaction id: value directly below the "เลขที่รายการ" label
    var txn = ""
    if let label = inImg.first(where: { $0.text.contains("รายการ") }) {
        let ly = label.box.midY
        let cand = inImg.filter {
            $0.box.midY < ly && $0.box.midY > ly - 0.12 && $0.box.minX > 0.10 &&
            !matches($0.text, "^[0-9A-Za-z]{10,}$").isEmpty
        }.max { $0.box.midY < $1.box.midY }
        txn = cand?.text ?? ""
    }
    if txn.isEmpty { txn = (file as NSString).deletingPathExtension }

    // amount & fee: lines with "N.NN" + บาท; larger y is amount, smaller is fee
    let moneyLines = inImg.filter { $0.text.contains("บาท") && money($0.text) != nil }
        .sorted { $0.box.midY > $1.box.midY }
    let amount = moneyLines.first.flatMap { money($0.text) } ?? 0
    let fee = moneyLines.count > 1 ? (money(moneyLines[1].text) ?? 0) : 0

    // sender / recipient blocks. Anchor on labels, then split at the biggest vertical gap.
    // (Layout differs between slip types, so absolute bands are unreliable.)
    let anchorY = inImg.filter {
        $0.text.contains("จำนวน") || $0.text.contains("ค่าธรรมเนียม") || $0.text.contains("รายการ")
    }.map { $0.box.midY }.max() ?? 0.4
    let topY = dateObs?.box.midY ?? 0.95
    let mid = inImg.filter { $0.box.minX > 0.15 && $0.box.midY < topY && $0.box.midY > anchorY }
        .sorted { $0.box.midY > $1.box.midY }

    var split = 0
    var gap = 0.0
    if mid.count > 1 {
        for i in 0..<(mid.count - 1) {
            let g = mid[i].box.midY - mid[i + 1].box.midY
            if g > gap { gap = g; split = i }
        }
    }
    let senderLines = mid.isEmpty ? [] : Array(mid[0...min(split, mid.count - 1)])
    let recipientLines = split + 1 < mid.count ? Array(mid[(split + 1)...]) : []

    func party(_ lines: [Obs]) -> [String: Any] {
        let channel = lines.first { $0.text.contains("พร้อมเพย์") }
        let rest = lines.filter { $0.text != channel?.text }
        let names = rest.filter { !isAccountLike($0.text) }.map { $0.text }
        let accounts = rest.filter { isAccountLike($0.text) }.map { $0.text }
        let bank = names.first { $0.contains("ธ.") || $0.contains("ธนาคาร") || $0.lowercased().contains("bank") }
        var out: [String: Any] = ["name": names.filter { $0 != bank }.joined(separator: " ")]
        if let b = bank { out["bank"] = b }
        if let c = channel { out["channel"] = c.text }
        out["accounts"] = accounts
        return out
    }

    let sender = party(senderLines)
    var recipient = party(recipientLines)
    var recipientObs = recipientLines.first
    // top-up slips carry the receiver name in a trailing "รายละเอียด:" line
    if (recipient["name"] as? String)?.isEmpty ?? true,
       let d = inImg.first(where: { $0.text.contains("รายละเอียด") }) {
        let v = d.text.split(separator: ":", maxSplits: 1).last.map(String.init)?
            .trimmingCharacters(in: .whitespaces) ?? ""
        if !v.isEmpty { recipient["name"] = v; recipientObs = d }
    }

    // regions used, for highlighting: (label, Obs)
    var regions: [(String, Obs)] = []
    func add(_ label: String, _ o: Obs?) { if let o { regions.append((label, o)) } }
    add("date", dateObs)
    add("txn", inImg.first { $0.text == txn })
    if let a = moneyLines.first { add("amount", a) }
    if moneyLines.count > 1 { add("fee", moneyLines[1]) }
    add("sender", senderLines.first)
    add("recipient", recipientObs)

    return [
        "file": (file as NSString).lastPathComponent,
        "type": title,
        "transactionId": txn,
        "date": dateRaw,
        "dateTime": dateTime,
        "amount": amount,
        "fee": fee,
        "currency": "THB",
        "sender": sender,
        "recipient": recipient,
        "_regions": regions,
    ]
}
