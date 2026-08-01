package com.proflow.app;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-place APK self-update: the app downloads the newest APK to its cache and
 * hands it to the Android system installer. Because the APK is signed with the
 * same keystore, Android installs it OVER the current version — app data
 * (tasks, habits, notes, settings) is preserved. No uninstall, no Play Store.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

  @PluginMethod
  public void getAppInfo(PluginCall call) {
    try {
      // Read from PackageManager, not BuildConfig: AGP 8+ disables BuildConfig
      // generation by default, so referencing it would fail to compile.
      android.content.pm.PackageInfo info =
          getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
      JSObject ret = new JSObject();
      ret.put("versionName", info.versionName);
      ret.put("versionCode", info.getLongVersionCode());
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("Failed to read app version", e);
    }
  }

  /**
   * Download the APK at {@code url} and open the system installer for it.
   * Resolves once the installer intent has been fired.
   */
  @PluginMethod
  public void installUpdate(PluginCall call) {
    String url = call.getString("url");
    if (url == null || url.isEmpty()) {
      call.reject("url is required");
      return;
    }
    call.setKeepAlive(true);
    new Thread(() -> {
      try {
        File apk = download(url);
        Uri apkUri = FileProvider.getUriForFile(
            getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
      } catch (Exception e) {
        call.reject("Download/install failed: " + e.getMessage(), e);
      }
    }).start();
  }

  private File download(String urlStr) throws Exception {
    File out = new File(getContext().getCacheDir(), "proflow-update.apk");
    HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
    conn.setInstanceFollowRedirects(true); // GitHub asset URLs redirect to CDN
    conn.setConnectTimeout(20000);
    conn.setReadTimeout(120000);
    try (InputStream in = conn.getInputStream();
         FileOutputStream fos = new FileOutputStream(out)) {
      byte[] buf = new byte[8192];
      int n;
      while ((n = in.read(buf)) != -1) fos.write(buf, 0, n);
    } finally {
      conn.disconnect();
    }
    return out;
  }
}
