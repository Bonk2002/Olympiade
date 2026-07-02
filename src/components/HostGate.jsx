import { useCallback, useEffect, useState } from "react";

import App from "../App.jsx";
import {
  clearPendingHostPassword,
  consumeHostKeyFromQuery,
  getStoredHostKey,
  normalizeRoomSlug,
  readPendingHostPassword,
  roomClaimHostApiPath,
  roomMetaApiPath,
  storeHostKey,
} from "../utils/rooms";

export function HostGate({ room }) {
  const roomSlug = normalizeRoomSlug(room);
  const [hostKey, setHostKey] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkStoredAccess() {
      if (!roomSlug) {
        setCheckingAccess(false);
        return;
      }

      const queryHostKey = consumeHostKeyFromQuery(roomSlug);
      const storedHostKey = queryHostKey || getStoredHostKey(roomSlug);
      const pendingPassword = readPendingHostPassword(roomSlug);
      setPassword(pendingPassword);

      if (!storedHostKey) {
        setCheckingAccess(false);
        return;
      }

      try {
        const response = await fetch(roomMetaApiPath(roomSlug), { cache: "no-store" });
        const meta = response.ok ? await response.json() : null;

        if (!active) return;

        if (meta?.exists && meta?.hostProtected) {
          setHostKey(storedHostKey);
          setCheckingAccess(false);
          return;
        }

        setMessage("Bitte Host-Passwort erneut eingeben.");
        setCheckingAccess(false);
      } catch {
        if (active) {
          setHostKey(storedHostKey);
          setCheckingAccess(false);
        }
      }
    }

    checkStoredAccess();

    return () => {
      active = false;
    };
  }, [roomSlug]);

  const claimHost = useCallback(
    async (passwordValue) => {
      const nextPassword = String(passwordValue ?? password);

      if (!roomSlug) {
        setMessage("Ungültiger Lobbyname.");
        return;
      }

      if (!nextPassword.trim()) {
        setMessage("Host-Passwort eingeben.");
        return;
      }

      setSubmitting(true);
      setMessage("");

      try {
        const response = await fetch(roomClaimHostApiPath(roomSlug), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: nextPassword }),
        });

        if (response.status === 403) {
          setMessage("Falsches Host-Passwort für diese Lobby.");
          return;
        }

        if (!response.ok) {
          setMessage("Lobby konnte nicht geöffnet werden.");
          return;
        }

        const payload = await response.json();
        const nextHostKey = storeHostKey(roomSlug, payload.hostKey);

        if (!nextHostKey) {
          setMessage("Host-Zugang konnte nicht gespeichert werden.");
          return;
        }

        setHostKey(nextHostKey);
        setPassword("");
        clearPendingHostPassword(roomSlug);
      } catch {
        setMessage("Server nicht erreichbar.");
      } finally {
        setSubmitting(false);
      }
    },
    [password, roomSlug]
  );

  useEffect(() => {
    if (!checkingAccess && !hostKey && password.trim()) {
      claimHost(password);
    }
  }, [checkingAccess, claimHost, hostKey, password]);

  if (!roomSlug) {
    return (
      <main className="landingPage">
        <section className="landingCard hostAccessCard">
          <span className="eyebrow">Host</span>
          <h1>Ungültige Lobby</h1>
        </section>
      </main>
    );
  }

  if (hostKey) {
    return <App room={roomSlug} hostKey={hostKey} />;
  }

  return (
    <main className="landingPage">
      <section className="landingCard hostAccessCard">
        <div className="landingHero">
          <span className="eyebrow">Host-Lobby</span>
          <h1>{roomSlug}</h1>
        </div>

        <form
          className="hostAccessForm"
          onSubmit={(event) => {
            event.preventDefault();
            claimHost(password);
          }}
        >
          <label className="fieldBlock">
            <span>Host-Passwort</span>
            <input
              className="textInput lobbyInput"
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder="Passwort"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button
            className="btn ok"
            type="submit"
            disabled={checkingAccess || submitting || !password.trim()}
          >
            {submitting ? "Wird geöffnet..." : "Lobby als Host öffnen"}
          </button>
        </form>

        {message && <div className="landingStatus error">{message}</div>}
      </section>
    </main>
  );
}
