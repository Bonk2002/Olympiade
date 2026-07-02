import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ObsOverlay } from "./components/ObsOverlay.jsx";
import "./index.css";
import "./App.css";

const isOverlayRoute =
  window.location.pathname === "/overlay" ||
  new URLSearchParams(window.location.search).get("overlay") === "1";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isOverlayRoute ? <ObsOverlay /> : <App />}
  </React.StrictMode>
);
