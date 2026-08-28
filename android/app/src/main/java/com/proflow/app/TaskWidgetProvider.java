package com.proflow.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Interactive tasks widget — shows tasks with checkboxes and an "Add" button.
 * Uses TaskListService for the scrollable list.
 */
public class TaskWidgetProvider extends AppWidgetProvider {

  @Override
  public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
    for (int id : ids) {
      RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_tasks);

      // ListView
      Intent serviceIntent = new Intent(ctx, TaskListService.class);
      serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
      serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));
      rv.setRemoteAdapter(R.id.task_list, serviceIntent);
      rv.setEmptyView(R.id.task_list, R.id.empty_text);

      // Click intent for list items
      Intent clickIntent = new Intent(ctx, TaskItemReceiver.class);
      clickIntent.setAction("com.proflow.app.TASK_TOGGLE");
      PendingIntent clickPending = PendingIntent.getBroadcast(
          ctx, 0, clickIntent,
          PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
      rv.setPendingIntentTemplate(R.id.task_list, clickPending);

      // Task count
      SharedPreferences prefs = ctx.getSharedPreferences(TaskItemReceiver.PREFS, Context.MODE_PRIVATE);
      String data = prefs.getString(TaskItemReceiver.KEY_TASKS, "");
      int total = data.isEmpty() ? 0 : data.split("\n").length;
      int doneCount = 0;
      if (!data.isEmpty()) {
        for (String line : data.split("\n")) {
          String[] parts = line.split("\\|", 4);
          if (parts.length >= 3 && "true".equals(parts[2])) doneCount++;
        }
      }
      rv.setTextViewText(R.id.task_count, doneCount + "/" + total + " done");

      // Add button → open ProFlow
      Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
      if (launch != null) {
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id + 1000, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.add_task_btn, pi);
        // Header tap also opens app
        rv.setOnClickPendingIntent(R.id.widget_header, pi);
      }

      mgr.updateAppWidget(id, rv);
    }
  }

  @Override
  public void onReceive(Context ctx, Intent intent) {
    super.onReceive(ctx, intent);
    if ("com.proflow.app.TASK_WIDGET_SYNC".equals(intent.getAction())) {
      AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
      ComponentName cn = new ComponentName(ctx, TaskWidgetProvider.class);
      int[] ids = mgr.getAppWidgetIds(cn);
      for (int id : ids) {
        mgr.notifyAppWidgetViewDataChanged(id, R.id.task_list);
      }
    }
  }
}
