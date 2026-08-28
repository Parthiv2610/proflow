package com.proflow.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

public class TaskListService extends RemoteViewsService {
  @Override
  public RemoteViewsFactory onGetViewFactory(Intent intent) {
    return new TaskListFactory(getApplicationContext());
  }
}
