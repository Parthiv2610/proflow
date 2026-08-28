package com.proflow.app;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * Handles habit toggle clicks from the widget.
 * Data format in SharedPreferences: newline-separated "id|name|done|streak"
 * Example: "h-123|Exercise|true|5\nh-456|Read|false|12"
 */
public class HabitItemReceiver extends BroadcastReceiver {

  static final String PREFS = "proflow-habits-widget";
  static final String KEY_HABITS = "habits_data";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (!"com.proflow.app.HABIT_TOGGLE".equals(intent.getAction())) return;

    String habitId = intent.getStringExtra("habit_id");
    if (habitId == null) return;

    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    String data = prefs.getString(KEY_HABITS, "");
    String updated = toggleHabit(data, habitId);
    prefs.edit().putString(KEY_HABITS, updated).apply();

    // Signal WebView to sync
    Intent sync = new Intent("com.proflow.app.HABIT_WIDGET_SYNC");
    sync.putExtra("habit_id", habitId);
    context.sendBroadcast(sync);

    refreshAll(context);
  }

  /** Toggle done flag for the given habit id. Format: id|name|done|streak per line. */
  static String toggleHabit(String data, String habitId) {
    String[] lines = data.split("\n");
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < lines.length; i++) {
      String line = lines[i];
      if (line.startsWith(habitId + "|")) {
        String[] parts = line.split("\\|", 4);
        if (parts.length >= 4) {
          boolean done = "true".equals(parts[2]);
          parts[2] = done ? "false" : "true";
          line = parts[0] + "|" + parts[1] + "|" + parts[2] + "|" + parts[3];
        }
      }
      sb.append(line);
      if (i < lines.length - 1) sb.append("\n");
    }
    return sb.toString();
  }

  private void refreshAll(Context context) {
    AppWidgetManager mgr = AppWidgetManager.getInstance(context);
    ComponentName cn = new ComponentName(context, HabitWidgetProvider.class);
    int[] ids = mgr.getAppWidgetIds(cn);
    if (ids.length > 0) {
      Intent i = new Intent(context, HabitWidgetProvider.class);
      i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
      context.sendBroadcast(i);
    }
  }
}
