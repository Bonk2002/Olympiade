import { useMemo, useState } from "react";

import {
  absoluteRoomUrl,
  copyTextToClipboard,
  isValidRoomSlug,
  normalizeRoomSlug,
  roomPath,
  storePendingHostPassword,
} from "../utils/rooms";

export function LandingPage() {
  const [roomName, setRoomName] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [status, setStatus] = useState("");
  const roomSlug = normalizeRoomSlug(roomName);
  const roomValid = isValidRoomSlug(roomSlug);

  const links = useMemo(() => {
    if (!roomValid) return null;

    return {
      host: roomPath("host", roomSlug),
      guest: roomPath("guest", roomSlug),
      overlay: `${roomPath("overlay", roomSlug)}?bg=transparent`,
    };
  }, [roomSlug, roomValid]);

  function openPath(path) {
    window.location.href = path;
  }

  function openHost() {
    if (!links) {
      setStatus("Gültigen Lobbynamen eingeben");
      return;
    }

    if (!hostPassword.trim()) {
      setStatus("Host-Passwort eingeben");
      return;
    }

    storePendingHostPassword(roomSlug, hostPassword);
    openPath(links.host);
  }

  async function copyObsLink() {
    if (!links) return;

    try {
      await copyTextToClipboard(absoluteRoomUrl("overlay", roomSlug, "bg=transparent"));
      setStatus("OBS-Link kopiert");
    } catch {
      setStatus("Kopieren nicht möglich");
    }
  }

  return (
    <main className="landingPage">
      <section className="landingCard">
        <div className="landingHero">
          <span className="eyebrow">Lobby</span>
          <h1>Olympiade</h1>
        </div>

        <label className="fieldBlock">
          <span>Lobbyname</span>
          <input
            className="textInput lobbyInput"
            value={roomName}
            maxLength={48}
            onChange={(event) => setRoomName(event.target.value)}
            placeholder="Lobbyname"
          />
        </label>

        <label className="fieldBlock">
          <span>Host-Passwort</span>
          <input
            className="textInput lobbyInput"
            value={hostPassword}
            type="password"
            autoComplete="new-password"
            onChange={(event) => setHostPassword(event.target.value)}
            placeholder="Passwort"
          />
        </label>

        <div className={`slugPreview ${roomValid ? "" : "invalid"}`}>
          {roomSlug || "lobby"} {roomValid ? "" : "- mindestens 2 Zeichen"}
        </div>

        <div className="landingActions">
          <button className="btn ok" type="button" disabled={!links || !hostPassword.trim()} onClick={openHost}>
            Als Host öffnen
          </button>
          <button className="btn secondary" type="button" disabled={!links} onClick={() => openPath(links.guest)}>
            Als Zuschauer öffnen
          </button>
          <button className="btn secondary" type="button" disabled={!links} onClick={copyObsLink}>
            OBS-Link kopieren
          </button>
        </div>

        {links && (
          <div className="linkPreview">
            <span>Host-Link: {links.host}</span>
            <span>Zuschauer-Link: {links.guest}</span>
            <span>OBS-Link: {links.overlay}</span>
          </div>
        )}

        {status && <div className="landingStatus">{status}</div>}
      </section>
    </main>
  );
}
