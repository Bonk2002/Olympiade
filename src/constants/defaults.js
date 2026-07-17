export const LS_KEYS = {
  games: "tg_presets_games_v5",
  players: "tg_presets_players_v5",
  mode: "tg_mode_v5",
  activeTournament: "tg_active_tournament_v1",
  setupState: "tg_setup_state_v1",
  scoringSettings: "tg_scoring_settings_v1",
  soundSettings: "tg_sound_settings_v1",
  wheelSettings: "tg_wheel_settings_v1",
  finishedTournaments: "tg_finished_tournaments_v1",
};

export const ACTIVE_TOURNAMENT_VERSION = 1;
export const SETUP_STATE_VERSION = 1;
export const SCORING_SETTINGS_VERSION = 1;
export const WHEEL_SETTINGS_VERSION = 1;

export const DEFAULT_SCORING_SETTINGS = {
  pointsByPlace: [1000, 500, 250, 125],
  multiplierEnabled: false,
  multiplier: 1.5,
  multiplierMode: "global",
  bonusEnabled: false,
  bonusMultiplier: 2,
  bonusChance: 15,
  minusRoundEnabled: false,
  minusRoundChance: 15,
  minusRoundPointsStep: 250,
  jackpotRoundEnabled: false,
  jackpotRoundChance: 10,
  jackpotRoundBonusPoints: 500,
  robberRoundEnabled: false,
  robberRoundChance: 10,
  robberRoundStealAmount: 300,
  comebackRoundEnabled: false,
  comebackRoundChance: 10,
  comebackRoundLastBonus: 500,
  comebackRoundSecondLastBonus: 250,
  riskRoundEnabled: false,
  riskRoundChance: 10,
  riskRoundRewardPoints: 500,
  riskRoundPenaltyPoints: 500,
  riskRoundSuccessPlaces: 1,
  secretRoundEnabled: false,
  secretRoundChance: 10,
  mysteryRoundEnabled: false,
  mysteryRoundChance: 10,
  mysteryRoundMinBonus: 100,
  mysteryRoundMaxBonus: 1000,
  mysteryRoundStep: 100,
  allOrNothingRoundEnabled: false,
  allOrNothingRoundChance: 10,
  allOrNothingRoundWinnerPoints: 1500,
  allOrNothingRoundLastPenaltyEnabled: false,
  allOrNothingRoundLastPenalty: 500,
  kingOfTheRoundEnabled: false,
  kingOfTheRoundChance: 10,
  kingOfTheRoundWinnerPoints: 1500,
  lastManPunishmentEnabled: false,
  lastManPunishmentChance: 10,
  lastManPunishmentPenaltyPoints: 500,
};

export const DEFAULT_WHEEL_SETTINGS = {
  weightMode: "equal",
  noRepeat: false,
};

export const MIN_SCORING_PLACES = DEFAULT_SCORING_SETTINGS.pointsByPlace.length;
export const MAX_SCORING_PLACES = 32;
export const MAX_POINTS_VALUE = 1000000;
export const MIN_MULTIPLIER = 0.01;
export const MAX_MULTIPLIER = 10;
export const MIN_BONUS_MULTIPLIER = 0.01;
export const MAX_BONUS_MULTIPLIER = 100;
export const MIN_BONUS_CHANCE = 0;
export const MAX_BONUS_CHANCE = 100;
export const MIN_MINUS_ROUND_CHANCE = 0;
export const MAX_MINUS_ROUND_CHANCE = 100;
export const MIN_MINUS_ROUND_POINTS_STEP = 1;
export const MAX_MINUS_ROUND_POINTS_STEP = 1000000;
export const MIN_SPECIAL_ROUND_CHANCE = 0;
export const MAX_SPECIAL_ROUND_CHANCE = 100;
export const MIN_SPECIAL_ROUND_POINTS = 0;
export const MAX_SPECIAL_ROUND_POINTS = 1000000;
export const MIN_RISK_SUCCESS_PLACES = 1;
export const MAX_RISK_SUCCESS_PLACES = 2;
