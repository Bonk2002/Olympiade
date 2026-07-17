import { useLayoutEffect, useRef } from "react";

import {
  MAX_BONUS_CHANCE,
  MAX_BONUS_MULTIPLIER,
  MAX_MINUS_ROUND_CHANCE,
  MAX_MINUS_ROUND_POINTS_STEP,
  MAX_MULTIPLIER,
  MAX_POINTS_VALUE,
  MAX_RISK_SUCCESS_PLACES,
  MAX_SPECIAL_ROUND_CHANCE,
  MAX_SPECIAL_ROUND_POINTS,
  MIN_BONUS_CHANCE,
  MIN_BONUS_MULTIPLIER,
  MIN_MINUS_ROUND_CHANCE,
  MIN_MINUS_ROUND_POINTS_STEP,
  MIN_MULTIPLIER,
  MIN_RISK_SUCCESS_PLACES,
  MIN_SPECIAL_ROUND_CHANCE,
  MIN_SPECIAL_ROUND_POINTS,
} from "../constants/defaults";
import { formatNumberInput } from "../utils/common";
import {
  basePointsForPlace,
  gameScoringModeLabel,
  normalizeGameScoringMode,
  normalizeScoringSettings,
} from "../utils/scoring";
import { normalizeSoundSettings } from "../utils/sound";
import {
  TEAM_COUNT_OPTIONS,
  normalizeTeams,
  teamsWithPlayers,
  unassignedPlayers,
} from "../utils/teams";
import { normalizeWheelSettings, wheelWeightModeLabel } from "../utils/wheel";

export function PresetTransferPanel({
  importMode,
  locked,
  onImportModeChange,
  onExport,
  onImportFile,
}) {
  const fileInputRef = useRef(null);

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    if (file) onImportFile(file);
    event.target.value = "";
  }

  return (
    <div className={`presetTransferPanel ${locked ? "locked" : ""}`}>
      <div className="presetTransferHead">
        <div>
          <div className="section-title">Presets</div>
          <div className="muted">JSON sichern oder laden</div>
        </div>
        {locked && (
          <span className="pill pillWarning">
            <span className="dot" /> Import gesperrt
          </span>
        )}
      </div>

      <div className="presetTransferMode">
        <div>
          <div className="muted">Import-Modus</div>
          <div className="modeToggle" role="group" aria-label="Import-Modus">
            <button
              className={`segmentedBtn ${importMode === "merge" ? "active" : ""}`}
              type="button"
              disabled={locked}
              onClick={() => onImportModeChange("merge")}
            >
              Zusammenführen
            </button>
            <button
              className={`segmentedBtn ${importMode === "replace" ? "active" : ""}`}
              type="button"
              disabled={locked}
              onClick={() => onImportModeChange("replace")}
            >
              Ersetzen
            </button>
          </div>
        </div>
      </div>

      <div className="presetTransferActions">
        <button className="btn secondary" type="button" onClick={onExport}>
          Presets exportieren
        </button>
        <button
          className="btn secondary"
          type="button"
          disabled={locked}
          onClick={() => fileInputRef.current?.click()}
        >
          Presets importieren
        </button>
        <input
          ref={fileInputRef}
          className="hiddenFileInput"
          type="file"
          accept="application/json,.json"
          disabled={locked}
          onChange={handleFileChange}
        />
      </div>

      {locked && (
        <div className="muted presetTransferHint">
          Import ist während eines laufenden Turniers deaktiviert.
        </div>
      )}
    </div>
  );
}

export function TeamSettingsPanel({
  enabled,
  teams,
  players,
  locked,
  randomTeamCount,
  onEnabledChange,
  onAddTeam,
  onDeleteTeam,
  onRenameTeam,
  onAssignPlayer,
  onRandomTeamCountChange,
  onCreateRandomTeams,
}) {
  const normalizedTeams = normalizeTeams(teams, players);
  const activeTeams = teamsWithPlayers(normalizedTeams);
  const unassigned = unassignedPlayers(players, normalizedTeams);

  function teamForPlayer(playerId) {
    return normalizedTeams.find((team) => team.playerIds.includes(playerId))?.id ?? "";
  }

  return (
    <div className={`teamSettingsPanel ${enabled ? "active" : ""} ${locked ? "locked" : ""}`}>
      <div className="teamSettingsHead">
        <div>
          <div className="section-title">Teams</div>
          <div className="muted">Teammodus</div>
        </div>
        <label className="bonusToggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={locked}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span>Teammodus aktivieren</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="teamTools">
            <div>
              <div className="muted">Zufaellige Teams</div>
              <div className="modeToggle" role="group" aria-label="Anzahl Teams">
                {TEAM_COUNT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    className={`segmentedBtn ${randomTeamCount === count ? "active" : ""}`}
                    type="button"
                    disabled={locked}
                    onClick={() => onRandomTeamCountChange(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn secondary miniBtn"
              type="button"
              disabled={locked || players.length < 2}
              onClick={onCreateRandomTeams}
            >
              Teams zufaellig erstellen
            </button>
            <button className="btn secondary miniBtn" type="button" disabled={locked} onClick={onAddTeam}>
              Team hinzufuegen
            </button>
          </div>

          <div className="teamCards">
            {normalizedTeams.length === 0 ? (
              <div className="muted">Noch keine Teams.</div>
            ) : (
              normalizedTeams.map((team) => {
                const members = players.filter((player) => team.playerIds.includes(player.id));
                return (
                  <div key={team.id} className={`teamCard ${members.length === 0 ? "empty" : ""}`}>
                    <div className="teamCardTop">
                      <input
                        type="text"
                        value={team.name}
                        disabled={locked}
                        onChange={(event) => onRenameTeam(team.id, event.target.value)}
                      />
                      <span className={`teamStatusChip ${members.length === 0 ? "empty" : ""}`}>
                        {members.length === 0 ? "Leer" : `${members.length} Spieler`}
                      </span>
                      <button
                        className="btn danger miniBtn"
                        type="button"
                        disabled={locked}
                        onClick={() => onDeleteTeam(team.id)}
                      >
                        Löschen
                      </button>
                    </div>
                    <div className="teamMemberList">
                      {members.length === 0 ? (
                        <span className="muted">0 Spieler</span>
                      ) : (
                        members.map((player) => (
                          <span key={player.id} className="teamMemberChip">
                            {player.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="teamAssignList">
            <div className="teamAssignHead">
              <div>
                <div className="section-title">Spieler zuordnen</div>
                <div className="muted">
                  {activeTeams.length}/2 Teams mit Spielern benötigt.
                  {unassigned.length > 0 ? ` ${unassigned.length} unzugeordnet.` : ""}
                </div>
              </div>
            </div>
            {unassigned.length > 0 && (
              <div className="unassignedPlayers">
                {unassigned.map((player) => (
                  <span key={player.id} className="teamMemberChip unassigned">
                    {player.name}
                  </span>
                ))}
              </div>
            )}
            {players.length === 0 ? (
              <div className="muted">Erst Spieler auswählen.</div>
            ) : (
              players.map((player) => (
                <label key={player.id} className="teamAssignRow">
                  <span>{player.name}</span>
                  <select
                    value={teamForPlayer(player.id)}
                    disabled={locked}
                    onChange={(event) => onAssignPlayer(player.id, event.target.value)}
                  >
                    <option value="">Unzugeordnet</option>
                    {normalizedTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))
            )}
          </div>

          {locked && <div className="muted scoringHint">Turnier-Snapshot aktiv.</div>}
        </>
      )}
    </div>
  );
}

export function ScoringSettingsPanel({
  settings,
  placeCount,
  locked,
  onPointChange,
  onMultiplierEnabledChange,
  onMultiplierChange,
  onMultiplierModeChange,
  onBonusEnabledChange,
  onBonusMultiplierChange,
  onBonusChanceChange,
  onMinusRoundEnabledChange,
  onMinusRoundChanceChange,
  onMinusRoundPointsStepChange,
  onScoringBooleanChange,
  onScoringNumberChange,
  onReset,
}) {
  const normalized = normalizeScoringSettings(settings, placeCount);
  const places = Array.from({ length: placeCount }, (_, index) => index + 1);

  return (
    <div className={`scoringPanel ${locked ? "locked" : ""}`}>
      <div className="scoringHead">
        <div>
          <div className="section-title">Punkte</div>
          <div className="muted">Basiswerte pro Platz</div>
        </div>
        <button
          className="btn secondary miniBtn"
          type="button"
          disabled={locked}
          onClick={onReset}
        >
          Standard wiederherstellen
        </button>
      </div>

      <div className="scoreGrid">
        {places.map((place) => (
          <label key={place} className="scoreField">
            <span>Platz {place}</span>
            <input
              type="number"
              min="0"
              max={MAX_POINTS_VALUE}
              step="1"
              value={formatNumberInput(basePointsForPlace(place, normalized))}
              disabled={locked}
              onChange={(event) => onPointChange(place, event.target.value)}
            />
          </label>
        ))}
      </div>

      <div className={`multiplierSetting ${normalized.multiplierEnabled ? "active" : ""}`}>
        <label className="bonusToggle multiplierToggle">
          <input
            type="checkbox"
            checked={normalized.multiplierEnabled}
            disabled={locked}
            onChange={(event) => onMultiplierEnabledChange(event.target.checked)}
          />
          <span>Multiplikator aktivieren</span>
        </label>
        <label className="scoreField multiplierField">
          <span>Multiplikator</span>
          <input
            type="number"
            min={MIN_MULTIPLIER}
            max={MAX_MULTIPLIER}
            step="0.01"
            value={formatNumberInput(normalized.multiplier)}
            disabled={locked || !normalized.multiplierEnabled}
            onChange={(event) => onMultiplierChange(event.target.value)}
          />
        </label>
        <span className="pill">
          <span className="dot" /> {normalized.multiplierEnabled ? "Aktiv" : "Aus"}
        </span>
      </div>

      <div className={`multiplierModeSetting ${normalized.multiplierEnabled ? "active" : "disabled"}`}>
        <div>
          <div className="muted">Multiplikator-Zählung</div>
          <div className="modeToggle" role="group" aria-label="Multiplikator-Zählung">
            <button
              className={`segmentedBtn ${normalized.multiplierMode === "global" ? "active" : ""}`}
              type="button"
              disabled={locked || !normalized.multiplierEnabled}
              onClick={() => onMultiplierModeChange("global")}
            >
              Global
            </button>
            <button
              className={`segmentedBtn ${normalized.multiplierMode === "perGame" ? "active" : ""}`}
              type="button"
              disabled={locked || !normalized.multiplierEnabled}
              onClick={() => onMultiplierModeChange("perGame")}
            >
              Pro Spiel
            </button>
          </div>
        </div>
        <span className="pill">
          <span className="dot" /> {normalized.multiplierMode === "perGame" ? "Pro Spiel" : "Global"}
        </span>
      </div>

      <div className={`bonusSetting ${normalized.bonusEnabled ? "active" : ""}`}>
        <label className="bonusToggle">
          <input
            type="checkbox"
            checked={normalized.bonusEnabled}
            disabled={locked}
            onChange={(event) => onBonusEnabledChange(event.target.checked)}
          />
          <span>Bonus-Runden aktivieren</span>
        </label>

        <div className="bonusFields">
          <label className="scoreField">
            <span>Bonus-Multiplikator</span>
            <input
              type="number"
              min={MIN_BONUS_MULTIPLIER}
              max={MAX_BONUS_MULTIPLIER}
              step="0.01"
              value={formatNumberInput(normalized.bonusMultiplier)}
              disabled={locked}
              onChange={(event) => onBonusMultiplierChange(event.target.value)}
            />
          </label>
          <label className="scoreField">
            <span>Bonus-Chance %</span>
            <input
              type="number"
              min={MIN_BONUS_CHANCE}
              max={MAX_BONUS_CHANCE}
              step="1"
              value={formatNumberInput(normalized.bonusChance)}
              disabled={locked}
              onChange={(event) => onBonusChanceChange(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className={`minusRoundSetting ${normalized.minusRoundEnabled ? "active" : ""}`}>
        <label className="bonusToggle">
          <input
            type="checkbox"
            checked={normalized.minusRoundEnabled}
            disabled={locked}
            onChange={(event) => onMinusRoundEnabledChange(event.target.checked)}
          />
          <span>Minusrunden aktivieren</span>
        </label>

        <div className="bonusFields">
          <label className="scoreField">
            <span>Chance %</span>
            <input
              type="number"
              min={MIN_MINUS_ROUND_CHANCE}
              max={MAX_MINUS_ROUND_CHANCE}
              step="1"
              value={formatNumberInput(normalized.minusRoundChance)}
              disabled={locked}
              onChange={(event) => onMinusRoundChanceChange(event.target.value)}
            />
          </label>
          <label className="scoreField">
            <span>Minus pro Platz</span>
            <input
              type="number"
              min={MIN_MINUS_ROUND_POINTS_STEP}
              max={MAX_MINUS_ROUND_POINTS_STEP}
              step="1"
              value={formatNumberInput(normalized.minusRoundPointsStep)}
              disabled={locked}
              onChange={(event) => onMinusRoundPointsStepChange(event.target.value)}
            />
          </label>
        </div>
        <div className="muted scoringHint">Minusrunde blockiert Bonus für diese Runde.</div>
      </div>

      <div className="specialRoundsPanel">
        <div className="specialRoundsHead">
          <div>
            <div className="section-title">Sonderrunden</div>
            <div className="muted">Maximal eine pro gezogener Runde</div>
          </div>
        </div>

        <div className="specialRoundRows">
          <div className={`specialRoundRow ${normalized.jackpotRoundEnabled ? "active" : ""}`}>
            <label className="bonusToggle">
              <input
                type="checkbox"
                checked={normalized.jackpotRoundEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("jackpotRoundEnabled", event.target.checked)}
              />
              <span>Jackpot</span>
            </label>
            <label className="scoreField">
              <span>Chance %</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_CHANCE}
                max={MAX_SPECIAL_ROUND_CHANCE}
                step="1"
                value={formatNumberInput(normalized.jackpotRoundChance)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("jackpotRoundChance", event.target.value, MIN_SPECIAL_ROUND_CHANCE, MAX_SPECIAL_ROUND_CHANCE)}
              />
            </label>
            <label className="scoreField">
              <span>Bonus</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.jackpotRoundBonusPoints)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("jackpotRoundBonusPoints", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
          </div>

          <div className={`specialRoundRow ${normalized.robberRoundEnabled ? "active" : ""}`}>
            <label className="bonusToggle">
              <input
                type="checkbox"
                checked={normalized.robberRoundEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("robberRoundEnabled", event.target.checked)}
              />
              <span>Räuber</span>
            </label>
            <label className="scoreField">
              <span>Chance %</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_CHANCE}
                max={MAX_SPECIAL_ROUND_CHANCE}
                step="1"
                value={formatNumberInput(normalized.robberRoundChance)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("robberRoundChance", event.target.value, MIN_SPECIAL_ROUND_CHANCE, MAX_SPECIAL_ROUND_CHANCE)}
              />
            </label>
            <label className="scoreField">
              <span>Klaubetrag</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.robberRoundStealAmount)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("robberRoundStealAmount", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
          </div>

          <div className={`specialRoundRow ${normalized.comebackRoundEnabled ? "active" : ""}`}>
            <label className="bonusToggle">
              <input
                type="checkbox"
                checked={normalized.comebackRoundEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("comebackRoundEnabled", event.target.checked)}
              />
              <span>Comeback</span>
            </label>
            <label className="scoreField">
              <span>Chance %</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_CHANCE}
                max={MAX_SPECIAL_ROUND_CHANCE}
                step="1"
                value={formatNumberInput(normalized.comebackRoundChance)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("comebackRoundChance", event.target.value, MIN_SPECIAL_ROUND_CHANCE, MAX_SPECIAL_ROUND_CHANCE)}
              />
            </label>
            <label className="scoreField">
              <span>Letzter</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.comebackRoundLastBonus)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("comebackRoundLastBonus", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
            <label className="scoreField">
              <span>Vorletzter</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.comebackRoundSecondLastBonus)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("comebackRoundSecondLastBonus", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
          </div>

          <div className={`specialRoundRow ${normalized.riskRoundEnabled ? "active" : ""}`}>
            <label className="bonusToggle">
              <input
                type="checkbox"
                checked={normalized.riskRoundEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("riskRoundEnabled", event.target.checked)}
              />
              <span>Risiko</span>
            </label>
            <label className="scoreField">
              <span>Chance %</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_CHANCE}
                max={MAX_SPECIAL_ROUND_CHANCE}
                step="1"
                value={formatNumberInput(normalized.riskRoundChance)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("riskRoundChance", event.target.value, MIN_SPECIAL_ROUND_CHANCE, MAX_SPECIAL_ROUND_CHANCE)}
              />
            </label>
            <label className="scoreField">
              <span>Bonus</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.riskRoundRewardPoints)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("riskRoundRewardPoints", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
            <label className="scoreField">
              <span>Strafe</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.riskRoundPenaltyPoints)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("riskRoundPenaltyPoints", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
            <label className="scoreField">
              <span>Top</span>
              <input
                type="number"
                min={MIN_RISK_SUCCESS_PLACES}
                max={MAX_RISK_SUCCESS_PLACES}
                step="1"
                value={formatNumberInput(normalized.riskRoundSuccessPlaces)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("riskRoundSuccessPlaces", event.target.value, MIN_RISK_SUCCESS_PLACES, MAX_RISK_SUCCESS_PLACES)}
              />
            </label>
          </div>

          <div className={`specialRoundRow ${normalized.secretRoundEnabled ? "active" : ""}`}>
            <label className="bonusToggle">
              <input
                type="checkbox"
                checked={normalized.secretRoundEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("secretRoundEnabled", event.target.checked)}
              />
              <span>Geheimrunde</span>
            </label>
            <label className="scoreField">
              <span>Chance %</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_CHANCE}
                max={MAX_SPECIAL_ROUND_CHANCE}
                step="1"
                value={formatNumberInput(normalized.secretRoundChance)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("secretRoundChance", event.target.value, MIN_SPECIAL_ROUND_CHANCE, MAX_SPECIAL_ROUND_CHANCE)}
              />
            </label>
            <span className="specialRoundHint">verdeckt bis Log</span>
          </div>

          <div className={`specialRoundRow ${normalized.mysteryRoundEnabled ? "active" : ""}`}>
            <label className="bonusToggle">
              <input
                type="checkbox"
                checked={normalized.mysteryRoundEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("mysteryRoundEnabled", event.target.checked)}
              />
              <span>Mystery-Bonus</span>
            </label>
            <label className="scoreField">
              <span>Chance %</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_CHANCE}
                max={MAX_SPECIAL_ROUND_CHANCE}
                step="1"
                value={formatNumberInput(normalized.mysteryRoundChance)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("mysteryRoundChance", event.target.value, MIN_SPECIAL_ROUND_CHANCE, MAX_SPECIAL_ROUND_CHANCE)}
              />
            </label>
            <label className="scoreField">
              <span>Min</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.mysteryRoundMinBonus)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("mysteryRoundMinBonus", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
            <label className="scoreField">
              <span>Max</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.mysteryRoundMaxBonus)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("mysteryRoundMaxBonus", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
            <label className="scoreField">
              <span>Schritt</span>
              <input
                type="number"
                min="1"
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.mysteryRoundStep)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("mysteryRoundStep", event.target.value, 1, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
          </div>

          <div className={`specialRoundRow ${normalized.allOrNothingRoundEnabled ? "active" : ""}`}>
            <label className="bonusToggle">
              <input
                type="checkbox"
                checked={normalized.allOrNothingRoundEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("allOrNothingRoundEnabled", event.target.checked)}
              />
              <span>Alles oder Nichts</span>
            </label>
            <label className="scoreField">
              <span>Chance %</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_CHANCE}
                max={MAX_SPECIAL_ROUND_CHANCE}
                step="1"
                value={formatNumberInput(normalized.allOrNothingRoundChance)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("allOrNothingRoundChance", event.target.value, MIN_SPECIAL_ROUND_CHANCE, MAX_SPECIAL_ROUND_CHANCE)}
              />
            </label>
            <label className="scoreField">
              <span>Sieger</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.allOrNothingRoundWinnerPoints)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("allOrNothingRoundWinnerPoints", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
            <label className="bonusToggle compactToggle">
              <input
                type="checkbox"
                checked={normalized.allOrNothingRoundLastPenaltyEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("allOrNothingRoundLastPenaltyEnabled", event.target.checked)}
              />
              <span>Letzter bestrafen</span>
            </label>
            <label className="scoreField">
              <span>Strafe</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.allOrNothingRoundLastPenalty)}
                disabled={locked || !normalized.allOrNothingRoundLastPenaltyEnabled}
                onChange={(event) => onScoringNumberChange?.("allOrNothingRoundLastPenalty", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
          </div>

          <div className={`specialRoundRow ${normalized.kingOfTheRoundEnabled ? "active" : ""}`}>
            <label className="bonusToggle">
              <input
                type="checkbox"
                checked={normalized.kingOfTheRoundEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("kingOfTheRoundEnabled", event.target.checked)}
              />
              <span>Rundenkönig</span>
            </label>
            <label className="scoreField">
              <span>Chance %</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_CHANCE}
                max={MAX_SPECIAL_ROUND_CHANCE}
                step="1"
                value={formatNumberInput(normalized.kingOfTheRoundChance)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("kingOfTheRoundChance", event.target.value, MIN_SPECIAL_ROUND_CHANCE, MAX_SPECIAL_ROUND_CHANCE)}
              />
            </label>
            <label className="scoreField">
              <span>Sieger</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.kingOfTheRoundWinnerPoints)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("kingOfTheRoundWinnerPoints", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
          </div>

          <div className={`specialRoundRow ${normalized.lastManPunishmentEnabled ? "active" : ""}`}>
            <label className="bonusToggle">
              <input
                type="checkbox"
                checked={normalized.lastManPunishmentEnabled}
                disabled={locked}
                onChange={(event) => onScoringBooleanChange?.("lastManPunishmentEnabled", event.target.checked)}
              />
              <span>Letzter - Strafe</span>
            </label>
            <label className="scoreField">
              <span>Chance %</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_CHANCE}
                max={MAX_SPECIAL_ROUND_CHANCE}
                step="1"
                value={formatNumberInput(normalized.lastManPunishmentChance)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("lastManPunishmentChance", event.target.value, MIN_SPECIAL_ROUND_CHANCE, MAX_SPECIAL_ROUND_CHANCE)}
              />
            </label>
            <label className="scoreField">
              <span>Strafe</span>
              <input
                type="number"
                min={MIN_SPECIAL_ROUND_POINTS}
                max={MAX_SPECIAL_ROUND_POINTS}
                step="1"
                value={formatNumberInput(normalized.lastManPunishmentPenaltyPoints)}
                disabled={locked}
                onChange={(event) => onScoringNumberChange?.("lastManPunishmentPenaltyPoints", event.target.value, MIN_SPECIAL_ROUND_POINTS, MAX_SPECIAL_ROUND_POINTS)}
              />
            </label>
          </div>
        </div>
      </div>

      {locked && <div className="muted scoringHint">Turnier-Snapshot aktiv.</div>}
    </div>
  );
}

export function WheelSettingsPanel({
  settings,
  locked,
  onWeightModeChange,
  onNoRepeatChange,
}) {
  const normalized = normalizeWheelSettings(settings);

  return (
    <div className={`wheelSettingsPanel ${locked ? "locked" : ""}`}>
      <div className="wheelSettingsHead">
        <div>
          <div className="section-title">Wheel</div>
          <div className="muted">Game-Auswahl</div>
        </div>
        <span className="pill">
          <span className="dot" /> {wheelWeightModeLabel(normalized.weightMode)}
        </span>
      </div>

      <div className="wheelModeSetting">
        <div>
          <div className="muted">Wheel-Modus</div>
          <div className="modeToggle" role="group" aria-label="Wheel-Modus">
            <button
              className={`segmentedBtn ${normalized.weightMode === "equal" ? "active" : ""}`}
              type="button"
              disabled={locked}
              onClick={() => onWeightModeChange("equal")}
            >
              Gleich
            </button>
            <button
              className={`segmentedBtn ${normalized.weightMode === "remainingRounds" ? "active" : ""}`}
              type="button"
              disabled={locked}
              onClick={() => onWeightModeChange("remainingRounds")}
            >
              Offene Runden
            </button>
          </div>
        </div>
      </div>

      <label className="bonusToggle wheelNoRepeatToggle">
        <input
          type="checkbox"
          checked={normalized.noRepeat}
          disabled={locked}
          onChange={(event) => onNoRepeatChange(event.target.checked)}
        />
        <span>Gleiches Spiel nicht direkt wiederholen</span>
      </label>

      {locked && <div className="muted scoringHint">Turnier-Snapshot aktiv.</div>}
    </div>
  );
}

export function SoundSettingsPanel({
  settings,
  onEnabledChange,
  onVolumeChange,
  onToggleCategory,
  onTestSound,
}) {
  const normalized = normalizeSoundSettings(settings);
  const soundOptions = [
    ["countdown", "Countdown"],
    ["wheel", "Wheel"],
    ["reveal", "Reveal"],
    ["save", "Speichern"],
    ["winner", "Gewinner"],
  ];

  return (
    <div className={`soundSettingsPanel ${normalized.enabled ? "active" : "disabled"}`}>
      <div className="soundSettingsHead">
        <div>
          <div className="section-title">Sounds</div>
          <div className="muted">Effekte</div>
        </div>
        <label className="bonusToggle">
          <input
            type="checkbox"
            checked={normalized.enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span>Sounds aktiv</span>
        </label>
      </div>

      <div className="soundVolumeRow">
        <label className="scoreField soundVolumeField">
          <span>Lautstärke</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={normalized.volume}
            disabled={!normalized.enabled}
            onInput={(event) => onVolumeChange(event.currentTarget.value)}
            onChange={(event) => onVolumeChange(event.target.value)}
          />
        </label>
        <span className="pill">
          <span className="dot" /> {Math.round(normalized.volume * 100)}%
        </span>
      </div>

      <div className="soundToggleGrid">
        {soundOptions.map(([key, label]) => (
          <label key={key} className="bonusToggle soundToggle">
            <input
              type="checkbox"
              checked={normalized[key]}
              disabled={!normalized.enabled}
              onChange={(event) => onToggleCategory(key, event.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <button
        className="btn secondary miniBtn"
        type="button"
        disabled={!normalized.enabled}
        onClick={onTestSound}
      >
        Test-Sound
      </button>
    </div>
  );
}

export function PresetGrid({
  items,
  inputValue,
  inputPlaceholder,
  emptyLabel,
  onInputChange,
  onAdd,
  onEnter,
  renderItem,
}) {
  return (
    <>
      <div className="row">
        <input
          type="text"
          value={inputValue}
          placeholder={inputPlaceholder}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onEnter();
          }}
        />
        <button className="btn" type="button" onClick={onAdd}>
          Hinzufügen
        </button>
      </div>
      <div className="tileGrid">
        {items.length === 0 ? (
          <div className="muted emptyGrid">{emptyLabel}</div>
        ) : (
          items.map(renderItem)
        )}
      </div>
    </>
  );
}

export function GameTile({
  game,
  active,
  rounds,
  locked,
  onDelete,
  onToggle,
  onChangeRounds,
  onChangeScoringMode,
}) {
  const scoringMode = normalizeGameScoringMode(game.scoringMode);
  const nextScoringMode = scoringMode === "score" ? "placement" : "score";
  const compactModeLabel = scoringMode === "score" ? "Score" : "Placement";

  return (
    <button
      className={`tile gameTile ${active ? "active" : ""}`}
      type="button"
      onClick={() => onToggle(game.id)}
    >
      <span
        className="icon del"
        role="button"
        tabIndex={0}
        title="Löschen"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(game.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onDelete(game.id);
          }
        }}
      >
        ×
      </span>
      <span
        className="icon plus"
        role="button"
        tabIndex={0}
        title="Runde +"
        onClick={(event) => {
          event.stopPropagation();
          onChangeRounds(game.id, 1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onChangeRounds(game.id, 1);
          }
        }}
      >
        +
      </span>
      <span
        className="icon minus"
        role="button"
        tabIndex={0}
        title="Runde -"
        onClick={(event) => {
          event.stopPropagation();
          onChangeRounds(game.id, -1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onChangeRounds(game.id, -1);
          }
        }}
      >
        −
      </span>
      <div className="tileContent">
        <div className="tileTopLine">
          {active && <span className="activeBadge">Aktiv</span>}
        </div>
        <div className="tileNameArea">
          <TileName text={game.name} />
        </div>
        <div className="tileFooter">
          <span className="badge">×{rounds}</span>
          {active && (
            <span
              className={`modeBadge ${scoringMode === "score" ? "scoreMode" : ""}`}
              role="button"
              tabIndex={0}
              title={gameScoringModeLabel(scoringMode)}
              onClick={(event) => {
                event.stopPropagation();
                if (!locked) onChangeScoringMode(game.id, nextScoringMode);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!locked) onChangeScoringMode(game.id, nextScoringMode);
                }
              }}
            >
              {compactModeLabel}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function PlayerTile({ player, active, onDelete, onToggle }) {
  return (
    <button
      className={`tile playerTile ${active ? "active" : ""}`}
      type="button"
      onClick={() => onToggle(player.id)}
    >
      <span
        className="icon del"
        role="button"
        tabIndex={0}
        title="Löschen"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(player.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onDelete(player.id);
          }
        }}
      >
        ×
      </span>
      <div className="tileContent playerTileContent">
        <div className="tileNameArea">
          <TileName text={player.name} player />
        </div>
      </div>
    </button>
  );
}

function TileName({ text, player = false }) {
  const tileRef = useRef(null);
  const nameRef = useRef(null);

  useLayoutEffect(() => {
    const tileEl = tileRef.current?.parentElement;
    const titleEl = nameRef.current;
    if (!tileEl || !titleEl) return undefined;

    function fit() {
      const hasSpaces = /\s/.test(text);

      titleEl.style.wordBreak = "normal";
      titleEl.style.overflowWrap = "normal";
      titleEl.style.hyphens = "none";

      if (hasSpaces) {
        titleEl.style.whiteSpace = "normal";
      } else {
        titleEl.style.whiteSpace = "nowrap";
      }

      const maxFontSize = player ? 18 : 18;
      const minFontSize = 12;
      const maxHeight = Math.max(18, Math.floor(tileEl.clientHeight * 0.96));

      for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 0.5) {
        titleEl.style.fontSize = `${fontSize}px`;
        const fitsWidth = titleEl.scrollWidth <= titleEl.clientWidth + 1;
        const fitsHeight = titleEl.scrollHeight <= maxHeight + 1;
        if (fitsWidth && fitsHeight) return;
      }

      titleEl.style.fontSize = `${minFontSize}px`;
    }

    fit();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(tileEl);
    observer.observe(titleEl);
    return () => observer.disconnect();
  }, [player, text]);

  return (
    <span ref={tileRef} className="nameMeasure">
      <span
        ref={nameRef}
        className={`name ${player ? "playerName" : ""}`}
        title={text}
      >
        {text}
      </span>
    </span>
  );
}
