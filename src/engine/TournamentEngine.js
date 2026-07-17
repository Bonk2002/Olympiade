import { uid } from "../utils/common";
import {
  basePointsByPlaceForPlayers,
  createCurrentRoundModifiers,
  effectiveSpecialRoundType,
  normalizeCurrentBonus,
  normalizeCurrentMinusRound,
  normalizeCurrentSpecialRound,
  normalizeGameScoringMode,
  normalizeScoringSettings,
  minusPointsForPlace,
  roundMultiplier,
  SPECIAL_ROUND_TYPES,
  specialRoundLabel,
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

function minusPointsByPlace(place, pointsStep) {
  return minusPointsForPlace(place, pointsStep);
}

function rankedPlacesByScore(items) {
  const sorted = [...items].sort((a, b) => b.score - a.score);

  return sorted.map((item, index) => {
    const firstSameScore = sorted.findIndex((row) => row.score === item.score);
    return {
      ...item,
      place: firstSameScore >= 0 ? firstSameScore + 1 : index + 1,
    };
  });
}

function currentSpecialRoundFromTournament(tournament, scoringSettings) {
  const normalized = normalizeCurrentSpecialRound(
    tournament.currentSpecialRound,
    scoringSettings,
    Boolean(tournament.currentPickGameId)
  );
  if (normalized) return normalized;

  const bonus = normalizeCurrentBonus(
    tournament.currentBonus,
    scoringSettings,
    Boolean(tournament.currentPickGameId)
  );
  if (bonus?.active) {
    return {
      type: SPECIAL_ROUND_TYPES.bonus,
      label: specialRoundLabel(SPECIAL_ROUND_TYPES.bonus),
      config: { multiplier: bonus.multiplier },
    };
  }

  const minus = normalizeCurrentMinusRound(
    tournament.currentMinusRound,
    scoringSettings,
    Boolean(tournament.currentPickGameId)
  );
  if (minus?.active) {
    return {
      type: SPECIAL_ROUND_TYPES.minus,
      label: specialRoundLabel(SPECIAL_ROUND_TYPES.minus),
      config: { pointsStep: minus.pointsStep },
    };
  }

  return null;
}

function addDelta(pointsByPlayer, playerId, delta) {
  if (!playerId || !Number.isFinite(Number(delta)) || Number(delta) === 0) return;
  pointsByPlayer[playerId] = safePoint(pointsByPlayer[playerId]) + Number(delta);
}

function nameById(items, id) {
  return items.find((item) => item.id === id)?.name ?? "?";
}

function teamTotalsFromPlayers(players, teams) {
  return teams.map((team) => ({
    ...team,
    total: team.playerIds.reduce((sum, playerId) => {
      const player = players.find((item) => item.id === playerId);
      return sum + safePoint(player?.total);
    }, 0),
  }));
}

function individualPlacesFromPlacements(placements) {
  return placements.map((playerId, index) => ({
    playerId,
    place: index + 1,
  }));
}

function placesByPlayerFromTeamPlaces(teamPlaces) {
  const result = {};
  teamPlaces.forEach((teamPlace) => {
    teamPlace.playerIds.forEach((playerId) => {
      result[playerId] = teamPlace.place;
    });
  });
  return result;
}

function applySpecialRoundEffects({
  tournament,
  entry,
  pointsByPlayer,
  individualPlaces = [],
  teamPlaces = [],
  teams = [],
  riskSelections = {},
}) {
  const type = effectiveSpecialRoundType(entry.currentSpecialRound ?? entry);
  if (!type) {
    return { entry, pointsByPlayer };
  }

  if (type === SPECIAL_ROUND_TYPES.bonus || type === SPECIAL_ROUND_TYPES.minus) {
    if (entry.specialRoundHidden) {
      return {
        entry: {
          ...entry,
          specialRoundResult: `Geheimrunde aufgedeckt: ${specialRoundLabel(type)}`,
        },
        pointsByPlayer,
      };
    }
    return { entry, pointsByPlayer };
  }

  const config = isPlainObject(entry.specialRoundConfig) ? entry.specialRoundConfig : {};
  const nextPoints = { ...pointsByPlayer };
  const specialResultParts = [];
  const nextEntry = { ...entry };
  const teamRound = teamPlaces.length > 0;
  const places = teamRound ? teamPlaces : individualPlaces;

  function placeWinners() {
    if (places.length === 0) return [];
    const bestPlace = Math.min(...places.map((row) => row.place));
    return places.filter((row) => row.place === bestPlace);
  }

  function placeLosers() {
    if (places.length === 0) return [];
    const worstPlace = Math.max(...places.map((row) => row.place));
    return places.filter((row) => row.place === worstPlace);
  }

  function applyToPlacedRow(row, delta) {
    if (teamRound) {
      row.playerIds.forEach((playerId) => addDelta(nextPoints, playerId, delta));
    } else {
      addDelta(nextPoints, row.playerId, delta);
    }
  }

  function placedRowName(row) {
    return teamRound ? teamName(teams, row.teamId) : nameById(tournament.players, row.playerId);
  }

  function placedRowId(row) {
    return teamRound ? row.teamId : row.playerId;
  }

  if (entry.specialRoundHidden) {
    specialResultParts.push(`Geheimrunde aufgedeckt: ${specialRoundLabel(type)}`);
  }

  if (type === SPECIAL_ROUND_TYPES.jackpot || type === SPECIAL_ROUND_TYPES.mystery) {
    const bonusPoints = safePoint(type === SPECIAL_ROUND_TYPES.mystery ? config.bonusPoints : config.bonusPoints);
    const winners = placeWinners();
    if (teamRound) {
      winners.forEach((team) => {
        team.playerIds.forEach((playerId) => addDelta(nextPoints, playerId, bonusPoints));
      });
      nextEntry.jackpotWinners = winners.map((team) => team.teamId);
      specialResultParts.push(
        `${type === SPECIAL_ROUND_TYPES.mystery ? "Mystery" : "Jackpot"}: ${winners.map(placedRowName).join(", ")} +${bonusPoints}`
      );
    } else {
      winners.forEach((row) => addDelta(nextPoints, row.playerId, bonusPoints));
      nextEntry.jackpotWinners = winners.map((row) => row.playerId);
      specialResultParts.push(
        `${type === SPECIAL_ROUND_TYPES.mystery ? "Mystery" : "Jackpot"}: ${winners.map(placedRowName).join(", ")} +${bonusPoints}`
      );
    }
    if (type === SPECIAL_ROUND_TYPES.mystery) {
      nextEntry.mysteryBonus = bonusPoints;
    }
  }

  if (type === SPECIAL_ROUND_TYPES.robber) {
    const stealAmount = safePoint(config.stealAmount);
    if (teamRound) {
      const bestPlace = Math.min(...teamPlaces.map((row) => row.place));
      const worstPlace = Math.max(...teamPlaces.map((row) => row.place));
      const winners = teamPlaces.filter((row) => row.place === bestPlace);
      const losers = teamPlaces.filter((row) => row.place === worstPlace);
      winners.forEach((team) => team.playerIds.forEach((playerId) => addDelta(nextPoints, playerId, stealAmount)));
      losers.forEach((team) => team.playerIds.forEach((playerId) => addDelta(nextPoints, playerId, -stealAmount)));
      nextEntry.robberSourceIds = losers.map((row) => row.teamId);
      nextEntry.robberTargetIds = winners.map((row) => row.teamId);
      specialResultParts.push(
        `Räuber: ${winners.map((row) => teamName(teams, row.teamId)).join(", ")} klaut ${stealAmount} von ${losers.map((row) => teamName(teams, row.teamId)).join(", ")}`
      );
    } else {
      const bestPlace = Math.min(...individualPlaces.map((row) => row.place));
      const worstPlace = Math.max(...individualPlaces.map((row) => row.place));
      const winners = individualPlaces.filter((row) => row.place === bestPlace);
      const losers = individualPlaces.filter((row) => row.place === worstPlace);
      winners.forEach((row) => addDelta(nextPoints, row.playerId, stealAmount));
      losers.forEach((row) => addDelta(nextPoints, row.playerId, -stealAmount));
      nextEntry.robberSourceIds = losers.map((row) => row.playerId);
      nextEntry.robberTargetIds = winners.map((row) => row.playerId);
      specialResultParts.push(
        `Räuber: ${winners.map((row) => nameById(tournament.players, row.playerId)).join(", ")} klaut ${stealAmount} von ${losers.map((row) => nameById(tournament.players, row.playerId)).join(", ")}`
      );
    }
  }

  if (type === SPECIAL_ROUND_TYPES.comeback) {
    const lastBonus = safePoint(config.lastBonus);
    const secondLastBonus = safePoint(config.secondLastBonus);
    const bonusesByPlayer = {};

    if (teamRound) {
      const teamsByTotal = teamTotalsFromPlayers(tournament.players, teams).sort((a, b) => a.total - b.total);
      const lastTeam = teamsByTotal[0] ?? null;
      const secondLastTeam = teamsByTotal[1] ?? null;
      lastTeam?.playerIds.forEach((playerId) => {
        addDelta(nextPoints, playerId, lastBonus);
        bonusesByPlayer[playerId] = safePoint(bonusesByPlayer[playerId]) + lastBonus;
      });
      secondLastTeam?.playerIds.forEach((playerId) => {
        addDelta(nextPoints, playerId, secondLastBonus);
        bonusesByPlayer[playerId] = safePoint(bonusesByPlayer[playerId]) + secondLastBonus;
      });
      nextEntry.comebackTargets = {
        mode: "team",
        lastTeamId: lastTeam?.id ?? "",
        secondLastTeamId: secondLastTeam?.id ?? "",
      };
      specialResultParts.push(
        `Comeback: ${lastTeam ? `${lastTeam.name} +${lastBonus}` : ""}${secondLastTeam ? `, ${secondLastTeam.name} +${secondLastBonus}` : ""}`
      );
    } else {
      const playersByTotal = [...tournament.players].sort((a, b) => a.total - b.total);
      const lastPlayer = playersByTotal[0] ?? null;
      const secondLastPlayer = playersByTotal[1] ?? null;
      if (lastPlayer) {
        addDelta(nextPoints, lastPlayer.id, lastBonus);
        bonusesByPlayer[lastPlayer.id] = safePoint(bonusesByPlayer[lastPlayer.id]) + lastBonus;
      }
      if (secondLastPlayer) {
        addDelta(nextPoints, secondLastPlayer.id, secondLastBonus);
        bonusesByPlayer[secondLastPlayer.id] = safePoint(bonusesByPlayer[secondLastPlayer.id]) + secondLastBonus;
      }
      nextEntry.comebackTargets = {
        mode: "player",
        lastPlayerId: lastPlayer?.id ?? "",
        secondLastPlayerId: secondLastPlayer?.id ?? "",
      };
      specialResultParts.push(
        `Comeback: ${lastPlayer ? `${lastPlayer.name} +${lastBonus}` : ""}${secondLastPlayer ? `, ${secondLastPlayer.name} +${secondLastBonus}` : ""}`
      );
    }

    nextEntry.comebackBonusesByPlayer = bonusesByPlayer;
  }

  if (type === SPECIAL_ROUND_TYPES.risk) {
    const rewardPoints = safePoint(config.rewardPoints);
    const penaltyPoints = safePoint(config.penaltyPoints);
    const successPlaces = Math.max(1, Math.round(safePoint(config.successPlaces)) || 1);
    const selected = isPlainObject(riskSelections) ? riskSelections : {};
    const placesByPlayer = teamRound
      ? placesByPlayerFromTeamPlaces(teamPlaces)
      : Object.fromEntries(individualPlaces.map((row) => [row.playerId, row.place]));
    const normalizedSelections = {};
    const riskResults = {};

    tournament.players.forEach((player) => {
      const active = selected[player.id] === true;
      normalizedSelections[player.id] = active;
      if (!active) return;

      const place = placesByPlayer[player.id] ?? Number.POSITIVE_INFINITY;
      const success = place <= successPlaces;
      const delta = success ? rewardPoints : -penaltyPoints;
      addDelta(nextPoints, player.id, delta);
      riskResults[player.id] = { success, delta, place };
    });

    nextEntry.riskSelections = normalizedSelections;
    nextEntry.riskResults = riskResults;
    specialResultParts.push(
      `Risiko: ${Object.entries(riskResults)
        .map(([playerId, result]) => `${nameById(tournament.players, playerId)} ${result.delta >= 0 ? "+" : ""}${result.delta}`)
        .join(", ") || "keine Auswahl"}`
    );
  }

  if (type === SPECIAL_ROUND_TYPES.allOrNothing || type === SPECIAL_ROUND_TYPES.kingOfTheRound) {
    const winnerPoints = safePoint(config.winnerPoints);
    const lastPenaltyEnabled = type === SPECIAL_ROUND_TYPES.allOrNothing && config.lastPenaltyEnabled === true;
    const lastPenalty = safePoint(config.lastPenalty);
    const winners = placeWinners();
    const losers = placeLosers();

    Object.keys(nextPoints).forEach((playerId) => {
      nextPoints[playerId] = 0;
    });
    winners.forEach((row) => applyToPlacedRow(row, winnerPoints));
    if (lastPenaltyEnabled) {
      losers.forEach((row) => applyToPlacedRow(row, -lastPenalty));
    }

    nextEntry.specialWinnerIds = winners.map(placedRowId);
    nextEntry.lastPlayerIds = lastPenaltyEnabled ? losers.map(placedRowId) : [];
    specialResultParts.push(
      `${type === SPECIAL_ROUND_TYPES.allOrNothing ? "Alles oder Nichts" : "Rundenkönig"}: ${winners.map(placedRowName).join(", ")} +${winnerPoints}${lastPenaltyEnabled ? ` | Letzter -${lastPenalty}` : ""}`
    );
  }

  if (type === SPECIAL_ROUND_TYPES.lastManPunishment) {
    const penaltyPoints = safePoint(config.penaltyPoints);
    const losers = placeLosers();
    losers.forEach((row) => applyToPlacedRow(row, -penaltyPoints));
    nextEntry.lastPlayerIds = losers.map(placedRowId);
    specialResultParts.push(
      `Last Man: ${losers.map(placedRowName).join(", ")} -${penaltyPoints}`
    );
  }

  nextEntry.specialRoundResult = specialResultParts.filter(Boolean).join(" | ");
  nextEntry.pointsByPlayer = nextPoints;

  return {
    entry: nextEntry,
    pointsByPlayer: nextPoints,
  };
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
    currentMinusRound: null,
    currentSpecialRound: null,
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
  const currentSpecialRound = currentSpecialRoundFromTournament(tournament, roundScoringSettings);
  const effectiveRoundType = effectiveSpecialRoundType(currentSpecialRound);
  const minusRoundActive = effectiveRoundType === SPECIAL_ROUND_TYPES.minus;
  const bonusActive = effectiveRoundType === SPECIAL_ROUND_TYPES.bonus;
  const bonusMultiplier = bonusActive ? currentSpecialRound.config.multiplier : 1;
  const normalizedMultiplier = minusRoundActive ? 1 : multiplier;

  return {
    roundScoringSettings,
    multiplier: normalizedMultiplier,
    bonusActive,
    bonusMultiplier,
    effectiveMultiplier: minusRoundActive ? 1 : normalizedMultiplier * bonusMultiplier,
    minusRoundActive,
    minusRoundStep: currentSpecialRound?.config?.pointsStep ?? roundScoringSettings.minusRoundPointsStep,
    currentSpecialRound,
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
      currentMinusRound: null,
      currentSpecialRound: null,
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

  const { currentBonus, currentMinusRound, currentSpecialRound } = createCurrentRoundModifiers(
    tournament.scoringSettings,
    random
  );

  return {
    ...tournament,
    currentPickGameId: gameId,
    currentBonus,
    currentMinusRound,
    currentSpecialRound,
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

function buildIndividualScoreRound(tournament, baseLogEntry, effectiveMultiplier, scoresInput, riskSelections) {
  const source = isPlainObject(scoresInput) ? scoresInput : {};
  const scoresByPlayer = {};
  const pointsByPlayer = {};
  const resultParts = [];
  const scoreRows = [];

  for (const player of tournament.players) {
    const parsed = parseScore(source[player.id]);
    if (!parsed.ok) {
      return { ok: false, message: "Scores muessen 0 oder groesser sein" };
    }

    scoresByPlayer[player.id] = parsed.score;
    scoreRows.push({ id: player.id, score: parsed.score });
    resultParts.push(`${player.name}: ${parsed.score}`);
  }

  if (baseLogEntry.minusRoundActive) {
    rankedPlacesByScore(scoreRows).forEach((row) => {
      pointsByPlayer[row.id] = minusPointsByPlace(row.place, baseLogEntry.minusRoundStep);
    });
  } else {
    scoreRows.forEach((row) => {
      pointsByPlayer[row.id] = Math.round(row.score * effectiveMultiplier);
    });
  }

  const individualPlaces = rankedPlacesByScore(scoreRows).map((row) => ({
    playerId: row.id,
    place: row.place,
  }));
  const withSpecial = applySpecialRoundEffects({
    tournament,
    entry: {
      ...baseLogEntry,
      basePointsByPlace: null,
      scoresByPlayer,
      pointsByPlayer,
      result: resultParts.join(" | "),
    },
    pointsByPlayer,
    individualPlaces,
    riskSelections,
  });

  return {
    ok: true,
    entry: withSpecial.entry,
    pointsByPlayer: withSpecial.pointsByPlayer,
  };
}

function buildPlacementRound(tournament, baseLogEntry, roundScoringSettings, effectiveMultiplier, placements, riskSelections) {
  if (placements.length !== tournament.players.length || placements.some((value) => !value)) {
    return { ok: false, message: "Alle Plätze wählen" };
  }
  if (new Set(placements).size !== placements.length) {
    return { ok: false, message: "Spieler doppelt gewählt" };
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
    const points = baseLogEntry.minusRoundActive
      ? minusPointsByPlace(place, baseLogEntry.minusRoundStep)
      : Math.round(basePointsByPlace[String(place)] * effectiveMultiplier);
    const player = tournament.players.find((item) => item.id === playerId);

    pointsByPlayer[playerId] = points;
    resultParts.push(`${place}. ${player ? player.name : "?"}`);
  });

  const withSpecial = applySpecialRoundEffects({
    tournament,
    entry: {
      ...baseLogEntry,
      basePointsByPlace,
      placements,
      result: resultParts.join(" | "),
      pointsByPlayer,
    },
    pointsByPlayer,
    individualPlaces: individualPlacesFromPlacements(placements),
    riskSelections,
  });

  return {
    ok: true,
    entry: withSpecial.entry,
    pointsByPlayer: withSpecial.pointsByPlayer,
  };
}

function buildTeamWinnerRound(
  tournament,
  teams,
  baseLogEntry,
  roundScoringSettings,
  effectiveMultiplier,
  winnerTeamId,
  riskSelections
) {
  const winnerTeam = teams.find((team) => team.id === winnerTeamId);
  if (!winnerTeam || winnerTeam.playerIds.length === 0) {
    return { ok: false, message: "Gewinnerteam wählen" };
  }

  const basePointsByPlace = basePointsByPlaceForPlayers(
    roundScoringSettings,
    tournament.players.length
  );
  const winnerPoints = Math.round(safePoint(basePointsByPlace["1"]) * effectiveMultiplier);
  const winnerIds = new Set(winnerTeam.playerIds);
  const minusActive = baseLogEntry.minusRoundActive === true;
  const pointsByPlayer = {};

  tournament.players.forEach((player) => {
    pointsByPlayer[player.id] = winnerIds.has(player.id)
      ? 0
      : minusActive
        ? minusPointsByPlace(2, baseLogEntry.minusRoundStep)
        : 0;
    if (!minusActive && winnerIds.has(player.id)) {
      pointsByPlayer[player.id] = winnerPoints;
    }
  });

  const teamPlaces = teams.map((team) => ({
    teamId: team.id,
    place: team.id === winnerTeamId ? 1 : 2,
    playerIds: team.playerIds,
  }));
  const entry = {
    ...baseLogEntry,
    basePointsByPlace,
    winnerTeamId,
    teamPointsByTeam: teamPointsFromPlayerPoints(pointsByPlayer, teams),
    pointsByPlayer,
    result: `${teamName(teams, winnerTeamId)} gewinnt`,
  };
  const withSpecial = applySpecialRoundEffects({
    tournament,
    entry,
    pointsByPlayer,
    teamPlaces,
    teams,
    riskSelections,
  });

  return {
    ok: true,
    entry: {
      ...withSpecial.entry,
      teamPointsByTeam: teamPointsFromPlayerPoints(withSpecial.pointsByPlayer, teams),
    },
    pointsByPlayer: withSpecial.pointsByPlayer,
  };
}

function buildTeamScoreRound(tournament, teams, baseLogEntry, effectiveMultiplier, teamScoresInput, riskSelections) {
  const source = isPlainObject(teamScoresInput) ? teamScoresInput : {};
  const teamScoresByTeam = {};
  const pointsByPlayer = {};
  const resultParts = [];
  const scoreRows = [];

  tournament.players.forEach((player) => {
    pointsByPlayer[player.id] = 0;
  });

  for (const team of teams) {
    const parsed = parseScore(source[team.id]);
    if (!parsed.ok) {
      return { ok: false, message: "Team-Scores muessen 0 oder groesser sein" };
    }

    teamScoresByTeam[team.id] = parsed.score;
    scoreRows.push({ id: team.id, score: parsed.score });
    resultParts.push(`${team.name}: ${parsed.score}`);
  }

  const pointsByTeam = {};
  if (baseLogEntry.minusRoundActive) {
    rankedPlacesByScore(scoreRows).forEach((row) => {
      pointsByTeam[row.id] = minusPointsByPlace(row.place, baseLogEntry.minusRoundStep);
    });
  } else {
    scoreRows.forEach((row) => {
      pointsByTeam[row.id] = Math.round(row.score * effectiveMultiplier);
    });
  }

  teams.forEach((team) => {
    const points = pointsByTeam[team.id] ?? 0;
    team.playerIds.forEach((playerId) => {
      if (Object.hasOwn(pointsByPlayer, playerId)) {
        pointsByPlayer[playerId] = points;
      }
    });
  });

  const teamPlaces = rankedPlacesByScore(scoreRows).map((row) => ({
    teamId: row.id,
    place: row.place,
    playerIds: teams.find((team) => team.id === row.id)?.playerIds ?? [],
  }));
  const entry = {
    ...baseLogEntry,
    basePointsByPlace: null,
    teamScoresByTeam,
    teamPointsByTeam: teamPointsFromPlayerPoints(pointsByPlayer, teams),
    pointsByPlayer,
    result: resultParts.join(" | "),
  };
  const withSpecial = applySpecialRoundEffects({
    tournament,
    entry,
    pointsByPlayer,
    teamPlaces,
    teams,
    riskSelections,
  });

  return {
    ok: true,
    entry: {
      ...withSpecial.entry,
      teamPointsByTeam: teamPointsFromPlayerPoints(withSpecial.pointsByPlayer, teams),
    },
    pointsByPlayer: withSpecial.pointsByPlayer,
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
    minusRoundActive,
    minusRoundStep,
    currentSpecialRound,
    globalRoundNumber,
  } = roundContext(tournament, game);
  const effectiveRoundType = effectiveSpecialRoundType(currentSpecialRound);
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
    minusRoundActive,
    minusRoundStep,
    specialRoundType: currentSpecialRound?.type ?? null,
    specialRoundLabel: currentSpecialRound?.label ?? "",
    specialRoundConfig: currentSpecialRound?.config ?? null,
    resolvedSpecialRoundType: currentSpecialRound?.resolvedType ?? effectiveRoundType,
    specialRoundHidden: currentSpecialRound?.hidden === true,
    currentSpecialRound,
    jackpotRoundActive: effectiveRoundType === SPECIAL_ROUND_TYPES.jackpot,
    robberRoundActive: effectiveRoundType === SPECIAL_ROUND_TYPES.robber,
    comebackRoundActive: effectiveRoundType === SPECIAL_ROUND_TYPES.comeback,
    riskRoundActive: effectiveRoundType === SPECIAL_ROUND_TYPES.risk,
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
    const scoreRows = [];

    for (const player of tournament.players) {
      const parsed = parseScore(scoresInput[player.id]);
      if (!parsed.ok) {
        return { ok: false, message: "Scores müssen 0 oder größer sein" };
      }

      scoresByPlayer[player.id] = parsed.score;
      scoreRows.push({ id: player.id, score: parsed.score });
      resultParts.push(`${player.name}: ${parsed.score}`);
    }

    if (minusRoundActive) {
      rankedPlacesByScore(scoreRows).forEach((row) => {
        pointsByPlayer[row.id] = minusPointsByPlace(row.place, minusRoundStep);
      });
    } else {
      scoreRows.forEach((row) => {
        pointsByPlayer[row.id] = Math.round(row.score * effectiveMultiplier);
      });
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
    const points = minusRoundActive
      ? minusPointsByPlace(place, minusRoundStep)
      : Math.round(basePointsByPlace[String(place)] * effectiveMultiplier);
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
    minusRoundActive,
    minusRoundStep,
    currentSpecialRound,
    globalRoundNumber,
  } = roundContext(tournament, game);
  const effectiveRoundType = effectiveSpecialRoundType(currentSpecialRound);
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
    minusRoundActive,
    minusRoundStep,
    specialRoundType: currentSpecialRound?.type ?? null,
    specialRoundLabel: currentSpecialRound?.label ?? "",
    specialRoundConfig: currentSpecialRound?.config ?? null,
    resolvedSpecialRoundType: currentSpecialRound?.resolvedType ?? effectiveRoundType,
    specialRoundHidden: currentSpecialRound?.hidden === true,
    currentSpecialRound,
    jackpotRoundActive: effectiveRoundType === SPECIAL_ROUND_TYPES.jackpot,
    robberRoundActive: effectiveRoundType === SPECIAL_ROUND_TYPES.robber,
    comebackRoundActive: effectiveRoundType === SPECIAL_ROUND_TYPES.comeback,
    riskRoundActive: effectiveRoundType === SPECIAL_ROUND_TYPES.risk,
    scoringSettings: roundScoringSettings,
    teamsSnapshot: tournament.teamModeEnabled === true ? teams : [],
  };

  let result;
  if (roundEvaluationMode === ROUND_EVALUATION_MODES.individualScore) {
    result = buildIndividualScoreRound(
      tournament,
      baseLogEntry,
      effectiveMultiplier,
      roundInput?.scoresByPlayer,
      roundInput?.riskSelections
    );
  } else if (roundEvaluationMode === ROUND_EVALUATION_MODES.individualPlacement) {
    const placements = Array.isArray(roundInput) ? roundInput : roundInput?.placements ?? [];
    result = buildPlacementRound(
      tournament,
      baseLogEntry,
      roundScoringSettings,
      effectiveMultiplier,
      placements,
      roundInput?.riskSelections
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
        roundInput?.winnerTeamId,
        roundInput?.riskSelections
      );
    } else if (roundEvaluationMode === ROUND_EVALUATION_MODES.teamScore) {
      result = buildTeamScoreRound(
        tournament,
        teams,
        baseLogEntry,
        effectiveMultiplier,
        roundInput?.teamScoresByTeam,
        roundInput?.riskSelections
      );
    } else {
      const placements = Array.isArray(roundInput) ? roundInput : roundInput?.placements ?? [];
      result = buildPlacementRound(
        tournament,
        baseLogEntry,
        roundScoringSettings,
        effectiveMultiplier,
        placements,
        roundInput?.riskSelections
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
    currentMinusRound: null,
    currentSpecialRound: null,
    games: tournament.games.map((game) =>
      game.id === gameId
        ? { ...game, remainingRounds: 0, totalRounds: game.playedRounds }
        : game
    ),
  };
}

function deleteLogEntry(tournament, entryId) {
  if (!tournament?.log.length) {
    return { ok: false, message: "Keine Runde zum Löschen" };
  }

  const entryToDelete = tournament.log.find((entry) => entry.id === entryId);
  if (!entryToDelete) {
    return { ok: false, message: "Log-Eintrag nicht gefunden" };
  }

  const gameIdToDelete = resolveLogGameId(entryToDelete, tournament.games);
  if (!gameIdToDelete || !isPlainObject(entryToDelete.pointsByPlayer)) {
    return { ok: false, message: "Löschen nicht möglich: Log-Eintrag ist unvollständig" };
  }
  if (!tournament.games.some((game) => game.id === gameIdToDelete)) {
    return { ok: false, message: "Löschen nicht möglich: Game fehlt im Turnier" };
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
      currentMinusRound: null,
      currentSpecialRound: null,
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
  const scoreRows = [];
  const minusActive = entry.minusRoundActive === true;
  const minusStep = safePoint(entry.minusRoundStep) || roundScoringSettings.minusRoundPointsStep;

  for (const player of tournament.players) {
    const parsed = parseScore(scoresInput[player.id]);
    if (!parsed.ok) {
      return { ok: false, message: "Scores muessen 0 oder groesser sein" };
    }

    scoresByPlayer[player.id] = parsed.score;
    scoreRows.push({ id: player.id, score: parsed.score });
    resultParts.push(`${player.name}: ${parsed.score}`);
  }

  if (minusActive) {
    rankedPlacesByScore(scoreRows).forEach((row) => {
      pointsByPlayer[row.id] = minusPointsByPlace(row.place, minusStep);
    });
  } else {
    scoreRows.forEach((row) => {
      pointsByPlayer[row.id] = Math.round(row.score * effectiveMultiplier);
    });
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
      minusRoundActive: minusActive,
      minusRoundStep: minusStep,
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
    return { ok: false, message: "Alle Plätze wählen" };
  }
  if (new Set(placements).size !== placements.length) {
    return { ok: false, message: "Spieler doppelt gewählt" };
  }

  const playerIds = new Set(tournament.players.map((player) => player.id));
  if (placements.some((playerId) => !playerIds.has(playerId))) {
    return { ok: false, message: "Unbekannter Spieler in Platzierung" };
  }

  const effectiveMultiplier = normalizeEffectiveMultiplier(entry);
  const roundScoringSettings = logScoringSettings(tournament, entry);
  const basePointsByPlace = logBasePointsByPlace(tournament, entry);
  const minusActive = entry.minusRoundActive === true;
  const minusStep = safePoint(entry.minusRoundStep) || roundScoringSettings.minusRoundPointsStep;
  const pointsByPlayer = {};
  const resultParts = [];

  placements.forEach((playerId, index) => {
    const place = index + 1;
    const points = minusActive
      ? minusPointsByPlace(place, minusStep)
      : Math.round(safePoint(basePointsByPlace[String(place)]) * effectiveMultiplier);
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
      minusRoundActive: minusActive,
      minusRoundStep: minusStep,
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
    return { ok: false, message: "Bearbeiten nicht möglich: Log-Eintrag ist unvollständig" };
  }

  const roundEvaluationMode = normalizeRoundEvaluationMode(
    entryToEdit.roundEvaluationMode,
    entryToEdit.scoringMode,
    true
  );
  if (isTeamRoundEvaluationMode(roundEvaluationMode)) {
    return { ok: false, message: "Team-Runden koennen aktuell geloescht, aber nicht bearbeitet werden" };
  }
  if (
    [
      SPECIAL_ROUND_TYPES.jackpot,
      SPECIAL_ROUND_TYPES.robber,
      SPECIAL_ROUND_TYPES.comeback,
      SPECIAL_ROUND_TYPES.risk,
      SPECIAL_ROUND_TYPES.secret,
      SPECIAL_ROUND_TYPES.mystery,
      SPECIAL_ROUND_TYPES.allOrNothing,
      SPECIAL_ROUND_TYPES.kingOfTheRound,
      SPECIAL_ROUND_TYPES.lastManPunishment,
    ].includes(entryToEdit.specialRoundType)
  ) {
    return { ok: false, message: "Diese Sonderrunde kann aktuell geloescht, aber nicht bearbeitet werden" };
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
      currentMinusRound: null,
      currentSpecialRound: null,
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
