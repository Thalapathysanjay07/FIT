import React from "react";
import { createRoot } from "react-dom/client";
import AuthGate from "./AuthGate.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><AuthGate /></React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("FIT offline support could not be enabled:", error);
    });
  });
}