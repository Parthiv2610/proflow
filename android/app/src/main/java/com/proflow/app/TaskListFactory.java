package com.proflow.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

/**
 * Factory for task items in the scrollable widget.
 * Data format: newline-separated "id|title|done|priority"
 */
public class TaskListFactory implements RemoteViewsService.RemoteViewsFactory {

  private final Context context;
  private String[] items;

  public TaskListFactory(Context context) {
    this.context = context;
    loadItems();
  }

  private void loadItems() {
    SharedPreferences prefs = context.getSharedPreferences(TaskItemReceiver.PREFS, Context.MODE_PRIVATE);
    String data = prefs.getString(TaskItemReceiver.KEY_TASKS, "");
    if (data.isEmpty()) {
      items = new String[0];
    } else {
      items = data.split("\n");
    }
  }

  @Override public void onCreate() {}
  @Override public void onDestroy() {}
  @Override public void onDataSetChanged() { loadItems(); }
  @Override public int getCount() { return items.length; }
  @Override public long getItemId(int position) { return position; }
  @Override public boolean hasStableIds() { return false; }

  @Override
  public RemoteViews getViewAt(int position) {
    if (position < 0 || position >= items.length) return null;

    String[] parts = items[position].split("\\|", 4);
    String id = parts.length > 0 ? parts[0] : "";
    String title = parts.length > 1 ? parts[1] : "Task";
    boolean done = parts.length > 2 && "true".equals(parts[2]);
    String priority = parts.length > 3 ? parts[3] : "medium";

    RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_task_item);

    // Checkbox
    if (done) {
      rv.setInt(R.id.task_checkbox, "setBackgroundResource", R.drawable.widget_task_checked_bg);
      rv.setTextViewText(R.id.task_checkbox, "✓");
      rv.setTextColor(R.id.task_checkbox, 0xFFFFFFFF);
      rv.setTextColor(R.id.task_title, 0xFF9CA3AF); // muted
    } else {
      rv.setInt(R.id.task_checkbox, "setBackgroundResource", R.drawable.widget_task_unchecked_bg);
      rv.setTextViewText(R.id.task_checkbox, "");
      rv.setTextColor(R.id.task_title, 0xFFE5E7EB);
    }

    rv.setTextViewText(R.id.task_title, title);

    // Priority indicator
    int pColor;
    String pLabel;
    if ("high".equals(priority)) {
      pColor = 0xFFEF4444;
      pLabel = "HIGH";
    } else if ("low".equals(priority)) {
      pColor = 0xFF6B7280;
      pLabel = "LOW";
    } else {
      pColor = 0xFF60A5FA;
      pLabel = "MED";
    }
    rv.setTextColor(R.id.task_priority, pColor);
    rv.setTextViewText(R.id.task_priority, pLabel);

    // Click intent
    Intent toggleIntent = new Intent("com.proflow.app.TASK_TOGGLE");
    toggleIntent.putExtra("task_id", id);
    toggleIntent.setClass(context, TaskItemReceiver.class);
    rv.setOnClickFillInIntent(R.id.task_row, toggleIntent);

    return rv;
  }

  @Override public RemoteViews getLoadingView() { return null; }
  @Override public int getViewTypeCount() { return 1; }
}
