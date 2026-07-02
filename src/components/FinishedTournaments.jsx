import { formatMultiplier, formatPoints, formatScore, formatTime } from "../utils/common";
import {
  multiplierModeLabel,
  normalizeScoringSettings,
} from "../utils/scoring";
import {
  normalizeRoundEvaluationMode,
  roundEvaluationModeLabel,
} from "../utils/teams";
import { normalizeWheelSettings, wheelWeightModeLabel } from "../utils/wheel";

function winnerOf(tournament) {
  return tournament?.ranking?.[0] ?? null;
}

function formatSavedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("de-DE");
}

function SettingsSummary({ tournament }) {
  const settings = normalizeScoringSettings(
    tournament.scoringSettings,
    tournament.players.length,
    tournament.mode
  );
  const wheelSettings = normalizeWheelSettings(tournament.wheelSettings);
  return (
    <div className="settingsSummary">
      <span>Teammodus: {tournament.teamModeEnabled ? "aktiv" : "aus"}</span>
      <span>Multiplikator: {settings.multiplierEnabled ? "aktiv" : "aus"}</span>
      <span>Basis: {settings.pointsByPlace.slice(0, 4).map(formatPoints).join(" / ")}</span>
      {settings.multiplierEnabled && (
        <span>
          Multiplikator: ×{formatMultiplier(settings.multiplier)} ·{" "}
          {multiplierModeLabel(settings.multiplierMode)}
        </span>
      )}
      <span>
        Bonus: {settings.bonusEnabled ? `aktiv · ${settings.bonusChance}% · ×${formatMultiplier(settings.bonusMultiplier)}` : "aus"}
      </span>
      <span>
        Wheel: {wheelWeightModeLabel(wheelSettings.weightMode)} Â· No Repeat{" "}
        {wheelSettings.noRepeat ? "an" : "aus"}
      </span>
    </div>
  );
}

function RankingTable({ ranking, label = "Spieler" }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Platz</th>
          <th>{label}</th>
          <th className="right">Punkte</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((player, index) => (
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
  );
}

function LogTable({ tournament }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Zeit</th>
          <th>Game</th>
          <th>Runde</th>
          <th>Ergebnis</th>
          <th className="right">Punkte</th>
        </tr>
      </thead>
      <tbody>
        {tournament.log.map((entry) => {
          const effectiveMultiplier = entry.effectiveMultiplier ?? entry.multiplier ?? 1;
          const bonusMultiplier = entry.bonusMultiplier ?? 1;
          const isScoreMode = entry.scoringMode === "score";
          const roundEvaluationMode = normalizeRoundEvaluationMode(
            entry.roundEvaluationMode,
            entry.scoringMode,
            Array.isArray(entry.teamsSnapshot) && entry.teamsSnapshot.length > 0
          );
          const scoresByPlayer = entry.scoresByPlayer ?? {};
          return (
            <tr key={entry.id}>
              <td>{formatTime(entry.t)}</td>
              <td>{entry.gameName}</td>
              <td className="roundColumn">
                <div>TR {entry.globalRound}</div>
                <div className="roundMultiplierLine">
                  Normal ×{formatMultiplier(entry.multiplier ?? 1)}
                </div>
                <div className="roundMultiplierLine">
                  {roundEvaluationModeLabel(roundEvaluationMode)}
                </div>
                {entry.bonusActive ? (
                  <span className="bonusMini">
                    BONUS ×{formatMultiplier(bonusMultiplier)} · Gesamt ×
                    {formatMultiplier(effectiveMultiplier)}
                  </span>
                ) : (
                  <div className="roundMultiplierLine">
                    Gesamt ×{formatMultiplier(effectiveMultiplier)}
                  </div>
                )}
              </td>
              <td>
                {isScoreMode && <span className="scoreLogTag">Score-Modus</span>}
                <div>{entry.result}</div>
              </td>
              <td className="right">
                {Object.entries(entry.pointsByPlayer ?? {})
                  .map(([playerId, points]) => {
                    const player = tournament.players.find((item) => item.id === playerId);
                    const scoreText = isScoreMode
                      ? `Score ${formatScore(scoresByPlayer[playerId])} → `
                      : "";
                    return `${player ? player.name : "?"}: ${scoreText}${formatPoints(points)}`;
                  })
                  .join(" • ")}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function WinningScreen({
  tournament,
  saved,
  onSave,
  onNewTournament,
  onClose,
}) {
  if (!tournament) return null;

  const winner = winnerOf(tournament);
  const podium = [tournament.ranking[1], tournament.ranking[0], tournament.ranking[2]];
  const bestTeam = tournament.teamModeEnabled ? tournament.teamRanking?.[0] : null;

  return (
    <div className="overlay">
      <div className="modal winningModal">
        <div className="mhead">
          <b>Turnier beendet</b>
          <span className="pill">
            <span className="dot" /> Ergebnis
          </span>
        </div>
        <div className="mbody">
          <div className="winnerHero">
            <div className="muted">Gewinner</div>
            <div className="winnerName">{winner ? winner.name : "Unentschieden"}</div>
            <div className="winnerPoints">{winner ? `${formatPoints(winner.total)} Punkte` : "0 Punkte"}</div>
          </div>

          <div className="podium">
            {podium.map((player, index) => {
              const place = index === 0 ? 2 : index === 1 ? 1 : 3;
              return (
                <div key={place} className={`podiumStep place${place}`}>
                  <div className="podiumPlace">Platz {place}</div>
                  <div className="podiumName">{player ? player.name : "—"}</div>
                  <div className="podiumPoints">
                    {player ? formatPoints(player.total) : 0}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="winnerStats">
            <span>Runden: {tournament.totalRounds}</span>
            <span>Games: {tournament.playedGames}</span>
            <span>Bonus-Runden: {tournament.bonusRounds}</span>
          </div>

          {tournament.teamModeEnabled && (
            <div className="teamWinnerSummary">
              <div>
                <div className="muted">Bestes Team</div>
                <div className="section-title">{bestTeam ? bestTeam.name : "-"}</div>
              </div>
              <span className="pill">
                <span className="dot" /> {bestTeam ? formatPoints(bestTeam.total) : 0}
              </span>
            </div>
          )}

          <div className="hr" />
          <RankingTable ranking={tournament.ranking.slice(0, 3)} />

          {tournament.teamModeEnabled && tournament.teamRanking?.length > 0 && (
            <>
              <div className="hr" />
              <div className="section-title">Teamranking</div>
              <RankingTable ranking={tournament.teamRanking} label="Team" />
            </>
          )}

          <div className="winnerActions">
            <button className="btn ok" type="button" disabled={saved} onClick={onSave}>
              {saved ? "Turnier gespeichert" : "Turnier speichern"}
            </button>
            <button className="btn secondary" type="button" onClick={onNewTournament}>
              Neues Turnier
            </button>
            <button className="btn secondary" type="button" onClick={onClose}>
              Zurück zur Übersicht
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FinishedTournamentsList({
  tournaments,
  deleteArmedId,
  onView,
  onDelete,
}) {
  return (
    <section className="card finishedTournamentsCard">
      <div className="head">
        <h2>Vergangene Turniere</h2>
        <span className="pill">
          <span className="dot" /> {tournaments.length}
        </span>
      </div>
      <div className="body">
        {tournaments.length === 0 ? (
          <div className="muted">Noch keine gespeicherten Turniere.</div>
        ) : (
          <div className="finishedList">
            {tournaments.map((tournament) => {
              const winner = winnerOf(tournament);
              return (
                <div key={tournament.id} className="finishedItem">
                  <div className="finishedMain">
                    <div className="section-title">{tournament.title}</div>
                    <div className="muted">{formatSavedAt(tournament.savedAt)}</div>
                    <div className="finishedMeta">
                      <span>Gewinner: {winner ? winner.name : "—"}</span>
                      <span>{tournament.players.length} Spieler</span>
                      <span>{tournament.totalRounds} Runden</span>
                    </div>
                  </div>
                  <div className="finishedActions">
                    <button className="btn secondary miniBtn" type="button" onClick={() => onView(tournament)}>
                      Ansehen
                    </button>
                    <button
                      className={`btn danger miniBtn ${deleteArmedId === tournament.id ? "armed" : ""}`}
                      type="button"
                      onClick={() => onDelete(tournament.id)}
                    >
                      {deleteArmedId === tournament.id ? "Nochmal klicken" : "Löschen"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function FinishedTournamentDetails({ tournament, onClose }) {
  if (!tournament) return null;

  return (
    <div className="overlay">
      <div className="modal finishedDetailModal">
        <div className="mhead">
          <b>{tournament.title}</b>
          <button className="btn secondary miniBtn" type="button" onClick={onClose}>
            Schließen
          </button>
        </div>
        <div className="mbody">
          <div className="winnerStats detailStats">
            <span>Runden: {tournament.totalRounds}</span>
            <span>Games: {tournament.playedGames}</span>
            <span>Bonus-Runden: {tournament.bonusRounds}</span>
          </div>

          <div className="detailSection">
            <div className="section-title">Endranking</div>
            <RankingTable ranking={tournament.ranking} />
          </div>

          {tournament.teamModeEnabled && tournament.teamRanking?.length > 0 && (
            <div className="detailSection">
              <div className="section-title">Teamranking</div>
              <RankingTable ranking={tournament.teamRanking} label="Team" />
            </div>
          )}

          <div className="detailSection">
            <div className="section-title">Settings</div>
            <SettingsSummary tournament={tournament} />
          </div>

          <div className="detailSection">
            <div className="section-title">Verlauf</div>
            {tournament.log.length > 0 ? (
              <LogTable tournament={tournament} />
            ) : (
              <div className="muted">Keine gespeicherten Runden.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
