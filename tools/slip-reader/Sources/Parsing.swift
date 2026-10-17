// Shared parsing helpers: regex, Thai months, money / account detection.
import Foundation

let thaiMonths = [
    "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
    "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
]

func matches(_ s: String, _ pattern: String) -> [NSTextCheckingResult] {
    guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
    return re.matches(in: s, range: NSRange(s.startIndex..., in: s))
}

// account/ref lines start with a digit or masked x; names start with a letter/Thai.
func isAccountLike(_ s: String) -> Bool {
    guard let f = s.first else { return false }
    return f.isNumber || f == "x" || f == "X"
}

func money(_ s: String) -> Double? {
    guard let m = matches(s, "([0-9,]+\\.[0-9]{2})").first,
          let r = Range(m.range(at: 1), in: s) else { return nil }
    return Double(s[r].replacingOccurrences(of: ",", with: ""))
}
