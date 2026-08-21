package com.proflow.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

/**
 * Service that provides the list data for the interactive habits widget.
 */
public class HabitListService extends RemoteViewsService {
  @Override
  public RemoteViewsFactory onGetViewFactory(Intent intent) {
    return new HabitListFactory(getApplicationContext());
  }
}
