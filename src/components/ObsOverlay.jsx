import { useCallback, useEffect, useMemo, useState } from "react";

import { LS_KEYS } from "../constants/defaults";
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
  SPECIAL_ROUND_TYPES,
  specialRoundText,
} from "../utils/scoring";
import {
  normalizeRoundEvaluationMode,
  roundEvaluationModeLabel,
  teamRankingFromPlayers,
} from "../utils/teams";

const POLL_INTERVAL_MS = 750;

function overlayBackgroundMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("bg") === "dark" ? "dark" : "transparent";
  } catch {
    return "transparent";
  }
}

function emptyOverlaySnapshot(raw = "", source = "local") {
  return {
    raw,
    source,
    savedAt: "",
    tournament: null,
    roundEvaluationMode: "",
  };
}

function snapshotFromSavedData(data, raw, source) {
  return {
    raw,
    source,
    savedAt: data.savedAt,
    tournament: data.tournament,
    roundEvaluationMode: data.roundEvaluationMode,
  };
}

function readLocalOverlaySnapshot(room, legacyGlobal = false) {
  const roomSlug = normalizeRoomSlug(room);
  if (!roomSlug && !legacyGlobal) {
    return emptyOverlaySnapshot("missing-room", "local");
  }

  let raw = "";

  try {
    raw = localStorage.getItem(activeTournamentStorageKey(roomSlug)) ?? "";
    if (!raw && roomSlug) {
      raw = localStorage.getItem(LS_KEYS.activeTournament) ?? "";
    }
  } catch {
    raw = "";
  }

  const saved = readActiveTournamentSave(roomSlug, {
    fallbackGlobal: !roomSlug || legacyGlobal,
  });
  if (!saved?.valid) {
    return emptyOverlaySnapshot(raw, "local");
  }

  return snapshotFromSavedData(saved.data, `local:${raw}`, "local");
}

async function readServerOverlaySnapshot(room, legacyGlobal = false) {
  if (typeof fetch !== "function") return null;

  const roomSlug = normalizeRoomSlug(room);
  if (!roomSlug && !legacyGlobal) return null;

  try {
    const response = await fetch(roomSlug ? roomStateApiPath(roomSlug) : "/api/tournament-state", {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = await response.json();
    if (!payload || payload.state == null) return null;

    const saved = normalizeActiveTournamentSaveValue(payload.state);
    if (!saved?.valid) return null;

    return snapshotFromSavedData(
      saved.data,
      `server:${JSON.stringify(payload.state)}`,
      "server"
    );
  } catch {
    return null;
  }
}

async function readOverlaySnapshot(room, legacyGlobal = false) {
  return (await readServerOverlaySnapshot(room, legacyGlobal)) ?? readLocalOverlaySnapshot(room, legacyGlobal);
}

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

function RankingPanel({ title, rows, compact = false }) {
  const rankedRows = rankingRows(rows);
  const maxPoints = Math.max(1, ...rankedRows.map((row) => Number(row.total) || 0));

  return (
    <section className={`obsCard obsRankingCard ${compact ? "compact" : ""}`}>
      <div className="obsCardHead">
        <span>{title}</span>
        <strong>{rankedRows.length}</strong>
      </div>

      {rankedRows.length === 0 ? (
        <div className="obsMuted">Keine Wertung</div>
      ) : (
        <div className="obsRankingList">
          {rankedRows.slice(0, compact ? 5 : 8).map((row) => {
            const progress = Math.max(4, Math.round(((Number(row.total) || 0) / maxPoints) * 100));

            return (
              <div key={row.id} className={`obsRankRow place${row.place <= 3 ? row.place : "Other"}`}>
                <div className="obsRankTop">
                  <span className="obsPlace">#{row.place}</span>
                  <span className="obsName">{row.name}</span>
                  {row.tied && <span className="obsTie">=</span>}
                  <strong>{formatPoints(row.total)}</strong>
                </div>
                <div className="obsRankBar">
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

function CurrentGamePanel({ tournament, currentGame, roundEvaluationMode }) {
  const scoringSettings = normalizeScoringSettings(
    tournament.scoringSettings,
    tournament.players.length,
    tournament.mode
  );
  const currentSpecialRound = tournament.currentSpecialRound ?? null;
  const currentMinusRound = currentSpecialRound?.type === SPECIAL_ROUND_TYPES.minus
    ? { active: true, pointsStep: currentSpecialRound.config?.pointsStep ?? 0 }
    : tournament.currentMinusRound?.active ? tournament.currentMinusRound : null;
  const currentBonus = currentSpecialRound?.type === SPECIAL_ROUND_TYPES.bonus
    ? { active: true, multiplier: currentSpecialRound.config?.multiplier ?? 1 }
    : !currentMinusRound && tournament.currentBonus?.active ? tournament.currentBonus : null;
  const otherSpecialRound = currentSpecialRound && ![SPECIAL_ROUND_TYPES.bonus, SPECIAL_ROUND_TYPES.minus].includes(currentSpecialRound.type)
    ? currentSpecialRound
    : null;
  const normalMultiplier = currentGame ? roundMultiplier(tournament, currentGame) : 1;
  const effectiveMultiplier = currentMinusRound ? 1 : normalMultiplier * (currentBonus?.multiplier ?? 1);
  const openGamesCount = TournamentEngine.openGames(tournament).length;
  const tournamentFinished = openGamesCount === 0;

  if (!currentGame) {
    return (
      <section className="obsCard obsCurrentCard waiting">
        <div className="obsEyebrow">Aktuelles Spiel</div>
        <h1>{tournamentFinished ? "Turnier beendet" : "Nächste Runde wird gedreht..."}</h1>
        <div className="obsMetaGrid">
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
    <section className={`obsCard obsCurrentCard ${currentBonus ? "bonusActive" : ""} ${currentMinusRound ? "minusActive" : ""} ${otherSpecialRound ? `specialActive special-${otherSpecialRound.type}` : ""}`}>
      <div className="obsCurrentTop">
        <div>
          <div className="obsEyebrow">Aktuelles Spiel</div>
          <h1>{currentGame.name}</h1>
        </div>
        {currentBonus && (
          <span className="obsBonusBadge">
            BONUS ×{formatMultiplier(currentBonus.multiplier)}
          </span>
        )}
        {currentMinusRound && (
          <span className="obsMinusBadge">
            MINUSRUNDE · -{formatMultiplier(currentMinusRound.pointsStep)}
          </span>
        )}
        {otherSpecialRound && (
          <span className={`obsSpecialBadge obsSpecialBadge-${otherSpecialRound.type}`}>
            {specialRoundText(otherSpecialRound)}
          </span>
        )}
      </div>

      <div className="obsMetaGrid">
        <span>Spiel-Runde {currentGame.playedRounds + 1}/{currentGame.totalRounds}</span>
        <span>TR {tournament.globalRound + 1}</span>
        <span>{roundEvaluationModeLabel(normalizedRoundMode)}</span>
        <span>{gameScoringModeLabel(currentGame.scoringMode)}</span>
        {currentMinusRound ? (
          <span>-{formatMultiplier(currentMinusRound.pointsStep)} pro Platz</span>
        ) : otherSpecialRound ? (
          <span>{specialRoundText(otherSpecialRound)}</span>
        ) : (
          <>
            <span>Normal ×{formatMultiplier(normalMultiplier)}</span>
            <span>Gesamt ×{formatMultiplier(effectiveMultiplier)}</span>
          </>
        )}
      </div>
    </section>
  );
}

function StatusLine({ tournament }) {
  const playedRounds = tournament.games.reduce((sum, game) => sum + (game.playedRounds ?? 0), 0);
  const remainingRounds = tournament.games.reduce((sum, game) => sum + (game.remainingRounds ?? 0), 0);
  const openGames = TournamentEngine.openGames(tournament).length;
  const bonusRounds = tournament.log.filter((entry) => entry.bonusActive).length;
  const minusRounds = tournament.log.filter((entry) => entry.minusRoundActive).length;
  const specialRounds = tournament.log.filter((entry) =>
    entry.specialRoundType && ![SPECIAL_ROUND_TYPES.bonus, SPECIAL_ROUND_TYPES.minus].includes(entry.specialRoundType)
  ).length;
  const status = remainingRounds === 0 && !tournament.currentPickGameId ? "Fertig" : "Live";

  return (
    <div className="obsStatusLine">
      <span>{status}</span>
      <span>{playedRounds} gespielt</span>
      <span>{remainingRounds} offen</span>
      <span>{openGames} Games</span>
      {bonusRounds > 0 && <span>{bonusRounds} Bonus</span>}
      {minusRounds > 0 && <span>{minusRounds} Minus</span>}
      {specialRounds > 0 && <span>{specialRounds} Sonderrunden</span>}
    </div>
  );
}

function EmptyOverlay() {
  return (
    <div className="obsEmptyState">
      <div className="obsEmptyCard">
        <span className="obsEyebrow">Overlay</span>
        <strong>Kein aktives Turnier</strong>
      </div>
    </div>
  );
}

function MissingRoomOverlay() {
  return (
    <div className="obsEmptyState">
      <div className="obsEmptyCard">
        <span className="obsEyebrow">Overlay</span>
        <strong>Bitte Lobby angeben, z. B. /overlay/bonk</strong>
      </div>
    </div>
  );
}

export function ObsOverlay({ room = "", legacyGlobal = false } = {}) {
  const roomSlug = normalizeRoomSlug(room);
  const [backgroundMode] = useState(() => overlayBackgroundMode());
  const [snapshot, setSnapshot] = useState(() => readLocalOverlaySnapshot(roomSlug, legacyGlobal));

  const refreshSnapshot = useCallback(async () => {
    const next = await readOverlaySnapshot(roomSlug, legacyGlobal);

    setSnapshot((current) => {
      return next.raw === current.raw ? current : next;
    });
  }, [legacyGlobal, roomSlug]);

  useEffect(() => {
    const bodyClass = backgroundMode === "dark"
      ? "obsOverlayBodyDark"
      : "obsOverlayBodyTransparent";

    document.documentElement.classList.add("obsOverlayDocument");
    document.body.classList.add("obsOverlayBody", bodyClass);

    return () => {
      document.documentElement.classList.remove("obsOverlayDocument");
      document.body.classList.remove("obsOverlayBody", bodyClass);
    };
  }, [backgroundMode]);

  useEffect(() => {
    function onStorage(event) {
      const roomKey = activeTournamentStorageKey(roomSlug);
      if (!event.key || event.key === roomKey || event.key === LS_KEYS.activeTournament) {
        refreshSnapshot();
      }
    }

    window.addEventListener("storage", onStorage);
    const initialRefreshId = window.setTimeout(() => {
      refreshSnapshot();
    }, 0);
    const intervalId = window.setInterval(() => {
      refreshSnapshot();
    }, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
    };
  }, [refreshSnapshot, roomSlug]);

  const tournament = snapshot.tournament;
  const playerRankingRows = useMemo(
    () => (tournament ? tournament.players : []),
    [tournament]
  );
  const teamLeaderboard = useMemo(
    () => (
      tournament?.teamModeEnabled
        ? teamRankingFromPlayers(tournament.players, tournament.teams)
        : []
    ),
    [tournament]
  );
  const currentGame = useMemo(() => {
    if (!tournament?.currentPickGameId) return null;
    return tournament.games.find((game) => game.id === tournament.currentPickGameId) ?? null;
  }, [tournament]);

  return (
    <main className={`obsOverlay obsOverlay-${backgroundMode}`}>
      {!roomSlug && !legacyGlobal ? (
        <MissingRoomOverlay />
      ) : !tournament ? (
        <EmptyOverlay />
      ) : (
        <div className="obsOverlayShell">
          <CurrentGamePanel
            tournament={tournament}
            currentGame={currentGame}
            roundEvaluationMode={snapshot.roundEvaluationMode}
          />

          <div className={`obsRankingGrid ${teamLeaderboard.length ? "withTeams" : ""}`}>
            <RankingPanel title="Live Ranking" rows={playerRankingRows} />
            {teamLeaderboard.length > 0 && (
              <RankingPanel title="Team Ranking" rows={teamLeaderboard} compact />
            )}
          </div>

          <StatusLine tournament={tournament} />
        </div>
      )}
    </main>
  );
}
