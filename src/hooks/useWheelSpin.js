import { useCallback, useEffect, useRef, useState } from "react";

import { TournamentEngine } from "../engine/TournamentEngine";
import { clamp } from "../utils/common";
import { angleForWheelEntry, wheelAngleForSelection } from "../utils/wheel";

export function useWheelSpin({
  tournament,
  currentGame,
  games,
  onPick,
  onToast,
  onSpinStart,
  onSpinTick,
}) {
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const wheelAngleRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    wheelAngleRef.current = wheelAngle;
  }, [wheelAngle]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const spin = useCallback(() => {
    if (spinning) return;
    if (!tournament) {
      onToast("Turnier starten");
      return;
    }
    if (currentGame) {
      onToast("Erst aktuelle Runde speichern oder skippen");
      return;
    }
    if (games.length === 0) {
      onToast("Keine offenen Games");
      return;
    }

    const picked = TournamentEngine.pickGameFromWheel(tournament);
    if (!picked) {
      onToast("Keine Auswahl");
      return;
    }

    setSpinning(true);
    if (onSpinStart) onSpinStart();

    const startTime = performance.now();
    const duration = 2200 + Math.random() * 900;
    const extraTurns = 4 + Math.floor(Math.random() * 3);
    const startAngle = wheelAngleRef.current;
    const selectionAngle = angleForWheelEntry(games, picked.id);
    const targetAngle =
      selectionAngle == null
        ? startAngle + extraTurns * Math.PI * 2
        : wheelAngleForSelection(selectionAngle, startAngle, extraTurns);
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    let lastTickTime = startTime;
    let tickCount = 0;

    function frame(now) {
      const progress = clamp((now - startTime) / duration, 0, 1);
      const eased = easeOutCubic(progress);
      const angle = startAngle + (targetAngle - startAngle) * eased;
      wheelAngleRef.current = angle;
      setWheelAngle(angle);

      if (
        onSpinTick &&
        progress > 0.04 &&
        progress < 0.94 &&
        tickCount < 10 &&
        now - lastTickTime > 220
      ) {
        lastTickTime = now;
        tickCount += 1;
        onSpinTick(progress);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      setSpinning(false);
      onPick(picked.id);
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [currentGame, games, onPick, onSpinStart, onSpinTick, onToast, spinning, tournament]);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    wheelAngleRef.current = 0;
    setWheelAngle(0);
    setSpinning(false);
  }, []);

  return { wheelAngle, spinning, spin, reset };
}
