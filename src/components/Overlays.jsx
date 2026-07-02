export function RestoreTournamentModal({ candidate, onContinue, onDiscard }) {
  const saved = candidate.valid ? candidate.data : null;
  const savedAt = saved?.savedAt ? new Date(saved.savedAt) : null;
  const savedAtText =
    savedAt && !Number.isNaN(savedAt.getTime()) ? savedAt.toLocaleString("de-DE") : "";
  const openRounds = saved
    ? saved.tournament.games.reduce((sum, game) => sum + game.remainingRounds, 0)
    : 0;

  return (
    <div className="overlay">
      <div className="modal restoreModal">
        <div className="mhead">
          <b>Turnier fortsetzen?</b>
          <span className="pill">
            <span className="dot" /> Auto-Save
          </span>
        </div>
        <div className="mbody">
          <div className="big">Es wurde ein laufendes Turnier gefunden.</div>
          <div className="muted mode-muted">
            {saved
              ? `TR ${saved.tournament.globalRound} · ${openRounds} offene Runden · ${saved.tournament.players.length} Spieler`
              : "Der gespeicherte Stand konnte nicht geladen werden."}
          </div>

          {savedAtText && <div className="restoreMeta">Gespeichert: {savedAtText}</div>}
          {!candidate.valid && (
            <div className="restoreMeta dangerText">{candidate.reason}</div>
          )}

          <div className="restoreActions">
            {candidate.valid && (
              <button className="btn ok" type="button" onClick={onContinue}>
                Turnier fortsetzen
              </button>
            )}
            <button className="btn secondary" type="button" onClick={onDiscard}>
              Gespeichertes Turnier verwerfen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message }) {
  return <div className={`toast ${message ? "show" : ""}`}>{message}</div>;
}
