import { formatLei } from "../lib/money";

const compact = new Intl.NumberFormat("ro-RO", {
  notation: "compact",
  maximumFractionDigits: 1
});

export function compactLei(n: number): string {
  return compact.format(n);
}

/**
 * Grouped bar chart: for each label, a pair of bars (a = venit, b =
 * cheltuit). An optional `aExtra` (report) stacks on top of bar a in a
 * lighter shade, so carried-over money reads as distinct from income.
 * Pure SVG, scales to container width.
 */
export function PairBars({
  data,
  aLabel,
  bLabel,
  aExtraLabel
}: {
  data: { label: string; a: number; aExtra?: number; b: number }[];
  aLabel: string;
  bLabel: string;
  aExtraLabel?: string;
}) {
  const W = 640;
  const H = 240;
  const pad = { top: 16, right: 8, bottom: 28, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => Math.max(d.a + (d.aExtra ?? 0), d.b)));
  const group = innerW / Math.max(1, data.length);
  const barW = Math.min(26, group * 0.32);
  const hasExtra = data.some((d) => (d.aExtra ?? 0) > 0);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${aLabel} vs ${bLabel}`}>
        {data.map((d, i) => {
          const cx = pad.left + group * i + group / 2;
          const extra = d.aExtra ?? 0;
          const ha = (d.a / max) * innerH;
          const he = (extra / max) * innerH;
          const hb = (d.b / max) * innerH;
          const base = pad.top + innerH;
          return (
            <g key={d.label}>
              <rect
                className="chart__bar-a"
                x={cx - barW - 2}
                y={base - ha}
                width={barW}
                height={Math.max(2, ha)}
                rx={4}
              >
                <title>{`${d.label} — ${aLabel}: ${formatLei(d.a)}`}</title>
              </rect>
              {he > 0 && (
                <rect
                  className="chart__bar-a2"
                  x={cx - barW - 2}
                  y={base - ha - he}
                  width={barW}
                  height={he}
                  rx={4}
                >
                  <title>{`${d.label} — ${aExtraLabel ?? ""}: ${formatLei(extra)}`}</title>
                </rect>
              )}
              <rect
                className="chart__bar-b"
                x={cx + 2}
                y={base - hb}
                width={barW}
                height={Math.max(2, hb)}
                rx={4}
              >
                <title>{`${d.label} — ${bLabel}: ${formatLei(d.b)}`}</title>
              </rect>
              <text className="chart__label" x={cx} y={H - 8} textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
        <line
          className="chart__axis"
          x1={pad.left}
          y1={pad.top + innerH}
          x2={W - pad.right}
          y2={pad.top + innerH}
        />
      </svg>
      <figcaption className="chart__legend">
        <span><i className="dot dot--a" /> {aLabel}</span>
        {hasExtra && aExtraLabel && (
          <span><i className="dot dot--a2" /> {aExtraLabel}</span>
        )}
        <span><i className="dot dot--b" /> {bLabel}</span>
      </figcaption>
    </figure>
  );
}

/** Line chart for percentages (e.g. savings rate per month). */
export function PercentLine({ data }: { data: { label: string; value: number }[] }) {
  const W = 640;
  const H = 200;
  const pad = { top: 20, right: 16, bottom: 28, left: 16 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const min = Math.min(0, ...data.map((d) => d.value));
  const max = Math.max(10, ...data.map((d) => d.value));
  const x = (i: number) =>
    pad.left + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
  const y = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH;
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rata de economisire pe luni">
        {min < 0 && (
          <line className="chart__zero" x1={pad.left} y1={y(0)} x2={W - pad.right} y2={y(0)} />
        )}
        <polyline className="chart__line" points={points} />
        {data.map((d, i) => (
          <g key={d.label}>
            <circle
              className={`chart__dot ${d.value < 0 ? "is-negative" : ""}`}
              cx={x(i)}
              cy={y(d.value)}
              r={4}
            >
              <title>{`${d.label}: ${d.value.toFixed(1).replace(".", ",")}%`}</title>
            </circle>
            <text className="chart__value" x={x(i)} y={y(d.value) - 10} textAnchor="middle">
              {Math.round(d.value)}%
            </text>
            <text className="chart__label" x={x(i)} y={H - 8} textAnchor="middle">
              {d.label}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** Single-series bars (category evolution across months). */
export function MiniBars({ data }: { data: { label: string; value: number }[] }) {
  const W = 640;
  const H = 200;
  const pad = { top: 24, right: 8, bottom: 28, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const group = innerW / Math.max(1, data.length);
  const barW = Math.min(34, group * 0.55);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evoluție pe luni">
        {data.map((d, i) => {
          const cx = pad.left + group * i + group / 2;
          const h = (d.value / max) * innerH;
          const base = pad.top + innerH;
          return (
            <g key={d.label}>
              <rect
                className="chart__bar-b"
                x={cx - barW / 2}
                y={base - h}
                width={barW}
                height={Math.max(2, h)}
                rx={4}
              >
                <title>{`${d.label}: ${formatLei(d.value)}`}</title>
              </rect>
              {d.value > 0 && (
                <text className="chart__value" x={cx} y={base - h - 6} textAnchor="middle">
                  {compactLei(d.value)}
                </text>
              )}
              <text className="chart__label" x={cx} y={H - 8} textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
        <line
          className="chart__axis"
          x1={pad.left}
          y1={pad.top + innerH}
          x2={W - pad.right}
          y2={pad.top + innerH}
        />
      </svg>
    </figure>
  );
}
