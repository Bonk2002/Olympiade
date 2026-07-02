export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isValidTournament(value) {
  if (!isPlainObject(value)) return false;
  if (value.mode !== "fixed" && value.mode !== "multi") return false;
  if (!Number.isFinite(value.globalRound)) return false;
  if (!Array.isArray(value.players) || !Array.isArray(value.games) || !Array.isArray(value.log)) {
    return false;
  }

  const playersValid = value.players.every(
    (player) =>
      isPlainObject(player) &&
      typeof player.id === "string" &&
      typeof player.name === "string" &&
      Number.isFinite(player.total)
  );
  const gamesValid = value.games.every(
    (game) =>
      isPlainObject(game) &&
      typeof game.id === "string" &&
      typeof game.name === "string" &&
      Number.isFinite(game.totalRounds) &&
      Number.isFinite(game.remainingRounds) &&
      Number.isFinite(game.playedRounds)
  );

  return playersValid && gamesValid;
}
