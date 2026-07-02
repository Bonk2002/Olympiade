import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RestoreTournamentModal, Toast } from "./components/Overlays";
import {
  FinishedTournamentDetails,
  FinishedTournamentsList,
  WinningScreen,
} from "./components/FinishedTournaments";
import {
  GameTile,
  PlayerTile,
  PresetGrid,
  PresetTransferPanel,
  ScoringSettingsPanel,
  SoundSettingsPanel,
  TeamSettingsPanel,
  WheelSettingsPanel,
} from "./components/SetupPanel";
import { LogEditModal, Summary } from "./components/Summary";
import { TournamentDashboard } from "./components/TournamentDashboard";
import {
  ManualGamePicker,
  PickedGame,
  RoundEntry,
  Wheel,
  WheelControls,
  WheelStatus,
} from "./components/WheelPanel";
import {
  ACTIVE_TOURNAMENT_VERSION,
  DEFAULT_SCORING_SETTINGS,
  LS_KEYS,
  MAX_BONUS_CHANCE,
  MAX_BONUS_MULTIPLIER,
  MAX_MULTIPLIER,
  MAX_POINTS_VALUE,
  MIN_BONUS_CHANCE,
  MIN_BONUS_MULTIPLIER,
  MIN_MULTIPLIER,
  MIN_SCORING_PLACES,
} from "./constants/defaults";
import { TournamentEngine } from "./engine/TournamentEngine";
import { useSoundEffects } from "./hooks/useSoundEffects";
import { useWheelSpin } from "./hooks/useWheelSpin";
import { clamp, formatMultiplier, formatPoints, uid } from "./utils/common";
import {
  deriveSetupRoundsFromTournament,
  loadSetupState,
  loadPresets,
  loadScoringSettings,
  loadWheelSettings,
  readActiveTournamentSave,
  removeActiveTournamentSave,
  saveActiveTournament,
  savePresets,
  saveScoringSettings,
  saveSetupState,
  saveWheelSettings,
} from "./utils/persistence";
import {
  basePointsForPlace,
  gameScoringModeLabel,
  modeText,
  normalizeGameScoringMode,
  normalizeNumber,
  normalizeScoringSettings,
} from "./utils/scoring";
import {
  loadSoundSettings,
  normalizeSoundSettings,
  saveSoundSettings,
} from "./utils/sound";
import {
  applyPresetImport,
  buildPresetExport,
  parsePresetImportJson,
} from "./utils/presetTransfer";
import {
  buildFinishedTournamentSnapshot,
  buildFinishedTournamentSummary,
  loadFinishedTournaments,
  saveFinishedTournaments,
} from "./utils/finishedTournaments";
import {
  makeWheelEntryFromPreset,
  normalizeWheelSettings,
} from "./utils/wheel";
import {
  createBalancedRandomTeams,
  defaultRoundEvaluationMode,
  normalizeRoundEvaluationMode,
  normalizeTeams,
  teamsWithPlayers,
} from "./utils/teams";

const COUNTDOWN_STEPS = ["3", "2", "1", "LOS"];

function phaseLabel(phase) {
  if (phase === "countdown") return "Countdown";
  if (phase === "wheel") return "Wheel";
  if (phase === "reveal") return "Reveal";
  if (phase === "roundEntry") return "Live-Runde";
  if (phase === "saved") return "Gespeichert";
  return "Setup";
}

function MiniRankingBar({ leaderboard }) {
  if (!leaderboard.length) return null;

  return (
    <div className="miniRankingBar">
      {leaderboard.slice(0, 3).map((player, index) => (
        <div key={player.id} className={`miniRankItem place${index + 1}`}>
          <span>#{index + 1}</span>
          <b>{player.name}</b>
          <strong>{formatPoints(player.total)}</strong>
        </div>
      ))}
    </div>
  );
}

function OpenGamesChips({ games, currentGame }) {
  if (!games.length) return null;

  return (
    <div className="openGamesChips" aria-label="Offene Games">
      {games.map((game) => {
        const totalRounds = game.totalRounds ?? game.remainingRounds ?? 1;
        const playedRounds = game.playedRounds ?? Math.max(0, totalRounds - game.remainingRounds);

        return (
          <span
            key={game.id}
            className={`openGameChip ${currentGame?.id === game.id ? "current" : ""}`}
            title={`${game.name} - ${playedRounds}/${totalRounds}`}
          >
            <b>{game.name}</b>
            <small>{playedRounds}/{totalRounds}</small>
          </span>
        );
      })}
    </div>
  );
}

function CountdownStage({ value }) {
  return (
    <div className="flowStage countdownStage" aria-live="polite">
      <div className="countdownPulse">{value}</div>
    </div>
  );
}

function RevealStage({ tournament, currentGame, onContinue }) {
  if (!tournament || !currentGame) return null;

  const scoringSettings = normalizeScoringSettings(tournament.scoringSettings, tournament.players.length);
  const currentBonus = tournament.currentBonus?.active ? tournament.currentBonus : null;
  const normalMultiplier = scoringSettings.multiplierEnabled
    ? Math.pow(
        scoringSettings.multiplier,
        scoringSettings.multiplierMode === "perGame"
          ? currentGame.playedRounds
          : tournament.globalRound
      )
    : 1;
  const effectiveMultiplier = normalMultiplier * (currentBonus?.multiplier ?? 1);

  return (
    <button className="flowStage revealStage" type="button" onClick={onContinue}>
      <span className="revealEyebrow">Naechstes Game</span>
      <strong>{currentGame.name}</strong>
      <span className="revealMeta">
        Runde {currentGame.playedRounds + 1}/{currentGame.totalRounds} · TR {tournament.globalRound + 1}
      </span>
      <span className="revealChips">
        <span>{gameScoringModeLabel(currentGame.scoringMode)}</span>
        <span>Normal x{formatMultiplier(normalMultiplier)}</span>
        {currentBonus && <span className="bonusChip">BONUS x{formatMultiplier(currentBonus.multiplier)}</span>}
        <span>Gesamt x{formatMultiplier(effectiveMultiplier)}</span>
      </span>
    </button>
  );
}

function SavedStage({ savedRound }) {
  return (
    <div className="flowStage savedStage" aria-live="polite">
      <div className="savedCard">
        <span className="savedCheck">OK</span>
        <b>Runde gespeichert</b>
        {savedRound && (
          <span>
            {savedRound.gameName} · TR {savedRound.globalRound}
            {savedRound.totalPoints > 0 ? ` · ${formatPoints(savedRound.totalPoints)} vergeben` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function App() {
  const [presetsGames, setPresetsGames] = useState(() => loadPresets(LS_KEYS.games));
  const [presetsPlayers, setPresetsPlayers] = useState(() => loadPresets(LS_KEYS.players));
  const [selectedGameIds, setSelectedGameIds] = useState(
    () => new Set(loadSetupState()?.selectedGameIds ?? [])
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(
    () => new Set(loadSetupState()?.selectedPlayerIds ?? [])
  );
  const [setupRounds, setSetupRoundsState] = useState(() => loadSetupState()?.setupRounds ?? {});
  const [scoringSettings, setScoringSettings] = useState(() => loadScoringSettings());
  const [wheelSettings, setWheelSettings] = useState(() => loadWheelSettings());
  const [soundSettings, setSoundSettings] = useState(() => loadSoundSettings());
  const [teamModeEnabled, setTeamModeEnabled] = useState(
    () => loadSetupState()?.teamModeEnabled ?? false
  );
  const [teams, setTeams] = useState(() => loadSetupState()?.teams ?? []);
  const [randomTeamCount, setRandomTeamCount] = useState(
    () => loadSetupState()?.randomTeamCount ?? 2
  );
  const [setupOpen, setSetupOpen] = useState(true);
  const [setupGamesOpen, setSetupGamesOpen] = useState(true);
  const [setupPlayersOpen, setSetupPlayersOpen] = useState(false);
  const [gameName, setGameName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [tournament, setTournament] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [scoreDraft, setScoreDraft] = useState({});
  const [roundEvaluationMode, setRoundEvaluationMode] = useState("individualPlacement");
  const [winnerTeamId, setWinnerTeamId] = useState("");
  const [teamScoreDraft, setTeamScoreDraft] = useState({});
  const [toast, setToast] = useState("");
  const [resetArmed, setResetArmed] = useState(false);
  const [undoArmed, setUndoArmed] = useState(false);
  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [presetImportMode, setPresetImportMode] = useState("merge");
  const [finishedTournaments, setFinishedTournaments] = useState(() => loadFinishedTournaments());
  const [showWinningScreen, setShowWinningScreen] = useState(false);
  const [viewFinishedTournament, setViewFinishedTournament] = useState(null);
  const [savedFinishedTournamentId, setSavedFinishedTournamentId] = useState(null);
  const [deleteFinishedArmedId, setDeleteFinishedArmedId] = useState(null);
  const [deleteLogArmedId, setDeleteLogArmedId] = useState(null);
  const [editLogEntry, setEditLogEntry] = useState(null);
  const [restoreCandidate, setRestoreCandidate] = useState(() => readActiveTournamentSave());
  const [uiPhase, setUiPhase] = useState("setup");
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [runtimePanel, setRuntimePanel] = useState("games");
  const [savedRoundInfo, setSavedRoundInfo] = useState(null);

  const resetTimerRef = useRef(null);
  const undoTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const deleteFinishedTimerRef = useRef(null);
  const deleteLogTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const revealTimerRef = useRef(null);
  const savedTimerRef = useRef(null);
  const lastCountdownSoundRef = useRef(null);
  const lastRevealSoundRef = useRef(null);
  const lastSavedSoundRef = useRef(null);
  const lastWinnerSoundRef = useRef(null);

  const getSetupRounds = useCallback((gameId) => setupRounds[gameId] ?? 1, [setupRounds]);
  const selectedPlayers = useMemo(
    () => presetsPlayers.filter((player) => selectedPlayerIds.has(player.id)),
    [presetsPlayers, selectedPlayerIds]
  );
  const setupTeams = useMemo(
    () => normalizeTeams(teams, selectedPlayers),
    [selectedPlayers, teams]
  );
  const scoringPlaceCount = Math.max(
    MIN_SCORING_PLACES,
    selectedPlayerIds.size,
    tournament?.players.length ?? 0
  );

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  const {
    unlock: unlockSound,
    playCountdownTick,
    playCountdownGo,
    playWheelStart,
    playWheelTick,
    playReveal,
    playSave,
    playWinner,
    playTestSound,
  } = useSoundEffects(soundSettings);

  function clearUndoConfirmation() {
    setUndoArmed(false);
    window.clearTimeout(undoTimerRef.current);
  }

  function clearDeleteLogConfirmation() {
    setDeleteLogArmedId(null);
    window.clearTimeout(deleteLogTimerRef.current);
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(resetTimerRef.current);
      window.clearTimeout(undoTimerRef.current);
      window.clearTimeout(toastTimerRef.current);
      window.clearTimeout(deleteFinishedTimerRef.current);
      window.clearTimeout(deleteLogTimerRef.current);
      window.clearTimeout(countdownTimerRef.current);
      window.clearTimeout(revealTimerRef.current);
      window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    savePresets(LS_KEYS.games, presetsGames);
  }, [presetsGames]);

  useEffect(() => {
    savePresets(LS_KEYS.players, presetsPlayers);
  }, [presetsPlayers]);

  useEffect(() => {
    saveScoringSettings(scoringSettings);
  }, [scoringSettings]);

  useEffect(() => {
    saveWheelSettings(wheelSettings);
  }, [wheelSettings]);

  useEffect(() => {
    saveSoundSettings(soundSettings);
  }, [soundSettings]);

  useEffect(() => {
    saveFinishedTournaments(finishedTournaments);
  }, [finishedTournaments]);

  useEffect(() => {
    if (tournament) return;

    saveSetupState({
      selectedGameIds: [...selectedGameIds],
      selectedPlayerIds: [...selectedPlayerIds],
      setupRounds,
      teamModeEnabled,
      teams: setupTeams,
      randomTeamCount,
    });
  }, [
    randomTeamCount,
    selectedGameIds,
    selectedPlayerIds,
    setupRounds,
    setupTeams,
    teamModeEnabled,
    tournament,
  ]);

  useEffect(() => {
    if (!tournament) return;

    saveActiveTournament({
      version: ACTIVE_TOURNAMENT_VERSION,
      savedAt: new Date().toISOString(),
      mode: tournament.mode,
      tournament,
      scoringSettings: tournament.scoringSettings,
      wheelSettings: tournament.wheelSettings,
      teamModeEnabled: tournament.teamModeEnabled === true,
      teams: tournament.teams ?? [],
      selectedGameIds: tournament.games.map((game) => game.id),
      selectedPlayerIds: tournament.players.map((player) => player.id),
      setupRounds: deriveSetupRoundsFromTournament(tournament),
      placements,
      scoreDraft,
      roundEvaluationMode,
      winnerTeamId,
      teamScoreDraft,
    });
  }, [placements, roundEvaluationMode, scoreDraft, teamScoreDraft, tournament, winnerTeamId]);

  const openGames = useMemo(() => {
    if (tournament) {
      return TournamentEngine.openGames(tournament);
    }

    return presetsGames
      .filter((game) => selectedGameIds.has(game.id))
      .map((game) => makeWheelEntryFromPreset(game, setupRounds, wheelSettings));
  }, [presetsGames, selectedGameIds, setupRounds, tournament, wheelSettings]);

  const wheelEntries = useMemo(() => {
    if (tournament) {
      return TournamentEngine.getWheelEntries(tournament);
    }

    return openGames;
  }, [openGames, tournament]);

  const currentGame = useMemo(() => {
    if (!tournament?.currentPickGameId) return null;
    return tournament.games.find((game) => game.id === tournament.currentPickGameId) || null;
  }, [tournament]);

  const remainingTotal = useMemo(() => {
    if (!tournament) return 0;
    return tournament.games.reduce((sum, game) => sum + game.remainingRounds, 0);
  }, [tournament]);
  const selectedSetupRounds = useMemo(() => {
    return presetsGames
      .filter((game) => selectedGameIds.has(game.id))
      .reduce((sum, game) => sum + getSetupRounds(game.id), 0);
  }, [getSetupRounds, presetsGames, selectedGameIds]);

  const tournamentFinished = Boolean(tournament) && openGames.length === 0 && !currentGame;
  const finishedTournamentSummary = useMemo(() => {
    return tournamentFinished ? buildFinishedTournamentSummary(tournament) : null;
  }, [tournament, tournamentFinished]);

  const leaderboard = useMemo(() => {
    if (!tournament) return [];
    return [...tournament.players].sort((a, b) => b.total - a.total);
  }, [tournament]);

  const usedPlayerIds = useMemo(() => {
    return new Set(placements.filter(Boolean));
  }, [placements]);

  const wheel = useWheelSpin({
    tournament,
    currentGame,
    games: wheelEntries,
    onPick: setCurrentPick,
    onSpinStart: playWheelStart,
    onSpinTick: playWheelTick,
    onToast: showToast,
  });

  const canManualPick =
    Boolean(tournament) && !currentGame && !wheel.spinning && openGames.length > 0;
  const manualPickerVisible = manualPickerOpen && canManualPick;
  const setupVisible = !tournament || setupOpen;
  const activeScoringText = modeText(tournament?.scoringSettings ?? scoringSettings);
  const runtimePanelVisible = Boolean(tournament) && !setupOpen && uiPhase !== "countdown";
  const showDashboardPanel =
    Boolean(tournament) && (setupOpen || runtimePanel === "games");
  const showSummaryPanel =
    !tournament || setupOpen || runtimePanel === "ranking" || runtimePanel === "history" || tournamentFinished;
  const showFinishedPanel = !tournament || setupOpen || runtimePanel === "history";
  const summaryFocus =
    runtimePanelVisible && runtimePanel === "ranking"
      ? "ranking"
      : runtimePanelVisible && runtimePanel === "history"
        ? "history"
        : "all";

  useEffect(() => {
    window.clearTimeout(countdownTimerRef.current);

    if (uiPhase !== "countdown") return undefined;

    countdownTimerRef.current = window.setTimeout(() => {
      setCountdownIndex((index) => {
        if (index >= COUNTDOWN_STEPS.length - 1) {
          setUiPhase("wheel");
          return index;
        }

        return index + 1;
      });
    }, 650);

    return () => window.clearTimeout(countdownTimerRef.current);
  }, [uiPhase, countdownIndex]);

  useEffect(() => {
    window.clearTimeout(revealTimerRef.current);

    if (uiPhase !== "reveal" || !currentGame) return undefined;

    revealTimerRef.current = window.setTimeout(() => {
      setUiPhase("roundEntry");
    }, 2300);

    return () => window.clearTimeout(revealTimerRef.current);
  }, [currentGame, uiPhase]);

  useEffect(() => {
    window.clearTimeout(savedTimerRef.current);

    if (uiPhase !== "saved") return undefined;

    savedTimerRef.current = window.setTimeout(() => {
      setUiPhase("wheel");
      setSavedRoundInfo(null);
    }, 1500);

    return () => window.clearTimeout(savedTimerRef.current);
  }, [uiPhase]);

  useEffect(() => {
    if (uiPhase !== "countdown") {
      lastCountdownSoundRef.current = null;
      return;
    }

    if (lastCountdownSoundRef.current === countdownIndex) return;
    lastCountdownSoundRef.current = countdownIndex;

    if (COUNTDOWN_STEPS[countdownIndex] === "LOS") {
      playCountdownGo();
      return;
    }

    playCountdownTick();
  }, [countdownIndex, playCountdownGo, playCountdownTick, uiPhase]);

  useEffect(() => {
    if (uiPhase !== "reveal" || !currentGame) return;

    const key = `${tournament?.globalRound ?? 0}:${currentGame.id}:${currentGame.playedRounds}`;
    if (lastRevealSoundRef.current === key) return;
    lastRevealSoundRef.current = key;
    playReveal();
  }, [currentGame, playReveal, tournament?.globalRound, uiPhase]);

  useEffect(() => {
    if (uiPhase !== "saved" || !savedRoundInfo) return;

    const key = `${savedRoundInfo.gameName}:${savedRoundInfo.globalRound}:${savedRoundInfo.totalPoints}`;
    if (lastSavedSoundRef.current === key) return;
    lastSavedSoundRef.current = key;
    playSave();
  }, [playSave, savedRoundInfo, uiPhase]);

  useEffect(() => {
    if (!showWinningScreen || !finishedTournamentSummary || !tournament) return;

    const key = `${tournament.log[0]?.id ?? "finished"}:${tournament.globalRound}`;
    if (lastWinnerSoundRef.current === key) return;
    lastWinnerSoundRef.current = key;
    playWinner();
  }, [finishedTournamentSummary, playWinner, showWinningScreen, tournament]);

  function continueSavedTournament() {
    if (!restoreCandidate?.valid) return;

    const saved = restoreCandidate.data;
    setTournament(saved.tournament);
    setSelectedGameIds(new Set(saved.selectedGameIds));
    setSelectedPlayerIds(new Set(saved.selectedPlayerIds));
    setSetupRoundsState(saved.setupRounds);
    setScoringSettings(saved.scoringSettings);
    setWheelSettings(saved.wheelSettings);
    setPlacements(saved.placements);
    setScoreDraft(saved.scoreDraft);
    setTeamModeEnabled(saved.tournament.teamModeEnabled === true);
    setTeams(saved.tournament.teams ?? []);
    setRoundEvaluationMode(saved.roundEvaluationMode);
    setWinnerTeamId(saved.winnerTeamId);
    setTeamScoreDraft(saved.teamScoreDraft);
    setManualPickerOpen(false);
    setSetupOpen(false);
    setUiPhase(saved.tournament.currentPickGameId ? "roundEntry" : "wheel");
    setRuntimePanel("games");
    setSavedRoundInfo(null);
    setSavedFinishedTournamentId(null);
    setShowWinningScreen(false);
    setEditLogEntry(null);
    clearDeleteLogConfirmation();
    setRestoreCandidate(null);
    showToast("Turnier fortgesetzt");
  }

  function discardSavedTournament() {
    removeActiveTournamentSave();
    setManualPickerOpen(false);
    setSetupOpen(true);
    setUiPhase("setup");
    setRuntimePanel("games");
    setSavedRoundInfo(null);
    setShowWinningScreen(false);
    setEditLogEntry(null);
    clearDeleteLogConfirmation();
    setRestoreCandidate(null);
    showToast("Gespeichertes Turnier verworfen");
  }

  function updateSetupRounds(gameId, updater) {
    setSetupRoundsState((current) => {
      const nextValue = clamp(updater(current[gameId] ?? 1), 1, 25);
      return { ...current, [gameId]: nextValue };
    });
  }

  function changeScoringPoint(placeIndex, value) {
    if (tournament) return;

    setScoringSettings((current) => {
      const minPlaces = Math.max(scoringPlaceCount, placeIndex);
      const normalized = normalizeScoringSettings(current, minPlaces);
      const pointsByPlace = [...normalized.pointsByPlace];
      pointsByPlace[placeIndex - 1] = normalizeNumber(
        value,
        basePointsForPlace(placeIndex, normalized),
        0,
        MAX_POINTS_VALUE
      );

      return normalizeScoringSettings(
        {
          ...normalized,
          pointsByPlace,
        },
        minPlaces
      );
    });
  }

  function changeMultiplierEnabled(checked) {
    if (tournament) return;

    setScoringSettings((current) => {
      const normalized = normalizeScoringSettings(current, scoringPlaceCount);
      return normalizeScoringSettings(
        {
          ...normalized,
          multiplierEnabled: checked,
        },
        scoringPlaceCount
      );
    });
  }

  function changeScoringMultiplier(value) {
    if (tournament) return;

    setScoringSettings((current) => {
      const normalized = normalizeScoringSettings(current, scoringPlaceCount);
      return normalizeScoringSettings(
        {
          ...normalized,
          multiplier: normalizeNumber(
            value,
            normalized.multiplier,
            MIN_MULTIPLIER,
            MAX_MULTIPLIER
          ),
        },
        scoringPlaceCount
      );
    });
  }

  function changeMultiplierMode(multiplierMode) {
    if (tournament) return;

    setScoringSettings((current) => {
      const normalized = normalizeScoringSettings(current, scoringPlaceCount);
      return normalizeScoringSettings(
        {
          ...normalized,
          multiplierMode,
        },
        scoringPlaceCount
      );
    });
  }

  function changeBonusEnabled(checked) {
    if (tournament) return;

    setScoringSettings((current) => {
      const normalized = normalizeScoringSettings(current, scoringPlaceCount);
      return normalizeScoringSettings(
        {
          ...normalized,
          bonusEnabled: checked,
        },
        scoringPlaceCount
      );
    });
  }

  function changeBonusMultiplier(value) {
    if (tournament) return;

    setScoringSettings((current) => {
      const normalized = normalizeScoringSettings(current, scoringPlaceCount);
      return normalizeScoringSettings(
        {
          ...normalized,
          bonusMultiplier: normalizeNumber(
            value,
            normalized.bonusMultiplier,
            MIN_BONUS_MULTIPLIER,
            MAX_BONUS_MULTIPLIER
          ),
        },
        scoringPlaceCount
      );
    });
  }

  function changeBonusChance(value) {
    if (tournament) return;

    setScoringSettings((current) => {
      const normalized = normalizeScoringSettings(current, scoringPlaceCount);
      return normalizeScoringSettings(
        {
          ...normalized,
          bonusChance: normalizeNumber(
            value,
            normalized.bonusChance,
            MIN_BONUS_CHANCE,
            MAX_BONUS_CHANCE
          ),
        },
        scoringPlaceCount
      );
    });
  }

  function resetScoringSettings() {
    if (tournament) return;
    setScoringSettings(normalizeScoringSettings(DEFAULT_SCORING_SETTINGS, scoringPlaceCount));
    showToast("Standard-Punkte wiederhergestellt");
  }

  function changeWheelWeightMode(weightMode) {
    if (tournament) return;

    setWheelSettings((current) =>
      normalizeWheelSettings({
        ...current,
        weightMode,
      })
    );
  }

  function changeWheelNoRepeat(checked) {
    if (tournament) return;

    setWheelSettings((current) =>
      normalizeWheelSettings({
        ...current,
        noRepeat: checked,
      })
    );
  }

  function changeSoundEnabled(checked) {
    setSoundSettings((current) =>
      normalizeSoundSettings({
        ...current,
        enabled: checked,
      })
    );
    if (checked) unlockSound();
  }

  function changeSoundVolume(value) {
    setSoundSettings((current) =>
      normalizeSoundSettings({
        ...current,
        volume: normalizeNumber(value, current.volume, 0, 1),
      })
    );
  }

  function changeSoundCategory(key, checked) {
    const allowedKeys = ["countdown", "wheel", "reveal", "save", "winner"];
    if (!allowedKeys.includes(key)) return;

    setSoundSettings((current) =>
      normalizeSoundSettings({
        ...current,
        [key]: checked,
      })
    );
  }

  function testSound() {
    unlockSound();
    playTestSound();
  }

  function changeTeamModeEnabled(checked) {
    if (tournament) return;

    setTeamModeEnabled(checked);
    if (checked && setupTeams.length < 2) {
      setTeams([
        { id: uid(), name: "Team 1", playerIds: [] },
        { id: uid(), name: "Team 2", playerIds: [] },
      ]);
    }
  }

  function addTeam() {
    if (tournament) return;

    setTeams((current) => [
      ...normalizeTeams(current, selectedPlayers),
      { id: uid(), name: `Team ${current.length + 1}`, playerIds: [] },
    ]);
  }

  function deleteTeam(teamId) {
    if (tournament) return;

    setTeams((current) => normalizeTeams(current, selectedPlayers).filter((team) => team.id !== teamId));
  }

  function renameTeam(teamId, name) {
    if (tournament) return;

    setTeams((current) =>
      normalizeTeams(current, selectedPlayers).map((team) =>
        team.id === teamId ? { ...team, name } : team
      )
    );
  }

  function assignPlayerToTeam(playerId, teamId) {
    if (tournament) return;

    setTeams((current) =>
      normalizeTeams(current, selectedPlayers).map((team) => {
        const playerIds = team.playerIds.filter((id) => id !== playerId);
        if (team.id === teamId) playerIds.push(playerId);
        return { ...team, playerIds };
      })
    );
  }

  function createRandomTeams() {
    if (tournament) return;

    if (selectedPlayers.length < 2) {
      showToast("Mind. 2 Spieler fuer Teams auswaehlen");
      return;
    }

    setTeamModeEnabled(true);
    setTeams(createBalancedRandomTeams(selectedPlayers, randomTeamCount));
    showToast("Teams zufaellig erstellt");
  }

  function addGame() {
    const name = gameName.trim();
    if (!name) {
      showToast("Game-Name fehlt");
      return;
    }
    if (presetsGames.some((game) => game.name.toLowerCase() === name.toLowerCase())) {
      showToast("Gibt es schon");
      return;
    }

    const game = { id: uid(), name, scoringMode: "placement" };
    setPresetsGames((games) => [game, ...games]);
    setSetupRoundsState((rounds) => ({ ...rounds, [game.id]: 1 }));
    setGameName("");
  }

  function addPlayer() {
    const name = playerName.trim();
    if (!name) {
      showToast("Spieler-Name fehlt");
      return;
    }
    if (presetsPlayers.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
      showToast("Gibt es schon");
      return;
    }

    setPresetsPlayers((players) => [{ id: uid(), name }, ...players]);
    setPlayerName("");
  }

  function deleteGame(gameId) {
    setPresetsGames((games) => games.filter((game) => game.id !== gameId));
    setSelectedGameIds((ids) => {
      const next = new Set(ids);
      next.delete(gameId);
      return next;
    });
    setSetupRoundsState((rounds) => {
      const next = { ...rounds };
      delete next[gameId];
      return next;
    });
    showToast("Game gelöscht");
  }

  function deletePlayer(playerId) {
    setPresetsPlayers((players) => players.filter((player) => player.id !== playerId));
    setTeams((current) =>
      normalizeTeams(current).map((team) => ({
        ...team,
        playerIds: team.playerIds.filter((id) => id !== playerId),
      }))
    );
    setSelectedPlayerIds((ids) => {
      const next = new Set(ids);
      next.delete(playerId);
      return next;
    });
    showToast("Spieler gelöscht");
  }

  function toggleGame(gameId) {
    setSelectedGameIds((ids) => {
      const next = new Set(ids);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  }

  function togglePlayer(playerId) {
    const wasSelected = selectedPlayerIds.has(playerId);
    if (wasSelected) {
      setTeams((current) =>
        normalizeTeams(current).map((team) => ({
          ...team,
          playerIds: team.playerIds.filter((id) => id !== playerId),
        }))
      );
    }

    setSelectedPlayerIds((ids) => {
      const next = new Set(ids);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function changeGameRounds(gameId, delta) {
    setSelectedGameIds((ids) => {
      const next = new Set(ids);
      next.add(gameId);
      return next;
    });
    updateSetupRounds(gameId, (rounds) => rounds + delta);
  }

  function changeGameScoringMode(gameId, scoringMode) {
    if (tournament) return;

    setPresetsGames((games) =>
      games.map((game) =>
        game.id === gameId
          ? { ...game, scoringMode: normalizeGameScoringMode(scoringMode) }
          : game
      )
    );
  }

  function clearSelection() {
    setSelectedGameIds(new Set());
    setSelectedPlayerIds(new Set());
    setTeams([]);
    setTeamModeEnabled(false);
  }

  function exportPresets() {
    const payload = buildPresetExport({
      games: presetsGames,
      players: presetsPlayers,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = payload.exportedAt.slice(0, 10);

    link.href = url;
    link.download = `turnier-presets-${date}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast("Export erstellt");
  }

  async function importPresets(file) {
    if (tournament) {
      showToast("Import während laufendem Turnier deaktiviert");
      return;
    }

    let raw;
    try {
      raw = await file.text();
    } catch {
      showToast("Ungültige Datei");
      return;
    }

    const parsed = parsePresetImportJson(raw);
    if (!parsed.ok) {
      showToast("Ungültige Datei");
      return;
    }

    const result = applyPresetImport({
      currentGames: presetsGames,
      currentPlayers: presetsPlayers,
      importedGames: parsed.games,
      importedPlayers: parsed.players,
      mode: presetImportMode,
      createId: uid,
    });
    const skipped = result.counts.gamesSkipped + result.counts.playersSkipped;
    const skippedText = skipped > 0 ? `, ${skipped} Duplikate übersprungen` : "";

    setPresetsGames(result.games);
    setPresetsPlayers(result.players);

    if (result.mode === "replace") {
      setSelectedGameIds(new Set());
      setSelectedPlayerIds(new Set());
      setTeamModeEnabled(false);
      setTeams([]);
      setSetupRoundsState(
        Object.fromEntries(result.games.map((game) => [game.id, 1]))
      );
    } else {
      setSetupRoundsState((rounds) => {
        const next = { ...rounds };
        result.addedGames.forEach((game) => {
          next[game.id] = 1;
        });
        return next;
      });
    }

    showToast(
      `Import erfolgreich: ${result.counts.gamesImported} Games, ${result.counts.playersImported} Spieler importiert${skippedText}`
    );
  }

  function startTournament() {
    if (tournament) {
      showToast("Erst Reset bestätigen, bevor ein neues Turnier startet");
      return;
    }

    const chosenGames = presetsGames.filter((game) => selectedGameIds.has(game.id));
    const chosenPlayers = presetsPlayers.filter((player) => selectedPlayerIds.has(player.id));

    if (chosenGames.length < 1) {
      showToast("Mind. 1 Game");
      return;
    }
    if (chosenPlayers.length < 2) {
      showToast("Mind. 2 Spieler");
      return;
    }

    const chosenTeams = normalizeTeams(teams, chosenPlayers);
    const validTeams = teamsWithPlayers(chosenTeams);
    if (teamModeEnabled && validTeams.length < 2) {
      showToast("Teammodus braucht mindestens 2 Teams mit Spielern");
      return;
    }

    unlockSound();
    setTournament(
      TournamentEngine.start({
        games: chosenGames,
        players: chosenPlayers,
        getSetupRounds,
        scoringSettings,
        wheelSettings,
        teamModeEnabled,
        teams: validTeams,
      })
    );
    setTeams(teamModeEnabled ? validTeams : []);
    setPlacements([]);
    setScoreDraft({});
    setRoundEvaluationMode("individualPlacement");
    setWinnerTeamId("");
    setTeamScoreDraft({});
    setManualPickerOpen(false);
    setSetupOpen(false);
    setCountdownIndex(0);
    setUiPhase("countdown");
    setRuntimePanel("games");
    setSavedRoundInfo(null);
    setSavedFinishedTournamentId(null);
    setShowWinningScreen(false);
  }

  function setCurrentPick(gameId) {
    const game = tournament?.games.find((item) => item.id === gameId) ?? null;
    const nextRoundEvaluationMode = defaultRoundEvaluationMode(game?.scoringMode);
    const activeTeams = teamsWithPlayers(tournament?.teams ?? []);

    unlockSound();
    setManualPickerOpen(false);
    setPlacements(Array.from({ length: tournament?.players.length ?? 0 }, () => ""));
    setScoreDraft(
      Object.fromEntries((tournament?.players ?? []).map((player) => [player.id, ""]))
    );
    setRoundEvaluationMode(nextRoundEvaluationMode);
    setWinnerTeamId(activeTeams[0]?.id ?? "");
    setTeamScoreDraft(
      Object.fromEntries((tournament?.teams ?? []).map((team) => [team.id, ""]))
    );
    setTournament((current) => TournamentEngine.setCurrentPick(current, gameId));
    setUiPhase("reveal");
    setRuntimePanel("games");
    setSavedRoundInfo(null);
    setSavedFinishedTournamentId(null);
  }

  function changeRoundEvaluationMode(value) {
    if (!tournament || !currentGame) return;

    setRoundEvaluationMode(
      normalizeRoundEvaluationMode(value, currentGame.scoringMode, tournament.teamModeEnabled === true)
    );
  }

  function toggleManualPicker() {
    if (!tournament) {
      showToast("Turnier starten");
      return;
    }
    if (currentGame) {
      showToast("Erst aktuelle Runde speichern oder skippen");
      return;
    }
    if (wheel.spinning) {
      showToast("Rad dreht gerade");
      return;
    }
    if (uiPhase !== "wheel") {
      showToast("Zur Wheel-Phase wechseln");
      setUiPhase("wheel");
      return;
    }
    if (openGames.length === 0) {
      showToast("Keine offenen Games");
      return;
    }

    setManualPickerOpen((open) => !open);
  }

  function setPlacement(placeIndex, playerId) {
    setPlacements((current) => {
      const next = [...current];
      next[placeIndex] = playerId;
      return next;
    });
  }

  function setScore(playerId, value) {
    setScoreDraft((current) => {
      if (value === "") return { ...current, [playerId]: "" };

      const number = Number(value);
      return {
        ...current,
        [playerId]: Number.isFinite(number) && number >= 0 ? value : "0",
      };
    });
  }

  function setTeamScore(teamId, value) {
    setTeamScoreDraft((current) => {
      if (value === "") return { ...current, [teamId]: "" };

      const number = Number(value);
      return {
        ...current,
        [teamId]: Number.isFinite(number) && number >= 0 ? value : "0",
      };
    });
  }

  function submitRound() {
    const result = TournamentEngine.saveRound(tournament, {
      placements,
      scoresByPlayer: scoreDraft,
      roundEvaluationMode,
      winnerTeamId,
      teamScoresByTeam: teamScoreDraft,
    });
    if (!result.ok) {
      if (result.message) showToast(result.message);
      return;
    }

    const latestEntry = result.tournament.log[0];
    const totalPoints = latestEntry?.pointsByPlayer && typeof latestEntry.pointsByPlayer === "object"
      ? Object.values(latestEntry.pointsByPlayer).reduce((sum, points) => {
          const value = Number(points);
          return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
        }, 0)
      : 0;
    const finishedAfterSave =
      TournamentEngine.openGames(result.tournament).length === 0 &&
      !result.tournament.currentPickGameId;

    setTournament(result.tournament);
    setPlacements([]);
    setScoreDraft({});
    setRoundEvaluationMode("individualPlacement");
    setWinnerTeamId("");
    setTeamScoreDraft({});
    setManualPickerOpen(false);
    setSavedRoundInfo({
      gameName: latestEntry?.gameName ?? currentGame?.name ?? "Game",
      globalRound: latestEntry?.globalRound ?? result.tournament.globalRound,
      totalPoints,
    });
    setUiPhase(finishedAfterSave ? "wheel" : "saved");
    if (finishedAfterSave) {
      playSave();
      setShowWinningScreen(true);
    }
    setSavedFinishedTournamentId(null);
    clearUndoConfirmation();
    clearDeleteLogConfirmation();
  }

  function skipGame() {
    if (!tournament?.currentPickGameId) return;

    const nextTournament = TournamentEngine.skipGame(tournament);
    const finishedAfterSkip =
      TournamentEngine.openGames(nextTournament).length === 0 &&
      !nextTournament.currentPickGameId;

    setTournament(nextTournament);
    setPlacements([]);
    setScoreDraft({});
    setRoundEvaluationMode("individualPlacement");
    setWinnerTeamId("");
    setTeamScoreDraft({});
    setManualPickerOpen(false);
    setUiPhase("wheel");
    setRuntimePanel("games");
    setSavedRoundInfo(null);
    if (finishedAfterSkip) setShowWinningScreen(true);
    setSavedFinishedTournamentId(null);
  }

  function undoLastRound() {
    if (!tournament?.log.length) {
      showToast("Keine Runde zum Zurücknehmen");
      return;
    }

    if (!undoArmed) {
      setUndoArmed(true);
      showToast("Nochmal klicken zum Zurücknehmen");
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = window.setTimeout(() => setUndoArmed(false), 3000);
      return;
    }

    const result = TournamentEngine.undo(tournament);
    clearUndoConfirmation();
    clearDeleteLogConfirmation();
    if (!result.ok) {
      showToast(result.message);
      return;
    }

    wheel.reset();
    setTournament(result.tournament);
    setPlacements([]);
    setScoreDraft({});
    setRoundEvaluationMode("individualPlacement");
    setWinnerTeamId("");
    setTeamScoreDraft({});
    setManualPickerOpen(false);
    setUiPhase("wheel");
    setRuntimePanel("games");
    setSavedRoundInfo(null);
    setSavedFinishedTournamentId(null);
    setShowWinningScreen(false);
    showToast("Letzte Runde zurückgenommen");
  }

  function deleteLogEntry(entryId) {
    if (!tournament?.log.length) {
      showToast("Keine Runde zum Loeschen");
      return;
    }

    if (deleteLogArmedId !== entryId) {
      setDeleteLogArmedId(entryId);
      showToast("Nochmal klicken zum Loeschen");
      window.clearTimeout(deleteLogTimerRef.current);
      deleteLogTimerRef.current = window.setTimeout(() => setDeleteLogArmedId(null), 3000);
      return;
    }

    const result = TournamentEngine.deleteLogEntry(tournament, entryId);
    clearDeleteLogConfirmation();
    if (!result.ok) {
      showToast(result.message);
      return;
    }

    wheel.reset();
    setTournament(result.tournament);
    setPlacements([]);
    setScoreDraft({});
    setRoundEvaluationMode("individualPlacement");
    setWinnerTeamId("");
    setTeamScoreDraft({});
    setManualPickerOpen(false);
    setUiPhase("wheel");
    setRuntimePanel("history");
    setSavedRoundInfo(null);
    setSavedFinishedTournamentId(null);
    setShowWinningScreen(false);
    setEditLogEntry((current) => (current?.id === entryId ? null : current));
    showToast("Runde geloescht");
  }

  function saveEditedLogEntry(entryId, input) {
    const result = TournamentEngine.editLogEntry(tournament, entryId, input);
    if (!result.ok) {
      showToast(result.message);
      return;
    }

    setTournament(result.tournament);
    setUiPhase(currentGame ? "roundEntry" : "wheel");
    setRuntimePanel("history");
    setSavedRoundInfo(null);
    setSavedFinishedTournamentId(null);
    setShowWinningScreen(false);
    setEditLogEntry(null);
    clearDeleteLogConfirmation();
    showToast("Runde korrigiert");
  }

  function saveFinishedTournament() {
    if (!tournament || !tournamentFinished) {
      showToast("Turnier ist noch nicht beendet");
      return;
    }
    if (savedFinishedTournamentId) {
      showToast("Turnier ist bereits gespeichert");
      return;
    }

    const snapshot = buildFinishedTournamentSnapshot(tournament, uid);
    setFinishedTournaments((current) => [snapshot, ...current]);
    setSavedFinishedTournamentId(snapshot.id);
    removeActiveTournamentSave();
    setRestoreCandidate(null);
    showToast("Turnier gespeichert");
  }

  function startNewTournamentFromWinner() {
    clearUndoConfirmation();
    clearDeleteLogConfirmation();
    wheel.reset();
    removeActiveTournamentSave();
    setRestoreCandidate(null);
    setTournament(null);
    setPlacements([]);
    setScoreDraft({});
    setRoundEvaluationMode("individualPlacement");
    setWinnerTeamId("");
    setTeamScoreDraft({});
    setManualPickerOpen(false);
    setSetupOpen(true);
    setUiPhase("setup");
    setRuntimePanel("games");
    setSavedRoundInfo(null);
    setShowWinningScreen(false);
    setSavedFinishedTournamentId(null);
    setEditLogEntry(null);
  }

  function deleteFinishedTournament(id) {
    if (deleteFinishedArmedId !== id) {
      setDeleteFinishedArmedId(id);
      showToast("Nochmal klicken zum Löschen");
      window.clearTimeout(deleteFinishedTimerRef.current);
      deleteFinishedTimerRef.current = window.setTimeout(() => setDeleteFinishedArmedId(null), 3000);
      return;
    }

    window.clearTimeout(deleteFinishedTimerRef.current);
    setDeleteFinishedArmedId(null);
    setFinishedTournaments((current) => current.filter((item) => item.id !== id));
    setSavedFinishedTournamentId((current) => (current === id ? null : current));
    setViewFinishedTournament((current) => (current?.id === id ? null : current));
    showToast("Turnier gelöscht");
  }

  function resetTournament() {
    if (!resetArmed) {
      setResetArmed(true);
      showToast("Nochmal klicken zum Bestätigen");
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => setResetArmed(false), 2500);
      return;
    }

    setResetArmed(false);
    window.clearTimeout(resetTimerRef.current);
    clearUndoConfirmation();
    clearDeleteLogConfirmation();
    wheel.reset();
    removeActiveTournamentSave();
    setRestoreCandidate(null);
    setTournament(null);
    setPlacements([]);
    setScoreDraft({});
    setRoundEvaluationMode("individualPlacement");
    setWinnerTeamId("");
    setTeamScoreDraft({});
    setManualPickerOpen(false);
    setSetupOpen(true);
    setUiPhase("setup");
    setRuntimePanel("games");
    setSavedRoundInfo(null);
    setShowWinningScreen(false);
    setSavedFinishedTournamentId(null);
    setEditLogEntry(null);
  }

  return (
    <>
      {restoreCandidate && (
        <RestoreTournamentModal
          candidate={restoreCandidate}
          onContinue={continueSavedTournament}
          onDiscard={discardSavedTournament}
        />
      )}

      {showWinningScreen && finishedTournamentSummary && (
        <WinningScreen
          tournament={finishedTournamentSummary}
          saved={Boolean(savedFinishedTournamentId)}
          onSave={saveFinishedTournament}
          onNewTournament={startNewTournamentFromWinner}
          onClose={() => setShowWinningScreen(false)}
        />
      )}

      <FinishedTournamentDetails
        tournament={viewFinishedTournament}
        onClose={() => setViewFinishedTournament(null)}
      />

      {tournament && editLogEntry && (
        <LogEditModal
          tournament={tournament}
          entry={editLogEntry}
          onClose={() => setEditLogEntry(null)}
          onSave={saveEditedLogEntry}
        />
      )}

      <Toast message={toast} />

      <div className="app">
        <header className="topbar">
          <div className="brand">
            <b>Olympiade</b>
            <span>{tournament ? phaseLabel(uiPhase) : "Setup"} · {activeScoringText}</span>
          </div>
          <div className="row">
            {tournament && (
              <>
                <button
                  className={`btn secondary ${setupOpen ? "active" : ""}`}
                  type="button"
                  onClick={() => setSetupOpen((open) => !open)}
                >
                  {setupOpen ? "Einstellungen aus" : "Einstellungen"}
                </button>
                <button
                  className={`btn secondary ${!setupOpen && runtimePanel === "games" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSetupOpen(false);
                    setRuntimePanel("games");
                  }}
                >
                  Spiele
                </button>
                <button
                  className={`btn secondary ${!setupOpen && runtimePanel === "ranking" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSetupOpen(false);
                    setRuntimePanel("ranking");
                  }}
                >
                  Ranking
                </button>
                <button
                  className={`btn secondary ${!setupOpen && runtimePanel === "history" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSetupOpen(false);
                    setRuntimePanel("history");
                  }}
                >
                  Verlauf
                </button>
              </>
            )}
            <span className="pill">
              <span className="dot" />
            </span>
            <button
              className={`btn danger ${resetArmed ? "armed" : ""}`}
              type="button"
              onClick={resetTournament}
            >
              {resetArmed ? "Reset bestätigen" : "Reset"}
            </button>
          </div>
        </header>

        <main
          className={`grid ${tournament ? "tournamentView flowRuntime" : "setupView"} flow-${uiPhase} ${
            setupVisible ? "setupVisible" : "setupCollapsed"
          }`}
        >
          {setupVisible && (
          <section className={`card setupCard ${tournament ? "runtimeSetupCard" : ""}`}>
            <div className="head">
              <div>
                <h2>Setup</h2>
                <div className="muted">Turnier vorbereiten</div>
              </div>
              <span className={`pill ${tournament ? "pillWarning" : ""}`}>
                <span className="dot" />
                {tournament ? "Snapshot aktiv" : "Setup"}
              </span>
            </div>

            <div className="body">
              <div className="setupStats">
                <span>
                  <b>{selectedGameIds.size}</b>
                  Games
                </span>
                <span>
                  <b>{selectedPlayerIds.size}</b>
                  Player
                </span>
                <span>
                  <b>{selectedSetupRounds}</b>
                  Runden
                </span>
              </div>

              <div className={`setupAccordion ${setupGamesOpen ? "open" : ""}`}>
                <button
                  className="setupAccordionHead"
                  type="button"
                  onClick={() => setSetupGamesOpen((open) => !open)}
                  aria-expanded={setupGamesOpen}
                >
                  <span>
                    <b>Games</b>
                    <small>
                      {presetsGames.length} Games · {selectedGameIds.size} ausgewählt · {selectedSetupRounds} Runden
                    </small>
                  </span>
                  <strong>{setupGamesOpen ? "Einklappen" : "Aufklappen"} ˅</strong>
                </button>
                {setupGamesOpen && (
                  <div className="setupAccordionBody">
                    <PresetGrid
                      items={presetsGames}
                      inputValue={gameName}
                      inputPlaceholder="Neues Game ..."
                      emptyLabel="Keine Games."
                      onInputChange={setGameName}
                      onAdd={addGame}
                      onEnter={addGame}
                      renderItem={(game) => (
                        <GameTile
                          key={game.id}
                          game={game}
                          active={selectedGameIds.has(game.id)}
                          rounds={getSetupRounds(game.id)}
                          locked={!!tournament}
                          onDelete={deleteGame}
                          onToggle={toggleGame}
                          onChangeRounds={changeGameRounds}
                          onChangeScoringMode={changeGameScoringMode}
                        />
                      )}
                    />
                  </div>
                )}
              </div>

              <div className={`setupAccordion ${setupPlayersOpen ? "open" : ""}`}>
                <button
                  className="setupAccordionHead"
                  type="button"
                  onClick={() => setSetupPlayersOpen((open) => !open)}
                  aria-expanded={setupPlayersOpen}
                >
                  <span>
                    <b>Player</b>
                    <small>
                      {presetsPlayers.length} Spieler · {selectedPlayerIds.size} ausgewählt
                    </small>
                  </span>
                  <strong>{setupPlayersOpen ? "Einklappen" : "Aufklappen"} ˅</strong>
                </button>
                {setupPlayersOpen && (
                  <div className="setupAccordionBody">
                    <PresetGrid
                      items={presetsPlayers}
                      inputValue={playerName}
                      inputPlaceholder="Neuer Player ..."
                      emptyLabel="Keine Spieler."
                      onInputChange={setPlayerName}
                      onAdd={addPlayer}
                      onEnter={addPlayer}
                      renderItem={(player) => (
                        <PlayerTile
                          key={player.id}
                          player={player}
                          active={selectedPlayerIds.has(player.id)}
                          onDelete={deletePlayer}
                          onToggle={togglePlayer}
                        />
                      )}
                    />
                  </div>
                )}
              </div>

              <PresetTransferPanel
                importMode={presetImportMode}
                locked={!!tournament}
                onImportModeChange={setPresetImportMode}
                onExport={exportPresets}
                onImportFile={importPresets}
              />

              <TeamSettingsPanel
                enabled={teamModeEnabled}
                teams={setupTeams}
                players={selectedPlayers}
                locked={!!tournament}
                randomTeamCount={randomTeamCount}
                onEnabledChange={changeTeamModeEnabled}
                onAddTeam={addTeam}
                onDeleteTeam={deleteTeam}
                onRenameTeam={renameTeam}
                onAssignPlayer={assignPlayerToTeam}
                onRandomTeamCountChange={setRandomTeamCount}
                onCreateRandomTeams={createRandomTeams}
              />

              <ScoringSettingsPanel
                settings={scoringSettings}
                placeCount={scoringPlaceCount}
                locked={!!tournament}
                onPointChange={changeScoringPoint}
                onMultiplierEnabledChange={changeMultiplierEnabled}
                onMultiplierChange={changeScoringMultiplier}
                onMultiplierModeChange={changeMultiplierMode}
                onBonusEnabledChange={changeBonusEnabled}
                onBonusMultiplierChange={changeBonusMultiplier}
                onBonusChanceChange={changeBonusChance}
                onReset={resetScoringSettings}
              />

              <WheelSettingsPanel
                settings={wheelSettings}
                locked={!!tournament}
                onWeightModeChange={changeWheelWeightMode}
                onNoRepeatChange={changeWheelNoRepeat}
              />

              <SoundSettingsPanel
                settings={soundSettings}
                onEnabledChange={changeSoundEnabled}
                onVolumeChange={changeSoundVolume}
                onToggleCategory={changeSoundCategory}
                onTestSound={testSound}
              />

              <div className="hr" />

              <div className="row">
                <button
                  className="btn ok"
                  type="button"
                  onClick={startTournament}
                  disabled={!!tournament}
                  title={tournament ? "Reset beendet das laufende Turnier" : "Turnier starten"}
                >
                  {tournament ? "Turnier läuft" : "Turnier starten"}
                </button>
                <button className="btn secondary" type="button" onClick={clearSelection}>
                  Auswahl leeren
                </button>
              </div>
              <div className="muted setup-hint">
                {tournament
                  ? "Snapshot fuer dieses Turnier."
                  : "Bereit, wenn Games und Player gewaehlt sind."}
              </div>
            </div>
          </section>
          )}

          <div className="wheelWrap">
            <section className={`card wheelCard ${wheel.spinning ? "spinning" : ""}`}>
              <div className="head">
                <h2>Glücksrad</h2>
                <div className="row">
                  <WheelControls
                    spinning={wheel.spinning}
                    currentGame={currentGame}
                    canManualPick={canManualPick}
                    manualPickerOpen={manualPickerVisible}
                    flowLocked={Boolean(tournament) && uiPhase !== "wheel"}
                    onSpin={wheel.spin}
                    onToggleManualPicker={toggleManualPicker}
                  />
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={!tournament?.currentPickGameId}
                    onClick={skipGame}
                  >
                    Skip Game
                  </button>
                </div>
              </div>

              <div className="body">
                {uiPhase === "countdown" && (
                  <CountdownStage value={COUNTDOWN_STEPS[countdownIndex]} />
                )}

                {uiPhase !== "countdown" && (
                  <>
                    {uiPhase !== "roundEntry" && uiPhase !== "saved" && (
                      <Wheel
                        currentGame={currentGame}
                        games={wheelEntries}
                        wheelAngle={wheel.wheelAngle}
                        spinning={wheel.spinning}
                        locked={Boolean(tournament) && uiPhase !== "wheel"}
                        onSpin={wheel.spin}
                      />
                    )}

                    {uiPhase === "roundEntry" && (
                      <div className="compactWheelDock">
                        <span className="pill">
                          <span className="dot" /> Aktuelle Runde
                        </span>
                        <b>{currentGame?.name}</b>
                      </div>
                    )}

                    {uiPhase === "wheel" && (
                      <>
                        <MiniRankingBar leaderboard={leaderboard} />
                        <OpenGamesChips games={openGames} currentGame={currentGame} />
                      </>
                    )}

                    <WheelStatus
                      tournament={tournament}
                      entries={wheelEntries}
                      openGames={openGames}
                      setupSettings={wheelSettings}
                    />

                    <ManualGamePicker
                      open={manualPickerVisible}
                      games={openGames}
                      onSelect={setCurrentPick}
                    />

                    {uiPhase !== "roundEntry" && uiPhase !== "saved" && (
                      <PickedGame
                        tournament={tournament}
                        currentGame={currentGame}
                        remainingTotal={remainingTotal}
                      />
                    )}

                    {uiPhase === "reveal" && (
                      <RevealStage
                        tournament={tournament}
                        currentGame={currentGame}
                        onContinue={() => setUiPhase("roundEntry")}
                      />
                    )}

                    {uiPhase === "saved" && <SavedStage savedRound={savedRoundInfo} />}

                    {uiPhase === "roundEntry" && (
                      <RoundEntry
                        tournament={tournament}
                        currentGame={currentGame}
                        placements={placements}
                        scoreDraft={scoreDraft}
                        roundEvaluationMode={roundEvaluationMode}
                        winnerTeamId={winnerTeamId}
                        teamScoreDraft={teamScoreDraft}
                        usedPlayerIds={usedPlayerIds}
                        onRoundEvaluationModeChange={changeRoundEvaluationMode}
                        onSetPlacement={setPlacement}
                        onSetScore={setScore}
                        onSetWinnerTeam={setWinnerTeamId}
                        onSetTeamScore={setTeamScore}
                        onSubmit={submitRound}
                      />
                    )}
                  </>
                )}
              </div>
            </section>

            {showDashboardPanel && (
              <TournamentDashboard tournament={tournament} currentGame={currentGame} />
            )}

            {showSummaryPanel && (
              <Summary
                tournament={tournament}
                leaderboard={leaderboard}
                tournamentFinished={tournamentFinished}
                undoArmed={undoArmed}
                deleteArmedId={deleteLogArmedId}
                focus={summaryFocus}
                onShowWinner={() => setShowWinningScreen(true)}
                onUndoLastRound={undoLastRound}
                onEditLogEntry={setEditLogEntry}
                onDeleteLogEntry={deleteLogEntry}
              />
            )}

            {showFinishedPanel && (
              <FinishedTournamentsList
                tournaments={finishedTournaments}
                deleteArmedId={deleteFinishedArmedId}
                onView={setViewFinishedTournament}
                onDelete={deleteFinishedTournament}
              />
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
