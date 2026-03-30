import type {
  MoneylinePrediction,
  TotalPrediction,
  SpreadPrediction,
  PlayerPropPrediction,
  PlayerSpecialPrediction,
} from "./schemas";

function confidenceEmoji(c: number): string {
  if (c >= 0.8) return "🔥";
  if (c >= 0.6) return "✅";
  if (c >= 0.4) return "⚠️";
  return "❓";
}

function pct(c: number): string {
  return `${Math.round(c * 100)}%`;
}

export function formatMoneyline(p: MoneylinePrediction): string {
  return [
    `${confidenceEmoji(p.confidence)} *${p.homeTeam} vs ${p.awayTeam}*`,
    `Pick: *${p.pick}* wins (${pct(p.confidence)})`,
    `_${p.reasoning}_`,
  ].join("\n");
}

export function formatTotal(p: TotalPrediction): string {
  return [
    `${confidenceEmoji(p.confidence)} *${p.homeTeam} vs ${p.awayTeam}*`,
    `Line: ${p.line} | Pick: *${p.pick.toUpperCase()}* (projected ${p.projectedTotal})`,
    `Confidence: ${pct(p.confidence)}`,
    `_${p.reasoning}_`,
  ].join("\n");
}

export function formatSpread(p: SpreadPrediction): string {
  return [
    `${confidenceEmoji(p.confidence)} *${p.homeTeam} vs ${p.awayTeam}*`,
    `Spread: ${p.favorite} ${p.spread} | Pick: *${p.pick}* covers`,
    `Projected margin: ${p.projectedMargin} (${pct(p.confidence)})`,
    `_${p.reasoning}_`,
  ].join("\n");
}

export function formatPlayerProp(p: PlayerPropPrediction): string {
  return [
    `${confidenceEmoji(p.confidence)} *${p.playerName}* (${p.team})`,
    `${p.stat}: ${p.pick.toUpperCase()} ${p.line} (projected ${p.projectedValue})`,
    `Confidence: ${pct(p.confidence)}`,
    `_${p.reasoning}_`,
  ].join("\n");
}

export function formatPlayerSpecial(p: PlayerSpecialPrediction): string {
  const label =
    p.type === "double_double" ? "Double-Double" : "Triple-Double";
  const stats = p.projectedStats;
  const statLine = `PTS ${stats.pts} | AST ${stats.ast} | REB ${stats.reb} | STL ${stats.stl} | BLK ${stats.blk}`;
  return [
    `${confidenceEmoji(p.confidence)} *${p.playerName}* (${p.team}) — ${label}`,
    `Probability: *${pct(p.probability)}* | Confidence: ${pct(p.confidence)}`,
    `Projected: ${statLine}`,
    `_${p.reasoning}_`,
  ].join("\n");
}

export function formatDailyPredictions(data: {
  date: string;
  playerProps: PlayerPropPrediction[];
  specials: PlayerSpecialPrediction[];
  moneyline: MoneylinePrediction[];
  totals: TotalPrediction[];
  spreads: SpreadPrediction[];
}): string {
  const sections: string[] = [
    `🏀 *NBA Predictions — ${data.date}*\n`,
  ];

  // Player predictions first — they're the main product
  if (data.playerProps.length > 0) {
    sections.push("*── 🎯 PLAYER PROPS ──*");
    sections.push(...data.playerProps.map(formatPlayerProp));
    sections.push("");
  }

  if (data.specials.length > 0) {
    sections.push("*── ⭐ DOUBLE-DOUBLES & TRIPLE-DOUBLES ──*");
    sections.push(...data.specials.map(formatPlayerSpecial));
    sections.push("");
  }

  // Game-level predictions secondary
  if (data.moneyline.length > 0) {
    sections.push("*── MONEYLINE ──*");
    sections.push(...data.moneyline.map(formatMoneyline));
    sections.push("");
  }

  if (data.totals.length > 0) {
    sections.push("*── TOTALS (O/U) ──*");
    sections.push(...data.totals.map(formatTotal));
    sections.push("");
  }

  if (data.spreads.length > 0) {
    sections.push("*── SPREADS ──*");
    sections.push(...data.spreads.map(formatSpread));
  }

  return sections.join("\n");
}

export function formatAccuracyReport(data: {
  date: string;
  results: Array<{
    type: string;
    total: number;
    correct: number;
  }>;
}): string {
  const lines = [
    `📊 *Accuracy Report — ${data.date}*\n`,
  ];

  for (const r of data.results) {
    const pctVal = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
    lines.push(`*${r.type}*: ${r.correct}/${r.total} (${pctVal}%)`);
  }

  return lines.join("\n");
}
