package com.proflow.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Fires when a scheduled ProFlow reminder alarm goes off — even if the app is
 * closed — and posts the OS notification. Tapping it reopens the app.
 */
public class ReminderReceiver extends BroadcastReceiver {

  private static final String CHANNEL_ID = "proflow-reminders";

  @Override
  public void onReceive(Context context, Intent intent) {
    String id = intent.getStringExtra("id");
    String title = intent.getStringExtra("title");
    String body = intent.getStringExtra("body");
    if (id == null || title == null) return;

    NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

    Notification.Builder builder;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(
          CHANNEL_ID, "ProFlow reminders", NotificationManager.IMPORTANCE_HIGH);
      ch.setDescription("Event and task reminders");
      nm.createNotificationChannel(ch);
      builder = new Notification.Builder(context, CHANNEL_ID);
    } else {
      builder = new Notification.Builder(context);
    }

    Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    PendingIntent contentIntent = PendingIntent.getActivity(
        context, 0, launch,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    Notification notification = builder
        .setContentTitle(title)
        .setContentText(body == null ? "" : body)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setAutoCancel(true)
        .setContentIntent(contentIntent)
        .build();
    nm.notify(id.hashCode() & 0x7fffffff, notification);
  }
}
