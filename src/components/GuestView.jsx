import { useCallback, useEffect, useState } from "react";

import { TournamentEngine } from "../engine/TournamentEngine";
import { formatMultiplier, formatPoints } from "../utils/common";
import {
  activeTournamentStorageKey,
  normalizeActiveTournamentSaveValue,
  readActiveTournamentSave,
} from "../utils/persistence";
import { normalizeRoomSlug, roomStateApiPath } from "../utils/rooms";
import {
  gameScoringModeLabel,
  normalizeScoringSettings,
  roundMultiplier,
} from "../utils/scoring";
import {
  normalizeRoundEvaluationMode,
  roundEvaluationModeLabel,
  teamRankingFromPlayers,
} from "../utils/teams";

const GUEST_POLL_INTERVAL_MS = 900;

function rankingRows(items) {
  const sorted = [...items].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));

  return sorted.map((item, index) => {
    const firstSameScore = sorted.findIndex((row) => row.total === item.total);
    const place = firstSameScore >= 0 ? firstSameScore + 1 : index + 1;
    const tied = sorted.some((row, rowIndex) => rowIndex !== index && row.total === item.total);

    return {
      ...item,
      place,
      tied,
    };
  });
}

function emptyGuestSnapshot(raw = "empty", status = "empty") {
  return {
    raw,
    status,
    source: "",
    tournament: null,
    roundEvaluationMode: "",
    updatedAt: null,
  };
}

function snapshotFromSavedData(data, raw, source, updatedAt = null) {
  return {
    raw,
    status: "ready",
    source,
    tournament: data.tournament,
    roundEvaluationMode: data.roundEvaluationMode,
    updatedAt,
  };
}

function readLocalGuestSnapshot(room) {
  const roomSlug = normalizeRoomSlug(room);
  if (!roomSlug) return null;

  let raw = "";

  try {
    raw = localStorage.getItem(activeTournamentStorageKey(roomSlug)) ?? "";
  } catch {
    raw = "";
  }

  const saved = readActiveTournamentSave(roomSlug, {
    fallbackGlobal: false,
  });

  if (!saved?.valid) return null;
  return snapshotFromSavedData(saved.data, `local:${raw}`, "local");
}

async function readServerGuestSnapshot(room) {
  const roomSlug = normalizeRoomSlug(room);
  if (!roomSlug) return null;

  try {
    const response = await fetch(roomStateApiPath(roomSlug), { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.state) return null;

    const saved = normalizeActiveTournamentSaveValue(payload.state);
    if (!saved?.valid) return null;

    return snapshotFromSavedData(
      saved.data,
      `server:${JSON.stringify(payload.state)}:${payload.updatedAt ?? ""}`,
      "server",
      payload.updatedAt ?? null
    );
  } catch {
    return null;
  }
}

async function readGuestSnapshot(room) {
  const roomSlug = normalizeRoomSlug(room);
  if (!roomSlug) return emptyGuestSnapshot("missing-room", "missing-room");

  return (await readServerGuestSnapshot(roomSlug))
    ?? readLocalGuestSnapshot(roomSlug)
    ?? emptyGuestSnapshot("empty", "empty");
}

function GuestRanking({ title, rows }) {
  const rankedRows = rankingRows(rows);
  const maxPoints = Math.max(1, ...rankedRows.map((row) => Number(row.total) || 0));

  return (
    <section className="guestCard guestRanking">
      <div className="guestCardHead">
        <span>{title}</span>
        <strong>{rankedRows.length}</strong>
      </div>

      {rankedRows.length === 0 ? (
        <div className="guestMuted">Keine Wertung</div>
      ) : (
        <div className="guestRankingRows">
          {rankedRows.map((row) => {
            const progress = Math.max(4, Math.round(((Number(row.total) || 0) / maxPoints) * 100));

            return (
              <div key={row.id} className={`guestRankRow place${row.place <= 3 ? row.place : "Other"}`}>
                <div className="guestRankMeta">
                  <span>#{row.place}</span>
                  <b>{row.name}</b>
                  {row.tied && <em>=</em>}
                  <strong>{formatPoints(row.total)}</strong>
                </div>
                <div className="guestRankBar">
                  <div style={{ width: `${progress}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GuestCurrentGame({ tournament, currentGame, roundEvaluationMode }) {
  const scoringSettings = normalizeScoringSettings(
    tournament.scoringSettings,
    tournament.players.length,
    tournament.mode
  );
  const currentBonus = tournament.currentBonus?.active ? tournament.currentBonus : null;
  const normalMultiplier = currentGame ? roundMultiplier(tournament, currentGame) : 1;
  const effectiveMultiplier = normalMultiplier * (currentBonus?.multiplier ?? 1);
  const openGamesCount = TournamentEngine.openGames(tournament).length;

  if (!currentGame) {
    return (
      <section className="guestCard guestCurrent waiting">
        <span className="guestEyebrow">Aktuelles Spiel</span>
        <h1>{openGamesCount === 0 ? "Turnier beendet" : "Nächste Runde wird gedreht..."}</h1>
        <div className="guestChips">
          <span>TR {tournament.globalRound + 1}</span>
          <span>{openGamesCount} Games offen</span>
          <span>{scoringSettings.multiplierEnabled ? "Multiplikator aktiv" : "Multiplikator aus"}</span>
        </div>
      </section>
    );
  }

  const normalizedRoundMode = normalizeRoundEvaluationMode(
    roundEvaluationMode,
    currentGame.scoringMode,
    tournament.teamModeEnabled === true
  );

  return (
    <section className={`guestCard guestCurrent ${currentBonus ? "bonusActive" : ""}`}>
      <div className="guestCurrentTop">
        <div>
          <span className="guestEyebrow">Aktuelles Spiel</span>
          <h1>{currentGame.name}</h1>
        </div>
        {currentBonus && (
          <strong className="guestBonus">BONUS x{formatMultiplier(currentBonus.multiplier)}</strong>
        )}
      </div>

      <div className="guestChips">
        <span>Spiel-Runde {currentGame.playedRounds + 1}/{currentGame.totalRounds}</span>
        <span>TR {tournament.globalRound + 1}</span>
        <span>{roundEvaluationModeLabel(normalizedRoundMode)}</span>
        <span>{gameScoringModeLabel(currentGame.scoringMode)}</span>
        <span>Normal x{formatMultiplier(normalMultiplier)}</span>
        <span>Gesamt x{formatMultiplier(effectiveMultiplier)}</span>
      </div>
    </section>
  );
}

function GuestStatus({ tournament }) {
  const playedRounds = tournament.games.reduce((sum, game) => sum + (game.playedRounds ?? 0), 0);
  const remainingRounds = tournament.games.reduce((sum, game) => sum + (game.remainingRounds ?? 0), 0);
  const openGames = TournamentEngine.openGames(tournament).length;
  const bonusRounds = tournament.log.filter((entry) => entry.bonusActive).length;

  return (
    <div className="guestStatus">
      <span>{remainingRounds === 0 && !tournament.currentPickGameId ? "Fertig" : "Live"}</span>
      <span>{playedRounds} gespielt</span>
      <span>{remainingRounds} offen</span>
      <span>{openGames} Games</span>
      {bonusRounds > 0 && <span>{bonusRounds} Bonus</span>}
    </div>
  );
}

export function GuestView({ room }) {
  const roomSlug = normalizeRoomSlug(room);
  const [snapshot, setSnapshot] = useState(() => ({
    raw: "initial",
    status: "loading",
    source: "",
    tournament: null,
    roundEvaluationMode: "",
    updatedAt: null,
  }));

  const refreshSnapshot = useCallback(async () => {
    const next = await readGuestSnapshot(roomSlug);
    setSnapshot((current) => (current.raw === next.raw ? current : next));
  }, [roomSlug]);

  useEffect(() => {
    let active = true;

    async function refreshIfActive() {
      const next = await readGuestSnapshot(roomSlug);
      if (active) {
        setSnapshot((current) => (current.raw === next.raw ? current : next));
      }
    }

    refreshIfActive();
    const intervalId = window.setInterval(refreshIfActive, GUEST_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [roomSlug]);

  useEffect(() => {
    function onStorage() {
      refreshSnapshot();
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshSnapshot]);

  if (!roomSlug) {
    return (
      <main className="guestPage">
        <section className="guestEmpty">
          <span className="guestEyebrow">Zuschauer</span>
          <strong>Bitte Lobby angeben, z. B. /guest/bonk</strong>
        </section>
      </main>
    );
  }

  const tournament = snapshot.tournament;
  const currentGame = tournament?.currentPickGameId
    ? tournament.games.find((game) => game.id === tournament.currentPickGameId) ?? null
    : null;
  const teamLeaderboard = tournament?.teamModeEnabled
    ? teamRankingFromPlayers(tournament.players, tournament.teams)
    : [];

  return (
    <main className="guestPage">
      <div className="guestShell">
        <header className="guestHeader">
          <div>
            <span className="guestEyebrow">Lobby {roomSlug}</span>
            <h1>Olympiade Live</h1>
          </div>
          <span className="guestLiveDot">Live</span>
        </header>

        {!tournament ? (
          <section className="guestEmpty">
            <span className="guestEyebrow">Status</span>
            <strong>
              {snapshot.status === "loading"
                ? "Turnierstand wird geladen..."
                : "In dieser Lobby läuft aktuell kein Turnier."}
            </strong>
          </section>
        ) : (
          <>
            <GuestCurrentGame
              tournament={tournament}
              currentGame={currentGame}
              roundEvaluationMode={snapshot.roundEvaluationMode}
            />

            <div className={`guestGrid ${teamLeaderboard.length ? "withTeams" : ""}`}>
              <GuestRanking title="Live Ranking" rows={tournament.players} />
              {teamLeaderboard.length > 0 && (
                <GuestRanking title="Team Ranking" rows={teamLeaderboard} />
              )}
            </div>

            <GuestStatus tournament={tournament} />
          </>
        )}
      </div>
    </main>
  );
}
