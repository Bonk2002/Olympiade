import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { GuestView } from "./components/GuestView.jsx";
import { LandingPage } from "./components/LandingPage.jsx";
import { ObsOverlay } from "./components/ObsOverlay.jsx";
import { getOrCreateHostKey, normalizeRoomSlug } from "./utils/rooms.js";
import "./index.css";
import "./App.css";

function routeFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const parts = window.location.pathname.split("/").filter(Boolean);
  const [section, rawRoom] = parts;
  const room = normalizeRoomSlug(rawRoom);

  if (params.get("overlay") === "1") {
    return { view: "overlay", room: "", legacyGlobal: true };
  }

  if (!section) {
    return { view: "landing" };
  }

  if (section === "host") {
    if (!room) return { view: "landing" };
    return { view: "host", room };
  }

  if (section === "guest") {
    return { view: "guest", room };
  }

  if (section === "overlay") {
    return { view: "overlay", room, legacyGlobal: false };
  }

  return { view: "landing" };
}

const route = routeFromLocation();
let appElement = <LandingPage />;

if (route.view === "host") {
  appElement = <App room={route.room} hostKey={getOrCreateHostKey(route.room)} />;
}

if (route.view === "guest") {
  appElement = <GuestView room={route.room} />;
}

if (route.view === "overlay") {
  appElement = <ObsOverlay room={route.room} legacyGlobal={route.legacyGlobal} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {appElement}
  </React.StrictMode>
);
