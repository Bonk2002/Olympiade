import { uid } from "./common";
import { normalizeGameScoringMode } from "./scoring";
import { isPlainObject } from "./validation";

export const ROUND_EVALUATION_MODES = {
  individualPlacement: "individualPlacement",
  individualScore: "individualScore",
  teamWinner: "teamWinner",
  teamPlacement: "teamPlacement",
  teamScore: "teamScore",
};

export const TEAM_COUNT_OPTIONS = [2, 3, 4];

const MODE_LABELS = {
  [ROUND_EVALUATION_MODES.individualPlacement]: "Einzel-Platzierung",
  [ROUND_EVALUATION_MODES.individualScore]: "Einzel-Score",
  [ROUND_EVALUATION_MODES.teamWinner]: "Team-Gewinner",
  [ROUND_EVALUATION_MODES.teamPlacement]: "Team-Platzierung",
  [ROUND_EVALUATION_MODES.teamScore]: "Team-Score",
};

export function defaultRoundEvaluationMode(scoringMode) {
  return normalizeGameScoringMode(scoringMode) === "score"
    ? ROUND_EVALUATION_MODES.individualScore
    : ROUND_EVALUATION_MODES.individualPlacement;
}

export function roundEvaluationModeLabel(value) {
  return MODE_LABELS[value] ?? MODE_LABELS[ROUND_EVALUATION_MODES.individualPlacement];
}

export function isTeamRoundEvaluationMode(value) {
  return (
    value === ROUND_EVALUATION_MODES.teamWinner ||
    value === ROUND_EVALUATION_MODES.teamPlacement ||
    value === ROUND_EVALUATION_MODES.teamScore
  );
}

export function isScoreRoundEvaluationMode(value) {
  return (
    value === ROUND_EVALUATION_MODES.individualScore ||
    value === ROUND_EVALUATION_MODES.teamScore
  );
}

export function isPlacementRoundEvaluationMode(value) {
  return (
    value === ROUND_EVALUATION_MODES.individualPlacement ||
    value === ROUND_EVALUATION_MODES.teamPlacement
  );
}

export function normalizeRoundEvaluationMode(value, scoringMode = "placement", teamModeEnabled = false) {
  const fallback = defaultRoundEvaluationMode(scoringMode);
  const allowed = teamModeEnabled
    ? Object.values(ROUND_EVALUATION_MODES)
    : [
        ROUND_EVALUATION_MODES.individualPlacement,
        ROUND_EVALUATION_MODES.individualScore,
      ];

  return allowed.includes(value) ? value : fallback;
}

export function roundEvaluationModeOptions(teamModeEnabled = false) {
  const modes = [
    ROUND_EVALUATION_MODES.individualPlacement,
    ROUND_EVALUATION_MODES.individualScore,
  ];

  if (teamModeEnabled) {
    modes.push(
      ROUND_EVALUATION_MODES.teamWinner,
      ROUND_EVALUATION_MODES.teamPlacement,
      ROUND_EVALUATION_MODES.teamScore
    );
  }

  return modes.map((value) => ({
    value,
    label: roundEvaluationModeLabel(value),
  }));
}

export function normalizeTeams(value, players = []) {
  if (!Array.isArray(value)) return [];

  const knownPlayerIds = new Set(
    Array.isArray(players)
      ? players
          .map((player) => (typeof player?.id === "string" ? player.id : ""))
          .filter(Boolean)
      : []
  );
  const shouldFilterPlayers = knownPlayerIds.size > 0;
  const usedTeamIds = new Set();
  const usedPlayerIds = new Set();

  return value
    .filter(isPlainObject)
    .map((team, index) => {
      const fallbackId = uid();
      let id = typeof team.id === "string" && team.id.trim() ? team.id : fallbackId;
      if (usedTeamIds.has(id)) id = fallbackId;
      usedTeamIds.add(id);

      const name =
        typeof team.name === "string" && team.name.trim()
          ? team.name.trim()
          : `Team ${index + 1}`;
      const playerIds = Array.isArray(team.playerIds) ? team.playerIds : [];
      const normalizedPlayerIds = [];

      playerIds.forEach((playerId) => {
        if (typeof playerId !== "string" || !playerId) return;
        if (usedPlayerIds.has(playerId)) return;
        if (shouldFilterPlayers && !knownPlayerIds.has(playerId)) return;

        usedPlayerIds.add(playerId);
        normalizedPlayerIds.push(playerId);
      });

      return {
        id,
        name,
        playerIds: normalizedPlayerIds,
      };
    });
}

export function assignedPlayerIds(teams) {
  return new Set(normalizeTeams(teams).flatMap((team) => team.playerIds));
}

export function unassignedPlayers(players, teams) {
  const assigned = assignedPlayerIds(teams);
  return players.filter((player) => !assigned.has(player.id));
}

export function teamsWithPlayers(teams) {
  return normalizeTeams(teams).filter((team) => team.playerIds.length > 0);
}

export function teamName(teams, teamId) {
  return normalizeTeams(teams).find((team) => team.id === teamId)?.name ?? "?";
}

export function playerTeamMap(teams) {
  const map = {};
  normalizeTeams(teams).forEach((team) => {
    team.playerIds.forEach((playerId) => {
      map[playerId] = team.id;
    });
  });
  return map;
}

export function teamPointsFromPlayerPoints(pointsByPlayer, teams) {
  const source = isPlainObject(pointsByPlayer) ? pointsByPlayer : {};
  return Object.fromEntries(
    normalizeTeams(teams).map((team) => [
      team.id,
      team.playerIds.reduce((sum, playerId) => {
        const points = Number(source[playerId]);
        return sum + (Number.isFinite(points) ? points : 0);
      }, 0),
    ])
  );
}

export function teamRankingFromPlayers(players, teams) {
  const playerMap = new Map(players.map((player) => [player.id, player]));

  return normalizeTeams(teams, players)
    .map((team) => {
      const members = team.playerIds
        .map((playerId) => playerMap.get(playerId))
        .filter(Boolean);
      const total = members.reduce((sum, player) => sum + (Number(player.total) || 0), 0);

      return {
        ...team,
        players: members,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function createBalancedRandomTeams(players, teamCount, random = Math.random) {
  const count = TEAM_COUNT_OPTIONS.includes(Number(teamCount)) ? Number(teamCount) : 2;
  const shuffled = [...players];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  const teams = Array.from({ length: count }, (_, index) => ({
    id: uid(),
    name: `Team ${index + 1}`,
    playerIds: [],
  }));

  shuffled.forEach((player, index) => {
    teams[index % count].playerIds.push(player.id);
  });

  return teams;
}
