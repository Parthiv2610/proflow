package com.proflow.app;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * Handles task toggle clicks from the widget.
 * Data format: newline-separated "id|title|done|priority"
 * Priority: low, medium, high
 */
public class TaskItemReceiver extends BroadcastReceiver {

  static final String PREFS = "proflow-tasks-widget";
  static final String KEY_TASKS = "tasks_data";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (!"com.proflow.app.TASK_TOGGLE".equals(intent.getAction())) return;

    String taskId = intent.getStringExtra("task_id");
    if (taskId == null) return;

    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    String data = prefs.getString(KEY_TASKS, "");
    String updated = toggleTask(data, taskId);
    prefs.edit().putString(KEY_TASKS, updated).apply();

    // Signal WebView
    Intent sync = new Intent("com.proflow.app.TASK_WIDGET_SYNC");
    sync.putExtra("task_id", taskId);
    context.sendBroadcast(sync);

    refreshAll(context);
  }

  static String toggleTask(String data, String taskId) {
    String[] lines = data.split("\n");
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < lines.length; i++) {
      String line = lines[i];
      if (line.startsWith(taskId + "|")) {
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
    ComponentName cn = new ComponentName(context, TaskWidgetProvider.class);
    int[] ids = mgr.getAppWidgetIds(cn);
    if (ids.length > 0) {
      Intent i = new Intent(context, TaskWidgetProvider.class);
      i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
      context.sendBroadcast(i);
    }
  }
}
