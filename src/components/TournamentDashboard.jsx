import { formatTime } from "../utils/common";
import { gameScoringModeLabel } from "../utils/scoring";

function lastLogForGame(tournament, gameId) {
  return tournament.log.find((entry) => entry.gameId === gameId) ?? null;
}

function GameProgressCard({ game, current, lastLog }) {
  const played = game.playedRounds ?? 0;
  const total = game.totalRounds ?? played + (game.remainingRounds ?? 0);
  const remaining = game.remainingRounds ?? Math.max(0, total - played);
  const done = remaining <= 0;
  const progress = total > 0 ? Math.min(100, Math.round((played / total) * 100)) : 0;

  return (
    <div className={`progressGameCard ${current ? "current" : ""} ${done ? "done" : ""}`}>
      <div className="progressGameTop">
        <div className="progressGameName">{game.name}</div>
        <span className={`progressStatus ${current ? "current" : done ? "done" : ""}`}>
          {current ? "Aktuell" : done ? "Fertig" : "Offen"}
        </span>
      </div>
      <div className="progressGameMeta">
        <span>{gameScoringModeLabel(game.scoringMode)}</span>
        <span>{played}/{total} gespielt</span>
        <span>{remaining} offen</span>
      </div>
      <div className="progressTrack">
        <div className="progressFill" style={{ width: `${progress}%` }} />
      </div>
      {lastLog && (
        <div className="muted progressLastLog">
          Letzte Runde: TR {lastLog.globalRound} · {formatTime(lastLog.t)}
        </div>
      )}
    </div>
  );
}

function GameProgressList({ title, emptyLabel, games, tournament, currentGame }) {
  return (
    <section className="card dashboardCard">
      <div className="head">
        <h2>{title}</h2>
        <span className="pill">
          <span className="dot" /> {games.length}
        </span>
      </div>
      <div className="body">
        {games.length === 0 ? (
          <div className="muted">{emptyLabel}</div>
        ) : (
          <div className="gameProgressList">
            {games.map((game) => (
              <GameProgressCard
                key={game.id}
                game={game}
                current={currentGame?.id === game.id}
                lastLog={lastLogForGame(tournament, game.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function TournamentDashboard({ tournament, currentGame }) {
  if (!tournament) return null;

  const openGames = tournament.games.filter((game) => game.remainingRounds > 0);
  const playedGames = tournament.games.filter((game) => game.playedRounds > 0);
  const playedRounds = tournament.games.reduce((sum, game) => sum + (game.playedRounds ?? 0), 0);
  const remainingRounds = tournament.games.reduce((sum, game) => sum + (game.remainingRounds ?? 0), 0);

  return (
    <div className="tournamentDashboard">
      <div className="dashboardStats">
        <span>
          <b>{playedRounds}</b>
          gespielt
        </span>
        <span>
          <b>{remainingRounds}</b>
          offen
        </span>
        <span>
          <b>{openGames.length}</b>
          aktive Games
        </span>
        <span>
          <b>{currentGame ? currentGame.name : "Bereit"}</b>
          Status
        </span>
      </div>
      <div className="dashboardGrid">
        <GameProgressList
          title="Offene Spiele"
          emptyLabel="Keine offenen Spiele."
          games={openGames}
          tournament={tournament}
          currentGame={currentGame}
        />
        <GameProgressList
          title="Gespielte Spiele"
          emptyLabel="Noch keine gespielten Spiele."
          games={playedGames}
          tournament={tournament}
          currentGame={currentGame}
        />
      </div>
    </div>
  );
}
