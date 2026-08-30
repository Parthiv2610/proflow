import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.proflow.app",
  appName: "ProFlow",
  webDir: "out",
  android: {
    allowMixedContent: true,
  },
}

export default config
