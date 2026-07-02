import { useCallback, useEffect, useRef } from "react";

import { normalizeSoundSettings } from "../utils/sound";

function audioContextConstructor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function safeNow(ctx) {
  return Math.max(0, ctx.currentTime);
}

function tone(ctx, {
  start = safeNow(ctx),
  duration = 0.08,
  frequency = 880,
  endFrequency = null,
  gain = 0.08,
  type = "sine",
}) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const stopAt = start + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, frequency), start);
  if (endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), stopAt);
  }

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(Math.max(0.0001, gain), start + Math.min(0.018, duration / 3));
  amp.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(stopAt + 0.025);
}

function noiseBurst(ctx, volume) {
  const duration = 0.42;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    const progress = index / data.length;
    const fade = Math.sin(progress * Math.PI);
    data[index] = (Math.random() * 2 - 1) * fade * 0.45;
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  const now = safeNow(ctx);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(420, now);
  filter.frequency.exponentialRampToValueAtTime(1400, now + duration);
  filter.Q.setValueAtTime(0.8, now);

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(0.12 * volume, now + 0.05);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  source.start(now);
  source.stop(now + duration + 0.03);
}

function arpeggio(ctx, volume, notes, gain = 0.07, duration = 0.11) {
  const now = safeNow(ctx);
  notes.forEach((frequency, index) => {
    tone(ctx, {
      start: now + index * 0.105,
      duration,
      frequency,
      gain: gain * volume,
      type: "triangle",
    });
  });
}

export function useSoundEffects(settings) {
  const contextRef = useRef(null);
  const settingsRef = useRef(normalizeSoundSettings(settings));

  useEffect(() => {
    settingsRef.current = normalizeSoundSettings(settings);
  }, [settings]);

  useEffect(() => {
    return () => {
      const ctx = contextRef.current;
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }
    };
  }, []);

  const ensureContext = useCallback(() => {
    if (contextRef.current) return contextRef.current;

    const AudioContextCtor = audioContextConstructor();
    if (!AudioContextCtor) return null;

    try {
      contextRef.current = new AudioContextCtor();
      return contextRef.current;
    } catch {
      return null;
    }
  }, []);

  const unlock = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx || ctx.state !== "suspended") return;
    ctx.resume().catch(() => {});
  }, [ensureContext]);

  const run = useCallback((category, play) => {
    const normalized = settingsRef.current;
    if (!normalized.enabled) return;
    if (category && normalized[category] === false) return;

    const ctx = ensureContext();
    if (!ctx) return;

    const playSafely = () => {
      try {
        play(ctx, normalized.volume);
      } catch {
        // Audio should never break the tournament UI.
      }
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(playSafely).catch(() => {});
      return;
    }

    playSafely();
  }, [ensureContext]);

  const playCountdownTick = useCallback(() => {
    run("countdown", (ctx, volume) => {
      tone(ctx, {
        duration: 0.075,
        frequency: 820,
        endFrequency: 980,
        gain: 0.07 * volume,
        type: "sine",
      });
    });
  }, [run]);

  const playCountdownGo = useCallback(() => {
    run("countdown", (ctx, volume) => {
      arpeggio(ctx, volume, [520, 780], 0.08, 0.13);
    });
  }, [run]);

  const playWheelStart = useCallback(() => {
    run("wheel", (ctx, volume) => {
      noiseBurst(ctx, volume);
      tone(ctx, {
        duration: 0.22,
        frequency: 220,
        endFrequency: 420,
        gain: 0.035 * volume,
        type: "sawtooth",
      });
    });
  }, [run]);

  const playWheelTick = useCallback(() => {
    run("wheel", (ctx, volume) => {
      tone(ctx, {
        duration: 0.022,
        frequency: 1320,
        gain: 0.035 * volume,
        type: "square",
      });
    });
  }, [run]);

  const playReveal = useCallback(() => {
    run("reveal", (ctx, volume) => {
      const now = safeNow(ctx);
      tone(ctx, {
        start: now,
        duration: 0.11,
        frequency: 660,
        endFrequency: 990,
        gain: 0.07 * volume,
        type: "triangle",
      });
      tone(ctx, {
        start: now + 0.08,
        duration: 0.16,
        frequency: 990,
        endFrequency: 1320,
        gain: 0.045 * volume,
        type: "sine",
      });
    });
  }, [run]);

  const playSave = useCallback(() => {
    run("save", (ctx, volume) => {
      arpeggio(ctx, volume, [523, 784], 0.06, 0.12);
    });
  }, [run]);

  const playWinner = useCallback(() => {
    run("winner", (ctx, volume) => {
      arpeggio(ctx, volume, [523, 659, 784, 1046, 1318], 0.065, 0.16);
    });
  }, [run]);

  const playTestSound = useCallback(() => {
    run(null, (ctx, volume) => {
      arpeggio(ctx, volume, [660, 990, 1320], 0.06, 0.09);
    });
  }, [run]);

  return {
    unlock,
    playCountdownTick,
    playCountdownGo,
    playWheelStart,
    playWheelTick,
    playReveal,
    playSave,
    playWinner,
    playTestSound,
  };
}
