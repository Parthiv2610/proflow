package com.proflow.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * 4×2 home-screen widget that shows today's summary:
 * tasks done, habits done, focus minutes, and a short list
 * of pending tasks. Tapping the header opens ProFlow.
 */
public class TodayWidgetProvider extends AppWidgetProvider {

  @Override
  public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
    SharedPreferences prefs = ctx.getSharedPreferences(WidgetBridge.PREFS, Context.MODE_PRIVATE);
    int tasksDone = prefs.getInt(WidgetBridge.KEY_TASKS_DONE, 0);
    int habitsDone = prefs.getInt(WidgetBridge.KEY_HABITS_DONE, 0);
    int focusMin = prefs.getInt(WidgetBridge.KEY_FOCUS_MINUTES, 0);
    int streak = prefs.getInt(WidgetBridge.KEY_STREAK, 0);
    String pending = prefs.getString(WidgetBridge.KEY_PENDING_TASKS, "");

    for (int id : ids) {
      RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_today);

      // Stats
      rv.setTextViewText(R.id.widget_tasks_done, String.valueOf(tasksDone));
      rv.setTextViewText(R.id.widget_habits_done, String.valueOf(habitsDone));
      int hours = focusMin / 60;
      int mins = focusMin % 60;
      rv.setTextViewText(R.id.widget_focus, hours > 0
          ? hours + "h " + mins + "m"
          : mins + "m");
      rv.setTextViewText(R.id.widget_streak, streak + " day streak");

      // Pending tasks list (up to 4)
      String[] lines = pending.isEmpty() ? new String[0] : pending.split("\n");
      StringBuilder sb = new StringBuilder();
      int count = Math.min(lines.length, 4);
      for (int i = 0; i < count; i++) {
        sb.append("• ").append(lines[i].trim());
        if (i < count - 1) sb.append("\n");
      }
      if (lines.length > 4) sb.append("\n… +").append(lines.length - 4).append(" more");
      if (lines.length == 0) sb.append("All done! 🎉");
      rv.setTextViewText(R.id.widget_pending, sb.toString());

      // Tap header → open ProFlow
      Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
      if (launch != null) {
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.widget_header, pi);
        // Also make the body tappable
        rv.setOnClickPendingIntent(R.id.widget_body, pi);
      }

      mgr.updateAppWidget(id, rv);
    }
  }
}
