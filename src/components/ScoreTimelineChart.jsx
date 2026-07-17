import { formatPoints } from "../utils/common";

const LINE_COLORS = [
  "#35ffb1",
  "#b100ff",
  "#ffcc66",
  "#ff5f7a",
  "#52a8ff",
  "#f7f06d",
  "#ff8a35",
  "#8dffea",
];

function safePoint(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function buildTimeline(tournament) {
  const players = Array.isArray(tournament?.players) ? tournament.players : [];
  const chronologicalLog = Array.isArray(tournament?.log) ? [...tournament.log].reverse() : [];
  const totals = Object.fromEntries(players.map((player) => [player.id, 0]));
  const rounds = [
    {
      round: 0,
      totals: { ...totals },
    },
  ];

  chronologicalLog.forEach((entry, index) => {
    const pointsByPlayer = entry?.pointsByPlayer && typeof entry.pointsByPlayer === "object"
      ? entry.pointsByPlayer
      : {};

    players.forEach((player) => {
      totals[player.id] += safePoint(pointsByPlayer[player.id]);
    });

    rounds.push({
      round: Number(entry?.globalRound) || index + 1,
      totals: { ...totals },
    });
  });

  return { players, rounds };
}

export function ScoreTimelineChart({ tournament }) {
  const { players, rounds } = buildTimeline(tournament);
  if (players.length === 0 || rounds.length <= 1) {
    return (
      <section className="scoreTimelineCard">
        <div className="scoreTimelineHead">
          <div>
            <div className="section-title">Punkteverlauf</div>
            <div className="muted">Noch nicht genug Rundendaten.</div>
          </div>
        </div>
      </section>
    );
  }

  const width = 920;
  const height = 340;
  const padding = { top: 24, right: 24, bottom: 42, left: 66 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const allValues = rounds.flatMap((round) => players.map((player) => round.totals[player.id] ?? 0));
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(0, ...allValues);
  const range = Math.max(1, maxValue - minValue);

  function xFor(index) {
    if (rounds.length <= 1) return padding.left;
    return padding.left + (index / (rounds.length - 1)) * plotWidth;
  }

  function yFor(value) {
    return padding.top + ((maxValue - value) / range) * plotHeight;
  }

  const zeroY = yFor(0);
  const yTicks = Array.from(new Set([minValue, 0, maxValue])).sort((a, b) => b - a);

  return (
    <section className="scoreTimelineCard">
      <div className="scoreTimelineHead">
        <div>
          <div className="section-title">Punkteverlauf</div>
          <div className="muted">Kumulierte Punkte pro Runde</div>
        </div>
        <span className="pill">
          <span className="dot" /> {rounds.length - 1} Runden
        </span>
      </div>

      <div className="scoreTimelineSvgWrap" role="img" aria-label="Punkteverlauf aller Spieler">
        <svg viewBox={`0 0 ${width} ${height}`} className="scoreTimelineSvg">
          <rect x="0" y="0" width={width} height={height} rx="18" />
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={yFor(tick)}
                y2={yFor(tick)}
                className={tick === 0 ? "scoreTimelineZero" : "scoreTimelineGrid"}
              />
              <text x={padding.left - 12} y={yFor(tick) + 5} textAnchor="end">
                {formatPoints(tick)}
              </text>
            </g>
          ))}

          {rounds.map((round, index) => {
            if (index === 0 || index === rounds.length - 1 || index % Math.ceil(rounds.length / 6) === 0) {
              return (
                <g key={`x-${index}`}>
                  <line
                    x1={xFor(index)}
                    x2={xFor(index)}
                    y1={padding.top}
                    y2={padding.top + plotHeight}
                    className="scoreTimelineGrid vertical"
                  />
                  <text x={xFor(index)} y={height - 15} textAnchor="middle">
                    {round.round}
                  </text>
                </g>
              );
            }
            return null;
          })}

          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={zeroY}
            y2={zeroY}
            className="scoreTimelineZero strong"
          />

          {players.map((player, playerIndex) => {
            const color = LINE_COLORS[playerIndex % LINE_COLORS.length];
            const points = rounds
              .map((round, index) => `${xFor(index).toFixed(1)},${yFor(round.totals[player.id] ?? 0).toFixed(1)}`)
              .join(" ");

            return (
              <g key={player.id} className="scoreTimelinePlayer">
                <polyline points={points} fill="none" stroke={color} />
                {rounds.map((round, index) => (
                  <circle
                    key={`${player.id}-${index}`}
                    cx={xFor(index)}
                    cy={yFor(round.totals[player.id] ?? 0)}
                    r={index === rounds.length - 1 ? 4.5 : 3}
                    fill={color}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="scoreTimelineLegend">
        {players.map((player, index) => (
          <span key={player.id}>
            <i style={{ background: LINE_COLORS[index % LINE_COLORS.length] }} />
            {player.name}
          </span>
        ))}
      </div>
    </section>
  );
}
