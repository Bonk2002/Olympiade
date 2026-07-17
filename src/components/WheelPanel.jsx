import { useEffect, useRef } from "react";

import { formatMultiplier, formatPoints } from "../utils/common";
import {
  basePointsForPlace,
  gameScoringModeLabel,
  multiplierModeLabel,
  normalizeGameScoringMode,
  normalizeScoringSettings,
  roundMultiplier,
  SPECIAL_ROUND_TYPES,
  specialRoundText,
} from "../utils/scoring";
import {
  ROUND_EVALUATION_MODES,
  isPlacementRoundEvaluationMode,
  normalizeRoundEvaluationMode,
  roundEvaluationModeOptions,
  teamRankingFromPlayers,
  teamsWithPlayers,
} from "../utils/teams";
import {
  normalizeWheelSettings,
  totalWheelWeight,
  wheelWeightModeLabel,
} from "../utils/wheel";

const WHEEL_FONT = "ui-sans-serif, system-ui";

function compactText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  const ellipsis = "…";
  let compact = text;
  while (compact.length > 1 && ctx.measureText(`${compact}${ellipsis}`).width > maxWidth) {
    compact = compact.slice(0, -1);
  }
  return `${compact}${ellipsis}`;
}

function wrapWheelLabel(ctx, label, maxWidth, maxLines) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1 || maxLines === 1) {
    return [compactText(ctx, label, maxWidth)];
  }

  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(nextLine).width <= maxWidth || !currentLine) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) lines.push(currentLine);

  if (lines.length <= maxLines) return lines;

  const keptLines = lines.slice(0, maxLines);
  keptLines[maxLines - 1] = compactText(
    ctx,
    lines.slice(maxLines - 1).join(" "),
    maxWidth
  );
  return keptLines;
}

function fitWheelLabel(ctx, label, { maxWidth, maxLines, maxFontSize, minFontSize }) {
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    ctx.font = `800 ${fontSize}px ${WHEEL_FONT}`;
    const lines = wrapWheelLabel(ctx, label, maxWidth, maxLines);
    const fits = lines.every((line) => ctx.measureText(line).width <= maxWidth + 1);
    if (fits) return { fontSize, lines };
  }

  ctx.font = `800 ${minFontSize}px ${WHEEL_FONT}`;
  return {
    fontSize: minFontSize,
    lines: wrapWheelLabel(ctx, label, maxWidth, 1),
  };
}

function drawWheelLabel(ctx, label, { radius, slice, gameCount }) {
  const maxLines = gameCount <= 10 && /\s/.test(label) ? 2 : 1;
  const maxFontSize = gameCount > 14 ? 14 : gameCount > 10 ? 16 : gameCount > 6 ? 18 : 22;
  const minFontSize = gameCount > 12 ? 8 : 9;
  const maxWidth = Math.max(58, Math.min(radius * 0.52, slice * radius * 0.72));
  const { fontSize, lines } = fitWheelLabel(ctx, label, {
    maxWidth,
    maxLines,
    maxFontSize,
    minFontSize,
  });
  const lineHeight = fontSize * 1.08;
  const firstLineY = -((lines.length - 1) * lineHeight) / 2;

  ctx.font = `800 ${fontSize}px ${WHEEL_FONT}`;
  ctx.fillStyle = "rgba(233,226,255,.94)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(177,0,255,.45)";
  ctx.shadowBlur = 10;

  lines.forEach((line, index) => {
    ctx.fillText(line, 0, firstLineY + index * lineHeight);
  });
  ctx.shadowBlur = 0;
}

function getRoundInfo(tournament, currentGame) {
  if (!tournament) return null;

  const scoringSettings = normalizeScoringSettings(tournament.scoringSettings, tournament.players.length);
  const normalMultiplier = roundMultiplier(tournament, currentGame);
  const currentSpecialRound = currentGame ? tournament.currentSpecialRound ?? null : null;
  const currentMinusRound = currentSpecialRound?.type === SPECIAL_ROUND_TYPES.minus
    ? { active: true, pointsStep: currentSpecialRound.config?.pointsStep ?? 0 }
    : currentGame && tournament.currentMinusRound?.active
    ? tournament.currentMinusRound
    : null;
  const currentBonus = currentSpecialRound?.type === SPECIAL_ROUND_TYPES.bonus
    ? { active: true, multiplier: currentSpecialRound.config?.multiplier ?? 1 }
    : currentGame && !currentMinusRound && tournament.currentBonus?.active
    ? tournament.currentBonus
    : null;
  const effectiveMultiplier = currentMinusRound ? 1 : normalMultiplier * (currentBonus?.multiplier ?? 1);
  const modeLabel = scoringSettings.multiplierEnabled
    ? multiplierModeLabel(scoringSettings.multiplierMode)
    : "Multiplikator aus";

  return {
    globalRound: tournament.globalRound + 1,
    multiplierMode: scoringSettings.multiplierMode,
    multiplierModeLabel: modeLabel,
    scoringMode: normalizeGameScoringMode(currentGame?.scoringMode),
    gameRoundText: currentGame
      ? `Spiel-Runde ${currentGame.playedRounds + 1}/${currentGame.totalRounds}`
      : "",
    normalMultiplier,
    currentBonus,
    currentMinusRound,
    currentSpecialRound,
    effectiveMultiplier,
  };
}

export function WheelControls({
  spinning,
  currentGame,
  canManualPick,
  manualPickerOpen,
  flowLocked = false,
  onSpin,
  onToggleManualPicker,
}) {
  return (
    <>
      <button
        className="btn"
        type="button"
        disabled={flowLocked || spinning || !!currentGame}
        onClick={onSpin}
      >
        {spinning ? "Dreht ..." : "Drehen"}
      </button>
      <button
        className={`btn secondary ${manualPickerOpen ? "active" : ""}`}
        type="button"
        disabled={flowLocked || !canManualPick}
        aria-expanded={manualPickerOpen}
        onClick={onToggleManualPicker}
      >
        Manuell wählen
      </button>
    </>
  );
}

export function WheelStatus({ tournament, entries, openGames, setupSettings }) {
  const settings = normalizeWheelSettings(tournament?.wheelSettings ?? setupSettings);
  const lastPickedGame = tournament?.lastPickedGameId
    ? openGames.find((game) => game.id === tournament.lastPickedGameId)
    : null;
  const noRepeatApplied =
    settings.noRepeat &&
    Boolean(lastPickedGame) &&
    openGames.length > 1 &&
    entries.length < openGames.length;

  return (
    <div className="wheelStatus">
      <span>
        Modus: <b>{wheelWeightModeLabel(settings.weightMode)}</b>
      </span>
      <span>No Repeat: <b>{settings.noRepeat ? "an" : "aus"}</b></span>
      {settings.weightMode === "remainingRounds" && (
        <span>Segmente proportional zu offenen Runden</span>
      )}
      {noRepeatApplied && (
        <span>Ausgesetzt: <b>{lastPickedGame.name}</b></span>
      )}
      {tournament && (
        <span>
          Spin-Liste: <b>{entries.length}/{openGames.length}</b>
        </span>
      )}
    </div>
  );
}

export function Wheel({ currentGame, games, wheelAngle, spinning, locked = false, onSpin }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.46;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.02, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(177,0,255,.35)";
    ctx.lineWidth = radius * 0.06;
    ctx.stroke();
    ctx.restore();

    if (games.length === 0) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "rgba(233,226,255,.85)";
      ctx.font = "bold 34px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("—", 0, 0);
      ctx.restore();
      return;
    }

    const totalWeight = totalWheelWeight(games);
    if (totalWeight <= 0) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelAngle);

    let cursor = 0;
    games.forEach((game, index) => {
      const weight = Number(game.weight) > 0 ? Number(game.weight) : 1;
      const startAngle = (cursor / totalWeight) * Math.PI * 2;
      const endAngle = ((cursor + weight) / totalWeight) * Math.PI * 2;
      const slice = endAngle - startAngle;
      cursor += weight;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = index % 2 === 0 ? "rgba(12,10,18,.92)" : "rgba(18,12,26,.90)";
      ctx.fill();

      ctx.strokeStyle = "rgba(177,0,255,.35)";
      ctx.lineWidth = 4;
      ctx.stroke();

      const middle = (startAngle + endAngle) / 2;
      ctx.save();
      ctx.rotate(middle);
      ctx.translate(radius * 0.66, 0);
      ctx.rotate(Math.PI / 2);
      drawWheelLabel(ctx, game.name, { radius, slice, gameCount: games.length });

      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fill();
    ctx.strokeStyle = "rgba(177,0,255,.55)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "rgba(233,226,255,.92)";
    ctx.font = `900 22px ${WHEEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", 0, 2);

    ctx.restore();
  }, [games, wheelAngle]);

  return (
    <div className="wheelArea">
      <div className="pointer" />
      <canvas
        ref={canvasRef}
        width="900"
        height="900"
        onClick={locked ? undefined : onSpin}
        className={spinning || currentGame || locked ? "locked" : ""}
        title={currentGame ? "Erst aktuelle Runde eintragen" : "Klicken zum Drehen"}
      />
    </div>
  );
}

export function PickedGame({ tournament, currentGame, remainingTotal }) {
  const pickedGameText = !tournament ? "—" : currentGame ? currentGame.name : "Bereit";
  const roundInfo = getRoundInfo(tournament, currentGame);
  const pickedMeta = !tournament ? "Noch kein Turnier gestartet." : currentGame ? "Aktuelle Runde" : "Drehen.";
  const currentBonus = roundInfo?.currentBonus ?? null;
  const currentMinusRound = roundInfo?.currentMinusRound ?? null;
  const currentSpecialRound = roundInfo?.currentSpecialRound ?? null;
  const otherSpecialRound = currentSpecialRound && ![SPECIAL_ROUND_TYPES.bonus, SPECIAL_ROUND_TYPES.minus].includes(currentSpecialRound.type)
    ? currentSpecialRound
    : null;

  return (
    <div className={`row pickedRow ${currentBonus ? "bonusActive" : ""} ${currentMinusRound ? "minusActive" : ""} ${otherSpecialRound ? `specialActive special-${otherSpecialRound.type}` : ""}`}>
      <div className="pickedText">
        <div className="big">{pickedGameText}</div>
        <div className="muted">{pickedMeta}</div>
        {currentGame && roundInfo && (
          <div className="roundMeta">
            <span>{roundInfo.multiplierModeLabel}</span>
            <span>{gameScoringModeLabel(roundInfo.scoringMode)}</span>
            <span>{roundInfo.gameRoundText}</span>
            <span>TR {roundInfo.globalRound}</span>
            {currentMinusRound ? (
              <span>MINUSRUNDE -{formatMultiplier(currentMinusRound.pointsStep)} pro Platz</span>
            ) : otherSpecialRound ? (
              <>
                <span>{specialRoundText(otherSpecialRound)}</span>
                <span>Normal ×{formatMultiplier(roundInfo.normalMultiplier)}</span>
                <span>Gesamt ×{formatMultiplier(roundInfo.effectiveMultiplier)}</span>
              </>
            ) : (
              <>
                <span>Normal ×{formatMultiplier(roundInfo.normalMultiplier)}</span>
                {currentBonus && <span>Bonus ×{formatMultiplier(currentBonus.multiplier)}</span>}
                <span>Gesamt ×{formatMultiplier(roundInfo.effectiveMultiplier)}</span>
              </>
            )}
          </div>
        )}
      </div>
      {tournament && (
        <span className="pill">
          <span className="dot" /> Runden: <b>{currentGame ? currentGame.remainingRounds : remainingTotal}</b>
        </span>
      )}
      {currentBonus && (
        <span className="pill bonusPill">
          <span className="dot" /> BONUS ×{formatMultiplier(currentBonus.multiplier)} · Gesamt ×
          {formatMultiplier(roundInfo.effectiveMultiplier)}
        </span>
      )}
      {currentMinusRound && (
        <span className="pill minusPill">
          <span className="dot" /> MINUSRUNDE · -{formatMultiplier(currentMinusRound.pointsStep)} pro Platz
        </span>
      )}
      {otherSpecialRound && (
        <span className={`pill specialPill specialPill-${otherSpecialRound.type}`}>
          <span className="dot" /> {specialRoundText(otherSpecialRound)}
        </span>
      )}
    </div>
  );
}

export function ManualGamePicker({ open, games, onSelect }) {
  if (!open) return null;

  return (
    <div className="manualPicker">
      <div className="manualPickerHead">
        <div>
          <div className="section-title">Manuelle Auswahl</div>
          <div className="muted">Nur offene Games werden angezeigt.</div>
        </div>
        <span className="pill">
          <span className="dot" /> Offen: {games.length}
        </span>
      </div>

      <div className="manualGameList">
        {games.map((game) => {
          const totalRounds = game.totalRounds ?? game.remainingRounds;
          return (
            <button
              key={game.id}
              className="manualGameButton"
              type="button"
              onClick={() => onSelect(game.id)}
            >
              <span className="manualGameName">{game.name}</span>
              <span className="manualGameMeta">
                {game.remainingRounds}/{totalRounds} offen
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RoundEntry({
  tournament,
  currentGame,
  placements,
  scoreDraft = {},
  roundEvaluationMode,
  winnerTeamId,
  teamScoreDraft = {},
  riskSelections = {},
  usedPlayerIds,
  onRoundEvaluationModeChange,
  onSetPlacement,
  onSetScore,
  onSetWinnerTeam,
  onSetTeamScore,
  onSetRiskSelection,
  onSubmit,
}) {
  if (!tournament || !currentGame) return null;

  const scoringSnapshot = normalizeScoringSettings(tournament.scoringSettings, tournament.players.length);
  const roundInfo = getRoundInfo(tournament, currentGame);
  const currentBonus = roundInfo.currentBonus;
  const currentMinusRound = roundInfo.currentMinusRound;
  const currentSpecialRound = roundInfo.currentSpecialRound;
  const otherSpecialRound = currentSpecialRound && ![SPECIAL_ROUND_TYPES.bonus, SPECIAL_ROUND_TYPES.minus].includes(currentSpecialRound.type)
    ? currentSpecialRound
    : null;
  const normalizedRoundEvaluationMode = normalizeRoundEvaluationMode(
    roundEvaluationMode,
    roundInfo.scoringMode,
    tournament.teamModeEnabled === true
  );
  const evaluationOptions = roundEvaluationModeOptions(tournament.teamModeEnabled === true);
  const activeTeams = teamsWithPlayers(tournament.teams ?? []);
  const teamLeaderboard = tournament.teamModeEnabled === true
    ? teamRankingFromPlayers(tournament.players, activeTeams)
    : [];
  const isIndividualScore = normalizedRoundEvaluationMode === ROUND_EVALUATION_MODES.individualScore;
  const isTeamScore = normalizedRoundEvaluationMode === ROUND_EVALUATION_MODES.teamScore;
  const isTeamWinner = normalizedRoundEvaluationMode === ROUND_EVALUATION_MODES.teamWinner;
  const isPlacementMode = isPlacementRoundEvaluationMode(normalizedRoundEvaluationMode);
  const sectionTitle = isTeamWinner
    ? "Gewinnerteam"
    : isTeamScore
      ? "Team-Scores"
      : isIndividualScore
        ? "Scores"
        : "Platzierungen";
  const modeHint = currentMinusRound
    ? `MINUSRUNDE -${formatMultiplier(currentMinusRound.pointsStep)} pro Platz`
    : otherSpecialRound
      ? specialRoundText(otherSpecialRound)
      : `Normal ×${formatMultiplier(roundInfo.normalMultiplier)}`;
  const bonusHint = currentBonus
    ? ` · BONUS ×${formatMultiplier(currentBonus.multiplier)} · Gesamt ×${formatMultiplier(roundInfo.effectiveMultiplier)}`
    : "";
  const roundContext = currentMinusRound
    ? `TR ${roundInfo.globalRound}`
    : scoringSnapshot.multiplierEnabled
    ? roundInfo.multiplierMode === "perGame"
      ? `${roundInfo.multiplierModeLabel} · ${roundInfo.gameRoundText}`
      : `${roundInfo.multiplierModeLabel} · TR ${roundInfo.globalRound}`
    : `${roundInfo.multiplierModeLabel} · TR ${roundInfo.globalRound}`;
  const hint = `${roundContext} · ${modeHint}${bonusHint}`;

  const pointsHint = currentMinusRound
    ? `Platz 1 = 0, danach -${formatMultiplier(currentMinusRound.pointsStep)} pro Platz`
    : isTeamWinner
    ? `Gewinnerteam: ${formatPoints(basePointsForPlace(1, scoringSnapshot))} je Mitglied`
    : isTeamScore
      ? "Team-Score x Gesamt-Multiplikator je Mitglied"
      : isIndividualScore
        ? "Score x Gesamt-Multiplikator"
        : `Basis: 1.=${formatPoints(basePointsForPlace(1, scoringSnapshot))}, 2.=${formatPoints(basePointsForPlace(2, scoringSnapshot))}`;

  return (
    <div className={`roundEntry liveRoundCard ${currentBonus ? "bonusActive" : ""} ${currentMinusRound ? "minusActive" : ""} ${otherSpecialRound ? `specialActive special-${otherSpecialRound.type}` : ""}`}>
      <div className="liveRoundHero">
        <div className="liveRoundMain">
          <div className="muted">Aktuelle Runde</div>
          <div className="liveRoundTitle">{currentGame.name}</div>
          <div className="roundMeta">
            <span>{roundInfo.gameRoundText}</span>
            <span>TR {roundInfo.globalRound}</span>
            <span>{gameScoringModeLabel(roundInfo.scoringMode)}</span>
            {currentMinusRound ? (
              <span>MINUSRUNDE -{formatMultiplier(currentMinusRound.pointsStep)} pro Platz</span>
            ) : otherSpecialRound ? (
              <>
                <span>{specialRoundText(otherSpecialRound)}</span>
                <span>Normal ×{formatMultiplier(roundInfo.normalMultiplier)}</span>
                <span>Gesamt ×{formatMultiplier(roundInfo.effectiveMultiplier)}</span>
              </>
            ) : (
              <>
                <span>Normal ×{formatMultiplier(roundInfo.normalMultiplier)}</span>
                {currentBonus && <span>Bonus ×{formatMultiplier(currentBonus.multiplier)}</span>}
                <span>Gesamt ×{formatMultiplier(roundInfo.effectiveMultiplier)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="liveScoreStrip">
        {tournament.players.map((player) => (
          <span key={player.id}>
            <b>{player.name}</b>
            <strong>{formatPoints(player.total)}</strong>
          </span>
        ))}
      </div>

      {teamLeaderboard.length > 0 && (
        <div className="liveScoreStrip teamScoreStrip">
          {teamLeaderboard.map((team) => (
            <span key={team.id}>
              <b>{team.name}</b>
              <strong>{formatPoints(team.total)}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="roundEvaluationPicker">
        <div>
          <div className="section-title">Wertung für diese Runde</div>
          <div className="muted">
            Game-Default: {gameScoringModeLabel(roundInfo.scoringMode)}
          </div>
        </div>
        <select
          value={normalizedRoundEvaluationMode}
          onChange={(event) => onRoundEvaluationModeChange(event.target.value)}
        >
          {evaluationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="row roundHeader">
        <div>
          <div className="section-title">{sectionTitle}</div>
          <div className="muted">{hint}</div>
        </div>
        {currentBonus && (
          <span className="pill bonusPill">
            <span className="dot" /> BONUS ×{formatMultiplier(currentBonus.multiplier)} · Gesamt ×
            {formatMultiplier(roundInfo.effectiveMultiplier)}
          </span>
        )}
        {currentMinusRound && (
          <span className="pill minusPill">
            <span className="dot" /> MINUSRUNDE · -{formatMultiplier(currentMinusRound.pointsStep)} pro Platz
          </span>
        )}
        {otherSpecialRound && (
          <span className={`pill specialPill specialPill-${otherSpecialRound.type}`}>
            <span className="dot" /> {specialRoundText(otherSpecialRound)}
          </span>
        )}
        <button className="btn ok saveRoundBtn" type="button" onClick={onSubmit}>
          Speichern
        </button>
      </div>

      {otherSpecialRound?.type === SPECIAL_ROUND_TYPES.risk && (
        <div className="riskSelectionPanel">
          <div className="section-title">Risiko wählen</div>
          <div className="riskSelectionGrid">
            {tournament.players.map((player) => (
              <label key={player.id} className={`riskSelectionItem ${riskSelections[player.id] ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={riskSelections[player.id] === true}
                  onChange={(event) => onSetRiskSelection?.(player.id, event.target.checked)}
                />
                <span>{player.name} geht Risiko</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {isIndividualScore ? (
        <div className="scoreEntryGrid placementGrid">
          {tournament.players.map((player) => (
            <label key={player.id} className="scoreEntryField">
              <span>{player.name}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={scoreDraft[player.id] ?? ""}
                placeholder="0"
                onChange={(event) => onSetScore(player.id, event.target.value)}
              />
            </label>
          ))}
        </div>
      ) : isTeamWinner ? (
        <div className="teamWinnerEntry placementGrid">
          <label className="scoreEntryField">
            <span>Gewinnerteam</span>
            <select
              value={winnerTeamId}
              onChange={(event) => onSetWinnerTeam(event.target.value)}
            >
              <option value="">Team wählen</option>
              {activeTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          {activeTeams.length < 2 && (
            <div className="muted dangerText">Teamrunde braucht mindestens 2 Teams mit Spielern.</div>
          )}
        </div>
      ) : isTeamScore ? (
        <div className="scoreEntryGrid placementGrid">
          {activeTeams.map((team) => (
            <label key={team.id} className="scoreEntryField">
              <span>{team.name}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={teamScoreDraft[team.id] ?? ""}
                placeholder="0"
                onChange={(event) => onSetTeamScore(team.id, event.target.value)}
              />
            </label>
          ))}
          {activeTeams.length < 2 && (
            <div className="muted dangerText">Teamrunde braucht mindestens 2 Teams mit Spielern.</div>
          )}
        </div>
      ) : isPlacementMode ? (
        <div className="selectGrid placementGrid">
          {tournament.players.map((_, index) => {
            const place = index + 1;
            const value = placements[index] || "";
            return (
              <div key={place}>
                <div className="muted placement-label">Platz {place}</div>
                <select
                  value={value}
                  onChange={(event) => onSetPlacement(index, event.target.value)}
                >
                  <option value="">—</option>
                  {tournament.players.map((player) => (
                    <option
                      key={player.id}
                      value={player.id}
                      disabled={usedPlayerIds.has(player.id) && player.id !== value}
                    >
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="muted points-hint">
        {currentMinusRound ? pointsHint : `${pointsHint} x${formatMultiplier(roundInfo.effectiveMultiplier)}`}
      </div>
    </div>
  );
}
