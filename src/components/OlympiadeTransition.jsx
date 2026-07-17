import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { formatMultiplier } from "../utils/common";

const SEGMENTS = [
  "#35ffb1",
  "#b100ff",
  "#35ffb1",
  "#ffcc66",
  "#b100ff",
  "#35ffb1",
  "#b100ff",
  "#ffcc66",
  "#35ffb1",
  "#b100ff",
  "#35ffb1",
  "#ffcc66",
];

function usePrefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function transitionDuration(variant, reducedMotion) {
  if (reducedMotion) return 900;
  if (variant === "start") return 2700;
  if (variant === "winner") return 5200;
  if (variant === "bonus") return 4800;
  if (variant === "minus") return 4800;
  return 4200;
}

function safeWinnerName(value) {
  return String(value || "Unentschieden").trim() || "Unentschieden";
}

function TransitionLogo() {
  return (
    <div className="olympia-transition__logo" aria-hidden="true">
      <svg className="olympia-transition__wheel" viewBox="0 0 180 180">
        <defs>
          <linearGradient id="olympia-wheel-main" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#35ffb1" />
            <stop offset="50%" stopColor="#b100ff" />
            <stop offset="100%" stopColor="#ffcc66" />
          </linearGradient>
          <radialGradient id="olympia-hub" cx="50%" cy="46%" r="58%">
            <stop offset="0%" stopColor="#211031" />
            <stop offset="68%" stopColor="#09040f" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <filter id="olympia-wheel-glow" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="3.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="olympia-trophy-gold" x1="62" x2="118" y1="54" y2="138">
            <stop offset="0%" stopColor="#fff3b0" />
            <stop offset="38%" stopColor="#ffd45a" />
            <stop offset="100%" stopColor="#ff9f1c" />
          </linearGradient>
        </defs>

        <circle cx="90" cy="90" r="76" className="olympia-transition__wheel-shadow" />
        <g className="olympia-transition__rotor">
          <g className="olympia-transition__segments">
            {SEGMENTS.map((color, index) => (
              <circle
                key={`${color}-${index}`}
                cx="90"
                cy="90"
                r="69"
                className="olympia-transition__segment"
                pathLength="120"
                style={{
                  "--segment-index": index,
                  stroke: color,
                  transform: `rotate(${index * 30}deg)`,
                  transformOrigin: "90px 90px",
                }}
              />
            ))}
          </g>
          <circle cx="90" cy="90" r="76" className="olympia-transition__wheel-outer" />
          <g className="olympia-transition__spokes">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <line
                key={index}
                x1="90"
                y1="43"
                x2="90"
                y2="68"
                className="olympia-transition__wheel-spoke"
                style={{
                  transform: `rotate(${index * 60}deg)`,
                  transformOrigin: "90px 90px",
                }}
              />
            ))}
          </g>
        </g>
        <circle cx="90" cy="90" r="47" className="olympia-transition__wheel-hub" />
        <g className="olympia-transition__emblem">
          <g className="olympia-transition__emblem-inner">
            <path
              className="olympia-transition__trophy-glow"
              d="M61 55h58v13h-5v5c0 18-7 31-19 37v11h17v10H68v-10h17v-11c-12-6-19-19-19-37v-5h-5V55Z"
            />
            <path
              className="olympia-transition__trophy-handle"
              d="M67 68H55c0 20 10 32 27 35l2-11c-11-2-18-9-18-22v-2Z"
            />
            <path
              className="olympia-transition__trophy-handle"
              d="M113 68h12c0 20-10 32-27 35l-2-11c11-2 18-9 18-22v-2Z"
            />
            <path
              className="olympia-transition__trophy-body"
              d="M66 56h48v16c0 24-9 38-24 38S66 96 66 72V56Z"
            />
            <path
              className="olympia-transition__trophy-rim"
              d="M61 53h58v12H61V53Z"
            />
            <path
              className="olympia-transition__trophy-stem"
              d="M84 108h12v16H84v-16Z"
            />
            <path
              className="olympia-transition__trophy-base"
              d="M72 121h36v9H72v-9Zm-9 9h54v10H63v-10Z"
            />
            <path
              className="olympia-transition__trophy-highlight"
              d="M80 64h12c-1 16-4 27-11 35-4-7-5-18-5-27v-8h4Z"
            />
            <path
              className="olympia-transition__trophy-shine"
              d="M102 66h8M70 78h9M98 118h13"
            />
          </g>
        </g>
      </svg>

      <div className="olympia-transition__brand">
        <strong>OLYMPIADE</strong>
        <span>Turnier Glücksrad</span>
      </div>
    </div>
  );
}

export function OlympiadeTransition({
  active,
  variant = "game",
  gameName = "",
  roundLabel = "",
  tournamentRound = "",
  scoringLabel = "",
  bonusActive = false,
  bonusMultiplier = 1,
  minusRoundActive = false,
  minusRoundStep = 0,
  totalMultiplier = 1,
  winnerName = "",
  winnerLabel = "Gewinner",
  onComplete,
}) {
  const completedRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const normalizedVariant = minusRoundActive && variant === "game"
    ? "minus"
    : bonusActive && variant === "game"
      ? "bonus"
      : variant;
  const isBonus = normalizedVariant === "bonus";
  const isMinus = normalizedVariant === "minus";
  const isStart = normalizedVariant === "start";
  const isWinner = normalizedVariant === "winner";
  const duration = transitionDuration(normalizedVariant, prefersReducedMotion);
  const rootClass = `olympia-transition olympia-transition--${normalizedVariant}`;
  const title = isStart
    ? "TURNIER STARTET"
    : isWinner
      ? `${safeWinnerName(winnerName)} gewinnt`
      : gameName;
  const titleClassName = [
    isWinner ? "winnerName" : "",
    !/\s/.test(title) && title.length > 16 ? "singleWordTitle" : "",
  ].filter(Boolean).join(" ");
  const eyebrow = isStart
    ? "OLYMPIADE"
    : isWinner
      ? "TURNIER BEENDET"
      : "NÄCHSTES SPIEL";

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!active) return undefined;

    completedRef.current = false;
    const timer = window.setTimeout(complete, duration);

    function onKeyDown(event) {
      if (event.key === "Enter" || event.key === "Escape") {
        complete();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, complete, duration]);

  if (!active) return null;

  const overlay = (
    <div
      className={rootClass}
      role="button"
      tabIndex={0}
      aria-label="Transition überspringen"
      onClick={complete}
    >
      <div className="olympia-transition__split olympia-transition__split--left" />
      <div className="olympia-transition__split olympia-transition__split--right" />
      <div className="olympia-transition__scanline" />

      <section className="olympia-transition__stage" aria-live="polite">
        <TransitionLogo />

        <div className="olympia-transition__reveal">
          {isBonus && (
            <div className="olympia-transition__bonus-title">
              BONUS ×{formatMultiplier(bonusMultiplier)}
            </div>
          )}
          {isMinus && (
            <div className="olympia-transition__minus-title">
              MINUSRUNDE · -{formatMultiplier(minusRoundStep)} pro Platz
            </div>
          )}
          {isWinner && <div className="olympia-transition__winner-title">{winnerLabel}</div>}
          <p className="olympia-transition__eyebrow">{eyebrow}</p>
          <h1 className={titleClassName}>{title}</h1>
          {!isStart && !isWinner && (
            <div className="olympia-transition__chips">
              {roundLabel && <span>{roundLabel}</span>}
              {tournamentRound && <span>{tournamentRound}</span>}
              {scoringLabel && <span>{scoringLabel}</span>}
              {isBonus && (
                <span className="olympia-transition__chip-bonus">
                  BONUS ×{formatMultiplier(bonusMultiplier)}
                </span>
              )}
              {isMinus ? (
                <span className="olympia-transition__chip-minus">
                  MINUSRUNDE · -{formatMultiplier(minusRoundStep)} pro Platz
                </span>
              ) : (
                <span>Gesamt ×{formatMultiplier(totalMultiplier)}</span>
              )}
            </div>
          )}
          {isStart && (
            <div className="olympia-transition__chips olympia-transition__chips--center">
              <span>Bereit für Runde 1</span>
              <span>Viel Erfolg</span>
            </div>
          )}
          {isWinner && (
            <div className="olympia-transition__chips olympia-transition__chips--center">
              <span>Finale Wertung</span>
              <span>Winning Screen öffnet gleich</span>
            </div>
          )}
        </div>
      </section>

      <div className="olympia-transition__skip">Klick, Enter oder Esc überspringt</div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) {
    return overlay;
  }

  return createPortal(overlay, document.body);
}
