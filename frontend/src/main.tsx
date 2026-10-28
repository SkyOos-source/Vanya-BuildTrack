import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./style.css";

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/service-worker.js").catch((error: unknown) => {
    console.error("Unable to register the BuildTrack service worker:", error);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
