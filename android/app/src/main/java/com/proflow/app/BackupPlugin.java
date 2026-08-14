package com.proflow.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * File saving for Android. The browser-style download (Blob + &lt;a download&gt;)
 * is silently ignored by the Capacitor WebView, so every file the app needs to
 * hand the user goes through this plugin instead:
 *
 *  - {@link #saveBackup} — the Settings "Export data" JSON backup.
 *  - {@link #saveAttachment} — file attachments in notes (base64 data URLs).
 *
 * Both use the same strategy: Android 10+ (API 29) inserts the file into the
 * Downloads collection via MediaStore — no permission needed, and it shows up
 * in the Files/Downloads app like any normal download. Android 9 and older
 * opens the system "Save to…" picker (Storage Access Framework), where the
 * user chooses where to keep the file.
 */
@CapacitorPlugin(name = "Backup")
public class BackupPlugin extends Plugin {

  private String pendingContent;
  // Attachment variant of the pending save (API < 29 picker flow) — kept
  // separate so a backup export and an attachment save can't clobber each
  // other's pending state.
  private byte[] pendingAttachmentBytes;

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

  /**
   * Save a note attachment to the device. The attachment is stored in the app
   * as a base64 data URL ({@code data:<mime>;base64,....}) — this decodes it
   * and writes the raw bytes, the same way the JSON backup is written. Returns
   * the saved location.
   */
  @PluginMethod
  public void saveAttachment(PluginCall call) {
    String fileName = call.getString("fileName");
    String mimeType = call.getString("mimeType");
    String base64 = call.getString("base64");
    if (fileName == null || fileName.isEmpty() || base64 == null || base64.isEmpty()) {
      call.reject("fileName and base64 are required");
      return;
    }
    // Strip a possible "data:<mime>;base64," prefix so raw base64 works too.
    int comma = base64.indexOf(',');
    if (base64.startsWith("data:") && comma >= 0) {
      base64 = base64.substring(comma + 1);
    }
    if (mimeType == null || mimeType.isEmpty()) {
      mimeType = guessMime(fileName);
    }
    final byte[] bytes;
    try {
      bytes = Base64.decode(base64, Base64.DEFAULT);
    } catch (IllegalArgumentException e) {
      call.reject("Attachment data is not valid base64", e);
      return;
    }
    if (bytes.length == 0) {
      call.reject("Attachment is empty");
      return;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      saveBytesToDownloads(call, fileName, mimeType, bytes);
      return;
    }

    // Older Android: system "Save to…" picker.
    if (pendingAttachmentBytes != null) {
      call.reject("A save is already in progress");
      return;
    }
    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType(mimeType);
    intent.putExtra(Intent.EXTRA_TITLE, fileName);
    pendingAttachmentBytes = bytes;
    startActivityForResult(call, intent, "attachmentSaveResult");
  }

  @ActivityCallback
  private void saveResult(PluginCall call, ActivityResult result) {
    try {
      if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
        call.reject("Export cancelled");
        return;
      }
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
      // Always clear the pending state — including the cancel path, so a
      // dismissed picker can't block the next export.
      pendingContent = null;
    }
  }

  @ActivityCallback
  private void attachmentSaveResult(PluginCall call, ActivityResult result) {
    try {
      if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
        call.reject("Save cancelled");
        return;
      }
      Uri uri = result.getData().getData();
      try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
        if (os == null) throw new Exception("Cannot open file for writing");
        os.write(pendingAttachmentBytes);
      }
      JSObject ret = new JSObject();
      ret.put("path", uri.toString());
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("Save failed: " + e.getMessage(), e);
    } finally {
      // Always clear the pending state — including the cancel path, so a
      // dismissed picker can't block the next save.
      pendingAttachmentBytes = null;
    }
  }

  private void saveToDownloads(PluginCall call, String fileName, String content) {
    saveBytesToDownloads(call, fileName, "application/json", content.getBytes(StandardCharsets.UTF_8));
  }

  private void saveBytesToDownloads(PluginCall call, String fileName, String mimeType, byte[] bytes) {
    try {
      ContentValues values = new ContentValues();
      values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
      values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
      values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
      Uri uri = getContext().getContentResolver().insert(
          MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
      if (uri == null) {
        call.reject("Could not create the file in Downloads");
        return;
      }
      try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
        if (os == null) throw new Exception("Cannot open file for writing");
        os.write(bytes);
      }
      JSObject ret = new JSObject();
      ret.put("path", "Downloads/" + fileName);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("Save failed: " + e.getMessage(), e);
    }
  }

  /** Best-effort MIME guess for common attachment types. */
  private String guessMime(String fileName) {
    String lower = fileName.toLowerCase(Locale.ROOT);
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".txt")) return "text/plain";
    if (lower.endsWith(".md")) return "text/markdown";
    if (lower.endsWith(".json")) return "application/json";
    if (lower.endsWith(".csv")) return "text/csv";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    if (lower.endsWith(".zip")) return "application/zip";
    if (lower.endsWith(".doc")) return "application/msword";
    if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
    if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
    if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (lower.endsWith(".mp3")) return "audio/mpeg";
    if (lower.endsWith(".mp4")) return "video/mp4";
    return "application/octet-stream";
  }
}
