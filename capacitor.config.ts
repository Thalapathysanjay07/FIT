import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fitapp.mobile",
  appName: "FIT",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https"
  }
};

export default config;
