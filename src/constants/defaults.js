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
