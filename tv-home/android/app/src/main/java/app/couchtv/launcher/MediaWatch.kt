package app.couchtv.launcher

import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.net.Uri
import android.media.MediaMetadata
import android.media.session.MediaSessionManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Base64
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Keep watching, the part Android's Watch Next list cannot do on some TVs.
 *
 * Fire OS ships with the Watch Next list switched off, and every Amazon home plug-in that could fill
 * it is signature-only, so no third-party home can read it (see readWatchNext in MainActivity). What
 * is playing right now is still readable, though. With notification access - granted once over a
 * computer, `cmd notification allow_listener app.couchtv.launcher/app.couchtv.launcher.MediaWatch` -
 * Android lets this app see the live media sessions, and a media app already publishes the name, the
 * artwork, the position and the length of what it is showing. This service remembers the last of
 * those per app, so the Keep watching row fills with no computer and no Watch Next.
 *
 * Off until a computer grants notification access (tools/apply.sh), and then it is read-only: only
 * what a media app already publishes, never notification text and never screen content.
 * tools/undo.sh takes the grant back.
 */
class MediaWatch : NotificationListenerService() {
    private val main = Handler(Looper.getMainLooper())
    private val again = Runnable { read(this) }

    override fun onListenerConnected() {
        Log.i("couchtv.mediawatch", "keep watching: notification access is on")
        read(this)
    }

    /** Media apps post and update their notification as they play; one read after the noise settles. */
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        rememberArt(sbn)
        schedule()
    }
    override fun onNotificationRemoved(sbn: StatusBarNotification?) = schedule()

    private fun rememberArt(sbn: StatusBarNotification?) = Companion.rememberArt(sbn, this)

    private fun schedule() {
        main.removeCallbacks(again)
        main.postDelayed(again, SETTLE_MS)
    }

    override fun onDestroy() {
        main.removeCallbacks(again)
        super.onDestroy()
    }

    companion object {
        private const val SETTLE_MS = 1500L
        private const val KEY = "mediaKeep"
        private const val MAX = 10
        private const val DAY = 24L * 60 * 60 * 1000

        /** Past this age an entry nobody has come near the app for is not worth showing. */
        private const val STALE_MS = 14 * DAY
        private const val ART_DIR = "keep"

        /** The notification's own large icon per app: YouTube and others often publish the video
         *  still there while the media session carries no bitmap at all. */
        private val NOTIF_ART = HashMap<String, Bitmap>()

        /** The picture behind one card: what shouldInterceptRequest asks for on the art route. */
        fun artFor(ctx: Context, token: String): ByteArray? {
            val raw = try {
                String(Base64.decode(token, Base64.URL_SAFE or Base64.NO_PADDING), Charsets.UTF_8)
            } catch (e: Exception) { return null }
            if (!raw.startsWith("media://")) return null
            val f = file(ctx, raw)
            return if (f.isFile) runCatching { f.readBytes() }.getOrNull() else null
        }

        /** Android lists this service only while notification access is on; undo.sh's revoke empties the row. */
        private fun listening(ctx: Context): Boolean = try {
            val me = ComponentName(ctx, MediaWatch::class.java).flattenToString()
            val on = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: ""
            on.split(':').any { it.equals(me, true) }
        } catch (e: Exception) { false }

        /**
         * What each media app last showed, newest first, in the shape the Keep watching row and its
         * resume want (id, wn, title, episode_title, season, episode, backdrop, progress, app, package,
         * engaged). A live session wins; an app that has since closed keeps its last entry until it is
         * two weeks old. Empty when notification access has not been granted.
         */
        fun read(ctx: Context): JSONArray {
            if (!listening(ctx)) return JSONArray()
            val byPkg = LinkedHashMap<String, JSONObject>()
            for (o in saved(ctx)) byPkg[o.optString("package")] = o
            for (o in live(ctx)) byPkg[o.optString("package")] = o

            val now = System.currentTimeMillis()
            val list = byPkg.values
                .filter { it.optString("package").isNotEmpty() && now - it.optLong("engaged") < STALE_MS }
                .sortedByDescending { it.optLong("engaged") }
                .take(MAX)

            val out = JSONArray()
            for (o in list) out.put(o)
            save(ctx, out, list.map { it.optString("backdrop") })
            return out
        }

        /** The live media sessions, as Keep watching entries. Android only answers an enabled listener. */
        private fun live(ctx: Context): List<JSONObject> {
            val out = ArrayList<JSONObject>()
            val sm = ctx.getSystemService(Context.MEDIA_SESSION_SERVICE) as? MediaSessionManager ?: return out
            val listener = ComponentName(ctx.packageName, MediaWatch::class.java.name)
            val sessions = try { sm.getActiveSessions(listener) } catch (e: Exception) { return out }
            val now = System.currentTimeMillis()
            for (s in sessions) {
                val pkg = s.packageName ?: continue
                if (pkg == ctx.packageName) continue
                val md = s.metadata ?: continue
                val title = text(md, MediaMetadata.METADATA_KEY_TITLE)
                    ?: text(md, MediaMetadata.METADATA_KEY_DISPLAY_TITLE) ?: continue
                val sub = text(md, MediaMetadata.METADATA_KEY_ARTIST)
                    ?: text(md, MediaMetadata.METADATA_KEY_ALBUM)
                    ?: text(md, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE) ?: ""
                val dur = md.getLong(MediaMetadata.METADATA_KEY_DURATION)
                val pos = s.playbackState?.position?.coerceAtLeast(0L) ?: 0L
                if (dur > 0 && pos >= dur * 0.95) continue          // finished: nothing to keep watching
                val raw = "media://$pkg/${Integer.toHexString((pkg + "\u0000" + title).hashCode())}"
                val bits = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
                    ?: md.getBitmap(MediaMetadata.METADATA_KEY_ART)
                    ?: md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
                    ?: artUri(ctx, md)
                    ?: synchronized(NOTIF_ART) { NOTIF_ART[pkg] }
                if (bits != null) keepArt(ctx, raw, bits)
                val label = try {
                    ctx.packageManager.getApplicationLabel(ctx.packageManager.getApplicationInfo(pkg, 0)).toString()
                } catch (e: Exception) { pkg }
                out.add(JSONObject().apply {
                    put("id", "m:$pkg")                             // a made-up row: OK relaunches the app
                    put("wn", true)
                    put("title", title)
                    put("episode_title", sub)
                    put("season", "")
                    put("episode", "")
                    put("package", pkg)
                    put("engaged", now)
                    if (dur > 0 && pos > 0) put("progress", (pos.toDouble() / dur).coerceIn(0.0, 1.0))
                    put("app", JSONObject().put("package", pkg).put("name", label))
                    if (bits != null) put("backdrop", "http://tvos.invalid/art/" + Base64.encodeToString(
                        raw.toByteArray(Charsets.UTF_8), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING))
                })
            }
            return out
        }

        private fun text(md: MediaMetadata, key: String): String? =
            md.getText(key)?.toString()?.takeIf { it.isNotBlank() }

        /** Some apps publish only an art URI (a local content:// or file:// image), never a bitmap. */
        private fun artUri(ctx: Context, md: MediaMetadata): Bitmap? {
            val u = md.getString(MediaMetadata.METADATA_KEY_ART_URI)
                ?: md.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI) ?: return null
            if (!u.startsWith("content://") && !u.startsWith("file://")) return null
            return try {
                ctx.contentResolver.openInputStream(Uri.parse(u))?.use { BitmapFactory.decodeStream(it) }
            } catch (e: Exception) { null }
        }

        /** Keeps the latest notification large icon for each app, capped so memory cannot grow. */
        private fun rememberArt(sbn: StatusBarNotification?, ctx: Context) {
            val pkg = sbn?.packageName ?: return
            val icon = sbn.notification?.getLargeIcon() ?: return
            try {
                val d = icon.loadDrawable(ctx) ?: return
                val w = d.intrinsicWidth.coerceIn(1, 640)
                val h = d.intrinsicHeight.coerceIn(1, 640)
                val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                d.setBounds(0, 0, w, h)
                d.draw(Canvas(b))
                synchronized(NOTIF_ART) {
                    NOTIF_ART.remove(pkg)
                    NOTIF_ART[pkg] = b
                    while (NOTIF_ART.size > 12) NOTIF_ART.remove(NOTIF_ART.keys.first())
                }
            } catch (e: Exception) {}
        }

        private fun keepArt(ctx: Context, raw: String, bmp: Bitmap) {
            val f = file(ctx, raw)
            if (f.isFile && f.length() > 0) return   // the same track: keep the picture already there
            val bytes = ByteArrayOutputStream().use { o ->
                bmp.compress(Bitmap.CompressFormat.JPEG, 85, o)
                o.toByteArray()
            }
            runCatching { f.writeBytes(bytes) }
        }

        private fun file(ctx: Context, raw: String): File =
            File(File(ctx.filesDir, ART_DIR).apply { mkdirs() }, Integer.toHexString(raw.hashCode()) + ".jpg")

        private fun prefs(ctx: Context) = ctx.getSharedPreferences("home", Context.MODE_PRIVATE)

        private fun saved(ctx: Context): List<JSONObject> {
            val out = ArrayList<JSONObject>()
            try {
                val raw = prefs(ctx).getString(KEY, null) ?: return out
                val a = JSONArray(raw)
                for (i in 0 until a.length()) a.optJSONObject(i)?.let { out.add(it) }
            } catch (e: Exception) {}
            return out
        }

        /** Remembers the list for the next start, so a closed app still shows its last. */
        private fun save(ctx: Context, out: JSONArray, kept: List<String>) {
            try {
                val p = prefs(ctx)
                if (p.getString(KEY, null) == out.toString()) return    // nothing changed: leave the flash alone
                p.edit().putString(KEY, out.toString()).apply()
            } catch (e: Exception) {}
            try {
                val names = kept.mapNotNull { url ->
                    if (!url.contains("/art/")) return@mapNotNull null
                    try {
                        val raw = String(Base64.decode(url.substringAfterLast('/'), Base64.URL_SAFE), Charsets.UTF_8)
                        if (raw.startsWith("media://")) Integer.toHexString(raw.hashCode()) + ".jpg" else null
                    } catch (e: Exception) { null }
                }.toHashSet()
                File(ctx.filesDir, ART_DIR).listFiles()?.forEach { if (it.name !in names) it.delete() }
            } catch (e: Exception) {}
        }
    }
}
