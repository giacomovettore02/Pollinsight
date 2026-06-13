import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Crown,
  Info,
  Layers,
  List,
  Moon,
  Sun,
  Sunrise,
  X,
} from 'lucide-react';
import type { EnvData, Hive } from '../data/mockData';
import { localizeEntityName, useLanguage, type Language } from '../i18n/LanguageContext';
import EnvironmentalMetricChart from './EnvironmentalMetricChart';

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const W = 800;
const H = 280;
const PAD = { top: 28, right: 24, bottom: 36, left: 52 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;
const HIVE_COLORS = ['#6B2D8C', '#0d9488', '#b45309', '#dc2626', '#0369a1'];

interface TimeSlot {
  start: number;
  end: number;
  label: string;
  time: string;
  fill: string;
  textColor: string;
  icon: 'sunrise' | 'sun' | 'crown' | 'moon';
  description: string;
  warning?: string;
}

function getTimeSlots(language: Language): TimeSlot[] {
  const l = (italian: string, english: string) => language === 'it' ? italian : english;
  return [
    {
      start: 6,
      end: 11,
      label: l('Mattina', 'Morning'),
      time: '06:00 - 11:00',
      fill: '#fef9e7',
      textColor: '#b45309',
      icon: 'sunrise',
      description: l(
        'Ripresa intensa delle attività. Le bottinatrici raccolgono nettare e polline fresco.',
        'Activity rises quickly as foragers collect fresh nectar and pollen.'
      ),
    },
    {
      start: 14,
      end: 16,
      label: l('Primo pomeriggio', 'Early afternoon'),
      time: '14:00 - 16:00',
      fill: '#fef3c7',
      textColor: '#a16207',
      icon: 'sun',
      description: l(
        'Picco di calore giornaliero. Monitorare ventilazione e stabilità dei voli.',
        'Daily heat peak. Monitor ventilation and flight stability.'
      ),
    },
    {
      start: 16,
      end: 19,
      label: l('Volo della regina', 'Queen flight'),
      time: '16:00 - 19:00',
      fill: '#fde8c8',
      textColor: '#b45309',
      icon: 'crown',
      description: l(
        'Finestra critica per il volo nuziale della regina e l\'orientamento dei giovani fuchi.',
        'Critical window for the queen mating flight and orientation of young drones.'
      ),
      warning: l(
        'Evitare urti, aperture o altri disturbi fisici dell\'alveare.',
        'Avoid impacts, opening the hive, or other physical disturbance.'
      ),
    },
    {
      start: 19,
      end: 24,
      label: l('Sera', 'Evening'),
      time: '19:00 - 24:00',
      fill: '#dce8f5',
      textColor: '#3b82f6',
      icon: 'moon',
      description: l(
        'Rientro delle api, riposo, ventilazione notturna e termoregolazione.',
        'Bees return for rest, night ventilation, and thermoregulation.'
      ),
    },
  ];
}

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

interface ActivityChartProps {
  hives: Hive[];
  environment: EnvData;
  aggregatedToday: number[];
  aggregatedYesterday: number[];
}

export default function ActivityChart({
  hives,
  environment,
  aggregatedToday,
  aggregatedYesterday,
}: ActivityChartProps) {
  const { language, pick } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'aggregate' | 'breakdown'>('aggregate');
  const [selectedHiveId, setSelectedHiveId] = useState<string | null>(hives[0]?.id ?? null);

  const currentHour = new Date().getHours();
  const xStep = INNER_W / 23;
  const timeSlots = useMemo(() => getTimeSlots(language), [language]);
  const currentSlot = timeSlots.find(slot => currentHour >= slot.start && currentHour < slot.end) ?? null;
  const selectedHive = hives.find(hive => hive.id === selectedHiveId) ?? hives[0] ?? null;
  const selectedHiveIndex = Math.max(0, hives.findIndex(hive => hive.id === selectedHive?.id));
  const hiveEnvironment = useMemo(() => {
    const centeredIndex = selectedHiveIndex - (hives.length - 1) / 2;
    const temperatureOffset = centeredIndex * 0.35;
    const humidityOffset = centeredIndex * 1.4;
    const temperature = environment.hourly_temp.map((value, hour) =>
      Number((value + temperatureOffset + Math.sin((hour + selectedHiveIndex) * 0.7) * 0.12).toFixed(1))
    );
    const humidity = environment.hourly_humidity.map((value, hour) =>
      Number(Math.min(100, Math.max(
        0,
        value + humidityOffset + Math.sin((hour + selectedHiveIndex) * 0.55) * 0.45
      )).toFixed(1))
    );
    const previousTemperature = temperature.map((value, hour) =>
      Number((value - 0.45 + Math.cos((hour + selectedHiveIndex) * 0.5) * 0.18).toFixed(1))
    );
    const previousHumidity = humidity.map((value, hour) =>
      Number(Math.min(100, Math.max(
        0,
        value + 1.1 + Math.cos((hour + selectedHiveIndex) * 0.45) * 0.35
      )).toFixed(1))
    );

    return {
      temperature,
      humidity,
      previousTemperature,
      previousHumidity,
    };
  }, [environment.hourly_humidity, environment.hourly_temp, hives.length, selectedHiveIndex]);
  const today = viewMode === 'aggregate' ? aggregatedToday : selectedHive?.hourly_activity ?? [];
  const yesterday = viewMode === 'aggregate'
    ? aggregatedYesterday
    : selectedHive?.hourly_activity_yesterday ?? [];
  const todayVisible = today.slice(0, currentHour + 1);
  const rawMax = Math.max(...todayVisible, ...yesterday, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawMax));
  const normalized = rawMax / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const scaleMax = nice * magnitude;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(value => Math.round(value * scaleMax));

  const renderLine = (data: number[], color: string, dashed = false, area = false) => {
    const visible = dashed ? data : data.slice(0, currentHour + 1);
    const points: Array<[number, number]> = visible.map((value, index) => [
      PAD.left + index * xStep,
      PAD.top + INNER_H - (value / scaleMax) * INNER_H,
    ]);
    const line = smooth(points);
    if (!line) return null;
    const lastPoint = points[points.length - 1];
    const areaPath = area
      ? `${line} L ${lastPoint[0]} ${PAD.top + INNER_H} L ${points[0][0]} ${PAD.top + INNER_H} Z`
      : null;
    return (
      <>
        {areaPath && <path d={areaPath} fill={color} fillOpacity="0.12" clipPath="url(#activityClip)" />}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={dashed ? 2 : 2.5}
          strokeDasharray={dashed ? '6 4' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#activityClip)"
          opacity={dashed ? 0.6 : 1}
        />
      </>
    );
  };

  const slotIcon = (slot: TimeSlot) => {
    if (slot.icon === 'sunrise') return <Sunrise size={20} color={slot.textColor} />;
    if (slot.icon === 'sun') return <Sun size={20} color={slot.textColor} />;
    if (slot.icon === 'crown') return <Crown size={20} color={slot.textColor} />;
    return <Moon size={20} color={slot.textColor} />;
  };

  return (
    <>
      <div className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: 'white' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-gray-800 text-lg" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
                {pick('Attività api - 24 ore', 'Bee Activity - 24 Hours')}
              </h3>
              <p className="text-gray-400 text-sm mt-0.5" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                {viewMode === 'aggregate'
                  ? pick('Totale aggregato di tutti gli alveari', 'Combined total for all hives')
                  : pick('Dettaglio per singolo alveare', 'Individual hive detail')}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {hives.length > 1 && (
                <div className="flex items-center rounded-full p-0.5" style={{ backgroundColor: '#f3f4f6' }}>
                  <button
                    onClick={() => setViewMode('aggregate')}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{
                      backgroundColor: viewMode === 'aggregate' ? 'white' : 'transparent',
                      color: viewMode === 'aggregate' ? '#6B2D8C' : '#6b7280',
                      fontFamily: 'Afacad Flux, sans-serif',
                    }}
                  >
                    <Layers size={12} />
                    {pick('Aggregato', 'Combined')}
                  </button>
                  <button
                    onClick={() => setViewMode('breakdown')}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{
                      backgroundColor: viewMode === 'breakdown' ? 'white' : 'transparent',
                      color: viewMode === 'breakdown' ? '#6B2D8C' : '#6b7280',
                      fontFamily: 'Afacad Flux, sans-serif',
                    }}
                  >
                    <List size={12} />
                    {pick('Per alveare', 'By hive')}
                  </button>
                </div>
              )}
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: '#f9fafb',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  fontFamily: 'Afacad Flux, sans-serif',
                }}
              >
                <Info size={14} />
                {pick('Fasce orarie', 'Time periods')}
              </button>
            </div>
          </div>

          {currentSlot && (
            <div className="flex items-center gap-2 mb-3" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: currentSlot.textColor }} />
              <span className="text-xs text-gray-500">{pick('Fascia attuale:', 'Current period:')}</span>
              <span className="text-xs font-semibold" style={{ color: currentSlot.textColor }}>{currentSlot.label}</span>
              <span className="text-xs text-gray-400">({currentSlot.time})</span>
            </div>
          )}

          {viewMode === 'breakdown' && hives.length > 1 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {hives.map((hive, index) => (
                <button
                  key={hive.id}
                  onClick={() => setSelectedHiveId(hive.id)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{
                    backgroundColor: selectedHiveId === hive.id ? `${HIVE_COLORS[index % HIVE_COLORS.length]}15` : '#f9fafb',
                    border: `1.5px solid ${selectedHiveId === hive.id ? HIVE_COLORS[index % HIVE_COLORS.length] : '#e5e7eb'}`,
                  }}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: HIVE_COLORS[index % HIVE_COLORS.length] }} />
                  <span className="text-xs font-semibold" style={{ color: '#374151', fontFamily: 'Afacad Flux, sans-serif' }}>
                    {localizeEntityName(hive.name, language)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
              <defs>
                <clipPath id="activityClip">
                  <rect x={PAD.left} y={PAD.top} width={INNER_W} height={INNER_H} />
                </clipPath>
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
                  clipPath="url(#activityClip)"
                />
              ))}
              {yTicks.map(value => {
                const y = PAD.top + INNER_H - (value / scaleMax) * INNER_H;
                return (
                  <g key={value}>
                    <line x1={PAD.left} y1={y} x2={PAD.left + INNER_W} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                    <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
                      {value}
                    </text>
                  </g>
                );
              })}
              {renderLine(yesterday, '#b0b8c1', true)}
              {renderLine(
                today,
                viewMode === 'breakdown' && selectedHive
                  ? HIVE_COLORS[Math.max(0, hives.findIndex(hive => hive.id === selectedHive.id)) % HIVE_COLORS.length]
                  : '#6B2D8C',
                false,
                true
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
                stroke="#6B2D8C"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.4"
              />
            </svg>
          </div>

          <div className="flex items-center gap-6 mt-4 flex-wrap text-xs text-gray-500" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            <span className="flex items-center gap-2">
              <span className="w-5 h-0.5 rounded bg-[#6B2D8C]" />
              {viewMode === 'breakdown' && selectedHive
                ? `${localizeEntityName(selectedHive.name, language)} - ${pick('Oggi', 'Today')}`
                : pick('Oggi (totale)', 'Today (total)')}
            </span>
            <span className="flex items-center gap-2 text-gray-400">
              <span className="w-5 border-t-2 border-dashed border-gray-400" />
              {viewMode === 'breakdown' && selectedHive
                ? `${localizeEntityName(selectedHive.name, language)} - ${pick('Ieri', 'Yesterday')}`
                : pick('Ieri (totale)', 'Yesterday (total)')}
            </span>
          </div>
        </div>
      </div>

      {viewMode === 'breakdown' && selectedHive && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EnvironmentalMetricChart
            mode="daily"
            metric="temperature"
            values={hiveEnvironment.temperature}
            previousValues={hiveEnvironment.previousTemperature}
            hiveName={selectedHive.name}
          />
          <EnvironmentalMetricChart
            mode="daily"
            metric="humidity"
            values={hiveEnvironment.humidity}
            previousValues={hiveEnvironment.previousHumidity}
            hiveName={selectedHive.name}
          />
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'white' }}
            onClick={event => event.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4" style={{ backgroundColor: '#f9fafb' }}>
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 rounded-full p-1.5 hover:bg-gray-200"
                aria-label={pick('Chiudi', 'Close')}
              >
                <X size={18} color="#6b7280" />
              </button>
              <h2 className="font-bold text-lg text-gray-800" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
                {pick('Fasce orarie giornaliere', 'Daily Time Periods')}
              </h2>
              <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                {pick('I ritmi naturali dell\'attività delle api', 'Natural bee activity rhythms')}
              </p>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {timeSlots.map(slot => (
                <div
                  key={slot.label}
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: slot.fill,
                    border: currentSlot?.label === slot.label ? `2px solid ${slot.textColor}` : '1px solid transparent',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                      {slotIcon(slot)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm" style={{ color: slot.textColor, fontFamily: 'Comfortaa, sans-serif' }}>
                          {slot.label}
                        </p>
                        {currentSlot?.label === slot.label && (
                          <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: slot.textColor }}>
                            {pick('Attivo', 'Active')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: slot.textColor }}>{slot.time}</p>
                      <p className="text-sm text-gray-700 mt-2" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                        {slot.description}
                      </p>
                    </div>
                  </div>
                  {slot.warning && (
                    <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-white/70">
                      <AlertTriangle size={15} color="#c2410c" className="flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-800" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                        {slot.warning}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 pb-5">
              <button
                onClick={() => setModalOpen(false)}
                className="w-full rounded-2xl py-2.5 text-sm font-semibold"
                style={{ backgroundColor: '#f5f0f8', color: '#6B2D8C', fontFamily: 'Afacad Flux, sans-serif' }}
              >
                {pick('Chiudi', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
