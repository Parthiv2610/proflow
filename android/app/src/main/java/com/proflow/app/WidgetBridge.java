package com.proflow.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that lets the WebView push today's summary data
 * (tasks done, habits done, focus minutes, pending task titles) into
 * SharedPreferences so the native home-screen widgets can read it.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {

  static final String PREFS = "proflow-widgets";
  static final String KEY_TASKS_DONE = "tasks_done";
  static final String KEY_HABITS_DONE = "habits_done";
  static final String KEY_FOCUS_MINUTES = "focus_minutes";
  static final String KEY_PENDING_TASKS = "pending_tasks"; // newline-separated titles
  static final String KEY_STREAK = "streak";

  @PluginMethod
  public void updateToday(PluginCall call) {
    Integer tasksDone = call.getInt("tasksDone", 0);
    Integer habitsDone = call.getInt("habitsDone", 0);
    Integer focusMinutes = call.getInt("focusMinutes", 0);
    Integer streak = call.getInt("streak", 0);
    String pendingTasks = call.getString("pendingTasks", "");

    SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    prefs.edit()
        .putInt(KEY_TASKS_DONE, tasksDone)
        .putInt(KEY_HABITS_DONE, habitsDone)
        .putInt(KEY_FOCUS_MINUTES, focusMinutes)
        .putInt(KEY_STREAK, streak)
        .putString(KEY_PENDING_TASKS, pendingTasks)
        .apply();

    // Tell both widget providers to refresh
    refreshWidgets();

    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  private void refreshWidgets() {
    Context ctx = getContext();
    AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);

    // Refresh today widget
    ComponentName today = new ComponentName(ctx, TodayWidgetProvider.class);
    int[] todayIds = mgr.getAppWidgetIds(today);
    if (todayIds.length > 0) {
      Intent intent = new Intent(ctx, TodayWidgetProvider.class);
      intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, todayIds);
      ctx.sendBroadcast(intent);
    }

    // Refresh quick-add widget
    ComponentName quick = new ComponentName(ctx, QuickAddWidgetProvider.class);
    int[] quickIds = mgr.getAppWidgetIds(quick);
    if (quickIds.length > 0) {
      Intent intent = new Intent(ctx, QuickAddWidgetProvider.class);
      intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, quickIds);
      ctx.sendBroadcast(intent);
    }
  }
}
