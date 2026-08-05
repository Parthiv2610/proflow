package com.proflow.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Backup export for Android. The browser-style download (Blob + &lt;a download&gt;)
 * is silently ignored by the Capacitor WebView, so the Settings "Export data"
 * button writes the JSON through this plugin instead:
 *  - Android 10+ (API 29): inserts the file into the Downloads collection via
 *    MediaStore — no permission needed, and it shows up in the Files/Downloads
 *    app like any normal download.
 *  - Android 9 and older: opens the system "Save to…" picker (Storage Access
 *    Framework), where the user chooses where to keep the file.
 */
@CapacitorPlugin(name = "Backup")
public class BackupPlugin extends Plugin {

  private String pendingContent;

  @PluginMethod
  public void saveBackup(PluginCall call) {
    String fileName = call.getString("fileName");
    String content = call.getString("content");
    if (fileName == null || fileName.isEmpty() || content == null) {
      call.reject("fileName and content are required");
      return;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      saveToDownloads(call, fileName, content);
      return;
    }

    // Older Android: let the user pick a location (no storage permission needed).
    // Guard against a double-tap starting a second picker before the first result.
    if (pendingContent != null) {
      call.reject("A save is already in progress");
      return;
    }
    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("application/json");
    intent.putExtra(Intent.EXTRA_TITLE, fileName);
    pendingContent = content;
    startActivityForResult(call, intent, "saveResult");
  }

  @ActivityCallback
  private void saveResult(PluginCall call, ActivityResult result) {
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
      call.reject("Export cancelled");
      return;
    }
    try {
      Uri uri = result.getData().getData();
      try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
        if (os == null) throw new Exception("Cannot open file for writing");
        os.write(pendingContent.getBytes(StandardCharsets.UTF_8));
      }
      JSObject ret = new JSObject();
      ret.put("path", uri.toString());
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("Export failed: " + e.getMessage(), e);
    } finally {
      pendingContent = null;
    }
  }

  private void saveToDownloads(PluginCall call, String fileName, String content) {
    try {
      ContentValues values = new ContentValues();
      values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
      values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
      values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
      Uri uri = getContext().getContentResolver().insert(
          MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
      if (uri == null) {
        call.reject("Could not create the backup file in Downloads");
        return;
      }
      try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
        if (os == null) throw new Exception("Cannot open file for writing");
        os.write(content.getBytes(StandardCharsets.UTF_8));
      }
      JSObject ret = new JSObject();
      ret.put("path", "Downloads/" + fileName);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("Export failed: " + e.getMessage(), e);
    }
  }
}
