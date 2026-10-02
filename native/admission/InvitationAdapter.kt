package musicspace.admission

import android.net.Uri
import android.nfc.NdefRecord
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/** Transport adapter, not a signed Android app. Caller owns permission/lifecycle UI. */
class InvitationAdapter(private val base: Uri) {
    companion object {
        const val SERVICE = "6d757369-6373-4070-9163-652d696e7669"
        const val CHARACTERISTIC = "6d757369-6373-4070-9163-652d75726c31"
    }
    init { require(base.scheme == "https" && base.userInfo == null) }
    fun preview(raw: String): Uri {
        require(raw.toByteArray(Charsets.UTF_8).size <= 2048 && raw.none { it.isISOControl() })
        val uri = Uri.parse(raw)
        require(uri.scheme == "https" && uri.encodedAuthority == base.encodedAuthority && uri.encodedPath == base.encodedPath && uri.userInfo == null && uri.fragment == null)
        val match = Regex("^(room|community)=([A-Z2-7]{12})$").matchEntire(uri.encodedQuery ?: "")
        require(match != null)
        return uri // MUST show server preview; never invoke join from a radio callback.
    }
    fun nfcRecord(url: String): NdefRecord = NdefRecord.createUri(preview(url))
    fun fromNfc(record: NdefRecord): Uri = preview(requireNotNull(record.toUri()).toString())
    fun gattValue(url: String): ByteArray = preview(url).toString().toByteArray(Charsets.UTF_8)
    fun fromGatt(value: ByteArray): Uri {
        require(value.size <= 2048)
        val decoder = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
        return preview(decoder.decode(ByteBuffer.wrap(value)).toString())
    }
}
