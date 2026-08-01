import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.proflow.app",
  appName: "ProFlow",
  webDir: "out",
  android: {
    // The APK talks to the laptop's plain-HTTP LAN server (http://192.168.x.x:5174)
    // from the WebView origin — mixed content must be allowed for that to work.
    allowMixedContent: true,
  },
}

export default config
