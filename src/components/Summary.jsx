import { useMemo, useState } from "react";

import { formatMultiplier, formatPoints, formatScore, formatTime } from "../utils/common";
import {
  gameScoringModeLabel,
  multiplierModeLabel,
  normalizeGameScoringMode,
  normalizeScoringSettings,
  SPECIAL_ROUND_TYPES,
  specialRoundText,
} from "../utils/scoring";
import {
  isTeamRoundEvaluationMode,
  normalizeRoundEvaluationMode,
  normalizeTeams,
  roundEvaluationModeLabel,
  teamRankingFromPlayers,
} from "../utils/teams";

function RankingBoard({ leaderboard }) {
  const maxPoints = Math.max(1, ...leaderboard.map((player) => player.total));

  return (
    <div className="rankingBoard">
      {leaderboard.map((player, index) => {
        const previous = leaderboard[index - 1];
        const next = leaderboard[index + 1];
        const tiedWithPrevious = previous && previous.total === player.total;
        const tiedWithNext = next && next.total === player.total;
        const place = tiedWithPrevious
          ? leaderboard.findIndex((item) => item.total === player.total) + 1
          : index + 1;
        const progress = Math.max(4, Math.round((player.total / maxPoints) * 100));
        return (
          <div
            key={player.id}
            className={`rankingCard place${place <= 3 ? place : "Other"} ${
              tiedWithPrevious || tiedWithNext ? "tied" : ""
            }`}
          >
            <div className="rankingCardTop">
              <span className="rankingPlace">#{place}</span>
              <span className="rankingName">{player.name}</span>
              {(tiedWithPrevious || tiedWithNext) && <span className="tieBadge">Gleichstand</span>}
              <b>{formatPoints(player.total)}</b>
            </div>
            <div className="rankingBar">
              <div className="rankingBarFill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function playerName(tournament, playerId) {
  return tournament.players.find((player) => player.id === playerId)?.name ?? "?";
}

function safePointsByPlayer(entry) {
  return entry?.pointsByPlayer && typeof entry.pointsByPlayer === "object"
    ? entry.pointsByPlayer
    : {};
}

function entryRoundDetails(tournament, entry) {
  const roundSettings = normalizeScoringSettings(
    entry.scoringSettings ?? tournament.scoringSettings,
    tournament.players.length,
    tournament.mode
  );
  const multiplierMode = entry.multiplierMode ?? roundSettings.multiplierMode;
  const normalMultiplier = Number.isFinite(Number(entry.multiplier)) ? Number(entry.multiplier) : 1;
  const effectiveMultiplier = Number.isFinite(Number(entry.effectiveMultiplier))
    ? Number(entry.effectiveMultiplier)
    : normalMultiplier;
  const bonusMultiplier = Number.isFinite(Number(entry.bonusMultiplier))
    ? Number(entry.bonusMultiplier)
    : 1;

  return {
    roundSettings,
    multiplierMode,
    normalMultiplier,
    effectiveMultiplier,
    bonusMultiplier,
    minusRoundActive: entry.minusRoundActive === true,
    minusRoundStep: Number.isFinite(Number(entry.minusRoundStep))
      ? Number(entry.minusRoundStep)
      : roundSettings.minusRoundPointsStep,
    specialRoundType: entry.specialRoundType ?? (entry.minusRoundActive ? SPECIAL_ROUND_TYPES.minus : entry.bonusActive ? SPECIAL_ROUND_TYPES.bonus : null),
    specialRound: entry.specialRoundType
      ? {
          type: entry.specialRoundType,
          label: entry.specialRoundLabel,
          hidden: entry.specialRoundHidden === true,
          resolvedType: entry.resolvedSpecialRoundType ?? null,
          config: entry.specialRoundConfig ?? {},
        }
      : null,
    scoringMode: normalizeGameScoringMode(entry.scoringMode),
    roundEvaluationMode: normalizeRoundEvaluationMode(
      entry.roundEvaluationMode,
      entry.scoringMode,
      Array.isArray(entry.teamsSnapshot) && entry.teamsSnapshot.length > 0
    ),
  };
}

function teamsForEntry(tournament, entry) {
  const source = Array.isArray(entry.teamsSnapshot) && entry.teamsSnapshot.length > 0
    ? entry.teamsSnapshot
    : tournament.teams;
  return normalizeTeams(source, tournament.players);
}

function placementRows(tournament, entry) {
  const pointsByPlayer = safePointsByPlayer(entry);
  if (Array.isArray(entry.placements) && entry.placements.length > 0) {
    return entry.placements.map((playerId, index) => ({
      key: `${playerId}-${index}`,
      label: `${index + 1}.`,
      playerId,
      name: playerName(tournament, playerId),
      detail: "",
      points: pointsByPlayer[playerId] ?? 0,
    }));
  }

  return Object.entries(pointsByPlayer).map(([playerId, points], index) => ({
    key: `${playerId}-${index}`,
    label: "",
    playerId,
    name: playerName(tournament, playerId),
    detail: "Punkte aus altem Log",
    points,
  }));
}

function scoreRows(tournament, entry) {
  const pointsByPlayer = safePointsByPlayer(entry);
  const scoresByPlayer = entry.scoresByPlayer && typeof entry.scoresByPlayer === "object"
    ? entry.scoresByPlayer
    : {};

  return tournament.players.map((player) => ({
    key: player.id,
    label: "",
    playerId: player.id,
    name: player.name,
    detail: `Score ${formatScore(scoresByPlayer[player.id])}`,
    points: pointsByPlayer[player.id] ?? 0,
  }));
}

function teamRows(tournament, entry) {
  const teams = teamsForEntry(tournament, entry);
  const teamPointsByTeam = entry.teamPointsByTeam && typeof entry.teamPointsByTeam === "object"
    ? entry.teamPointsByTeam
    : {};
  const teamScoresByTeam = entry.teamScoresByTeam && typeof entry.teamScoresByTeam === "object"
    ? entry.teamScoresByTeam
    : {};

  return teams.map((team) => {
    const isWinner = entry.winnerTeamId === team.id;
    const score = teamScoresByTeam[team.id];
    return {
      key: team.id,
      label: isWinner ? "Gewinner" : "",
      name: team.name,
      detail: score == null ? `${team.playerIds.length} Spieler` : `Score ${formatScore(score)}`,
      points: teamPointsByTeam[team.id] ?? 0,
    };
  });
}

function LogEntryCard({
  tournament,
  entry,
  deleteArmed,
  onEdit,
  onDelete,
}) {
  const {
    roundSettings,
    multiplierMode,
    normalMultiplier,
    effectiveMultiplier,
    bonusMultiplier,
    minusRoundActive,
    minusRoundStep,
    specialRoundType,
    specialRound,
    scoringMode,
    roundEvaluationMode,
  } = entryRoundDetails(tournament, entry);
  const isTeamMode = isTeamRoundEvaluationMode(roundEvaluationMode);
  const isScoreMode = scoringMode === "score";
  const rows = isTeamMode
    ? teamRows(tournament, entry)
    : isScoreMode
      ? scoreRows(tournament, entry)
      : placementRows(tournament, entry);
  const canDelete = Boolean(entry.id && entry.pointsByPlayer && typeof entry.pointsByPlayer === "object");
  const isComplexSpecialRound = [
    SPECIAL_ROUND_TYPES.jackpot,
    SPECIAL_ROUND_TYPES.robber,
    SPECIAL_ROUND_TYPES.comeback,
    SPECIAL_ROUND_TYPES.risk,
    SPECIAL_ROUND_TYPES.secret,
    SPECIAL_ROUND_TYPES.mystery,
    SPECIAL_ROUND_TYPES.allOrNothing,
    SPECIAL_ROUND_TYPES.kingOfTheRound,
    SPECIAL_ROUND_TYPES.lastManPunishment,
  ].includes(specialRoundType);
  const canEdit = !isComplexSpecialRound && !isTeamMode && (isScoreMode
    ? canDelete
    : canDelete && Array.isArray(entry.placements) && entry.placements.length === tournament.players.length);

  return (
    <article className={`logCard ${scoringMode} ${isTeamMode ? "teamRound" : ""} ${entry.bonusActive ? "bonusActive" : ""} ${minusRoundActive ? "minusActive" : ""} ${isComplexSpecialRound ? `specialActive special-${specialRoundType}` : ""}`}>
      <div className="logCardTop">
        <div className="logTitleBlock">
          <div className="logRound">TR {entry.globalRound ?? "?"}</div>
          <div className="logGameName">{entry.gameName ?? "Unbekanntes Game"}</div>
          <div className="muted">
            {formatTime(entry.t)}{entry.editedAt ? " · bearbeitet" : ""}
          </div>
        </div>
        <div className="logActions">
          <button
            className="btn secondary miniBtn"
            type="button"
            disabled={!canEdit}
            title={canEdit ? "Runde bearbeiten" : isComplexSpecialRound ? "Sonderrunden können aktuell nur gelöscht werden" : isTeamMode ? "Team-Runden koennen aktuell nur geloescht werden" : "Dieser alte Eintrag hat nicht genug Daten"}
            onClick={() => onEdit(entry)}
          >
            Bearbeiten
          </button>
          <button
            className={`btn danger miniBtn ${deleteArmed ? "armed" : ""}`}
            type="button"
            disabled={!canDelete}
            onClick={() => onDelete(entry.id)}
          >
            {deleteArmed ? "Nochmal klicken" : "Runde löschen"}
          </button>
        </div>
      </div>

      <div className="logMetaChips">
        <span>{roundEvaluationModeLabel(roundEvaluationMode)}</span>
        <span>Spiel-Runde {entry.gameRound ?? "?"}</span>
        {minusRoundActive ? (
          <span className="minusChip">
            MINUSRUNDE · -{formatMultiplier(minusRoundStep)} pro Platz
          </span>
        ) : isComplexSpecialRound ? (
          <>
            <span className={`specialChip specialChip-${specialRoundType}`}>
              {specialRoundText(specialRound, { revealHidden: true })}
            </span>
            <span>
              {roundSettings.multiplierEnabled ? multiplierModeLabel(multiplierMode) : "Multiplikator aus"}
            </span>
            <span>Normal ×{formatMultiplier(normalMultiplier)}</span>
            <span>Gesamt ×{formatMultiplier(effectiveMultiplier)}</span>
          </>
        ) : (
          <>
            <span>
              {roundSettings.multiplierEnabled ? multiplierModeLabel(multiplierMode) : "Multiplikator aus"}
            </span>
            <span>Normal ×{formatMultiplier(normalMultiplier)}</span>
            {entry.bonusActive ? (
              <span className="bonusChip">
                Bonus ×{formatMultiplier(bonusMultiplier)} · Gesamt ×
                {formatMultiplier(effectiveMultiplier)}
              </span>
            ) : (
              <span>Gesamt ×{formatMultiplier(effectiveMultiplier)}</span>
            )}
          </>
        )}
      </div>

      <div className="logResultGrid">
        {rows.map((row) => (
          <div key={row.key} className="logResultRow">
            <div>
              <b>{row.label} {row.name}</b>
              {row.detail && <span>{row.detail}</span>}
            </div>
            <strong>{formatPoints(row.points)}</strong>
          </div>
        ))}
      </div>

      {entry.specialRoundResult && (
        <div className="specialResultLine">{entry.specialRoundResult}</div>
      )}

      {roundEvaluationMode === "teamPlacement" && Array.isArray(entry.placements) && (
        <div className="logTeamBreakdown">
          <div className="muted">Einzelpunkte dieser Team-Platzierung</div>
          <div className="logResultGrid">
            {placementRows(tournament, entry).map((row) => (
              <div key={row.key} className="logResultRow">
                <div>
                  <b>{row.label} {row.name}</b>
                </div>
                <strong>{formatPoints(row.points)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isTeamMode && !isScoreMode && !Array.isArray(entry.placements) && (
        <div className="muted logLegacyHint">
          Alter Placement-Eintrag: Ergebnis wird angezeigt, Bearbeiten ist deaktiviert.
        </div>
      )}
    </article>
  );
}

export function LogEditModal({ tournament, entry, onClose, onSave }) {
  if (!entry) return null;

  return (
    <LogEditModalForm
      key={entry.id}
      tournament={tournament}
      entry={entry}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function LogEditModalForm({ tournament, entry, onClose, onSave }) {
  const [placements, setPlacements] = useState(() =>
    Array.isArray(entry.placements) ? [...entry.placements] : []
  );
  const [scoresByPlayer, setScoresByPlayer] = useState(() =>
      Object.fromEntries(
        tournament.players.map((player) => [
          player.id,
          entry.scoresByPlayer?.[player.id] ?? "",
        ])
      )
  );

  const scoringMode = normalizeGameScoringMode(entry?.scoringMode);
  const isScoreMode = scoringMode === "score";
  const usedPlayerIds = useMemo(() => new Set(placements.filter(Boolean)), [placements]);
  const placementEditable = isScoreMode || placements.length === tournament.players.length;
  const hasDuplicatePlacement = placements.filter(Boolean).length !== usedPlayerIds.size;
  const canSave = isScoreMode || (placementEditable && !hasDuplicatePlacement);

  function changePlacement(index, playerId) {
    setPlacements((current) => {
      const next = [...current];
      next[index] = playerId;
      return next;
    });
  }

  function changeScore(playerId, value) {
    if (value === "") {
      setScoresByPlayer((current) => ({ ...current, [playerId]: "" }));
      return;
    }

    const score = Number(value);
    setScoresByPlayer((current) => ({
      ...current,
      [playerId]: Number.isFinite(score) && score >= 0 ? value : "0",
    }));
  }

  function save() {
    if (!canSave) return;
    onSave(
      entry.id,
      isScoreMode
        ? { scoresByPlayer }
        : { placements }
    );
  }

  const details = entryRoundDetails(tournament, entry);

  return (
    <div className="overlay">
      <div className="modal logEditModal">
        <div className="mhead">
          <b>Runde bearbeiten</b>
          <button className="btn secondary miniBtn" type="button" onClick={onClose}>
            Schließen
          </button>
        </div>
        <div className="mbody">
          <div className="logEditHeader">
            <div>
              <div className="muted">TR {entry.globalRound} · {gameScoringModeLabel(scoringMode)}</div>
              <div className="section-title">{entry.gameName}</div>
            </div>
            {details.minusRoundActive ? (
              <span className="pill minusPill">
                <span className="dot" /> MINUSRUNDE · -{formatMultiplier(details.minusRoundStep)} pro Platz
              </span>
            ) : (
              <span className="pill">
                <span className="dot" /> Gesamt ×{formatMultiplier(details.effectiveMultiplier)}
              </span>
            )}
          </div>

          <div className="logMetaChips">
            <span>Spiel-Runde {entry.gameRound ?? "?"}</span>
            {details.minusRoundActive ? (
              <span className="minusChip">
                Platz 1 = 0 · danach -{formatMultiplier(details.minusRoundStep)}
              </span>
            ) : (
              <>
                <span>Normal ×{formatMultiplier(details.normalMultiplier)}</span>
                {entry.bonusActive && (
                  <span className="bonusChip">
                    Bonus ×{formatMultiplier(details.bonusMultiplier)}
                  </span>
                )}
              </>
            )}
          </div>

          {isScoreMode ? (
            <div className="scoreEntryGrid placementGrid">
              {tournament.players.map((player) => (
                <label key={player.id} className="scoreEntryField">
                  <span>{player.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={scoresByPlayer[player.id] ?? ""}
                    placeholder="0"
                    onChange={(event) => changeScore(player.id, event.target.value)}
                  />
                </label>
              ))}
            </div>
          ) : placementEditable ? (
            <div className="selectGrid placementGrid">
              {tournament.players.map((_, index) => {
                const value = placements[index] || "";
                return (
                  <div key={index + 1}>
                    <div className="muted placement-label">Platz {index + 1}</div>
                    <select
                      value={value}
                      onChange={(event) => changePlacement(index, event.target.value)}
                    >
                      <option value="">-</option>
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
          ) : (
            <div className="muted logLegacyHint">
              Dieser alte Placement-Eintrag enthält keine gespeicherte Platzierungsreihenfolge.
            </div>
          )}

          {hasDuplicatePlacement && (
            <div className="muted dangerText logLegacyHint">Spieler dürfen nicht doppelt vorkommen.</div>
          )}

          <div className="winnerActions">
            <button className="btn ok" type="button" disabled={!canSave} onClick={save}>
              Korrektur speichern
            </button>
            <button className="btn secondary" type="button" onClick={onClose}>
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Summary({
  tournament,
  leaderboard,
  tournamentFinished,
  undoArmed,
  deleteArmedId,
  focus = "all",
  onShowWinner,
  onUndoLastRound,
  onEditLogEntry,
  onDeleteLogEntry,
}) {
  const [rankingTab, setRankingTab] = useState("players");

  if (!tournament) {
    return (
      <section className="card summaryCard">
        <div className="head">
          <h2>Zusammenfassung</h2>
          <span className="pill">
            <span className="dot" /> Live
          </span>
        </div>
        <div className="body">
          <div className="muted">Noch keine Ergebnisse.</div>
        </div>
      </section>
    );
  }

  const remainingTotal = tournament.games.reduce((sum, game) => sum + game.remainingRounds, 0);
  const teamModeActive = tournament.teamModeEnabled === true;
  const teamLeaderboard = teamModeActive
    ? teamRankingFromPlayers(tournament.players, tournament.teams)
    : [];
  const rankingRows = teamModeActive && rankingTab === "teams" ? teamLeaderboard : leaderboard;
  const rankingLabel = teamModeActive && rankingTab === "teams" ? "Team" : "Spieler";
  const status =
    remainingTotal === 0 ? "Fertig" : `Offen: ${remainingTotal} · TR: ${tournament.globalRound}`;

  return (
    <section className={`card summaryCard summaryFocus-${focus}`}>
      <div className="head">
        <h2>Zusammenfassung</h2>
        <div className="summaryActions">
          {tournamentFinished && (
            <button className="btn ok winnerBtn" type="button" onClick={onShowWinner}>
              Gewinner anzeigen
            </button>
          )}
          {tournament.log.length > 0 && (
            <button
              className={`btn undoBtn ${undoArmed ? "armed" : ""}`}
              type="button"
              onClick={onUndoLastRound}
            >
              {undoArmed ? "Nochmal klicken zum Zurücknehmen" : "Letzte Runde zurücknehmen"}
            </button>
          )}
          <span className="pill">
            <span className="dot" /> Live
          </span>
        </div>
      </div>
      <div className="body">
        {teamModeActive && (
          <div className="rankingTabs modeToggle">
            <button
              className={`segmentedBtn ${rankingTab === "players" ? "active" : ""}`}
              type="button"
              onClick={() => setRankingTab("players")}
            >
              Einzelwertung
            </button>
            <button
              className={`segmentedBtn ${rankingTab === "teams" ? "active" : ""}`}
              type="button"
              onClick={() => setRankingTab("teams")}
            >
              Teamwertung
            </button>
          </div>
        )}

        <RankingBoard leaderboard={rankingRows} />

        <div className="hr" />

        <table>
          <thead>
            <tr>
              <th>Platz</th>
              <th>{rankingLabel}</th>
              <th className="right">Punkte</th>
            </tr>
          </thead>
          <tbody>
            {rankingRows.map((player, index) => (
              <tr key={player.id}>
                <td>
                  <b>{index + 1}</b>
                </td>
                <td>{player.name}</td>
                <td className="right">
                  <b>{formatPoints(player.total)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="hr" />

        <div className="logSectionHead">
          <div>
            <div className="section-title">Verlauf</div>
            <div className="muted">{status}</div>
          </div>
          <span className="pill">
            <span className="dot" /> {tournament.log.length} Runden
          </span>
        </div>

        {tournament.log.length === 0 ? (
          <div className="muted emptyLog">Noch keine Runden gespeichert.</div>
        ) : (
          <div className="logCardList">
            {tournament.log.map((entry) => (
              <LogEntryCard
                key={entry.id}
                tournament={tournament}
                entry={entry}
                deleteArmed={deleteArmedId === entry.id}
                onEdit={onEditLogEntry}
                onDelete={onDeleteLogEntry}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
