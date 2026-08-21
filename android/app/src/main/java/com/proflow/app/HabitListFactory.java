package com.proflow.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

/**
 * Factory that provides habit items for the scrollable widget ListView.
 * Data format: newline-separated "id|name|done|streak"
 */
public class HabitListFactory implements RemoteViewsService.RemoteViewsFactory {

  private final Context context;
  private String[] items; // each element: "id|name|done|streak"

  public HabitListFactory(Context context) {
    this.context = context;
    loadItems();
  }

  private void loadItems() {
    SharedPreferences prefs = context.getSharedPreferences(HabitItemReceiver.PREFS, Context.MODE_PRIVATE);
    String data = prefs.getString(HabitItemReceiver.KEY_HABITS, "");
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
    String name = parts.length > 1 ? parts[1] : "Habit";
    boolean done = parts.length > 2 && "true".equals(parts[2]);
    String streak = parts.length > 3 ? parts[3] : "0";

    RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_habit_item);

    // Checkbox state
    if (done) {
      rv.setInt(R.id.habit_checkbox, "setBackgroundResource", R.drawable.widget_habit_checked_bg);
      rv.setTextViewText(R.id.habit_checkbox, "✓");
      rv.setTextColor(R.id.habit_checkbox, 0xFFFFFFFF);
      rv.setTextColor(R.id.habit_name, 0xFF9CA3AF); // muted for done
    } else {
      rv.setInt(R.id.habit_checkbox, "setBackgroundResource", R.drawable.widget_habit_unchecked_bg);
      rv.setTextViewText(R.id.habit_checkbox, "");
      rv.setTextColor(R.id.habit_name, 0xFFE5E7EB); // light for active
    }

    rv.setTextViewText(R.id.habit_name, name);
    rv.setTextViewText(R.id.habit_streak, streak + "d");

    // Click intent to toggle
    Intent toggleIntent = new Intent("com.proflow.app.HABIT_TOGGLE");
    toggleIntent.putExtra("habit_id", id);
    toggleIntent.setClass(context, HabitItemReceiver.class);
    rv.setOnClickFillInIntent(R.id.habit_row, toggleIntent);

    return rv;
  }

  @Override public RemoteViews getLoadingView() { return null; }
  @Override public int getViewTypeCount() { return 1; }
}
