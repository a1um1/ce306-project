// KBank slip reader: Vision OCR -> structured fields -> JSON + highlight PNG.
// Build: swiftc -O main.swift Sources/*.swift -o bin/slipreader
// Run:   bin/slipreader <image|dir> [more...]
import Foundation

let fm = FileManager.default
let args = Array(CommandLine.arguments.dropFirst())
guard !args.isEmpty else {
    FileHandle.standardError.write("usage: slipreader <image|dir>...\n".data(using: .utf8)!)
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

let outDir = "highlight"
try? fm.createDirectory(atPath: outDir, withIntermediateDirectories: true)

var results: [[String: Any]] = []
for path in images {
    guard let cg = loadCGImage(path) else {
        FileHandle.standardError.write("skip (unreadable): \(path)\n".data(using: .utf8)!)
        continue
    }
    do {
        let start = DispatchTime.now()
        let obs = try recognize(cg)
        var fields = parse(file: path, obs: obs)
        let regions = (fields.removeValue(forKey: "_regions") as? [(String, Obs)]) ?? []
        let name = ((path as NSString).lastPathComponent as NSString).deletingPathExtension
        highlight(cg, regions: regions, to: "\(outDir)/\(name).highlight.png")
        let ms = Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
        fields["durationMs"] = (ms * 10).rounded() / 10
        results.append(fields)
    } catch {
        FileHandle.standardError.write("error \(path): \(error)\n".data(using: .utf8)!)
    }
}

let data = try JSONSerialization.data(withJSONObject: results, options: [.prettyPrinted, .withoutEscapingSlashes])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
