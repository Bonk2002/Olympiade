import { isPlainObject } from "./validation";
import { normalizeGameScoringMode } from "./scoring";

export const PRESET_EXPORT_TYPE = "tournament-presets";
export const PRESET_EXPORT_VERSION = 1;

function cleanName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nameKey(name) {
  return cleanName(name).toLocaleLowerCase("de-DE");
}

function normalizeImportNames(value) {
  if (!Array.isArray(value)) return [];

  const names = [];
  value.forEach((item) => {
    const name = cleanName(isPlainObject(item) ? item.name : item);
    if (name) names.push(name);
  });

  return names;
}

function normalizeImportGames(value) {
  if (!Array.isArray(value)) return [];

  const games = [];
  value.forEach((item) => {
    const name = cleanName(isPlainObject(item) ? item.name : item);
    if (!name) return;

    games.push({
      name,
      scoringMode: normalizeGameScoringMode(isPlainObject(item) ? item.scoringMode : undefined),
    });
  });

  return games;
}

function makePreset(item, createId) {
  return {
    id: createId(),
    ...item,
  };
}

function mergePresetList(currentItems, importedItems, createId) {
  const seen = new Set(currentItems.map((item) => nameKey(item.name)).filter(Boolean));
  const nextItems = [...currentItems];
  const addedItems = [];
  let skipped = 0;

  importedItems.forEach((item) => {
    const key = nameKey(item.name);
    if (!key || seen.has(key)) {
      skipped += 1;
      return;
    }

    const preset = makePreset(item, createId);
    seen.add(key);
    nextItems.push(preset);
    addedItems.push(preset);
  });

  return {
    items: nextItems,
    addedItems,
    imported: addedItems.length,
    skipped,
  };
}

function replacePresetList(importedItems, createId) {
  const seen = new Set();
  const items = [];
  let skipped = 0;

  importedItems.forEach((item) => {
    const key = nameKey(item.name);
    if (!key || seen.has(key)) {
      skipped += 1;
      return;
    }

    seen.add(key);
    items.push(makePreset(item, createId));
  });

  return {
    items,
    addedItems: items,
    imported: items.length,
    skipped,
  };
}

export function buildPresetExport({ games, players }, exportedAt = new Date()) {
  return {
    type: PRESET_EXPORT_TYPE,
    version: PRESET_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    games: games
      .map((game) => ({
        name: cleanName(game.name),
        scoringMode: normalizeGameScoringMode(game.scoringMode),
      }))
      .filter((game) => game.name),
    players: players
      .map((player) => ({ name: cleanName(player.name) }))
      .filter((player) => player.name),
  };
}

export function parsePresetImportJson(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, message: "Leere Datei" };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Ungültiges JSON" };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, message: "Import-Datei ist kein Objekt" };
  }
  if (parsed.type !== PRESET_EXPORT_TYPE || parsed.version !== PRESET_EXPORT_VERSION) {
    return { ok: false, message: "Import-Datei hat ein unbekanntes Format" };
  }

  return {
    ok: true,
    games: normalizeImportGames(parsed.games),
    players: normalizeImportNames(parsed.players),
  };
}

export function applyPresetImport({
  currentGames,
  currentPlayers,
  importedGames,
  importedPlayers,
  mode,
  createId,
}) {
  const importMode = mode === "replace" ? "replace" : "merge";
  const playerItems = importedPlayers.map((name) => ({ name }));
  const gamesResult =
    importMode === "replace"
      ? replacePresetList(importedGames, createId)
      : mergePresetList(currentGames, importedGames, createId);
  const playersResult =
    importMode === "replace"
      ? replacePresetList(playerItems, createId)
      : mergePresetList(currentPlayers, playerItems, createId);

  return {
    mode: importMode,
    games: gamesResult.items,
    players: playersResult.items,
    addedGames: gamesResult.addedItems,
    addedPlayers: playersResult.addedItems,
    counts: {
      gamesImported: gamesResult.imported,
      playersImported: playersResult.imported,
      gamesSkipped: gamesResult.skipped,
      playersSkipped: playersResult.skipped,
    },
  };
}
