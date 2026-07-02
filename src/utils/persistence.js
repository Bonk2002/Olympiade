import {
  ACTIVE_TOURNAMENT_VERSION,
  LS_KEYS,
  SCORING_SETTINGS_VERSION,
  SETUP_STATE_VERSION,
  WHEEL_SETTINGS_VERSION,
} from "../constants/defaults";
import { clamp } from "./common";
import {
  normalizeCurrentBonus,
  normalizeGameScoringMode,
  normalizeScoringSettings,
} from "./scoring";
import {
  defaultRoundEvaluationMode,
  normalizeRoundEvaluationMode,
  normalizeTeams,
  TEAM_COUNT_OPTIONS,
  teamsWithPlayers,
} from "./teams";
import { isPlainObject, isStringArray, isValidTournament } from "./validation";
import { normalizeWheelSettings } from "./wheel";

function normalizePreset(value, key) {
  if (!isPlainObject(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;

  if (key === LS_KEYS.games) {
    return {
      ...value,
      scoringMode: normalizeGameScoringMode(value.scoringMode),
    };
  }

  return value;
}

function normalizeTournamentGame(game) {
  return {
    ...game,
    scoringMode: normalizeGameScoringMode(game.scoringMode),
  };
}

function normalizeTournamentLog(log, teams, players) {
  if (!Array.isArray(log)) return [];

  return log
    .filter(isPlainObject)
    .map((entry) => ({
      ...entry,
      roundEvaluationMode: normalizeRoundEvaluationMode(
        entry.roundEvaluationMode,
        entry.scoringMode,
        Array.isArray(entry.teamsSnapshot) && entry.teamsSnapshot.length > 0
      ),
      teamsSnapshot: normalizeTeams(entry.teamsSnapshot ?? teams, players),
    }));
}

export function loadPresets(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.map((item) => normalizePreset(item, key)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function savePresets(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

export function loadMode() {
  try {
    return localStorage.getItem(LS_KEYS.mode) || null;
  } catch {
    return null;
  }
}

export function saveMode(mode) {
  try {
    localStorage.setItem(LS_KEYS.mode, mode);
  } catch {
    // ignore
  }
}

export function loadScoringSettings() {
  try {
    const raw = localStorage.getItem(LS_KEYS.scoringSettings);
    const legacyMode = localStorage.getItem(LS_KEYS.mode);
    if (!raw) return normalizeScoringSettings(undefined, undefined, legacyMode);

    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return normalizeScoringSettings(undefined, undefined, legacyMode);
    if (parsed.version !== SCORING_SETTINGS_VERSION) {
      return normalizeScoringSettings(undefined, undefined, legacyMode);
    }

    return normalizeScoringSettings(parsed, undefined, legacyMode);
  } catch {
    return normalizeScoringSettings();
  }
}

export function saveScoringSettings(settings) {
  try {
    const normalized = normalizeScoringSettings(settings);
    localStorage.setItem(
      LS_KEYS.scoringSettings,
      JSON.stringify({
        version: SCORING_SETTINGS_VERSION,
        ...normalized,
      })
    );
  } catch {
    // ignore
  }
}

export function loadWheelSettings() {
  try {
    const raw = localStorage.getItem(LS_KEYS.wheelSettings);
    if (!raw) return normalizeWheelSettings();

    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed) || parsed.version !== WHEEL_SETTINGS_VERSION) {
      return normalizeWheelSettings();
    }

    return normalizeWheelSettings(parsed);
  } catch {
    return normalizeWheelSettings();
  }
}

export function saveWheelSettings(settings) {
  try {
    const normalized = normalizeWheelSettings(settings);
    localStorage.setItem(
      LS_KEYS.wheelSettings,
      JSON.stringify({
        version: WHEEL_SETTINGS_VERSION,
        ...normalized,
      })
    );
  } catch {
    // ignore
  }
}

function normalizeLooseSetupRounds(value) {
  if (!isPlainObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([gameId]) => typeof gameId === "string" && gameId)
      .map(([gameId, rounds]) => {
        const number = Number(rounds);
        return [
          gameId,
          Number.isFinite(number) ? clamp(Math.round(number), 1, 25) : 1,
        ];
      })
  );
}

function normalizeRandomTeamCount(value) {
  const count = Math.round(Number(value));
  return TEAM_COUNT_OPTIONS.includes(count) ? count : 2;
}

export function loadSetupState() {
  try {
    const raw = localStorage.getItem(LS_KEYS.setupState);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed) || parsed.version !== SETUP_STATE_VERSION) return null;

    return {
      selectedGameIds: isStringArray(parsed.selectedGameIds) ? parsed.selectedGameIds : [],
      selectedPlayerIds: isStringArray(parsed.selectedPlayerIds) ? parsed.selectedPlayerIds : [],
      setupRounds: normalizeLooseSetupRounds(parsed.setupRounds),
      teamModeEnabled: parsed.teamModeEnabled === true,
      teams: normalizeTeams(parsed.teams),
      randomTeamCount: normalizeRandomTeamCount(parsed.randomTeamCount),
    };
  } catch {
    return null;
  }
}

export function saveSetupState(value) {
  try {
    localStorage.setItem(
      LS_KEYS.setupState,
      JSON.stringify({
        version: SETUP_STATE_VERSION,
        savedAt: new Date().toISOString(),
        selectedGameIds: isStringArray(value?.selectedGameIds) ? value.selectedGameIds : [],
        selectedPlayerIds: isStringArray(value?.selectedPlayerIds) ? value.selectedPlayerIds : [],
        setupRounds: normalizeLooseSetupRounds(value?.setupRounds),
        teamModeEnabled: value?.teamModeEnabled === true,
        teams: normalizeTeams(value?.teams),
        randomTeamCount: normalizeRandomTeamCount(value?.randomTeamCount),
      })
    );
  } catch {
    // ignore
  }
}

export function deriveSetupRoundsFromTournament(tournament) {
  return Object.fromEntries(
    tournament.games.map((game) => [game.id, clamp(Math.round(game.totalRounds) || 1, 1, 25)])
  );
}

export function normalizeSavedSetupRounds(value, tournament) {
  const derived = deriveSetupRoundsFromTournament(tournament);
  if (!isPlainObject(value)) return derived;

  return Object.fromEntries(
    Object.entries(derived).map(([gameId, fallback]) => {
      const savedValue = Number(value[gameId]);
      return [gameId, Number.isFinite(savedValue) ? clamp(Math.round(savedValue), 1, 25) : fallback];
    })
  );
}

export function normalizeSavedPlacements(value, tournament) {
  if (!tournament.currentPickGameId) return [];
  if (!isStringArray(value)) {
    return Array.from({ length: tournament.players.length }, () => "");
  }

  const playerIds = new Set(tournament.players.map((player) => player.id));
  return Array.from({ length: tournament.players.length }, (_, index) => {
    const playerId = value[index] || "";
    return playerIds.has(playerId) ? playerId : "";
  });
}

export function normalizeSavedScoreDraft(value, tournament) {
  if (!tournament.currentPickGameId || !isPlainObject(value)) return {};

  return Object.fromEntries(
    tournament.players.map((player) => {
      const rawValue = value[player.id];
      const number = Number(rawValue);
      if (rawValue === "" || rawValue == null) return [player.id, ""];
      return [player.id, Number.isFinite(number) && number >= 0 ? String(rawValue) : "0"];
    })
  );
}

export function normalizeSavedRoundEvaluationMode(value, tournament) {
  const currentGame = tournament.currentPickGameId
    ? tournament.games.find((game) => game.id === tournament.currentPickGameId)
    : null;
  const fallback = currentGame
    ? defaultRoundEvaluationMode(currentGame.scoringMode)
    : defaultRoundEvaluationMode("placement");

  if (!currentGame) return fallback;
  return normalizeRoundEvaluationMode(value, currentGame.scoringMode, tournament.teamModeEnabled === true);
}

export function normalizeSavedWinnerTeamId(value, tournament) {
  if (!tournament.currentPickGameId || tournament.teamModeEnabled !== true) return "";
  const teams = teamsWithPlayers(tournament.teams);
  if (typeof value === "string" && teams.some((team) => team.id === value)) return value;
  return teams[0]?.id ?? "";
}

export function normalizeSavedTeamScoreDraft(value, tournament) {
  if (!tournament.currentPickGameId || tournament.teamModeEnabled !== true || !isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    normalizeTeams(tournament.teams, tournament.players).map((team) => {
      const rawValue = value[team.id];
      const number = Number(rawValue);
      if (rawValue === "" || rawValue == null) return [team.id, ""];
      return [team.id, Number.isFinite(number) && number >= 0 ? String(rawValue) : "0"];
    })
  );
}

export function readActiveTournamentSave() {
  try {
    const raw = localStorage.getItem(LS_KEYS.activeTournament);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      return { valid: false, reason: "Gespeicherter Stand ist kein Objekt." };
    }
    if (parsed.version !== ACTIVE_TOURNAMENT_VERSION) {
      return { valid: false, reason: "Gespeicherter Stand hat eine andere Version." };
    }
    if (!isValidTournament(parsed.tournament)) {
      return { valid: false, reason: "Gespeichertes Turnier ist unvollständig." };
    }

    const savedTournament = parsed.tournament;
    const legacyMode =
      parsed.mode === "fixed" || parsed.mode === "multi" ? parsed.mode : savedTournament.mode;
    const scoringSettings = normalizeScoringSettings(
      savedTournament.scoringSettings ?? parsed.scoringSettings,
      savedTournament.players.length,
      legacyMode
    );
    const games = savedTournament.games.map(normalizeTournamentGame);
    const gameIds = new Set(games.map((game) => game.id));
    const wheelSettings = normalizeWheelSettings(
      savedTournament.wheelSettings ?? parsed.wheelSettings
    );
    const lastPickedGameId = gameIds.has(savedTournament.lastPickedGameId)
      ? savedTournament.lastPickedGameId
      : null;
    const teams = normalizeTeams(savedTournament.teams ?? parsed.teams, savedTournament.players);
    const teamModeEnabled = (savedTournament.teamModeEnabled ?? parsed.teamModeEnabled) === true;
    const tournament = {
      ...savedTournament,
      mode: scoringSettings.multiplierEnabled ? "multi" : "fixed",
      scoringSettings,
      wheelSettings,
      teamModeEnabled,
      teams: teamModeEnabled ? teams : [],
      log: normalizeTournamentLog(savedTournament.log, teams, savedTournament.players),
      lastPickedGameId,
      games,
      currentBonus: normalizeCurrentBonus(
        savedTournament.currentBonus,
        scoringSettings,
        Boolean(savedTournament.currentPickGameId)
      ),
    };
    const selectedGameIds = isStringArray(parsed.selectedGameIds)
      ? parsed.selectedGameIds
      : tournament.games.map((game) => game.id);
    const selectedPlayerIds = isStringArray(parsed.selectedPlayerIds)
      ? parsed.selectedPlayerIds
      : tournament.players.map((player) => player.id);
    const setupRounds = normalizeSavedSetupRounds(parsed.setupRounds, tournament);

    return {
      valid: true,
      data: {
        version: parsed.version,
        savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
        mode: tournament.mode,
        tournament,
        scoringSettings,
        wheelSettings,
        selectedGameIds,
        selectedPlayerIds,
        setupRounds,
        placements: normalizeSavedPlacements(parsed.placements, tournament),
        scoreDraft: normalizeSavedScoreDraft(parsed.scoreDraft, tournament),
        roundEvaluationMode: normalizeSavedRoundEvaluationMode(parsed.roundEvaluationMode, tournament),
        winnerTeamId: normalizeSavedWinnerTeamId(parsed.winnerTeamId, tournament),
        teamScoreDraft: normalizeSavedTeamScoreDraft(parsed.teamScoreDraft, tournament),
      },
    };
  } catch {
    return { valid: false, reason: "Gespeicherter Stand ist kein gültiges JSON." };
  }
}

export function saveActiveTournament(value) {
  try {
    localStorage.setItem(LS_KEYS.activeTournament, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function removeActiveTournamentSave() {
  try {
    localStorage.removeItem(LS_KEYS.activeTournament);
  } catch {
    // ignore
  }
}
