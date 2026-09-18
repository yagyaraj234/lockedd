package com.yagyaraj.locked

import android.app.Activity
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import expo.modules.appblocker.PhoneLockScheduler

class WallpaperPickerActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (savedInstanceState == null) {
      @Suppress("DEPRECATION")
      startActivityForResult(
        Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "image/*"
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        },
        PICK_WALLPAPER
      )
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != PICK_WALLPAPER) return

    val uri = data?.data
    if (resultCode != RESULT_OK || uri == null) {
      finish()
      return
    }
    if (!isImage(uri)) {
      Toast.makeText(this, "Choose a valid image", Toast.LENGTH_SHORT).show()
      finish()
      return
    }

    try {
      contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      val prefs = getSharedPreferences(PhoneLockScheduler.PREFS_FILE, MODE_PRIVATE)
      val previous = prefs.getString(PhoneLockScheduler.CUSTOM_WALLPAPER_URI, null)
      prefs.edit()
        .putString(PhoneLockScheduler.CUSTOM_WALLPAPER_URI, uri.toString())
        .putString(PhoneLockScheduler.OVERLAY_DESIGN, "custom")
        .apply()
      PhoneLockScheduler.notifyLockChanged(this)
      if (previous != null && previous != uri.toString()) {
        try {
          contentResolver.releasePersistableUriPermission(
            Uri.parse(previous),
            Intent.FLAG_GRANT_READ_URI_PERMISSION
          )
        } catch (_: Exception) {}
      }
      Toast.makeText(this, "Custom wallpaper imported", Toast.LENGTH_SHORT).show()
    } catch (_: SecurityException) {
      Toast.makeText(this, "Could not keep access to that image", Toast.LENGTH_SHORT).show()
    }
    finish()
  }

  private fun isImage(uri: Uri): Boolean {
    if (contentResolver.getType(uri)?.startsWith("image/") != true) return false
    return try {
      contentResolver.openInputStream(uri)?.use {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeStream(it, null, bounds)
        bounds.outWidth > 0 && bounds.outHeight > 0
      } == true
    } catch (_: Exception) {
      false
    }
  }

  companion object {
    private const val PICK_WALLPAPER = 4201
  }
}
