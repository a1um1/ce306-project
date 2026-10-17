// KBank slip reader: Vision OCR -> structured fields -> JSON + highlight PNG.
// Build: swiftc -O main.swift Sources/*.swift -o bin/slipreader
// Run:   bin/slipreader <image|dir> [more...] [--no-highlight]
import Foundation

let fm = FileManager.default
var args = Array(CommandLine.arguments.dropFirst())
let noHighlight = args.contains("--no-highlight")
args.removeAll { $0 == "--no-highlight" }
guard !args.isEmpty else {
    FileHandle.standardError.write("usage: slipreader <image|dir>... [--no-highlight]\n".data(using: .utf8)!)
    exit(1)
}

var images: [String] = []
for a in args {
    var isDir: ObjCBool = false
    if fm.fileExists(atPath: a, isDirectory: &isDir), isDir.boolValue {
        let items = (try? fm.contentsOfDirectory(atPath: a)) ?? []
        images += items.filter { ["jpg", "jpeg", "png"].contains(($0 as NSString).pathExtension.lowercased()) }
            .sorted().map { (a as NSString).appendingPathComponent($0) }
    } else {
        images.append(a)
    }
}

if !noHighlight {
    try? fm.createDirectory(atPath: "highlight", withIntermediateDirectories: true)
}

// Vision already saturates the ANE/GPU: running slips concurrently gives the
// same wall time but inflates per-slip latency, so keep it serial and ordered.
var results = [[String: Any]?](repeating: nil, count: images.count)

for index in 0..<images.count {
    let path = images[index]
    guard let cg = loadCGImage(path) else {
        FileHandle.standardError.write("skip (unreadable): \(path)\n".data(using: .utf8)!)
        continue
    }
    do {
        let start = DispatchTime.now()
        let obs = try recognize(cg)
        var fields = parse(file: path, obs: obs)
        let regions = (fields.removeValue(forKey: "_regions") as? [(String, Obs)]) ?? []
        if !noHighlight {
            let name = ((path as NSString).lastPathComponent as NSString).deletingPathExtension
            highlight(cg, regions: regions, to: "highlight/\(name).highlight.png")
        }
        let ms = Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
        fields["durationMs"] = (ms * 10).rounded() / 10
        results[index] = fields
    } catch {
        FileHandle.standardError.write("error \(path): \(error)\n".data(using: .utf8)!)
    }
}

let data = try JSONSerialization.data(withJSONObject: results.compactMap { $0 }, options: [.prettyPrinted, .withoutEscapingSlashes])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
