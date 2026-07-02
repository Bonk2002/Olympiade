import {
  DEFAULT_SCORING_SETTINGS,
  MAX_BONUS_CHANCE,
  MAX_BONUS_MULTIPLIER,
  MAX_MULTIPLIER,
  MAX_POINTS_VALUE,
  MAX_SCORING_PLACES,
  MIN_BONUS_CHANCE,
  MIN_BONUS_MULTIPLIER,
  MIN_MULTIPLIER,
  MIN_SCORING_PLACES,
} from "../constants/defaults";
import { clamp, formatMultiplier } from "./common";
import { isPlainObject } from "./validation";

export function normalizeNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number, min, max);
}

export function normalizePointsByPlace(value, minPlaces = MIN_SCORING_PLACES) {
  const source = Array.isArray(value) ? value : DEFAULT_SCORING_SETTINGS.pointsByPlace;
  const placeCount = clamp(
    Math.max(Math.round(minPlaces) || MIN_SCORING_PLACES, source.length),
    MIN_SCORING_PLACES,
    MAX_SCORING_PLACES
  );
  const points = [];

  for (let index = 0; index < placeCount; index += 1) {
    const fallback = index === 0 ? DEFAULT_SCORING_SETTINGS.pointsByPlace[0] : points[index - 1] / 2;
    points[index] = normalizeNumber(source[index], fallback, 0, MAX_POINTS_VALUE);
  }

  return points;
}

export function normalizeScoringSettings(
  value,
  minPlaces = MIN_SCORING_PLACES,
  legacyMode = null
) {
  const settings = isPlainObject(value?.settings) ? value.settings : value;
  const source = isPlainObject(settings) ? settings : DEFAULT_SCORING_SETTINGS;
  const sourceMode = source.mode ?? value?.mode ?? legacyMode;
  const multiplierMode = source.multiplierMode === "perGame" ? "perGame" : "global";
  const multiplierEnabled =
    typeof source.multiplierEnabled === "boolean"
      ? source.multiplierEnabled
      : sourceMode === "multi"
        ? true
        : sourceMode === "fixed"
          ? false
          : DEFAULT_SCORING_SETTINGS.multiplierEnabled;

  return {
    pointsByPlace: normalizePointsByPlace(source.pointsByPlace, minPlaces),
    multiplierEnabled,
    multiplier: normalizeNumber(
      source.multiplier,
      DEFAULT_SCORING_SETTINGS.multiplier,
      MIN_MULTIPLIER,
      MAX_MULTIPLIER
    ),
    multiplierMode,
    bonusEnabled: source.bonusEnabled === true,
    bonusMultiplier: normalizeNumber(
      source.bonusMultiplier,
      DEFAULT_SCORING_SETTINGS.bonusMultiplier,
      MIN_BONUS_MULTIPLIER,
      MAX_BONUS_MULTIPLIER
    ),
    bonusChance: normalizeNumber(
      source.bonusChance,
      DEFAULT_SCORING_SETTINGS.bonusChance,
      MIN_BONUS_CHANCE,
      MAX_BONUS_CHANCE
    ),
  };
}

export function basePointsForPlace(placeIndex, scoringSettings) {
  const settings = normalizeScoringSettings(scoringSettings, placeIndex);
  return settings.pointsByPlace[placeIndex - 1] ?? 0;
}

export function basePointsByPlaceForPlayers(scoringSettings, playerCount) {
  const settings = normalizeScoringSettings(scoringSettings, playerCount);
  return Object.fromEntries(
    Array.from({ length: playerCount }, (_, index) => [
      String(index + 1),
      basePointsForPlace(index + 1, settings),
    ])
  );
}

export function multiplierModeLabel(multiplierMode) {
  return multiplierMode === "perGame" ? "Pro Spiel" : "Global";
}

export function normalizeGameScoringMode(value) {
  return value === "score" ? "score" : "placement";
}

export function gameScoringModeLabel(value) {
  return normalizeGameScoringMode(value) === "score" ? "Score" : "Platzierung";
}

export function roundMultiplier(tournament, game = null) {
  if (!tournament) return 1;
  const settings = normalizeScoringSettings(
    tournament.scoringSettings,
    tournament.players.length,
    tournament.mode
  );
  if (!settings.multiplierEnabled) return 1;

  const nextRound = settings.multiplierMode === "perGame" && game
    ? game.playedRounds + 1
    : tournament.globalRound + 1;

  return Math.pow(settings.multiplier, nextRound - 1);
}

export function createCurrentBonus(scoringSettings, random = Math.random) {
  const settings = normalizeScoringSettings(scoringSettings);
  const active = settings.bonusEnabled && random() * 100 < settings.bonusChance;

  return {
    active,
    multiplier: settings.bonusMultiplier,
  };
}

export function normalizeCurrentBonus(value, scoringSettings, hasCurrentPick) {
  if (!hasCurrentPick) return null;

  const settings = normalizeScoringSettings(scoringSettings);
  if (!isPlainObject(value)) {
    return {
      active: false,
      multiplier: settings.bonusMultiplier,
    };
  }

  return {
    active: value.active === true,
    multiplier: normalizeNumber(
      value.multiplier,
      settings.bonusMultiplier,
      MIN_BONUS_MULTIPLIER,
      MAX_BONUS_MULTIPLIER
    ),
  };
}

export function modeText(modeOrSettings, maybeScoringSettings = undefined) {
  const hasLegacyMode = maybeScoringSettings !== undefined;
  const settings = normalizeScoringSettings(
    hasLegacyMode ? maybeScoringSettings : modeOrSettings,
    MIN_SCORING_PLACES,
    hasLegacyMode ? modeOrSettings : null
  );

  if (!settings.multiplierEnabled) return "Multiplikator aus";
  return `×${formatMultiplier(settings.multiplier)} ${multiplierModeLabel(settings.multiplierMode)}`;
}
