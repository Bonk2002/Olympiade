import { DEFAULT_WHEEL_SETTINGS } from "../constants/defaults";
import { isPlainObject } from "./validation";

const FULL_CIRCLE = Math.PI * 2;

function normalizeAngle(angle) {
  let normalized = angle % FULL_CIRCLE;
  if (normalized < 0) normalized += FULL_CIRCLE;
  return normalized;
}

function entryWeight(entry) {
  const weight = Number(entry?.weight);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

export function normalizeWheelSettings(value) {
  const settings = isPlainObject(value?.settings) ? value.settings : value;
  const source = isPlainObject(settings) ? settings : DEFAULT_WHEEL_SETTINGS;

  return {
    weightMode: source.weightMode === "remainingRounds" ? "remainingRounds" : "equal",
    noRepeat: source.noRepeat === true,
  };
}

export function wheelWeightModeLabel(weightMode) {
  return weightMode === "remainingRounds" ? "Offene Runden" : "Gleich gewichtet";
}

export function makeWheelEntryFromPreset(game, setupRounds, wheelSettings = DEFAULT_WHEEL_SETTINGS) {
  const settings = normalizeWheelSettings(wheelSettings);
  const remainingRounds = setupRounds[game.id] ?? 1;

  return {
    id: game.id,
    name: game.name,
    scoringMode: game.scoringMode,
    remainingRounds,
    weight: settings.weightMode === "remainingRounds" ? Math.max(1, remainingRounds) : 1,
  };
}

export function getWheelEntriesFromGames(
  games,
  wheelSettings = DEFAULT_WHEEL_SETTINGS,
  lastPickedGameId = null
) {
  const settings = normalizeWheelSettings(wheelSettings);
  const openGames = Array.isArray(games)
    ? games.filter((game) => Number(game.remainingRounds) > 0)
    : [];
  const canExcludeLast =
    settings.noRepeat &&
    typeof lastPickedGameId === "string" &&
    openGames.length > 1 &&
    openGames.some((game) => game.id === lastPickedGameId);
  const eligibleGames = canExcludeLast
    ? openGames.filter((game) => game.id !== lastPickedGameId)
    : openGames;

  return eligibleGames.map((game) => {
    const remainingRounds = Number(game.remainingRounds) || 0;
    return {
      ...game,
      weight: settings.weightMode === "remainingRounds" ? Math.max(1, remainingRounds) : 1,
    };
  });
}

export function totalWheelWeight(entries) {
  return entries.reduce((sum, entry) => sum + entryWeight(entry), 0);
}

export function wheelSegmentForEntry(entries, entryId) {
  const totalWeight = totalWheelWeight(entries);
  if (totalWeight <= 0) return null;

  let cursor = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const weight = entryWeight(entry);
    const startAngle = (cursor / totalWeight) * FULL_CIRCLE;
    const endAngle = ((cursor + weight) / totalWeight) * FULL_CIRCLE;
    cursor += weight;

    if (entry.id === entryId) {
      return {
        index,
        entry,
        startAngle,
        endAngle,
        slice: endAngle - startAngle,
      };
    }
  }

  return null;
}

export function angleForWheelEntry(entries, entryId, random = Math.random) {
  const segment = wheelSegmentForEntry(entries, entryId);
  if (!segment) return null;

  const padding = Math.min(segment.slice * 0.18, 0.16);
  const startAngle = segment.startAngle + padding;
  const endAngle = Math.max(startAngle, segment.endAngle - padding);
  const roll = Math.min(0.999999, Math.max(0, random()));

  return startAngle + (endAngle - startAngle) * roll;
}

export function wheelAngleForSelection(selectionAngle, startWheelAngle, extraTurns = 5) {
  const targetBase = normalizeAngle(-Math.PI / 2 - selectionAngle);
  const startBase = normalizeAngle(startWheelAngle);
  const delta = normalizeAngle(targetBase - startBase);
  const turns = Math.max(1, Math.round(extraTurns));

  return startWheelAngle + delta + turns * FULL_CIRCLE;
}

export function pickGameFromEntries(entries, random = Math.random) {
  const totalWeight = totalWheelWeight(entries);
  if (entries.length === 0 || totalWeight <= 0) return null;

  const threshold = Math.min(0.999999, Math.max(0, random())) * totalWeight;
  let cursor = 0;

  for (const entry of entries) {
    cursor += entryWeight(entry);
    if (threshold < cursor) return entry;
  }

  return entries.at(-1) ?? null;
}

export function pickFromAngle(wheelAngle, entries) {
  const totalWeight = totalWheelWeight(entries);
  if (entries.length === 0 || totalWeight <= 0) return null;

  const pointerAngle = normalizeAngle(-Math.PI / 2 - wheelAngle);
  let cursor = 0;

  for (const entry of entries) {
    const weight = entryWeight(entry);
    const startAngle = (cursor / totalWeight) * FULL_CIRCLE;
    const endAngle = ((cursor + weight) / totalWeight) * FULL_CIRCLE;
    cursor += weight;

    if (pointerAngle >= startAngle && pointerAngle < endAngle) return entry;
  }

  return entries.at(-1) ?? null;
}
