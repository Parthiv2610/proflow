package com.proflow.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Posts immediate OS notifications on Android. The Capacitor WebView has no
 * web Notification API, so in-app toasts are the only channel unless we post
 * through the system NotificationManager directly. This plugin creates a
 * separate "general" channel (distinct from the scheduled-reminders channel)
 * for non-reminders like achievement unlocked, task completed, level up, etc.
 */
@CapacitorPlugin(
    name = "Notification",
    permissions = {
      @Permission(alias = "notifications", strings = {"android.permission.POST_NOTIFICATIONS"})
    })
public class NotificationPlugin extends Plugin {

  private static final String CHANNEL_ID = "proflow-notifications";
  private static final String CHANNEL_NAME = "ProFlow notifications";
  private static int notifCounter = 10000;

  private void ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = getContext().getSystemService(NotificationManager.class);
    NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT);
    channel.setDescription("General app notifications — achievements, task reminders, and more");
    nm.createNotificationChannel(channel);
  }

  private boolean notificationsGranted() {
    if (Build.VERSION.SDK_INT < 33) return true;
    return getContext().checkSelfPermission("android.permission.POST_NOTIFICATIONS")
        == PackageManager.PERMISSION_GRANTED;
  }

  @PluginMethod
  public void requestPermission(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 33) {
      requestPermissionForAlias("notifications", call, "permissionCallback");
    } else {
      JSObject ret = new JSObject();
      ret.put("granted", true);
      call.resolve(ret);
    }
  }

  @PermissionCallback
  private void permissionCallback(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("granted", notificationsGranted());
    call.resolve(ret);
  }

  @PluginMethod
  public void hasPermission(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("granted", notificationsGranted());
    call.resolve(ret);
  }

  /**
   * Post an immediate OS notification. Shows in the system notification tray
   * and on the lock screen (on supported devices). Tapping reopens the app.
   */
  @PluginMethod
  public void notify(PluginCall call) {
    String title = call.getString("title", "ProFlow");
    String body = call.getString("body", "");
    if (!notificationsGranted()) {
      call.reject("Notification permission not granted");
      return;
    }

    ensureChannel();

    Context ctx = getContext();
    NotificationManager nm = ctx.getSystemService(NotificationManager.class);

    Intent launchIntent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
    PendingIntent contentIntent = PendingIntent.getActivity(
        ctx, 0, launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    Notification.Builder builder;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      builder = new Notification.Builder(ctx, CHANNEL_ID);
    } else {
      builder = new Notification.Builder(ctx);
    }

    Notification notification = builder
        .setContentTitle(title)
        .setContentText(body)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setAutoCancel(true)
        .setContentIntent(contentIntent)
        .setStyle(new Notification.BigTextStyle().bigText(body))
        .build();

    int id = notifCounter++ % 100000 + 20000;  // offset to avoid clashing with reminder IDs
    nm.notify(id, notification);

    JSObject ret = new JSObject();
    ret.put("id", id);
    call.resolve(ret);
  }
}
