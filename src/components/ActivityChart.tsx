import { useState } from 'react';
import { X } from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const W = 800;
const H = 300;
const PAD = { top: 48, right: 24, bottom: 36, left: 52 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

interface TimeSlot {
  start: number;
  end: number;
  label: string;
  fill: string;
  textColor: string;
  isCrown: boolean;
  modalIcon: string;
  modalWhat: string;
  modalWhy: string;
  modalWarning?: string;
}

const TIME_SLOTS: TimeSlot[] = [
  {
    start: 6, end: 11,
    label: 'Mattina',
    fill: '#fef9e7',
    textColor: '#b45309', isCrown: false,
    modalIcon: '🌅',
    modalWhat: 'Le bottinatrici escono nelle prime ore del mattino per le raccolte di polline e nettare. Il traffico al portale cresce progressivamente con il riscaldarsi dell\'aria.',
    modalWhy: 'Questo è il periodo più indicato per osservare il comportamento della colonia: un flusso ordinato e bidirezionale indica una colonia sana e ben orientata. Carichi di polline sulle zampe posteriori sono un segnale positivo di allevamento attivo della covata.',
  },
  {
    start: 14, end: 16,
    label: 'Primo Pomeriggio',
    fill: '#fef3c7',
    textColor: '#a16207', isCrown: false,
    modalIcon: '☀️',
    modalWhat: 'Le temperature raggiungono il picco giornaliero. Le api continuano a bottinare con intensità, privilegiando fonti di nettare vicine all\'alveare per limitare il dispendio energetico.',
    modalWhy: 'Un\'attività sostenuta in questa fascia indica buona disponibilità floreale nel raggio di 1–3 km. Se l\'attività cala bruscamente rispetto alla mattina e le condizioni meteo sono buone, potrebbe esserci una riduzione delle risorse floreali nelle vicinanze.',
  },
  {
    start: 16, end: 19,
    label: 'Volo della Regina',
    fill: '#fde8c8',
    textColor: '#b45309', isCrown: true,
    modalIcon: '👑',
    modalWhat: 'La regina vergine esce dall\'alveare per il volo di accoppiamento con i fuchi ad alta quota. L\'evento dura 20–30 minuti e avviene tipicamente nelle ore più calde del pomeriggio.',
    modalWhy: 'È un momento critico che determina la genetica, la fecondità della regina e il futuro intero della colonia. Una regina ben fecondata può deporre fino a 2.000 uova al giorno per anni.',
    modalWarning: 'Evitare qualsiasi disturbo fisico all\'alveare in questa fascia oraria. Urti, vibrazioni o aperture del tetto possono impedire il rientro della regina o spaventarla, compromettendo irreversibilmente il volo nuziale.',
  },
  {
    start: 19, end: 24,
    label: 'Sera',
    fill: '#dce8f5',
    textColor: '#3b82f6', isCrown: false,
    modalIcon: '🌙',
    modalWhat: 'L\'attività di volo si riduce rapidamente dopo il tramonto. Le api rientrano nell\'alveare e avviano la termoregolazione notturna, mantenendo il nido covata a circa 35°C.',
    modalWhy: 'Un calo netto del traffico al portale in questa fascia è del tutto normale. Se si osservano api in uscita in numero anomalo di notte, potrebbe indicare sovraffollamento, eccessivo calore interno o presenza di predatori.',
  },
];

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
  previousData?: number[];
}

export default function ActivityChart({ data, previousData }: ActivityChartProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const currentHour = new Date().getHours();
  const maxVal = Math.max(...data, ...(previousData ?? []), 1);
  const xStep = INNER_W / (data.length - 1);

  const currentSlot = TIME_SLOTS.find(s => currentHour >= s.start && currentHour < s.end) ?? null;

  const currentDataToDisplay = data.slice(0, currentHour + 1);

  const pts: [number, number][] = currentDataToDisplay.map((v, i) => [
    PAD.left + i * xStep,
    PAD.top + INNER_H - (v / maxVal) * INNER_H,
  ]);

  const prevPts: [number, number][] | null = previousData
    ? previousData.map((v, i) => [
      PAD.left + i * xStep,
      PAD.top + INNER_H - (v / maxVal) * INNER_H,
    ])
    : null;

  const linePath = smooth(pts);
  const areaPath =
    pts.length > 1
      ? `${linePath} L ${pts[pts.length - 1][0]} ${PAD.top + INNER_H} L ${pts[0][0]} ${PAD.top + INNER_H} Z`
      : '';
  const prevLinePath = prevPts ? smooth(prevPts) : null;

  const yTicks = [0, 300, 600, 900, 1200].filter(v => v <= maxVal + 200);
  const currentX = PAD.left + currentHour * xStep;

  return (
    <>
      <div className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: 'white' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-gray-800 text-lg" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
                Attività Api — 24h
              </h3>
              <p className="text-gray-400 text-sm mt-0.5" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                Entrate e uscite attraverso il sensore del portale alveare
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Pulsating badge for current slot */}
              {currentSlot && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="relative flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer select-none transition-transform hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: currentSlot.fill,
                    color: currentSlot.textColor,
                    fontFamily: 'Afacad Flux, sans-serif',
                    border: `1.5px solid ${currentSlot.textColor}55`,
                  }}
                >
                  {/* Slot tag */}
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: currentSlot.fill, opacity: 0.5 }}
                  />
                  <span className="relative flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: currentSlot.textColor }}
                    />
                    {currentSlot.isCrown && <span>♛</span>}
                    Fascia Attuale: {currentSlot.label}
                  </span>
                </button>
              )}

              <div className="flex items-center gap-4 text-xs" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                <span className="flex items-center gap-1.5 text-gray-500">
                  <svg width="20" height="10" viewBox="0 0 20 10">
                    <line x1="0" y1="5" x2="20" y2="5" stroke="#6B2D8C" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  Oggi
                </span>
                {prevLinePath && (
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <svg width="20" height="10" viewBox="0 0 20 10">
                      <line x1="0" y1="5" x2="20" y2="5" stroke="#b0b8c1" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
                    </svg>
                    Ieri
                  </span>
                )}
              </div>
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
                  <stop offset="0%" stopColor="#6B2D8C" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6B2D8C" stopOpacity="0.02" />
                </linearGradient>
                <clipPath id="chartClip">
                  <rect x={PAD.left} y={PAD.top} width={INNER_W} height={INNER_H} />
                </clipPath>
              </defs>

              {/* Time slot bands */}
              {TIME_SLOTS.map((slot) => {
                const x = PAD.left + slot.start * xStep;
                const w = (slot.end - slot.start) * xStep;
                const midX = x + w / 2;

                return (
                  <g key={slot.label}>
                    <rect
                      x={x}
                      y={PAD.top}
                      width={w}
                      height={INNER_H}
                      fill={slot.fill}
                      opacity={0.6}
                      clipPath="url(#chartClip)"
                    />
                    <text
                      x={midX}
                      y={PAD.top - 7}
                      textAnchor="middle"
                      fontSize="8.5"
                      fill={slot.textColor}
                      fontWeight={'600'}
                      style={{ fontFamily: 'Afacad Flux, sans-serif' }}
                    >
                      {slot.modalIcon}
                    </text>
                    <line
                      x1={x}
                      y1={PAD.top - 20}
                      x2={x + w}
                      y2={PAD.top - 20}
                      stroke={slot.textColor}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      opacity={0.4}
                    />
                  </g>
                );
              })}

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
                      textAnchor="end" fontSize="11" fill="#9ca3af"
                      style={{ fontFamily: 'Afacad Flux, sans-serif' }}
                    >
                      {v}
                    </text>
                  </g>
                );
              })}

              {prevLinePath && (
                <path
                  d={prevLinePath}
                  fill="none" stroke="#b0b8c1" strokeWidth="2"
                  strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round"
                  clipPath="url(#chartClip)" opacity="0.7"
                />
              )}

              {areaPath && (
                <path d={areaPath} fill="url(#areaGrad)" clipPath="url(#chartClip)" />
              )}

              {linePath && (
                <path
                  d={linePath}
                  fill="none" stroke="#6B2D8C" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round"
                  clipPath="url(#chartClip)"
                />
              )}

              {pts.map(([x, y], i) =>
                data[i] > 300 ? (
                  <circle key={i} cx={x} cy={y} r="4" fill="#6B2D8C" stroke="white" strokeWidth="2" />
                ) : null
              )}

              {HOURS.filter(h => h % 4 === 0).map(h => {
                const x = PAD.left + h * xStep;
                return (
                  <text
                    key={h}
                    x={x} y={H - 8}
                    textAnchor="middle" fontSize="11" fill="#9ca3af"
                    style={{ fontFamily: 'Afacad Flux, sans-serif' }}
                  >
                    {`${String(h).padStart(2, '0')}:00`}
                  </text>
                );
              })}

              <line
                x1={currentX} y1={PAD.top}
                x2={currentX} y2={PAD.top + INNER_H}
                stroke="#6B2D8C" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5"
              />
              <text
                x={currentX + 5} y={PAD.top + 11}
                fontSize="9" fill="#6B2D8C" fontWeight="700"
                style={{ fontFamily: 'Afacad Flux, sans-serif' }}
              >
                Ora
              </text>
            </svg>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && currentSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'white' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Coloured header strip */}
            <div
              className="px-6 pt-6 pb-5"
              style={{ backgroundColor: currentSlot.fill }}
            >
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 rounded-full p-1.5 transition-colors hover:bg-black/10"
                style={{ color: currentSlot.textColor }}
              >
                <X size={18} strokeWidth={2.5} />
              </button>

              <div className="flex items-center gap-3">
                <span style={{ fontSize: '2rem', lineHeight: 1 }}>{currentSlot.modalIcon}</span>
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                    style={{ color: currentSlot.textColor, fontFamily: 'Afacad Flux, sans-serif', opacity: 0.7 }}
                  >
                    Fascia oraria attuale
                  </p>
                  <h2
                    className="font-bold text-xl leading-tight"
                    style={{ color: currentSlot.textColor, fontFamily: 'Comfortaa, sans-serif' }}
                  >
                    {currentSlot.isCrown ? `♛ ${currentSlot.label}` : currentSlot.label}
                  </h2>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: '#6b7280', fontFamily: 'Afacad Flux, sans-serif' }}
                >
                  Cosa succede ora
                </p>
                <p
                  className="text-sm text-gray-700 leading-relaxed"
                  style={{ fontFamily: 'Afacad Flux, sans-serif' }}
                >
                  {currentSlot.modalWhat}
                </p>
              </div>

              <div>
                <p
                  className="text-xs font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: '#6b7280', fontFamily: 'Afacad Flux, sans-serif' }}
                >
                  Perche e importante
                </p>
                <p
                  className="text-sm text-gray-700 leading-relaxed"
                  style={{ fontFamily: 'Afacad Flux, sans-serif' }}
                >
                  {currentSlot.modalWhy}
                </p>
              </div>

              {currentSlot.modalWarning && (
                <div
                  className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                  style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}
                >
                  <span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>⚠️</span>
                  <p
                    className="text-xs text-orange-700 leading-relaxed font-medium"
                    style={{ fontFamily: 'Afacad Flux, sans-serif' }}
                  >
                    {currentSlot.modalWarning}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5">
              <button
                onClick={() => setModalOpen(false)}
                className="w-full rounded-2xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: currentSlot.fill,
                  color: currentSlot.textColor,
                  fontFamily: 'Afacad Flux, sans-serif',
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
