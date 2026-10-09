// ocr.swift (film v3 pass): macOS Vision text recognition, zh-Hans + en-US, accurate, no language correction, a LOW minimum text
// height so the small product UI inside the phone / desktop frames is read too (Vision's default skips text under ~1/32 of the
// image height).  One JSON line per image: {"file": path, "texts": [{"t": text, "c": confidence, "box": [x0, y0, x1, y1] px, top-left origin}]}
//   ocr <minTextHeightFraction> <img1> [img2 ...]
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
let minH = Float(args[1]) ?? 0.01
for path in args.dropFirst(2) {
  guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("{\"file\": \"\(path)\", \"error\": \"load\"}"); continue }
  let W = Double(cg.width), H = Double(cg.height)
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["zh-Hans", "en-US"]
  req.usesLanguageCorrection = false
  req.minimumTextHeight = minH
  let handler = VNImageRequestHandler(cgImage: cg, options: [:])
  do { try handler.perform([req]) } catch { print("{\"file\": \"\(path)\", \"error\": \"perform\"}"); continue }
  var texts: [[String: Any]] = []
  for obs in (req.results ?? []) {
    if let c = obs.topCandidates(1).first {
      let b = obs.boundingBox
      texts.append(["t": c.string, "c": Double(c.confidence),
                    "box": [Int(b.minX * W), Int((1 - b.maxY) * H), Int(b.maxX * W), Int((1 - b.minY) * H)]])
    }
  }
  let rec: [String: Any] = ["file": path, "texts": texts]
  if let d = try? JSONSerialization.data(withJSONObject: rec), let s = String(data: d, encoding: .utf8) { print(s) }
  fflush(stdout)
}
