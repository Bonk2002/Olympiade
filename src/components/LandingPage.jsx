import { useMemo, useState } from "react";

import {
  absoluteRoomUrl,
  copyTextToClipboard,
  isValidRoomSlug,
  normalizeRoomSlug,
  roomPath,
} from "../utils/rooms";

export function LandingPage() {
  const [roomName, setRoomName] = useState("bonk");
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

  async function copyObsLink() {
    if (!links) return;

    try {
      await copyTextToClipboard(absoluteRoomUrl("overlay", roomSlug, "bg=transparent"));
      setStatus("OBS-Link kopiert");
    } catch {
      setStatus("Kopieren nicht moeglich");
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
            placeholder="bonk"
          />
        </label>

        <div className={`slugPreview ${roomValid ? "" : "invalid"}`}>
          {roomSlug || "lobby"} {roomValid ? "" : "- mindestens 2 Zeichen"}
        </div>

        <div className="landingActions">
          <button className="btn ok" type="button" disabled={!links} onClick={() => openPath(links.host)}>
            Als Host oeffnen
          </button>
          <button className="btn secondary" type="button" disabled={!links} onClick={() => openPath(links.guest)}>
            Als Zuschauer oeffnen
          </button>
          <button className="btn secondary" type="button" disabled={!links} onClick={copyObsLink}>
            OBS-Link kopieren
          </button>
        </div>

        {links && (
          <div className="linkPreview">
            <span>Host: {links.host}</span>
            <span>Guest: {links.guest}</span>
            <span>OBS: {links.overlay}</span>
          </div>
        )}

        {status && <div className="landingStatus">{status}</div>}
      </section>
    </main>
  );
}
