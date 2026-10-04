import { useId, useRef } from 'react';

/** Monotone cubic interpolation (Fritsch-Carlson): smooth, and never overshoots below the data. */
function smoothPath(pts) {
  const n = pts.length;
  if (n < 2) return '';
  const dx = []; const m = []; const t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i]; const b = t[i + 1] / m[i]; const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export function Sparkline({ values, color = 'var(--accent)', height = 40, onHover, activeIndex = null, animate = false, label }) {
  const id = useId();
  const svg = useRef(null);
  const W = 100;
  const pad = 3;
  const max = Math.max(1, ...values);
  const x = (i) => (values.length === 1 ? W / 2 : (i / (values.length - 1)) * W);
  const y = (v) => height - pad - (v / max) * (height - pad * 2);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const line = smoothPath(pts);
  const flat = values.every((v) => v === 0);

  const move = (e) => {
    const box = svg.current.getBoundingClientRect();
    const ratio = (e.clientX - box.left) / box.width;
    onHover?.(Math.max(0, Math.min(values.length - 1, Math.round(ratio * (values.length - 1)))));
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      role="img"
      aria-label={label}
      className={`block overflow-visible ${animate ? 'reveal-x' : ''}`}
      onPointerMove={onHover ? move : undefined}
      onPointerLeave={onHover ? () => onHover(null) : undefined}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {line && !flat && <path d={`${line} L${W},${height} L0,${height} Z`} fill={`url(#${id})`} />}
      {line && (
        <path
          d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          strokeOpacity={flat ? 0.35 : 1}
        />
      )}
      {activeIndex !== null && values[activeIndex] !== undefined && (
        <>
          <line x1={x(activeIndex)} x2={x(activeIndex)} y1={0} y2={height} stroke="var(--ring-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle cx={x(activeIndex)} cy={y(values[activeIndex])} r="3.2" fill={color} stroke="var(--surface)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}
