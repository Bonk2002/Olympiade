import { uid } from "../utils/common";
import {
  basePointsByPlaceForPlayers,
  createCurrentBonus,
  normalizeCurrentBonus,
  normalizeGameScoringMode,
  normalizeScoringSettings,
  roundMultiplier,
} from "../utils/scoring";
import { isPlainObject } from "../utils/validation";
import {
  getWheelEntriesFromGames,
  normalizeWheelSettings,
  pickGameFromEntries,
} from "../utils/wheel";
import {
  ROUND_EVALUATION_MODES,
  isScoreRoundEvaluationMode,
  isTeamRoundEvaluationMode,
  normalizeRoundEvaluationMode,
  normalizeTeams,
  teamName,
  teamPointsFromPlayerPoints,
  teamsWithPlayers,
} from "../utils/teams";

function resolveLogGameId(entry, games) {
  if (typeof entry?.gameId === "string" && entry.gameId) return entry.gameId;

  const matches = games.filter((game) => game.name === entry?.gameName);
  return matches.length === 1 ? matches[0].id : "";
}

function safePoint(value) {
  const points = Number(value);
  return Number.isFinite(points) ? points : 0;
}

function safePointsByPlayer(value) {
  return isPlainObject(value) ? value : {};
}

function subtractPointsFromPlayers(players, pointsByPlayer) {
  return players.map((player) => {
    const points = safePoint(pointsByPlayer[player.id]);
    if (points === 0) return player;

    const nextTotal = player.total - points;
    return {
      ...player,
      total: points > 0 ? Math.max(0, nextTotal) : nextTotal,
    };
  });
}

function addPointsToPlayers(players, pointsByPlayer) {
  return players.map((player) => ({
    ...player,
    total: player.total + safePoint(pointsByPlayer[player.id]),
  }));
}

function normalizeEffectiveMultiplier(entry) {
  const effectiveMultiplier = Number(entry?.effectiveMultiplier);
  if (Number.isFinite(effectiveMultiplier)) return effectiveMultiplier;

  const multiplier = Number(entry?.multiplier);
  return Number.isFinite(multiplier) ? multiplier : 1;
}

function logScoringSettings(tournament, entry) {
  return normalizeScoringSettings(
    entry?.scoringSettings ?? tournament.scoringSettings,
    tournament.players.length,
    tournament.mode
  );
}

function logBasePointsByPlace(tournament, entry) {
  const existing = isPlainObject(entry?.basePointsByPlace) ? entry.basePointsByPlace : null;
  if (existing) return existing;

  return basePointsByPlaceForPlayers(logScoringSettings(tournament, entry), tournament.players.length);
}

function previousPickedGameId(log, games) {
  return resolveLogGameId(log[0], games) || null;
}

function start({
  mode,
  games,
  players,
  getSetupRounds,
  scoringSettings,
  wheelSettings,
  teamModeEnabled = false,
  teams = [],
}) {
  const tournamentScoringSettings = normalizeScoringSettings(scoringSettings, players.length, mode);
  const tournamentWheelSettings = normalizeWheelSettings(wheelSettings);
  const tournamentTeams = teamModeEnabled === true
    ? teamsWithPlayers(normalizeTeams(teams, players))
    : [];

  return {
    mode: tournamentScoringSettings.multiplierEnabled ? "multi" : "fixed",
    globalRound: 0,
    scoringSettings: tournamentScoringSettings,
    wheelSettings: tournamentWheelSettings,
    teamModeEnabled: teamModeEnabled === true,
    teams: tournamentTeams,
    players: players.map((player) => ({ ...player, total: 0 })),
    games: games.map((game) => {
      const rounds = getSetupRounds(game.id);
      return {
        ...game,
        scoringMode: normalizeGameScoringMode(game.scoringMode),
        totalRounds: rounds,
        remainingRounds: rounds,
        playedRounds: 0,
      };
    }),
    currentPickGameId: null,
    currentBonus: null,
    lastPickedGameId: null,
    log: [],
  };
}

function roundContext(tournament, game) {
  const roundScoringSettings = normalizeScoringSettings(
    tournament.scoringSettings,
    tournament.players.length
  );
  const multiplier = roundMultiplier(tournament, game);
  const currentBonus = normalizeCurrentBonus(
    tournament.currentBonus,
    roundScoringSettings,
    Boolean(tournament.currentPickGameId)
  );
  const bonusActive = currentBonus?.active === true;
  const bonusMultiplier = bonusActive ? currentBonus.multiplier : 1;

  return {
    roundScoringSettings,
    multiplier,
    bonusActive,
    bonusMultiplier,
    effectiveMultiplier: multiplier * bonusMultiplier,
    globalRoundNumber: tournament.globalRound + 1,
  };
}

function completeRound(tournament, game, logEntry, pointsByPlayer) {
  return {
    ok: true,
    tournament: {
      ...tournament,
      globalRound: tournament.globalRound + 1,
      players: tournament.players.map((player) => ({
        ...player,
        total: player.total + (pointsByPlayer[player.id] || 0),
      })),
      games: tournament.games.map((item) => {
        if (item.id !== game.id) return item;
        const playedRounds = item.playedRounds + 1;
        return {
          ...item,
          playedRounds,
          remainingRounds: Math.max(0, item.totalRounds - playedRounds),
        };
      }),
      currentPickGameId: null,
      currentBonus: null,
      log: [logEntry, ...tournament.log],
    },
  };
}

function parseScore(value) {
  if (value === "" || value == null) {
    return { ok: true, score: 0 };
  }

  const score = Number(value);
  if (!Number.isFinite(score) || score < 0) {
    return { ok: false, score: 0 };
  }

  return { ok: true, score };
}

function setCurrentPick(tournament, gameId, random = Math.random) {
  if (!tournament) return tournament;
  if (!tournament.games.some((game) => game.id === gameId && game.remainingRounds > 0)) {
    return tournament;
  }

  return {
    ...tournament,
    currentPickGameId: gameId,
    currentBonus: createCurrentBonus(tournament.scoringSettings, random),
    lastPickedGameId: gameId,
  };
}

function validateTeamsForRound(tournament, teams) {
  if (tournament.teamModeEnabled !== true) {
    return { ok: false, message: "Teammodus ist nicht aktiv" };
  }
  if (teamsWithPlayers(teams).length < 2) {
    return { ok: false, message: "Teamrunde braucht mindestens 2 Teams mit Spielern" };
  }

  return { ok: true };
}

function buildIndividualScoreRound(tournament, baseLogEntry, effectiveMultiplier, scoresInput) {
  const source = isPlainObject(scoresInput) ? scoresInput : {};
  const scoresByPlayer = {};
  const pointsByPlayer = {};
  const resultParts = [];

  for (const player of tournament.players) {
    const parsed = parseScore(source[player.id]);
    if (!parsed.ok) {
      return { ok: false, message: "Scores muessen 0 oder groesser sein" };
    }

    scoresByPlayer[player.id] = parsed.score;
    pointsByPlayer[player.id] = Math.round(parsed.score * effectiveMultiplier);
    resultParts.push(`${player.name}: ${parsed.score}`);
  }

  return {
    ok: true,
    entry: {
      ...baseLogEntry,
      basePointsByPlace: null,
      scoresByPlayer,
      pointsByPlayer,
      result: resultParts.join(" | "),
    },
    pointsByPlayer,
  };
}

function buildPlacementRound(tournament, baseLogEntry, roundScoringSettings, effectiveMultiplier, placements) {
  if (placements.length !== tournament.players.length || placements.some((value) => !value)) {
    return { ok: false, message: "Alle Plaetze waehlen" };
  }
  if (new Set(placements).size !== placements.length) {
    return { ok: false, message: "Spieler doppelt gewaehlt" };
  }

  const playerIds = new Set(tournament.players.map((player) => player.id));
  if (placements.some((playerId) => !playerIds.has(playerId))) {
    return { ok: false, message: "Unbekannter Spieler in Platzierung" };
  }

  const basePointsByPlace = basePointsByPlaceForPlayers(
    roundScoringSettings,
    tournament.players.length
  );
  const pointsByPlayer = {};
  const resultParts = [];

  placements.forEach((playerId, index) => {
    const place = index + 1;
    const points = Math.round(basePointsByPlace[String(place)] * effectiveMultiplier);
    const player = tournament.players.find((item) => item.id === playerId);

    pointsByPlayer[playerId] = points;
    resultParts.push(`${place}. ${player ? player.name : "?"}`);
  });

  return {
    ok: true,
    entry: {
      ...baseLogEntry,
      basePointsByPlace,
      placements,
      result: resultParts.join(" | "),
      pointsByPlayer,
    },
    pointsByPlayer,
  };
}

function buildTeamWinnerRound(
  tournament,
  teams,
  baseLogEntry,
  roundScoringSettings,
  effectiveMultiplier,
  winnerTeamId
) {
  const winnerTeam = teams.find((team) => team.id === winnerTeamId);
  if (!winnerTeam || winnerTeam.playerIds.length === 0) {
    return { ok: false, message: "Gewinnerteam waehlen" };
  }

  const basePointsByPlace = basePointsByPlaceForPlayers(
    roundScoringSettings,
    tournament.players.length
  );
  const winnerPoints = Math.round(safePoint(basePointsByPlace["1"]) * effectiveMultiplier);
  const winnerIds = new Set(winnerTeam.playerIds);
  const pointsByPlayer = {};

  tournament.players.forEach((player) => {
    pointsByPlayer[player.id] = winnerIds.has(player.id) ? winnerPoints : 0;
  });

  return {
    ok: true,
    entry: {
      ...baseLogEntry,
      basePointsByPlace,
      winnerTeamId,
      teamPointsByTeam: teamPointsFromPlayerPoints(pointsByPlayer, teams),
      pointsByPlayer,
      result: `${teamName(teams, winnerTeamId)} gewinnt`,
    },
    pointsByPlayer,
  };
}

function buildTeamScoreRound(tournament, teams, baseLogEntry, effectiveMultiplier, teamScoresInput) {
  const source = isPlainObject(teamScoresInput) ? teamScoresInput : {};
  const teamScoresByTeam = {};
  const pointsByPlayer = {};
  const resultParts = [];

  tournament.players.forEach((player) => {
    pointsByPlayer[player.id] = 0;
  });

  for (const team of teams) {
    const parsed = parseScore(source[team.id]);
    if (!parsed.ok) {
      return { ok: false, message: "Team-Scores muessen 0 oder groesser sein" };
    }

    const points = Math.round(parsed.score * effectiveMultiplier);
    teamScoresByTeam[team.id] = parsed.score;
    team.playerIds.forEach((playerId) => {
      if (Object.hasOwn(pointsByPlayer, playerId)) {
        pointsByPlayer[playerId] = points;
      }
    });
    resultParts.push(`${team.name}: ${parsed.score}`);
  }

  return {
    ok: true,
    entry: {
      ...baseLogEntry,
      basePointsByPlace: null,
      teamScoresByTeam,
      teamPointsByTeam: teamPointsFromPlayerPoints(pointsByPlayer, teams),
      pointsByPlayer,
      result: resultParts.join(" | "),
    },
    pointsByPlayer,
  };
}

// eslint-disable-next-line no-unused-vars
function saveRoundLegacy(tournament, roundInput) {
  if (!tournament) {
    return { ok: false, message: "Kein Turnier" };
  }
  if (!tournament.currentPickGameId) {
    return { ok: false, message: "Erst drehen" };
  }

  const game = tournament.games.find((item) => item.id === tournament.currentPickGameId);
  if (!game) return { ok: false };

  const scoringMode = normalizeGameScoringMode(game.scoringMode);
  const {
    roundScoringSettings,
    multiplier,
    bonusActive,
    bonusMultiplier,
    effectiveMultiplier,
    globalRoundNumber,
  } = roundContext(tournament, game);
  const baseLogEntry = {
    id: uid(),
    t: Date.now(),
    gameId: game.id,
    gameName: game.name,
    scoringMode,
    globalRound: globalRoundNumber,
    gameRound: game.playedRounds + 1,
    multiplier,
    multiplierMode: roundScoringSettings.multiplierMode,
    bonusActive,
    bonusMultiplier,
    effectiveMultiplier,
    scoringSettings: roundScoringSettings,
  };

  if (scoringMode === "score") {
    const scoresInput = isPlainObject(roundInput?.scoresByPlayer)
      ? roundInput.scoresByPlayer
      : isPlainObject(roundInput)
        ? roundInput
        : {};
    const scoresByPlayer = {};
    const pointsByPlayer = {};
    const resultParts = [];

    for (const player of tournament.players) {
      const parsed = parseScore(scoresInput[player.id]);
      if (!parsed.ok) {
        return { ok: false, message: "Scores müssen 0 oder größer sein" };
      }

      scoresByPlayer[player.id] = parsed.score;
      pointsByPlayer[player.id] = Math.round(parsed.score * effectiveMultiplier);
      resultParts.push(`${player.name}: ${parsed.score}`);
    }

    return completeRound(
      tournament,
      game,
      {
        ...baseLogEntry,
        basePointsByPlace: null,
        scoresByPlayer,
        pointsByPlayer,
        result: resultParts.join(" • "),
      },
      pointsByPlayer
    );
  }

  const placements = Array.isArray(roundInput) ? roundInput : roundInput?.placements ?? [];
  if (placements.length !== tournament.players.length || placements.some((value) => !value)) {
    return { ok: false, message: "Alle Plätze wählen" };
  }
  if (new Set(placements).size !== placements.length) {
    return { ok: false, message: "Duplikat" };
  }

  const basePointsByPlace = basePointsByPlaceForPlayers(
    roundScoringSettings,
    tournament.players.length
  );
  const pointsByPlayer = {};
  const resultParts = [];

  placements.forEach((playerId, index) => {
    const place = index + 1;
    const points = Math.round(basePointsByPlace[String(place)] * effectiveMultiplier);
    const player = tournament.players.find((item) => item.id === playerId);

    pointsByPlayer[playerId] = points;
    resultParts.push(`${place}. ${player ? player.name : "?"}`);
  });

  const logEntry = {
    ...baseLogEntry,
    basePointsByPlace,
    placements,
    result: resultParts.join(" • "),
    pointsByPlayer,
  };

  return completeRound(tournament, game, logEntry, pointsByPlayer);
}

function saveRound(tournament, roundInput) {
  if (!tournament) {
    return { ok: false, message: "Kein Turnier" };
  }
  if (!tournament.currentPickGameId) {
    return { ok: false, message: "Erst drehen" };
  }

  const game = tournament.games.find((item) => item.id === tournament.currentPickGameId);
  if (!game) return { ok: false };

  const gameScoringMode = normalizeGameScoringMode(game.scoringMode);
  const roundEvaluationMode = normalizeRoundEvaluationMode(
    roundInput?.roundEvaluationMode,
    gameScoringMode,
    tournament.teamModeEnabled === true
  );
  const scoringMode = isScoreRoundEvaluationMode(roundEvaluationMode) ? "score" : "placement";
  const teams = normalizeTeams(tournament.teams, tournament.players);
  const {
    roundScoringSettings,
    multiplier,
    bonusActive,
    bonusMultiplier,
    effectiveMultiplier,
    globalRoundNumber,
  } = roundContext(tournament, game);
  const baseLogEntry = {
    id: uid(),
    t: Date.now(),
    gameId: game.id,
    gameName: game.name,
    gameScoringMode,
    scoringMode,
    roundEvaluationMode,
    globalRound: globalRoundNumber,
    gameRound: game.playedRounds + 1,
    multiplier,
    multiplierMode: roundScoringSettings.multiplierMode,
    bonusActive,
    bonusMultiplier,
    effectiveMultiplier,
    scoringSettings: roundScoringSettings,
    teamsSnapshot: tournament.teamModeEnabled === true ? teams : [],
  };

  let result;
  if (roundEvaluationMode === ROUND_EVALUATION_MODES.individualScore) {
    result = buildIndividualScoreRound(
      tournament,
      baseLogEntry,
      effectiveMultiplier,
      roundInput?.scoresByPlayer
    );
  } else if (roundEvaluationMode === ROUND_EVALUATION_MODES.individualPlacement) {
    const placements = Array.isArray(roundInput) ? roundInput : roundInput?.placements ?? [];
    result = buildPlacementRound(
      tournament,
      baseLogEntry,
      roundScoringSettings,
      effectiveMultiplier,
      placements
    );
  } else {
    const teamValidation = validateTeamsForRound(tournament, teams);
    if (!teamValidation.ok) return teamValidation;

    if (roundEvaluationMode === ROUND_EVALUATION_MODES.teamWinner) {
      result = buildTeamWinnerRound(
        tournament,
        teams,
        baseLogEntry,
        roundScoringSettings,
        effectiveMultiplier,
        roundInput?.winnerTeamId
      );
    } else if (roundEvaluationMode === ROUND_EVALUATION_MODES.teamScore) {
      result = buildTeamScoreRound(
        tournament,
        teams,
        baseLogEntry,
        effectiveMultiplier,
        roundInput?.teamScoresByTeam
      );
    } else {
      const placements = Array.isArray(roundInput) ? roundInput : roundInput?.placements ?? [];
      result = buildPlacementRound(
        tournament,
        baseLogEntry,
        roundScoringSettings,
        effectiveMultiplier,
        placements
      );
      if (result.ok) {
        result.entry = {
          ...result.entry,
          teamPointsByTeam: teamPointsFromPlayerPoints(result.pointsByPlayer, teams),
        };
      }
    }
  }

  if (!result.ok) return result;
  return completeRound(tournament, game, result.entry, result.pointsByPlayer);
}

function skipGame(tournament) {
  if (!tournament?.currentPickGameId) return tournament;

  const gameId = tournament.currentPickGameId;
  return {
    ...tournament,
    currentPickGameId: null,
    currentBonus: null,
    games: tournament.games.map((game) =>
      game.id === gameId
        ? { ...game, remainingRounds: 0, totalRounds: game.playedRounds }
        : game
    ),
  };
}

function deleteLogEntry(tournament, entryId) {
  if (!tournament?.log.length) {
    return { ok: false, message: "Keine Runde zum Loeschen" };
  }

  const entryToDelete = tournament.log.find((entry) => entry.id === entryId);
  if (!entryToDelete) {
    return { ok: false, message: "Log-Eintrag nicht gefunden" };
  }

  const gameIdToDelete = resolveLogGameId(entryToDelete, tournament.games);
  if (!gameIdToDelete || !isPlainObject(entryToDelete.pointsByPlayer)) {
    return { ok: false, message: "Loeschen nicht moeglich: Log-Eintrag ist unvollstaendig" };
  }
  if (!tournament.games.some((game) => game.id === gameIdToDelete)) {
    return { ok: false, message: "Loeschen nicht moeglich: Game fehlt im Turnier" };
  }

  const remainingLog = tournament.log.filter((entry) => entry.id !== entryId);
  const pointsByPlayer = safePointsByPlayer(entryToDelete.pointsByPlayer);

  return {
    ok: true,
    tournament: {
      ...tournament,
      globalRound: remainingLog.length,
      currentPickGameId: null,
      currentBonus: null,
      lastPickedGameId: previousPickedGameId(remainingLog, tournament.games),
      players: subtractPointsFromPlayers(tournament.players, pointsByPlayer),
      games: tournament.games.map((game) => {
        if (game.id !== gameIdToDelete) return game;

        return {
          ...game,
          playedRounds: Math.max(0, game.playedRounds - 1),
          remainingRounds: Math.min(game.totalRounds, Math.max(0, game.remainingRounds + 1)),
        };
      }),
      log: remainingLog,
    },
  };
}

function buildEditedScoreEntry(tournament, entry, input) {
  const scoresInput = isPlainObject(input?.scoresByPlayer)
    ? input.scoresByPlayer
    : isPlainObject(input)
      ? input
      : {};
  const effectiveMultiplier = normalizeEffectiveMultiplier(entry);
  const roundScoringSettings = logScoringSettings(tournament, entry);
  const scoresByPlayer = {};
  const pointsByPlayer = {};
  const resultParts = [];

  for (const player of tournament.players) {
    const parsed = parseScore(scoresInput[player.id]);
    if (!parsed.ok) {
      return { ok: false, message: "Scores muessen 0 oder groesser sein" };
    }

    scoresByPlayer[player.id] = parsed.score;
    pointsByPlayer[player.id] = Math.round(parsed.score * effectiveMultiplier);
    resultParts.push(`${player.name}: ${parsed.score}`);
  }

  return {
    ok: true,
    entry: {
      ...entry,
      editedAt: Date.now(),
      scoringMode: "score",
      roundEvaluationMode: ROUND_EVALUATION_MODES.individualScore,
      multiplierMode: entry.multiplierMode ?? roundScoringSettings.multiplierMode,
      scoringSettings: roundScoringSettings,
      basePointsByPlace: null,
      scoresByPlayer,
      pointsByPlayer,
      result: resultParts.join(" | "),
    },
    pointsByPlayer,
  };
}

function buildEditedPlacementEntry(tournament, entry, input) {
  const placements = Array.isArray(input) ? input : input?.placements ?? [];
  if (placements.length !== tournament.players.length || placements.some((value) => !value)) {
    return { ok: false, message: "Alle Plaetze waehlen" };
  }
  if (new Set(placements).size !== placements.length) {
    return { ok: false, message: "Spieler doppelt gewaehlt" };
  }

  const playerIds = new Set(tournament.players.map((player) => player.id));
  if (placements.some((playerId) => !playerIds.has(playerId))) {
    return { ok: false, message: "Unbekannter Spieler in Platzierung" };
  }

  const effectiveMultiplier = normalizeEffectiveMultiplier(entry);
  const roundScoringSettings = logScoringSettings(tournament, entry);
  const basePointsByPlace = logBasePointsByPlace(tournament, entry);
  const pointsByPlayer = {};
  const resultParts = [];

  placements.forEach((playerId, index) => {
    const place = index + 1;
    const points = Math.round(safePoint(basePointsByPlace[String(place)]) * effectiveMultiplier);
    const player = tournament.players.find((item) => item.id === playerId);

    pointsByPlayer[playerId] = points;
    resultParts.push(`${place}. ${player ? player.name : "?"}`);
  });

  return {
    ok: true,
    entry: {
      ...entry,
      editedAt: Date.now(),
      scoringMode: "placement",
      roundEvaluationMode: ROUND_EVALUATION_MODES.individualPlacement,
      multiplierMode: entry.multiplierMode ?? roundScoringSettings.multiplierMode,
      scoringSettings: roundScoringSettings,
      basePointsByPlace,
      placements,
      pointsByPlayer,
      result: resultParts.join(" | "),
    },
    pointsByPlayer,
  };
}

function editLogEntry(tournament, entryId, input) {
  if (!tournament?.log.length) {
    return { ok: false, message: "Kein Log vorhanden" };
  }

  const entryToEdit = tournament.log.find((entry) => entry.id === entryId);
  if (!entryToEdit || !isPlainObject(entryToEdit.pointsByPlayer)) {
    return { ok: false, message: "Bearbeiten nicht moeglich: Log-Eintrag ist unvollstaendig" };
  }

  const roundEvaluationMode = normalizeRoundEvaluationMode(
    entryToEdit.roundEvaluationMode,
    entryToEdit.scoringMode,
    true
  );
  if (isTeamRoundEvaluationMode(roundEvaluationMode)) {
    return { ok: false, message: "Team-Runden koennen aktuell geloescht, aber nicht bearbeitet werden" };
  }

  const scoringMode = normalizeGameScoringMode(entryToEdit.scoringMode);
  const result = scoringMode === "score"
    ? buildEditedScoreEntry(tournament, entryToEdit, input)
    : buildEditedPlacementEntry(tournament, entryToEdit, input);

  if (!result.ok) return result;

  const withoutOldPoints = subtractPointsFromPlayers(
    tournament.players,
    safePointsByPlayer(entryToEdit.pointsByPlayer)
  );

  return {
    ok: true,
    tournament: {
      ...tournament,
      players: addPointsToPlayers(withoutOldPoints, result.pointsByPlayer),
      log: tournament.log.map((entry) => (entry.id === entryId ? result.entry : entry)),
    },
  };
}

function undo(tournament) {
  if (!tournament?.log.length) {
    return { ok: false, message: "Keine Runde zum Zurücknehmen" };
  }

  const [entryToUndo, ...remainingLog] = tournament.log;
  const gameIdToUndo = resolveLogGameId(entryToUndo, tournament.games);
  if (!gameIdToUndo || !isPlainObject(entryToUndo.pointsByPlayer)) {
    return { ok: false, message: "Undo nicht möglich: Log-Eintrag ist unvollständig" };
  }
  if (!tournament.games.some((game) => game.id === gameIdToUndo)) {
    return { ok: false, message: "Undo nicht möglich: Game fehlt im Turnier" };
  }

  return {
    ok: true,
    tournament: {
      ...tournament,
      globalRound: Math.max(0, tournament.globalRound - 1),
      currentPickGameId: null,
      currentBonus: null,
      lastPickedGameId: resolveLogGameId(remainingLog[0], tournament.games) || null,
      players: tournament.players.map((player) => {
        const points = Number(entryToUndo.pointsByPlayer[player.id] ?? 0);
        if (!Number.isFinite(points)) return player;

        const nextTotal = player.total - points;
        return {
          ...player,
          total: points > 0 ? Math.max(0, nextTotal) : nextTotal,
        };
      }),
      games: tournament.games.map((game) => {
        if (game.id !== gameIdToUndo) return game;

        return {
          ...game,
          playedRounds: Math.max(0, game.playedRounds - 1),
          remainingRounds: Math.min(game.totalRounds, Math.max(0, game.remainingRounds + 1)),
        };
      }),
      log: remainingLog,
    },
  };
}

function openGames(tournament) {
  if (!tournament) return [];
  return tournament.games.filter((game) => game.remainingRounds > 0);
}

function getWheelEntries(tournament) {
  if (!tournament) return [];
  return getWheelEntriesFromGames(
    tournament.games,
    tournament.wheelSettings,
    tournament.lastPickedGameId
  );
}

function pickGameFromWheel(tournament, random = Math.random) {
  const picked = pickGameFromEntries(getWheelEntries(tournament), random);
  if (!picked) return null;

  return tournament.games.find((game) => game.id === picked.id) || null;
}

export const TournamentEngine = {
  start,
  setCurrentPick,
  saveRound,
  skipGame,
  undo,
  deleteLogEntry,
  editLogEntry,
  openGames,
  getWheelEntries,
  pickGameFromWheel,
};

export { resolveLogGameId };
