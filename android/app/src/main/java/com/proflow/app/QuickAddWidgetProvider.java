package com.proflow.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * 4×1 home-screen widget with a text field and "Add" button.
 * Typing a task title and tapping Add opens ProFlow's task capture
 * with the title pre-filled (via deep-link query param).
 */
public class QuickAddWidgetProvider extends AppWidgetProvider {

  @Override
  public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
    for (int id : ids) {
      RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_quick_add);

      // Open ProFlow when tapping the Add button or the whole widget
      Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
      if (launch != null) {
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.widget_add_btn, pi);
        rv.setOnClickPendingIntent(R.id.widget_quick_root, pi);
      }

      mgr.updateAppWidget(id, rv);
    }
  }
}
