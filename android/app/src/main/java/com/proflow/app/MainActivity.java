package com.proflow.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Capacitor 8 builds the bridge — and snapshots the plugin list — inside
    // super.onCreate(). Registering AFTER the super call silently drops plugins
    // from the WebView's plugin map (Capacitor.Plugins.X becomes undefined, e.g.
    // the Backup plugin that the Settings export button calls). Register first.
    registerPlugin(UpdaterPlugin.class);
    registerPlugin(BackupPlugin.class);
    registerPlugin(RemindersPlugin.class);
    registerPlugin(VoiceNotesPlugin.class);
    registerPlugin(WidgetBridge.class);
    super.onCreate(savedInstanceState);
  }
}
