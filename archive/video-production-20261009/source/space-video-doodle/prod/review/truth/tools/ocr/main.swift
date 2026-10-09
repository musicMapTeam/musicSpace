import Foundation
import Vision
import AppKit

// usage: ocr <out.jsonl> <img1> [img2 ...]
let args = CommandLine.arguments
let outPath = args[1]
var lines: [String] = []
for path in args.dropFirst(2) {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["zh-Hans", "en-US"]
    req.usesLanguageCorrection = false
    let h = VNImageRequestHandler(cgImage: cg, options: [:])
    try? h.perform([req])
    var texts: [[String: Any]] = []
    for o in (req.results ?? []) {
        if let c = o.topCandidates(1).first {
            let b = o.boundingBox
            texts.append(["t": c.string, "c": c.confidence, "x": b.origin.x, "y": b.origin.y, "w": b.size.width, "h": b.size.height])
        }
    }
    let rec: [String: Any] = ["file": path, "texts": texts]
    if let d = try? JSONSerialization.data(withJSONObject: rec), let s = String(data: d, encoding: .utf8) { lines.append(s) }
}
try! lines.joined(separator: "\n").write(toFile: outPath, atomically: true, encoding: .utf8)
print("ocr done", lines.count)
