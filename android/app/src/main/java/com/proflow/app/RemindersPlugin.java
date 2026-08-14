package com.proflow.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.HashSet;
import java.util.Set;

/**
 * OS notification reminders for Android. The Capacitor WebView has no web
 * Notification API, so real "ping me before my event" alerts are scheduled
 * through the OS AlarmManager: the JS side calls {@code schedule()} for
 * upcoming calendar events, and the alarm fires — posting a system
 * notification — even when ProFlow is closed. Scheduled ids are mirrored in
 * SharedPreferences so {@code cancelAll()} can clean up after a data reset.
 */
@CapacitorPlugin(
    name = "Reminders",
    permissions = {
      @Permission(alias = "notifications", strings = {"android.permission.POST_NOTIFICATIONS"})
    })
public class RemindersPlugin extends Plugin {

  private static final String CHANNEL_ID = "proflow-reminders";
  private static final String PREFS_NAME = "proflow-reminders";
  private static final String KEY_IDS = "scheduled-ids";

  private SharedPreferences prefs() {
    return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
  }

  private Set<String> scheduledIds() {
    return new HashSet<>(prefs().getStringSet(KEY_IDS, new HashSet<String>()));
  }

  private void saveIds(Set<String> ids) {
    prefs().edit().putStringSet(KEY_IDS, ids).apply();
  }

  /** Create the notification channel (Android 8+); harmless if it exists. */
  private void ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = getContext().getSystemService(NotificationManager.class);
    NotificationChannel ch = new NotificationChannel(
        CHANNEL_ID, "ProFlow reminders", NotificationManager.IMPORTANCE_HIGH);
    ch.setDescription("Event and task reminders");
    nm.createNotificationChannel(ch);
  }

  /** Stable alarm/notification id derived from the reminder id string. */
  private int notifId(String id) {
    return (id != null ? id.hashCode() : 0) & 0x7fffffff;
  }

  private boolean notificationsGranted() {
    if (Build.VERSION.SDK_INT < 33) return true;
    return getContext().checkSelfPermission("android.permission.POST_NOTIFICATIONS")
        == android.content.pm.PackageManager.PERMISSION_GRANTED;
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
   * Schedule a one-shot reminder at {@code at} (epoch millis). Alarms fire
   * through {@link ReminderReceiver} even when the app is closed. Exact alarms
   * need SCHEDULE_EXACT_ALARM on Android 12+; when unavailable we fall back to
   * a flexible alarm (fires within ~10 minutes of the target), so reminders
   * still work without the user granting the strict permission.
   */
  @PluginMethod
  public void schedule(PluginCall call) {
    String id = call.getString("id");
    String title = call.getString("title");
    String body = call.getString("body");
    Double at = call.getDouble("at");
    if (id == null || title == null || at == null) {
      call.reject("id, title and at are required");
      return;
    }
    ensureChannel();
    long when = at.longValue();
    if (when <= System.currentTimeMillis()) {
      call.resolve(); // already past — nothing to schedule
      return;
    }
    AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
    Intent intent = new Intent(getContext(), ReminderReceiver.class);
    intent.putExtra("id", id);
    intent.putExtra("title", title);
    intent.putExtra("body", body == null ? "" : body);
    PendingIntent pi = PendingIntent.getBroadcast(
        getContext(), notifId(id), intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
    } else {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
    }

    Set<String> ids = scheduledIds();
    ids.add(id);
    saveIds(ids);
    call.resolve();
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    String id = call.getString("id");
    if (id == null) {
      call.reject("id is required");
      return;
    }
    cancelOne(id);
    call.resolve();
  }

  @PluginMethod
  public void cancelAll(PluginCall call) {
    for (String id : scheduledIds()) cancelOne(id);
    saveIds(new HashSet<String>());
    call.resolve();
  }

  private void cancelOne(String id) {
    AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
    Intent intent = new Intent(getContext(), ReminderReceiver.class);
    PendingIntent pi = PendingIntent.getBroadcast(
        getContext(), notifId(id), intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    am.cancel(pi);
    NotificationManager nm = getContext().getSystemService(NotificationManager.class);
    nm.cancel(notifId(id));
    Set<String> ids = scheduledIds();
    ids.remove(id);
    saveIds(ids);
  }
}
