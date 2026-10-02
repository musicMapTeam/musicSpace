import Foundation
import CoreBluetooth
import CoreNFC

// Transport adapter only. A host app must own permissions and foreground lifetime.
struct InvitationAdapter {
    static let service = CBUUID(string: "6d757369-6373-4070-9163-652d696e7669")
    static let characteristic = CBUUID(string: "6d757369-6373-4070-9163-652d75726c31")
    let base: URL
    enum Invalid: Error { case invitation }
    func preview(_ raw: String) throws -> URL {
        guard raw.utf8.count <= 2048, !raw.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }),
              let value = URLComponents(string: raw), let origin = URLComponents(url: base, resolvingAgainstBaseURL: false),
              origin.scheme == "https", value.scheme == origin.scheme, value.host == origin.host, value.port == origin.port,
              value.percentEncodedPath == origin.percentEncodedPath, value.user == nil, value.password == nil, value.fragment == nil,
              let query = value.percentEncodedQuery, query.range(of: "^(room|community)=[A-Z2-7]{12}$", options: .regularExpression) != nil,
              let url = value.url else { throw Invalid.invitation }
        return url // Only preview. No join, friend or photo permission is implied.
    }
    func nfcPayload(_ raw: String) throws -> NFCNDEFPayload {
        guard let payload = NFCNDEFPayload.wellKnownTypeURIPayload(url: try preview(raw)) else { throw Invalid.invitation }
        return payload
    }
    func fromNfc(_ payload: NFCNDEFPayload) throws -> URL {
        guard let url = payload.wellKnownTypeURIPayload() else { throw Invalid.invitation }
        return try preview(url.absoluteString)
    }
    func gattValue(_ raw: String) throws -> Data { Data(try preview(raw).absoluteString.utf8) }
    func fromGatt(_ data: Data) throws -> URL {
        guard data.count <= 2048, let raw = String(data: data, encoding: .utf8) else { throw Invalid.invitation }
        return try preview(raw)
    }
}
