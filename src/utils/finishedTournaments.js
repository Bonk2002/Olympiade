import { LS_KEYS } from "../constants/defaults";
import { uid } from "./common";
import { roomScopedStorageKey } from "./rooms";
import { normalizeGameScoringMode, normalizeScoringSettings } from "./scoring";
import { normalizeTeams, teamRankingFromPlayers } from "./teams";
import { isPlainObject } from "./validation";
import { normalizeWheelSettings } from "./wheel";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function formatTitleDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function rankingFromPlayers(players) {
  return [...players]
    .map((player) => ({
      id: safeString(player.id),
      name: safeString(player.name, "?"),
      total: safeNumber(player.total),
    }))
    .sort((a, b) => b.total - a.total);
}

function normalizePlayers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainObject)
    .map((player) => ({
      id: safeString(player.id, uid()),
      name: safeString(player.name, "?"),
      total: safeNumber(player.total),
    }));
}

function normalizeGames(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainObject)
    .map((game) => ({
      id: safeString(game.id, uid()),
      name: safeString(game.name, "?"),
      scoringMode: normalizeGameScoringMode(game.scoringMode),
      totalRounds: safeNumber(game.totalRounds, 0),
      playedRounds: safeNumber(game.playedRounds, 0),
      remainingRounds: safeNumber(game.remainingRounds, 0),
    }));
}

function normalizeLog(value) {
  return Array.isArray(value) ? value.filter(isPlainObject).map(clone) : [];
}

function normalizeRanking(value, players) {
  const ranking = normalizePlayers(value);
  return ranking.length > 0 ? ranking : rankingFromPlayers(players);
}

export function buildFinishedTournamentSummary(tournament) {
  const players = normalizePlayers(tournament?.players);
  const games = normalizeGames(tournament?.games);
  const log = normalizeLog(tournament?.log);
  const ranking = rankingFromPlayers(players);
  const teamModeEnabled = tournament?.teamModeEnabled === true;
  const teams = teamModeEnabled ? normalizeTeams(tournament?.teams, players) : [];
  const teamRanking = teamModeEnabled ? teamRankingFromPlayers(players, teams) : [];
  const scoringSettings = normalizeScoringSettings(
    tournament?.scoringSettings,
    Math.max(players.length, 1),
    tournament?.mode
  );
  const wheelSettings = normalizeWheelSettings(tournament?.wheelSettings);
  const playedGames = games.filter((game) => game.playedRounds > 0).length;
  const bonusRounds = log.filter((entry) => entry.bonusActive === true).length;

  return {
    mode: scoringSettings.multiplierEnabled ? "multi" : "fixed",
    players,
    games,
    ranking,
    teamModeEnabled,
    teams,
    teamRanking,
    log,
    scoringSettings,
    wheelSettings,
    totalRounds: log.length,
    playedGames,
    bonusRounds,
  };
}

export function buildFinishedTournamentSnapshot(
  tournament,
  createId = uid,
  savedAtDate = new Date()
) {
  const savedAt = savedAtDate.toISOString();
  return {
    id: createId(),
    savedAt,
    title: `Turnier ${formatTitleDate(savedAtDate)}`,
    ...buildFinishedTournamentSummary(tournament),
  };
}

export function normalizeFinishedTournament(value) {
  if (!isPlainObject(value)) return null;

  const players = normalizePlayers(value.players);
  const games = normalizeGames(value.games);
  const log = normalizeLog(value.log);
  const ranking = normalizeRanking(value.ranking, players);
  const teamModeEnabled = value.teamModeEnabled === true;
  const teams = teamModeEnabled ? normalizeTeams(value.teams, players) : [];
  const teamRanking = teamModeEnabled
    ? teamRankingFromPlayers(players, teams)
    : [];
  const scoringSettings = normalizeScoringSettings(
    value.scoringSettings,
    Math.max(players.length, 1),
    value.mode
  );
  const wheelSettings = normalizeWheelSettings(value.wheelSettings);
  const savedAt = safeString(value.savedAt, new Date(0).toISOString());
  const title = safeString(value.title, `Turnier ${formatTitleDate(new Date(savedAt))}`);

  if (!safeString(value.id) || players.length === 0 || games.length === 0) return null;

  return {
    id: safeString(value.id),
    savedAt,
    title,
    mode: scoringSettings.multiplierEnabled ? "multi" : "fixed",
    players,
    games,
    ranking,
    teamModeEnabled,
    teams,
    teamRanking,
    log,
    scoringSettings,
    wheelSettings,
    totalRounds: safeNumber(value.totalRounds, log.length),
    playedGames: safeNumber(value.playedGames, games.filter((game) => game.playedRounds > 0).length),
    bonusRounds: safeNumber(value.bonusRounds, log.filter((entry) => entry.bonusActive === true).length),
  };
}

export function finishedTournamentsStorageKey(room) {
  return roomScopedStorageKey(LS_KEYS.finishedTournaments, room);
}

export function loadFinishedTournaments(room) {
  try {
    const raw = localStorage.getItem(finishedTournamentsStorageKey(room));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeFinishedTournament)
      .filter(Boolean)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

export function saveFinishedTournaments(tournaments, room) {
  try {
    localStorage.setItem(
      finishedTournamentsStorageKey(room),
      JSON.stringify(tournaments.map(normalizeFinishedTournament).filter(Boolean))
    );
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}
