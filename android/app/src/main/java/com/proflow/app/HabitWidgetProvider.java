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
 * Interactive habits widget — shows today's habits with checkboxes.
 * Uses a ListView backed by HabitListService for scrollable lists.
 * Tapping an item toggles its done state via HabitItemReceiver.
 */
public class HabitWidgetProvider extends AppWidgetProvider {

  @Override
  public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
    for (int id : ids) {
      RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_habits);

      // Set up the ListView with the service
      Intent serviceIntent = new Intent(ctx, HabitListService.class);
      serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
      serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));
      rv.setRemoteAdapter(R.id.habit_list, serviceIntent);

      // Empty view
      rv.setEmptyView(R.id.habit_list, R.id.empty_text);

      // Click intent for list items — routed to HabitItemReceiver
      Intent clickIntent = new Intent(ctx, HabitItemReceiver.class);
      clickIntent.setAction("com.proflow.app.HABIT_TOGGLE");
      PendingIntent clickPending = PendingIntent.getBroadcast(
          ctx, 0, clickIntent,
          PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
      rv.setPendingIntentTemplate(R.id.habit_list, clickPending);

      // Habit count
      SharedPreferences prefs = ctx.getSharedPreferences(HabitItemReceiver.PREFS, Context.MODE_PRIVATE);
      String data = prefs.getString(HabitItemReceiver.KEY_HABITS, "");
      int total = data.isEmpty() ? 0 : data.split("\n").length;
      int doneCount = 0;
      if (!data.isEmpty()) {
        for (String line : data.split("\n")) {
          String[] parts = line.split("\\|", 4);
          if (parts.length >= 3 && "true".equals(parts[2])) doneCount++;
        }
      }
      rv.setTextViewText(R.id.habit_count, doneCount + "/" + total + " done");

      // Tap header → open ProFlow
      Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
      if (launch != null) {
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.widget_header, pi);
      }

      mgr.updateAppWidget(id, rv);
    }
  }

  @Override
  public void onReceive(Context ctx, Intent intent) {
    super.onReceive(ctx, intent);
    // Force widget refresh on data changes
    if ("com.proflow.app.HABIT_WIDGET_SYNC".equals(intent.getAction())) {
      AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
      ComponentName cn = new ComponentName(ctx, HabitWidgetProvider.class);
      int[] ids = mgr.getAppWidgetIds(cn);
      for (int id : ids) {
        mgr.notifyAppWidgetViewDataChanged(id, R.id.habit_list);
      }
    }
  }
}
