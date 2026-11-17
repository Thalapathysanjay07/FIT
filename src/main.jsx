import React from "react";
import { createRoot } from "react-dom/client";
import AuthGate from "./AuthGate.jsx";
import FirebaseAuthGate from "./FirebaseAuthGate.jsx";
import "./index.css";

const RootAuth = import.meta.env.VITE_USE_FIREBASE_AUTH === "true" ? FirebaseAuthGate : AuthGate;

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("FIT application render failed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#090b0a", color: "#fff", fontFamily: "system-ui" }}>
          <section style={{ maxWidth: 480, padding: 24, border: "1px solid #444", borderRadius: 16 }}>
            <h1>FIT could not start</h1>
            <p>The app hit an unexpected error. Please update FIT to the latest build.</p>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "#ffb4a9" }}>{String(this.state.error?.message || this.state.error)}</pre>
            <button onClick={() => window.location.reload()} style={{ padding: "12px 18px", borderRadius: 10 }}>Reload FIT</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary><RootAuth /></AppErrorBoundary>
  </React.StrictMode>
);

// A service worker is useful for the web/PWA build, but should not control
// Capacitor's local Android WebView document or cache native app assets.
const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.());
if (!isNativeApp && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("FIT offline support could not be enabled:", error);
    });
  });
}
