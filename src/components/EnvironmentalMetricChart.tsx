import { Droplets, Radio, Thermometer, WifiOff } from 'lucide-react';
import { localizeEntityName, useLanguage } from '../i18n/LanguageContext';
import { getTimeSlots } from '../lib/timePeriods';

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const W = 800;
const H = 430;
const PAD = { top: 34, right: 28, bottom: 50, left: 58 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

type Metric = 'temperature' | 'humidity';

interface DailyMetricProps {
  mode: 'daily';
  metric: Metric;
  values: number[];
  previousValues: number[];
  hiveName: string;
}

interface LiveMetricProps {
  mode: 'live';
  metric: Metric;
  values: Array<{ timestamp: string; value: number }>;
  live: boolean;
}

type EnvironmentalMetricChartProps = DailyMetricProps | LiveMetricProps;

function smooth(points: Array<[number, number]>): string {
  if (points.length < 2) return '';
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 1; index < points.length; index += 1) {
    const [previousX, previousY] = points[index - 1];
    const [currentX, currentY] = points[index];
    const controlX = (previousX + currentX) / 2;
    path += ` C ${controlX} ${previousY}, ${controlX} ${currentY}, ${currentX} ${currentY}`;
  }
  return path;
}

function paddedRange(values: number[], metric: Metric): [number, number] {
  const safeValues = values.length ? values : [0];
  const minimum = Math.min(...safeValues);
  const maximum = Math.max(...safeValues);
  const minimumPadding = metric === 'temperature' ? 1 : 3;
  const padding = Math.max(minimumPadding, (maximum - minimum) * 0.16);
  return [minimum - padding, maximum + padding];
}

function formatValue(value: number, metric: Metric): string {
  return metric === 'temperature' ? `${value.toFixed(1)} C` : `${value.toFixed(1)}%`;
}

export default function EnvironmentalMetricChart(props: EnvironmentalMetricChartProps) {
  const { language, pick } = useLanguage();
  const metric = props.metric;
  const color = metric === 'temperature' ? '#d97706' : '#0284c7';
  const lightColor = metric === 'temperature' ? '#fff7ed' : '#e0f2fe';
  const Icon = metric === 'temperature' ? Thermometer : Droplets;
  const title = metric === 'temperature'
    ? pick('Temperatura', 'Temperature')
    : pick('Umidita', 'Humidity');

  if (props.mode === 'live') {
    const allValues = props.values.map(point => point.value);
    const [minimum, maximum] = paddedRange(allValues, metric);
    const denominator = maximum - minimum || 1;
    const xStep = props.values.length > 1 ? INNER_W / (props.values.length - 1) : 0;
    const points: Array<[number, number]> = props.values.map((point, index) => [
      PAD.left + index * xStep,
      PAD.top + INNER_H - ((point.value - minimum) / denominator) * INNER_H,
    ]);
    const path = smooth(points);
    const latest = props.values[props.values.length - 1];
    const currentHour = new Date().getHours();
    const currentSlot = getTimeSlots(language).find(
      slot => currentHour >= slot.start && currentHour < slot.end
    );

    return (
      <div className="rounded-2xl p-5 shadow-sm min-w-0" style={{ backgroundColor: 'white' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2.5" style={{ backgroundColor: lightColor, color }}>
              <Icon size={19} />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-base" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
                {title}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                {pick('Ultimo minuto', 'Last minute')}
              </p>
            </div>
          </div>
          <div
            className="rounded-full px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-semibold"
            style={{
              backgroundColor: props.live ? '#e0f2fe' : '#f3f4f6',
              color: props.live ? '#0284c7' : '#6b7280',
              fontFamily: 'Afacad Flux, sans-serif',
            }}
          >
            {props.live ? <Radio size={11} className="animate-pulse" /> : <WifiOff size={11} />}
            {props.live ? pick('Ogni 2 secondi', 'Every 2 seconds') : pick('In attesa', 'Waiting')}
          </div>
        </div>

        {props.values.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center">
            <Icon size={28} color="#9ca3af" />
            <p className="text-sm text-gray-400 mt-2" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
              {pick('Nessuna lettura disponibile.', 'No readings available.')}
            </p>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto mt-3">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 420 }}>
                <defs>
                  <clipPath id={`live-${metric}-clip`}>
                    <rect x={PAD.left} y={PAD.top} width={INNER_W} height={INNER_H} />
                  </clipPath>
                  <linearGradient id={`live-${metric}-fill`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {currentSlot && (
                  <rect
                    x={PAD.left}
                    y={PAD.top}
                    width={INNER_W}
                    height={INNER_H}
                    fill={currentSlot.fill}
                    opacity="0.55"
                    clipPath={`url(#live-${metric}-clip)`}
                  />
                )}
                {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                  const y = PAD.top + INNER_H - ratio * INNER_H;
                  const value = minimum + ratio * (maximum - minimum);
                  return (
                    <g key={ratio}>
                      <line x1={PAD.left} y1={y} x2={PAD.left + INNER_W} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                      <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
                        {metric === 'temperature' ? value.toFixed(1) : value.toFixed(0)}
                      </text>
                    </g>
                  );
                })}
                {path && (
                  <>
                    <path
                      d={`${path} L ${points[points.length - 1][0]} ${PAD.top + INNER_H} L ${points[0][0]} ${PAD.top + INNER_H} Z`}
                      fill={`url(#live-${metric}-fill)`}
                      clipPath={`url(#live-${metric}-clip)`}
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      clipPath={`url(#live-${metric}-clip)`}
                    />
                  </>
                )}
                {points.map(([x, y], index) => (
                  <circle
                    key={`${props.values[index].timestamp}-point`}
                    cx={x}
                    cy={y}
                    r="3.2"
                    fill="white"
                    stroke={color}
                    strokeWidth="2"
                    clipPath={`url(#live-${metric}-clip)`}
                  />
                ))}
                {props.values.map((point, index) => {
                  if (
                    props.values.length > 8 &&
                    index % Math.ceil(props.values.length / 5) !== 0 &&
                    index !== props.values.length - 1
                  ) {
                    return null;
                  }
                  return (
                    <text
                      key={point.timestamp}
                      x={PAD.left + index * xStep}
                      y={H - 8}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#9ca3af"
                    >
                      {new Date(point.timestamp).toLocaleTimeString(language === 'it' ? 'it-IT' : 'en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </text>
                  );
                })}
              </svg>
            </div>
            <div className="flex items-center justify-between gap-3 mt-2 text-xs" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
              <span className="font-semibold" style={{ color }}>
                {latest ? formatValue(latest.value, metric) : '--'}
              </span>
              <span className="text-gray-400">
                {props.values.length} {pick('campioni', 'samples')}
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  const currentHour = new Date().getHours();
  const timeSlots = getTimeSlots(language);
  const currentSlot = timeSlots.find(slot => currentHour >= slot.start && currentHour < slot.end);
  const allValues = [...props.values, ...props.previousValues];
  const [minimum, maximum] = paddedRange(allValues, metric);
  const denominator = maximum - minimum || 1;
  const xStep = INNER_W / 23;

  const buildPath = (values: number[], fullDay: boolean) => {
    const visible = fullDay ? values : values.slice(0, currentHour + 1);
    const points: Array<[number, number]> = visible.map((value, index) => [
      PAD.left + index * xStep,
      PAD.top + INNER_H - ((value - minimum) / denominator) * INNER_H,
    ]);
    return { points, path: smooth(points) };
  };

  const today = buildPath(props.values, false);
  const yesterday = buildPath(props.previousValues, true);
  const latestValue = props.values[Math.min(currentHour, props.values.length - 1)];

  return (
    <div className="rounded-2xl p-5 shadow-sm min-w-0" style={{ backgroundColor: 'white' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5" style={{ backgroundColor: lightColor, color }}>
            <Icon size={19} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-base" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
              {title}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
              {localizeEntityName(props.hiveName, language)} | 24 {pick('ore', 'hours')}
            </p>
          </div>
        </div>
        <span className="font-bold text-sm" style={{ color, fontFamily: 'Comfortaa, sans-serif' }}>
          {formatValue(latestValue, metric)}
        </span>
      </div>

      <div className="w-full overflow-x-auto mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 420 }}>
          <defs>
            <clipPath id={`daily-${metric}-clip`}>
              <rect x={PAD.left} y={PAD.top} width={INNER_W} height={INNER_H} />
            </clipPath>
            <linearGradient id={`daily-${metric}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {timeSlots.map(slot => (
            <rect
              key={slot.label}
              x={PAD.left + slot.start * xStep}
              y={PAD.top}
              width={(slot.end - slot.start) * xStep}
              height={INNER_H}
              fill={slot.fill}
              opacity={currentSlot?.label === slot.label ? 0.85 : 0.5}
              clipPath={`url(#daily-${metric}-clip)`}
            />
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const y = PAD.top + INNER_H - ratio * INNER_H;
            const value = minimum + ratio * (maximum - minimum);
            return (
              <g key={ratio}>
                <line x1={PAD.left} y1={y} x2={PAD.left + INNER_W} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
                  {metric === 'temperature' ? value.toFixed(1) : value.toFixed(0)}
                </text>
              </g>
            );
          })}
          {yesterday.path && (
            <path
              d={yesterday.path}
              fill="none"
              stroke="#b0b8c1"
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinecap="round"
              clipPath={`url(#daily-${metric}-clip)`}
              opacity="0.65"
            />
          )}
          {today.path && (
            <>
              <path
                d={`${today.path} L ${today.points[today.points.length - 1][0]} ${PAD.top + INNER_H} L ${today.points[0][0]} ${PAD.top + INNER_H} Z`}
                fill={`url(#daily-${metric}-fill)`}
                clipPath={`url(#daily-${metric}-clip)`}
              />
              <path
                d={today.path}
                fill="none"
                stroke={color}
                strokeWidth="2.7"
                strokeLinecap="round"
                clipPath={`url(#daily-${metric}-clip)`}
              />
            </>
          )}
          {HOURS.filter(hour => hour % 4 === 0).map(hour => (
            <text
              key={hour}
              x={PAD.left + hour * xStep}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#9ca3af"
            >
              {String(hour).padStart(2, '0')}:00
            </text>
          ))}
          <line
            x1={PAD.left + currentHour * xStep}
            y1={PAD.top}
            x2={PAD.left + currentHour * xStep}
            y2={PAD.top + INNER_H}
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.45"
          />
        </svg>
      </div>

      <div className="flex items-center gap-5 mt-3 flex-wrap text-xs text-gray-500" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
        <span className="flex items-center gap-2">
          <span className="w-5 h-0.5 rounded" style={{ backgroundColor: color }} />
          {pick('Oggi', 'Today')}
        </span>
        <span className="flex items-center gap-2 text-gray-400">
          <span className="w-5 border-t-2 border-dashed border-gray-400" />
          {pick('Ieri', 'Yesterday')}
        </span>
      </div>
    </div>
  );
}
