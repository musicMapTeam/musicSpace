// ocr.swift: print the text macOS Vision reads in each image (zh-Hans + en-US), one line per file:  FILE <tab> path <tab> line | line ...
// Used to grep sampled frames of the takes for old copy at the pixel level (the 3D canvas included).
import Foundation
import Vision
import AppKit

for path in CommandLine.arguments.dropFirst() {
  guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("ERR\t\(path)"); continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["zh-Hans", "en-US"]
  req.usesLanguageCorrection = false
  let handler = VNImageRequestHandler(cgImage: cg, options: [:])
  do { try handler.perform([req]) } catch { print("ERR\t\(path)\t\(error)"); continue }
  var lines: [String] = []
  for obs in (req.results ?? []) { if let t = obs.topCandidates(1).first { lines.append(t.string) } }
  print("FILE\t\(path)\t" + lines.joined(separator: " | "))
}
