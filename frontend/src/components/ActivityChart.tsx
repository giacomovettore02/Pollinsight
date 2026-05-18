const HOURS = Array.from({ length: 24 }, (_, i) => i);
const W = 800;
const H = 260;
const PAD = { top: 24, right: 24, bottom: 36, left: 52 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function smooth(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const cpx = (px + cx) / 2;
    d += ` C ${cpx} ${py}, ${cpx} ${cy}, ${cx} ${cy}`;
  }
  return d;
}

interface ActivityChartProps {
  data: number[];
}

export default function ActivityChart({ data }: ActivityChartProps) {
  const maxVal = Math.max(...data, 1);
  const xStep = INNER_W / (data.length - 1);

  const pts: [number, number][] = data.map((v, i) => [
    PAD.left + i * xStep,
    PAD.top + INNER_H - (v / maxVal) * INNER_H,
  ]);

  const linePath = smooth(pts);
  const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${PAD.top + INNER_H} L ${pts[0][0]} ${PAD.top + INNER_H} Z`;

  // Night bands: 0-6 and 20-24
  const nightLeft1 = PAD.left;
  const nightRight1 = PAD.left + 6 * xStep;
  const nightLeft2 = PAD.left + 20 * xStep;
  const nightRight2 = PAD.left + 23 * xStep;

  const dayLeft = PAD.left + 6 * xStep;
  const dayRight = PAD.left + 20 * xStep;

  const yTicks = [0, 300, 600, 900, 1200].filter(v => v <= maxVal + 200);

  return (
    <div className="rounded-[28px] p-6 shadow-sm" style={{ backgroundColor: 'white' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-800 text-lg" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
            Bee Activity — 24h
          </h3>
          <p className="text-gray-400 text-sm mt-0.5" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            Entries &amp; exits through hive gate sensor
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#b8cce8' }} />
            Night
          </span>
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#fde99c' }} />
            Day
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ minWidth: 320 }}
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bc84ee" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#bc84ee" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id="chartClip">
              <rect x={PAD.left} y={PAD.top} width={INNER_W} height={INNER_H} />
            </clipPath>
          </defs>

          {/* Night band left */}
          <rect
            x={nightLeft1} y={PAD.top}
            width={nightRight1 - nightLeft1}
            height={INNER_H}
            fill="#dce8f5"
            opacity="0.5"
            clipPath="url(#chartClip)"
          />
          {/* Day band */}
          <rect
            x={dayLeft} y={PAD.top}
            width={dayRight - dayLeft}
            height={INNER_H}
            fill="#fef3c7"
            opacity="0.55"
            clipPath="url(#chartClip)"
          />
          {/* Night band right */}
          <rect
            x={nightLeft2} y={PAD.top}
            width={nightRight2 - nightLeft2}
            height={INNER_H}
            fill="#dce8f5"
            opacity="0.5"
            clipPath="url(#chartClip)"
          />

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = PAD.top + INNER_H - (v / maxVal) * INNER_H;
            return (
              <g key={v}>
                <line
                  x1={PAD.left} y1={y} x2={PAD.left + INNER_W} y2={y}
                  stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4"
                />
                <text
                  x={PAD.left - 8} y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#9ca3af"
                  style={{ fontFamily: 'Afacad Flux, sans-serif' }}
                >
                  {v}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGrad)" clipPath="url(#chartClip)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#bc84ee"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#chartClip)"
          />

          {/* Data dots at peaks */}
          {pts.map(([x, y], i) =>
            data[i] > 300 ? (
              <circle key={i} cx={x} cy={y} r="4" fill="#bc84ee" stroke="white" strokeWidth="2" />
            ) : null
          )}

          {/* X axis labels */}
          {HOURS.filter(h => h % 4 === 0).map(h => {
            const x = PAD.left + h * xStep;
            const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
            return (
              <text
                key={h}
                x={x} y={H - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#9ca3af"
                style={{ fontFamily: 'Afacad Flux, sans-serif' }}
              >
                {label}
              </text>
            );
          })}

          {/* Period labels */}
          <text x={PAD.left + 3 * xStep} y={PAD.top + 16} textAnchor="middle" fontSize="10" fill="#7ba7d0" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            Night
          </text>
          <text x={PAD.left + 13 * xStep} y={PAD.top + 16} textAnchor="middle" fontSize="10" fill="#d4a000" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            Day
          </text>
          <text x={PAD.left + 21.5 * xStep} y={PAD.top + 16} textAnchor="middle" fontSize="10" fill="#7ba7d0" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            Dusk
          </text>
        </svg>
      </div>
    </div>
  );
}
