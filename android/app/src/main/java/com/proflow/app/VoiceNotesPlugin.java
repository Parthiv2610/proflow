package com.proflow.app;

import android.Manifest;
import android.app.Activity;
import android.media.MediaRecorder;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Voice note recording for Android. The Capacitor WebView's getUserMedia /
 * MediaRecorder support is unreliable, so recordings are captured natively
 * with the system MediaRecorder (AAC in an MP4 container) and handed back to
 * the web layer as a base64 data URL — the same storage model as image and
 * file attachments in notes.
 *
 * The JS wrapper (lib/voice.ts) requests the microphone permission through
 * {@link #requestPermission} before calling {@link #start}. Recordings are
 * capped at 60 seconds on both sides (JS auto-stops; {@link #start} sets
 * MediaRecorder's max duration as a backstop). The temp file lives in the app
 * cache and is deleted as soon as it's handed to JS.
 */
@CapacitorPlugin(
    name = "VoiceNotes",
    permissions = {
      @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "microphone")
    })
public class VoiceNotesPlugin extends Plugin {

  private MediaRecorder recorder;
  private File outputFile;
  private long startedAt;

  @PluginMethod
  public void checkPermission(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("state", getPermissionState("microphone").toString());
    call.resolve(ret);
  }

  @PluginMethod
  public void requestPermission(PluginCall call) {
    requestPermissionForAlias("microphone", call, "permissionCallback");
  }

  @PermissionCallback
  private void permissionCallback(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("state", getPermissionState("microphone").toString());
    call.resolve(ret);
  }

  @PluginMethod
  public void start(PluginCall call) {
    if (recorder != null) {
      call.reject("A recording is already in progress");
      return;
    }
    try {
      File dir = getContext().getCacheDir();
      outputFile = new File(dir, "voice-" + System.currentTimeMillis() + ".m4a");
      MediaRecorder r;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        r = new MediaRecorder(getContext());
      } else {
        r = new MediaRecorder();
      }
      r.setAudioSource(MediaRecorder.AudioSource.MIC);
      r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
      r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
      r.setAudioSamplingRate(44100);
      r.setAudioEncodingBitRate(64_000);
      // No setMaxDuration here: the JS side auto-stops at 60s, and a native
      // auto-stop would race the JS stop() and throw IllegalStateException
      // (discarding a completed recording at the exact boundary).
      r.setOutputFile(outputFile.getAbsolutePath());
      r.prepare();
      r.start();
      recorder = r;
      startedAt = System.currentTimeMillis();
      call.resolve(new JSObject().put("started", true));
    } catch (Exception e) {
      recorder = null;
      if (outputFile != null) outputFile.delete();
      call.reject("Could not start recording: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void stop(PluginCall call) {
    if (recorder == null) {
      call.reject("No recording in progress");
      return;
    }
    final long durationMs = System.currentTimeMillis() - startedAt;
    final File file = outputFile;
    MediaRecorder r = recorder;
    recorder = null;
    try {
      r.stop();
      r.release();
    } catch (RuntimeException e) {
      // MediaRecorder throws if the clip is too short to finalize — discard.
      r.release();
      if (file != null) file.delete();
      call.reject("Recording was too short", e);
      return;
    }

    // Read + base64 on a worker thread so a long clip can't jank the UI, then
    // resolve on the UI thread (Capacitor results must be delivered there). The
    // activity can be gone during teardown — fall back to a direct resolve.
    final Activity activity = getActivity();
    final ExecutorService pool = Executors.newSingleThreadExecutor();
    pool.execute(() -> {
      try {
        byte[] bytes = readAll(file);
        String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
        JSObject ret = new JSObject();
        ret.put("dataUrl", "data:audio/mp4;base64," + b64);
        ret.put("mime", "audio/mp4");
        ret.put("durationMs", durationMs);
        ret.put("size", bytes.length);
        if (activity != null) {
          activity.runOnUiThread(() -> call.resolve(ret));
        } else {
          call.resolve(ret);
        }
      } catch (IOException e) {
        if (activity != null) {
          activity.runOnUiThread(() -> call.reject("Could not read recording: " + e.getMessage(), e));
        } else {
          call.reject("Could not read recording: " + e.getMessage(), e);
        }
      } finally {
        if (file != null) file.delete();
        pool.shutdown();
      }
    });
  }

  private byte[] readAll(File file) throws IOException {
    try (FileInputStream in = new FileInputStream(file)) {
      byte[] buf = new byte[(int) file.length()];
      int off = 0;
      while (off < buf.length) {
        int n = in.read(buf, off, buf.length - off);
        if (n < 0) break;
        off += n;
      }
      return buf;
    }
  }
}
