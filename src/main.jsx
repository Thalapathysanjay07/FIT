import React from "react";
import { createRoot } from "react-dom/client";
import AuthGate from "./AuthGate.jsx";
import FirebaseAuthGate from "./FirebaseAuthGate.jsx";
import "./index.css";

const RootAuth = import.meta.env.VITE_USE_FIREBASE_AUTH === "true" ? FirebaseAuthGate : AuthGate;

createRoot(document.getElementById("root")).render(
  <React.StrictMode><RootAuth /></React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("FIT offline support could not be enabled:", error);
    });
  });
}