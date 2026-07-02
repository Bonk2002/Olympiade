import { LS_KEYS } from "../constants/defaults";
import { clamp } from "./common";
import { isPlainObject } from "./validation";

export const SOUND_SETTINGS_VERSION = 1;

export const DEFAULT_SOUND_SETTINGS = {
  enabled: true,
  volume: 0.45,
  countdown: true,
  wheel: true,
  reveal: true,
  save: true,
  winner: true,
};

export function normalizeSoundSettings(value) {
  const source = isPlainObject(value) ? value : DEFAULT_SOUND_SETTINGS;
  const volume = Number(source.volume);

  return {
    enabled: source.enabled !== false,
    volume: Number.isFinite(volume) ? clamp(volume, 0, 1) : DEFAULT_SOUND_SETTINGS.volume,
    countdown: source.countdown !== false,
    wheel: source.wheel !== false,
    reveal: source.reveal !== false,
    save: source.save !== false,
    winner: source.winner !== false,
  };
}

export function loadSoundSettings() {
  try {
    const raw = localStorage.getItem(LS_KEYS.soundSettings);
    if (!raw) return normalizeSoundSettings();

    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed) || parsed.version !== SOUND_SETTINGS_VERSION) {
      return normalizeSoundSettings(parsed);
    }

    return normalizeSoundSettings(parsed);
  } catch {
    return normalizeSoundSettings();
  }
}

export function saveSoundSettings(settings) {
  try {
    localStorage.setItem(
      LS_KEYS.soundSettings,
      JSON.stringify({
        version: SOUND_SETTINGS_VERSION,
        ...normalizeSoundSettings(settings),
      })
    );
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}
