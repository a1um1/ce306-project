// Slip reader: Vision OCR -> Apple's on-device foundation model -> JSON.
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

// Vision already saturates the ANE/GPU, and the model session is on-device:
// running slips concurrently gives the same wall time but inflates per-slip
// latency, so keep it serial and ordered.
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
        var fields = try await extract(file: path, obs: obs)
        let ms = Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
        fields["durationMs"] = (ms * 10).rounded() / 10
        results[index] = fields
    } catch {
        FileHandle.standardError.write("error \(path): \(error.localizedDescription)\n".data(using: .utf8)!)
    }
}

let data = try JSONSerialization.data(withJSONObject: results.compactMap { $0 }, options: [.prettyPrinted, .withoutEscapingSlashes])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
