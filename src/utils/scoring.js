import {
  DEFAULT_SCORING_SETTINGS,
  MAX_BONUS_CHANCE,
  MAX_BONUS_MULTIPLIER,
  MAX_MINUS_ROUND_CHANCE,
  MAX_MINUS_ROUND_POINTS_STEP,
  MAX_MULTIPLIER,
  MAX_POINTS_VALUE,
  MAX_RISK_SUCCESS_PLACES,
  MAX_SCORING_PLACES,
  MAX_SPECIAL_ROUND_CHANCE,
  MAX_SPECIAL_ROUND_POINTS,
  MIN_BONUS_CHANCE,
  MIN_BONUS_MULTIPLIER,
  MIN_MINUS_ROUND_CHANCE,
  MIN_MINUS_ROUND_POINTS_STEP,
  MIN_MULTIPLIER,
  MIN_RISK_SUCCESS_PLACES,
  MIN_SCORING_PLACES,
  MIN_SPECIAL_ROUND_CHANCE,
  MIN_SPECIAL_ROUND_POINTS,
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
    minusRoundEnabled: source.minusRoundEnabled === true,
    minusRoundChance: normalizeNumber(
      source.minusRoundChance,
      DEFAULT_SCORING_SETTINGS.minusRoundChance,
      MIN_MINUS_ROUND_CHANCE,
      MAX_MINUS_ROUND_CHANCE
    ),
    minusRoundPointsStep: normalizeNumber(
      source.minusRoundPointsStep,
      DEFAULT_SCORING_SETTINGS.minusRoundPointsStep,
      MIN_MINUS_ROUND_POINTS_STEP,
      MAX_MINUS_ROUND_POINTS_STEP
    ),
    jackpotRoundEnabled: source.jackpotRoundEnabled === true,
    jackpotRoundChance: normalizeNumber(
      source.jackpotRoundChance,
      DEFAULT_SCORING_SETTINGS.jackpotRoundChance,
      MIN_SPECIAL_ROUND_CHANCE,
      MAX_SPECIAL_ROUND_CHANCE
    ),
    jackpotRoundBonusPoints: normalizeNumber(
      source.jackpotRoundBonusPoints,
      DEFAULT_SCORING_SETTINGS.jackpotRoundBonusPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    robberRoundEnabled: source.robberRoundEnabled === true,
    robberRoundChance: normalizeNumber(
      source.robberRoundChance,
      DEFAULT_SCORING_SETTINGS.robberRoundChance,
      MIN_SPECIAL_ROUND_CHANCE,
      MAX_SPECIAL_ROUND_CHANCE
    ),
    robberRoundStealAmount: normalizeNumber(
      source.robberRoundStealAmount,
      DEFAULT_SCORING_SETTINGS.robberRoundStealAmount,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    comebackRoundEnabled: source.comebackRoundEnabled === true,
    comebackRoundChance: normalizeNumber(
      source.comebackRoundChance,
      DEFAULT_SCORING_SETTINGS.comebackRoundChance,
      MIN_SPECIAL_ROUND_CHANCE,
      MAX_SPECIAL_ROUND_CHANCE
    ),
    comebackRoundLastBonus: normalizeNumber(
      source.comebackRoundLastBonus,
      DEFAULT_SCORING_SETTINGS.comebackRoundLastBonus,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    comebackRoundSecondLastBonus: normalizeNumber(
      source.comebackRoundSecondLastBonus,
      DEFAULT_SCORING_SETTINGS.comebackRoundSecondLastBonus,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    riskRoundEnabled: source.riskRoundEnabled === true,
    riskRoundChance: normalizeNumber(
      source.riskRoundChance,
      DEFAULT_SCORING_SETTINGS.riskRoundChance,
      MIN_SPECIAL_ROUND_CHANCE,
      MAX_SPECIAL_ROUND_CHANCE
    ),
    riskRoundRewardPoints: normalizeNumber(
      source.riskRoundRewardPoints,
      DEFAULT_SCORING_SETTINGS.riskRoundRewardPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    riskRoundPenaltyPoints: normalizeNumber(
      source.riskRoundPenaltyPoints,
      DEFAULT_SCORING_SETTINGS.riskRoundPenaltyPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    riskRoundSuccessPlaces: normalizeNumber(
      source.riskRoundSuccessPlaces,
      DEFAULT_SCORING_SETTINGS.riskRoundSuccessPlaces,
      MIN_RISK_SUCCESS_PLACES,
      MAX_RISK_SUCCESS_PLACES
    ),
    secretRoundEnabled: source.secretRoundEnabled === true,
    secretRoundChance: normalizeNumber(
      source.secretRoundChance,
      DEFAULT_SCORING_SETTINGS.secretRoundChance,
      MIN_SPECIAL_ROUND_CHANCE,
      MAX_SPECIAL_ROUND_CHANCE
    ),
    mysteryRoundEnabled: source.mysteryRoundEnabled === true,
    mysteryRoundChance: normalizeNumber(
      source.mysteryRoundChance,
      DEFAULT_SCORING_SETTINGS.mysteryRoundChance,
      MIN_SPECIAL_ROUND_CHANCE,
      MAX_SPECIAL_ROUND_CHANCE
    ),
    mysteryRoundMinBonus: normalizeNumber(
      source.mysteryRoundMinBonus,
      DEFAULT_SCORING_SETTINGS.mysteryRoundMinBonus,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    mysteryRoundMaxBonus: normalizeNumber(
      source.mysteryRoundMaxBonus,
      DEFAULT_SCORING_SETTINGS.mysteryRoundMaxBonus,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    mysteryRoundStep: normalizeNumber(
      source.mysteryRoundStep,
      DEFAULT_SCORING_SETTINGS.mysteryRoundStep,
      1,
      MAX_SPECIAL_ROUND_POINTS
    ),
    allOrNothingRoundEnabled: source.allOrNothingRoundEnabled === true,
    allOrNothingRoundChance: normalizeNumber(
      source.allOrNothingRoundChance,
      DEFAULT_SCORING_SETTINGS.allOrNothingRoundChance,
      MIN_SPECIAL_ROUND_CHANCE,
      MAX_SPECIAL_ROUND_CHANCE
    ),
    allOrNothingRoundWinnerPoints: normalizeNumber(
      source.allOrNothingRoundWinnerPoints,
      DEFAULT_SCORING_SETTINGS.allOrNothingRoundWinnerPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    allOrNothingRoundLastPenaltyEnabled: source.allOrNothingRoundLastPenaltyEnabled === true,
    allOrNothingRoundLastPenalty: normalizeNumber(
      source.allOrNothingRoundLastPenalty,
      DEFAULT_SCORING_SETTINGS.allOrNothingRoundLastPenalty,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    kingOfTheRoundEnabled: source.kingOfTheRoundEnabled === true,
    kingOfTheRoundChance: normalizeNumber(
      source.kingOfTheRoundChance,
      DEFAULT_SCORING_SETTINGS.kingOfTheRoundChance,
      MIN_SPECIAL_ROUND_CHANCE,
      MAX_SPECIAL_ROUND_CHANCE
    ),
    kingOfTheRoundWinnerPoints: normalizeNumber(
      source.kingOfTheRoundWinnerPoints,
      DEFAULT_SCORING_SETTINGS.kingOfTheRoundWinnerPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    ),
    lastManPunishmentEnabled: source.lastManPunishmentEnabled === true,
    lastManPunishmentChance: normalizeNumber(
      source.lastManPunishmentChance,
      DEFAULT_SCORING_SETTINGS.lastManPunishmentChance,
      MIN_SPECIAL_ROUND_CHANCE,
      MAX_SPECIAL_ROUND_CHANCE
    ),
    lastManPunishmentPenaltyPoints: normalizeNumber(
      source.lastManPunishmentPenaltyPoints,
      DEFAULT_SCORING_SETTINGS.lastManPunishmentPenaltyPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
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

export function createCurrentMinusRound(scoringSettings, random = Math.random) {
  const settings = normalizeScoringSettings(scoringSettings);
  const active = settings.minusRoundEnabled && random() * 100 < settings.minusRoundChance;

  return {
    active,
    pointsStep: settings.minusRoundPointsStep,
  };
}

export const SPECIAL_ROUND_TYPES = {
  bonus: "bonus",
  minus: "minus",
  jackpot: "jackpot",
  robber: "robber",
  comeback: "comeback",
  risk: "risk",
  secret: "secret",
  mystery: "mystery",
  allOrNothing: "allOrNothing",
  kingOfTheRound: "kingOfTheRound",
  lastManPunishment: "lastManPunishment",
};

const SPECIAL_ROUND_PRIORITY = [
  SPECIAL_ROUND_TYPES.risk,
  SPECIAL_ROUND_TYPES.secret,
  SPECIAL_ROUND_TYPES.allOrNothing,
  SPECIAL_ROUND_TYPES.kingOfTheRound,
  SPECIAL_ROUND_TYPES.mystery,
  SPECIAL_ROUND_TYPES.jackpot,
  SPECIAL_ROUND_TYPES.robber,
  SPECIAL_ROUND_TYPES.comeback,
  SPECIAL_ROUND_TYPES.lastManPunishment,
  SPECIAL_ROUND_TYPES.minus,
  SPECIAL_ROUND_TYPES.bonus,
];

const SECRET_ROUND_POOL = [
  SPECIAL_ROUND_TYPES.bonus,
  SPECIAL_ROUND_TYPES.minus,
  SPECIAL_ROUND_TYPES.jackpot,
  SPECIAL_ROUND_TYPES.robber,
  SPECIAL_ROUND_TYPES.comeback,
  SPECIAL_ROUND_TYPES.mystery,
  SPECIAL_ROUND_TYPES.allOrNothing,
  SPECIAL_ROUND_TYPES.kingOfTheRound,
  SPECIAL_ROUND_TYPES.lastManPunishment,
];

export function specialRoundLabel(type) {
  if (type === SPECIAL_ROUND_TYPES.bonus) return "BONUS";
  if (type === SPECIAL_ROUND_TYPES.minus) return "MINUSRUNDE";
  if (type === SPECIAL_ROUND_TYPES.jackpot) return "JACKPOT";
  if (type === SPECIAL_ROUND_TYPES.robber) return "RÄUBER";
  if (type === SPECIAL_ROUND_TYPES.comeback) return "COMEBACK";
  if (type === SPECIAL_ROUND_TYPES.risk) return "RISIKO";
  if (type === SPECIAL_ROUND_TYPES.secret) return "GEHEIMRUNDE";
  if (type === SPECIAL_ROUND_TYPES.mystery) return "MYSTERY";
  if (type === SPECIAL_ROUND_TYPES.allOrNothing) return "ALLES ODER NICHTS";
  if (type === SPECIAL_ROUND_TYPES.kingOfTheRound) return "RUNDENKÖNIG";
  if (type === SPECIAL_ROUND_TYPES.lastManPunishment) return "LETZTER";
  return "";
}

export function normalizeSpecialRoundType(value) {
  return Object.values(SPECIAL_ROUND_TYPES).includes(value) ? value : null;
}

function specialRoundChance(settings, type) {
  if (type === SPECIAL_ROUND_TYPES.risk) return settings.riskRoundEnabled ? settings.riskRoundChance : 0;
  if (type === SPECIAL_ROUND_TYPES.jackpot) return settings.jackpotRoundEnabled ? settings.jackpotRoundChance : 0;
  if (type === SPECIAL_ROUND_TYPES.robber) return settings.robberRoundEnabled ? settings.robberRoundChance : 0;
  if (type === SPECIAL_ROUND_TYPES.comeback) return settings.comebackRoundEnabled ? settings.comebackRoundChance : 0;
  if (type === SPECIAL_ROUND_TYPES.secret) return settings.secretRoundEnabled ? settings.secretRoundChance : 0;
  if (type === SPECIAL_ROUND_TYPES.mystery) return settings.mysteryRoundEnabled ? settings.mysteryRoundChance : 0;
  if (type === SPECIAL_ROUND_TYPES.allOrNothing) return settings.allOrNothingRoundEnabled ? settings.allOrNothingRoundChance : 0;
  if (type === SPECIAL_ROUND_TYPES.kingOfTheRound) return settings.kingOfTheRoundEnabled ? settings.kingOfTheRoundChance : 0;
  if (type === SPECIAL_ROUND_TYPES.lastManPunishment) return settings.lastManPunishmentEnabled ? settings.lastManPunishmentChance : 0;
  if (type === SPECIAL_ROUND_TYPES.minus) return settings.minusRoundEnabled ? settings.minusRoundChance : 0;
  if (type === SPECIAL_ROUND_TYPES.bonus) return settings.bonusEnabled ? settings.bonusChance : 0;
  return 0;
}

function randomStepValue(random, min, max, step) {
  const safeStep = Math.max(1, Math.round(Number(step)) || 1);
  const low = Math.min(Number(min) || 0, Number(max) || 0);
  const high = Math.max(Number(min) || 0, Number(max) || 0);
  const slots = Math.max(0, Math.floor((high - low) / safeStep));
  return low + Math.floor(random() * (slots + 1)) * safeStep;
}

function specialRoundConfig(settings, type, random = Math.random) {
  if (type === SPECIAL_ROUND_TYPES.bonus) {
    return { multiplier: settings.bonusMultiplier };
  }
  if (type === SPECIAL_ROUND_TYPES.minus) {
    return { pointsStep: settings.minusRoundPointsStep };
  }
  if (type === SPECIAL_ROUND_TYPES.jackpot) {
    return { bonusPoints: settings.jackpotRoundBonusPoints };
  }
  if (type === SPECIAL_ROUND_TYPES.robber) {
    return { stealAmount: settings.robberRoundStealAmount };
  }
  if (type === SPECIAL_ROUND_TYPES.comeback) {
    return {
      lastBonus: settings.comebackRoundLastBonus,
      secondLastBonus: settings.comebackRoundSecondLastBonus,
    };
  }
  if (type === SPECIAL_ROUND_TYPES.risk) {
    return {
      rewardPoints: settings.riskRoundRewardPoints,
      penaltyPoints: settings.riskRoundPenaltyPoints,
      successPlaces: settings.riskRoundSuccessPlaces,
    };
  }
  if (type === SPECIAL_ROUND_TYPES.mystery) {
    return {
      minBonus: settings.mysteryRoundMinBonus,
      maxBonus: settings.mysteryRoundMaxBonus,
      step: settings.mysteryRoundStep,
      bonusPoints: randomStepValue(
        random,
        settings.mysteryRoundMinBonus,
        settings.mysteryRoundMaxBonus,
        settings.mysteryRoundStep
      ),
    };
  }
  if (type === SPECIAL_ROUND_TYPES.allOrNothing) {
    return {
      winnerPoints: settings.allOrNothingRoundWinnerPoints,
      lastPenaltyEnabled: settings.allOrNothingRoundLastPenaltyEnabled,
      lastPenalty: settings.allOrNothingRoundLastPenalty,
    };
  }
  if (type === SPECIAL_ROUND_TYPES.kingOfTheRound) {
    return { winnerPoints: settings.kingOfTheRoundWinnerPoints };
  }
  if (type === SPECIAL_ROUND_TYPES.lastManPunishment) {
    return { penaltyPoints: settings.lastManPunishmentPenaltyPoints };
  }
  return {};
}

export function effectiveSpecialRoundType(round) {
  const type = normalizeSpecialRoundType(round?.type ?? round?.specialRoundType);
  if (type !== SPECIAL_ROUND_TYPES.secret) return type;
  return normalizeSpecialRoundType(round?.resolvedType ?? round?.resolvedSpecialRoundType) ?? null;
}

export function specialRoundText(round, { revealHidden = false } = {}) {
  const type = normalizeSpecialRoundType(round?.type);
  const hidden = round?.hidden === true || type === SPECIAL_ROUND_TYPES.secret;
  const visibleType = hidden && revealHidden
    ? effectiveSpecialRoundType(round) ?? type
    : type;
  const config = isPlainObject(round?.config) ? round.config : {};
  const prefix = hidden && revealHidden ? "GEHEIMRUNDE: " : "";
  if (!visibleType) return "";
  if (hidden && !revealHidden) return "GEHEIMRUNDE";
  if (visibleType === SPECIAL_ROUND_TYPES.bonus) return `${prefix}BONUS ×${formatMultiplier(config.multiplier ?? 1)}`;
  if (visibleType === SPECIAL_ROUND_TYPES.minus) return `${prefix}MINUSRUNDE · -${formatMultiplier(config.pointsStep ?? 0)} pro Platz`;
  if (visibleType === SPECIAL_ROUND_TYPES.jackpot) return `${prefix}JACKPOT +${formatMultiplier(config.bonusPoints ?? 0)}`;
  if (visibleType === SPECIAL_ROUND_TYPES.robber) return `${prefix}RÄUBER · +${formatMultiplier(config.stealAmount ?? 0)} / -${formatMultiplier(config.stealAmount ?? 0)}`;
  if (visibleType === SPECIAL_ROUND_TYPES.comeback) return `${prefix}COMEBACK · +${formatMultiplier(config.lastBonus ?? 0)} / +${formatMultiplier(config.secondLastBonus ?? 0)}`;
  if (visibleType === SPECIAL_ROUND_TYPES.risk) return `${prefix}RISIKO · +${formatMultiplier(config.rewardPoints ?? 0)} / -${formatMultiplier(config.penaltyPoints ?? 0)}`;
  if (visibleType === SPECIAL_ROUND_TYPES.mystery) return `${prefix}MYSTERY +${formatMultiplier(config.bonusPoints ?? 0)}`;
  if (visibleType === SPECIAL_ROUND_TYPES.allOrNothing) return `${prefix}ALLES ODER NICHTS +${formatMultiplier(config.winnerPoints ?? 0)}${config.lastPenaltyEnabled ? ` / -${formatMultiplier(config.lastPenalty ?? 0)}` : ""}`;
  if (visibleType === SPECIAL_ROUND_TYPES.kingOfTheRound) return `${prefix}RUNDENKÖNIG +${formatMultiplier(config.winnerPoints ?? 0)}`;
  if (visibleType === SPECIAL_ROUND_TYPES.lastManPunishment) return `${prefix}LETZTER -${formatMultiplier(config.penaltyPoints ?? 0)}`;
  return `${prefix}${specialRoundLabel(visibleType)}`;
}

export function createCurrentSpecialRound(scoringSettings, random = Math.random) {
  const settings = normalizeScoringSettings(scoringSettings);
  const type = SPECIAL_ROUND_PRIORITY.find((candidate) => random() * 100 < specialRoundChance(settings, candidate));

  if (!type) return null;

  if (type === SPECIAL_ROUND_TYPES.secret) {
    const resolvedType = SECRET_ROUND_POOL[Math.floor(random() * SECRET_ROUND_POOL.length)] ?? SPECIAL_ROUND_TYPES.jackpot;
    return {
      type,
      label: specialRoundLabel(type),
      hidden: true,
      resolvedType,
      config: specialRoundConfig(settings, resolvedType, random),
    };
  }

  return {
    type,
    label: specialRoundLabel(type),
    hidden: false,
    resolvedType: null,
    config: specialRoundConfig(settings, type, random),
  };
}

export function createCurrentRoundModifiers(scoringSettings, random = Math.random) {
  const settings = normalizeScoringSettings(scoringSettings);
  const currentSpecialRound = createCurrentSpecialRound(settings, random);
  const currentMinusRound = currentSpecialRound?.type === SPECIAL_ROUND_TYPES.minus
    ? { active: true, pointsStep: currentSpecialRound.config.pointsStep }
    : { active: false, pointsStep: settings.minusRoundPointsStep };
  const currentBonus = currentSpecialRound?.type === SPECIAL_ROUND_TYPES.bonus
    ? { active: true, multiplier: currentSpecialRound.config.multiplier }
    : { active: false, multiplier: settings.bonusMultiplier };

  return {
    currentBonus,
    currentMinusRound,
    currentSpecialRound,
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

export function normalizeCurrentMinusRound(value, scoringSettings, hasCurrentPick) {
  if (!hasCurrentPick) return null;

  const settings = normalizeScoringSettings(scoringSettings);
  if (!isPlainObject(value)) {
    return {
      active: false,
      pointsStep: settings.minusRoundPointsStep,
    };
  }

  return {
    active: value.active === true,
    pointsStep: normalizeNumber(
      value.pointsStep,
      settings.minusRoundPointsStep,
      MIN_MINUS_ROUND_POINTS_STEP,
      MAX_MINUS_ROUND_POINTS_STEP
    ),
  };
}

export function normalizeCurrentSpecialRound(value, scoringSettings, hasCurrentPick) {
  if (!hasCurrentPick) return null;

  const settings = normalizeScoringSettings(scoringSettings);
  if (!isPlainObject(value)) return null;

  const type = normalizeSpecialRoundType(value.type);
  if (!type) return null;

  const resolvedType = type === SPECIAL_ROUND_TYPES.secret
    ? normalizeSpecialRoundType(value.resolvedType) ?? SPECIAL_ROUND_TYPES.jackpot
    : null;
  const configType = resolvedType ?? type;
  const fallbackConfig = specialRoundConfig(settings, configType, () => 0);
  const sourceConfig = isPlainObject(value.config) ? value.config : {};
  const config = { ...fallbackConfig };

  if (configType === SPECIAL_ROUND_TYPES.bonus) {
    config.multiplier = normalizeNumber(
      sourceConfig.multiplier,
      fallbackConfig.multiplier,
      MIN_BONUS_MULTIPLIER,
      MAX_BONUS_MULTIPLIER
    );
  } else if (configType === SPECIAL_ROUND_TYPES.minus) {
    config.pointsStep = normalizeNumber(
      sourceConfig.pointsStep,
      fallbackConfig.pointsStep,
      MIN_MINUS_ROUND_POINTS_STEP,
      MAX_MINUS_ROUND_POINTS_STEP
    );
  } else if (configType === SPECIAL_ROUND_TYPES.jackpot) {
    config.bonusPoints = normalizeNumber(
      sourceConfig.bonusPoints,
      fallbackConfig.bonusPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
  } else if (configType === SPECIAL_ROUND_TYPES.robber) {
    config.stealAmount = normalizeNumber(
      sourceConfig.stealAmount,
      fallbackConfig.stealAmount,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
  } else if (configType === SPECIAL_ROUND_TYPES.comeback) {
    config.lastBonus = normalizeNumber(
      sourceConfig.lastBonus,
      fallbackConfig.lastBonus,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
    config.secondLastBonus = normalizeNumber(
      sourceConfig.secondLastBonus,
      fallbackConfig.secondLastBonus,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
  } else if (configType === SPECIAL_ROUND_TYPES.risk) {
    config.rewardPoints = normalizeNumber(
      sourceConfig.rewardPoints,
      fallbackConfig.rewardPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
    config.penaltyPoints = normalizeNumber(
      sourceConfig.penaltyPoints,
      fallbackConfig.penaltyPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
    config.successPlaces = normalizeNumber(
      sourceConfig.successPlaces,
      fallbackConfig.successPlaces,
      MIN_RISK_SUCCESS_PLACES,
      MAX_RISK_SUCCESS_PLACES
    );
  } else if (configType === SPECIAL_ROUND_TYPES.mystery) {
    config.minBonus = normalizeNumber(
      sourceConfig.minBonus,
      fallbackConfig.minBonus,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
    config.maxBonus = normalizeNumber(
      sourceConfig.maxBonus,
      fallbackConfig.maxBonus,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
    config.step = normalizeNumber(
      sourceConfig.step,
      fallbackConfig.step,
      1,
      MAX_SPECIAL_ROUND_POINTS
    );
    config.bonusPoints = normalizeNumber(
      sourceConfig.bonusPoints,
      fallbackConfig.bonusPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
  } else if (configType === SPECIAL_ROUND_TYPES.allOrNothing) {
    config.winnerPoints = normalizeNumber(
      sourceConfig.winnerPoints,
      fallbackConfig.winnerPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
    config.lastPenaltyEnabled = sourceConfig.lastPenaltyEnabled === true;
    config.lastPenalty = normalizeNumber(
      sourceConfig.lastPenalty,
      fallbackConfig.lastPenalty,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
  } else if (configType === SPECIAL_ROUND_TYPES.kingOfTheRound) {
    config.winnerPoints = normalizeNumber(
      sourceConfig.winnerPoints,
      fallbackConfig.winnerPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
  } else if (configType === SPECIAL_ROUND_TYPES.lastManPunishment) {
    config.penaltyPoints = normalizeNumber(
      sourceConfig.penaltyPoints,
      fallbackConfig.penaltyPoints,
      MIN_SPECIAL_ROUND_POINTS,
      MAX_SPECIAL_ROUND_POINTS
    );
  }

  return {
    type,
    label: specialRoundLabel(type),
    hidden: type === SPECIAL_ROUND_TYPES.secret ? true : value.hidden === true,
    resolvedType,
    config,
  };
}

export function minusPointsForPlace(placeIndex, scoringSettingsOrStep) {
  const step = typeof scoringSettingsOrStep === "number"
    ? scoringSettingsOrStep
    : normalizeScoringSettings(scoringSettingsOrStep).minusRoundPointsStep;
  const place = Math.max(1, Math.round(Number(placeIndex)) || 1);

  return -Math.max(0, place - 1) * step;
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
