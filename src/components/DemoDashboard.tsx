import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Check,
  Clock3,
  Droplets,
  ExternalLink,
  FlaskConical,
  HeartPulse,
  Image as ImageIcon,
  Loader2,
  Radio,
  ShieldCheck,
  Thermometer,
  WifiOff,
  X,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import EnvironmentChart, { type EnvironmentSample } from './EnvironmentChart';
import { useLanguage, type Language } from '../i18n/LanguageContext';

type RunStatus =
  | 'connecting'
  | 'reading_sensor'
  | 'classifying'
  | 'uploading'
  | 'complete'
  | 'error';

interface EvidenceItem {
  filename: string;
  path: string;
  confidence: number;
  public_url?: string;
  captured_at?: string;
}

interface DisplayEvidenceItem extends EvidenceItem {
  public_url: string;
  capturedAt: string;
}

interface DemoRun {
  id: string;
  boot_id: string;
  status: RunStatus;
  progress_current: number;
  progress_total: number;
  total_bees: number | null;
  healthy_bees: number | null;
  infected_bees: number | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  sensor_status: 'pending' | 'online' | 'offline' | 'error';
  device_status: 'online' | 'offline' | 'error';
  evidence: EvidenceItem[];
  model_name: string | null;
  processing_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  updated_at: string;
  last_heartbeat_at: string;
  completed_at: string | null;
}

const STAGES: Array<Exclude<RunStatus, 'error'>> = [
  'connecting',
  'reading_sensor',
  'classifying',
  'uploading',
  'complete',
];

const FALLBACK_EVIDENCE_TIMESTAMPS = [
  '2026-06-10T09:18:00',
  '2026-06-11T11:42:00',
  '2026-06-12T14:07:00',
  '2026-06-13T15:26:00',
  '2026-06-14T10:53:00',
];

function formatTimestamp(value: string | null, language: Language): string {
  if (!value) return language === 'it' ? 'Non disponibile' : 'Not available';
  return new Date(value).toLocaleString(language === 'it' ? 'it-IT' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatShotTimestamp(value: string, language: Language): string {
  return new Date(value).toLocaleString(language === 'it' ? 'it-IT' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStageName(
  status: RunStatus,
  pick: (italian: string, english: string) => string
): string {
  const labels: Record<RunStatus, string> = {
    connecting: pick('Connessione', 'Connecting'),
    reading_sensor: pick('Lettura sensore', 'Reading sensor'),
    classifying: pick('Classificazione', 'Classifying'),
    uploading: pick('Caricamento', 'Uploading'),
    complete: pick('Completato', 'Complete'),
    error: pick('Errore', 'Error'),
  };
  return labels[status];
}

function getStageLabel(
  run: DemoRun,
  pick: (italian: string, english: string) => string
): string {
  if (run.status === 'classifying') {
    return `${pick('Classificazione', 'Classifying')} ${run.progress_current}/${run.progress_total}`;
  }
  if (run.status === 'uploading') {
    return `${pick('Caricamento', 'Uploading')} ${run.progress_current}/${run.progress_total}`;
  }
  return getStageName(run.status, pick);
}

function StatCard({
  icon,
  label,
  value,
  detail,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-2.5 min-h-[144px]" style={{ backgroundColor: 'white' }}>
      <div className="flex items-center justify-between">
        <p
          className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
          style={{ fontFamily: 'Afacad Flux, sans-serif' }}
        >
          {label}
        </p>
        <div className="rounded-xl p-2" style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      <p
        className="font-bold leading-none"
        style={{ color: '#1e293b', fontFamily: 'Comfortaa, sans-serif', fontSize: '1.55rem' }}
      >
        {value}
      </p>
      <p className="text-[11px] text-gray-400 mt-auto leading-snug" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
        {detail}
      </p>
    </div>
  );
}

export default function DemoDashboard() {
  const { language, pick } = useLanguage();
  const [run, setRun] = useState<DemoRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<DisplayEvidenceItem | null>(null);
  const [environmentSamples, setEnvironmentSamples] = useState<EnvironmentSample[]>([]);
  const [now, setNow] = useState(Date.now());
  const latestRunRef = useRef<DemoRun | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      setConnectionError(pick(
        'Supabase non è configurato su questo laptop.',
        'Supabase is not configured on this laptop.'
      ));
      return;
    }

    let active = true;

    const loadLatest = async () => {
      const { data, error } = await client
        .from('demo_runs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setConnectionError(error.message);
      } else {
        setRun((data as DemoRun | null) ?? null);
        setConnectionError(null);
      }
      setLoading(false);
    };

    void loadLatest();

    const channel = client
      .channel('pollinsight-demo-runs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demo_runs' },
        payload => {
          const incoming = payload.new as DemoRun;
          if (!incoming?.started_at) return;
          setRun(current => {
            if (!current) return incoming;
            const incomingUpdated = new Date(incoming.updated_at).getTime();
            const currentUpdated = new Date(current.updated_at).getTime();
            if (incoming.boot_id === current.boot_id || incomingUpdated >= currentUpdated) {
              return incoming;
            }
            return current;
          });
          setConnectionError(null);
          setLoading(false);
        }
      )
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionError(pick(
            'Connessione Realtime interrotta. Nuovo tentativo automatico.',
            'Realtime connection interrupted. Retrying automatically.'
          ));
        }
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [pick]);

  useEffect(() => {
    latestRunRef.current = run;
  }, [run]);

  useEffect(() => {
    const sampleLatestReading = () => {
      const latestRun = latestRunRef.current;
      const cutoff = Date.now() - 60_000;

      if (
        !latestRun ||
        latestRun.sensor_status !== 'online' ||
        latestRun.temperature_c === null ||
        latestRun.humidity_percent === null
      ) {
        setEnvironmentSamples(current =>
          current.filter(sample => new Date(sample.timestamp).getTime() >= cutoff)
        );
        return;
      }

      const sample: EnvironmentSample = {
        bootId: latestRun.boot_id,
        timestamp: new Date().toISOString(),
        temperature: Number(latestRun.temperature_c),
        humidity: Number(latestRun.humidity_percent),
      };

      setEnvironmentSamples(current => {
        if (current.length > 0 && current[current.length - 1].bootId !== sample.bootId) {
          return [sample];
        }
        return [...current, sample]
          .filter(item => new Date(item.timestamp).getTime() >= cutoff)
          .slice(-30);
      });
    };

    sampleLatestReading();
    const timer = window.setInterval(sampleLatestReading, 2_000);
    return () => window.clearInterval(timer);
  }, []);

  const evidence = useMemo(() => {
    const client = supabase;
    if (!run || !client) return [];
    const rawItems = run.evidence ?? [];

    return rawItems.map((item, index): DisplayEvidenceItem => ({
      ...item,
      public_url:
        item.public_url ??
        client.storage.from('demo-evidence').getPublicUrl(item.path).data.publicUrl,
      capturedAt:
        item.captured_at ??
        FALLBACK_EVIDENCE_TIMESTAMPS[index % FALLBACK_EVIDENCE_TIMESTAMPS.length],
    }));
  }, [run]);

  const heartbeatAge = run
    ? now - new Date(run.updated_at).getTime()
    : Number.POSITIVE_INFINITY;
  const deviceOffline = Boolean(run && heartbeatAge > 20 * 60 * 1000);
  const waitingForDevice = Boolean(run?.status === 'complete' && deviceOffline);
  const isRunning = Boolean(run && run.status !== 'complete' && run.status !== 'error');
  const currentStageIndex = run ? STAGES.findIndex(stage => stage === run.status) : -1;
  const progressPercent = run && run.progress_total > 0
    ? Math.min(100, Math.round((run.progress_current / run.progress_total) * 100))
    : 0;

  const dateStr = new Date().toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-8 pb-12 space-y-5 pt-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-gray-400 text-sm capitalize" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            {dateStr}
          </p>
          <h1
            className="font-bold text-gray-800 text-3xl mt-1 leading-tight"
            style={{ fontFamily: 'Comfortaa, sans-serif' }}
          >
            {pick('Demo Raspberry Pi', 'Raspberry Pi Demo')}
          </h1>
        </div>
        <div
          className="rounded-2xl px-4 py-2 flex items-center gap-2 text-sm font-semibold shadow-sm"
          style={{
            backgroundColor: deviceOffline ? '#fff7ed' : '#e6faf5',
            color: deviceOffline ? '#c2410c' : '#0d9488',
            fontFamily: 'Afacad Flux, sans-serif',
          }}
        >
          {deviceOffline ? <WifiOff size={15} /> : <Radio size={15} />}
          {waitingForDevice
            ? pick('In attesa del dispositivo', 'Waiting for device')
            : deviceOffline
              ? pick('Dispositivo offline', 'Device offline')
              : run
                ? pick('Dispositivo connesso', 'Device connected')
                : pick('In attesa del dispositivo', 'Waiting for device')}
        </div>
      </div>

      {connectionError && (
        <div
          className="rounded-2xl px-5 py-3 flex items-center gap-3"
          style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}
        >
          <AlertCircle size={18} color="#c2410c" />
          <p className="text-sm" style={{ color: '#9a3412', fontFamily: 'Afacad Flux, sans-serif' }}>
            {connectionError}
          </p>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl p-12 shadow-sm flex flex-col items-center text-center" style={{ backgroundColor: 'white' }}>
          <Loader2 className="animate-spin" size={38} color="#6B2D8C" />
          <p className="font-semibold text-gray-700 mt-4" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
            {pick('Connessione al backend della demo', 'Connecting to the demo backend')}
          </p>
        </div>
      )}

      {!loading && !run && (
        <div className="rounded-2xl p-12 shadow-sm flex flex-col items-center text-center" style={{ backgroundColor: 'white' }}>
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#f5f0f8' }}>
            <FlaskConical size={42} color="#6B2D8C" />
          </div>
          <p className="font-bold text-gray-700 text-lg mt-4" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
            {pick('In attesa del Raspberry Pi', 'Waiting for the Raspberry Pi')}
          </p>
          <p className="text-sm text-gray-400 mt-2 max-w-md" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            {pick(
              'Accendi il Raspberry Pi per avviare lettura del sensore, classificazione e caricamento delle prove.',
              'Power on the Raspberry Pi to start sensor reading, bee classification, and evidence upload.'
            )}
          </p>
        </div>
      )}

      {run && isRunning && (
        <div className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: 'white' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="rounded-xl p-2.5" style={{ backgroundColor: '#f5f0f8' }}>
                <Loader2 className="animate-spin" size={21} color="#6B2D8C" />
              </div>
              <div>
                <p className="font-bold text-gray-800" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
                  {getStageLabel(run, pick)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                  {pick('Batch avviato', 'Batch started')} {formatTimestamp(run.started_at, language)}
                </p>
              </div>
            </div>
            {(run.status === 'classifying' || run.status === 'uploading') && (
              <span
                className="rounded-full px-3 py-1 text-sm font-bold"
                style={{ backgroundColor: '#e6faf5', color: '#0d9488', fontFamily: 'Comfortaa, sans-serif' }}
              >
                {progressPercent}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-6">
            {STAGES.map((stage, index) => {
              const done = index < currentStageIndex;
              const active = index === currentStageIndex;
              return (
                <div
                  key={stage}
                  className="rounded-xl px-3 py-3 flex items-center gap-2"
                  style={{
                    backgroundColor: active ? '#f5f0f8' : done ? '#f0fdf4' : '#f9fafb',
                    color: active ? '#6B2D8C' : done ? '#15803d' : '#9ca3af',
                    fontFamily: 'Afacad Flux, sans-serif',
                  }}
                >
                  {done ? <Check size={15} strokeWidth={3} /> : <span className="w-2 h-2 rounded-full bg-current" />}
                  <span className="text-xs font-semibold">
                    {getStageName(stage, pick)}
                  </span>
                </div>
              );
            })}
          </div>

          {(run.status === 'classifying' || run.status === 'uploading') && (
            <div className="w-full h-2 rounded-full overflow-hidden mt-5" style={{ backgroundColor: '#f3f4f6' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%`, backgroundColor: '#20C997' }}
              />
            </div>
          )}
        </div>
      )}

      {run?.status === 'error' && (
        <div
          className="rounded-2xl p-6 shadow-sm"
          style={{ backgroundColor: '#fff5f5', border: '1.5px solid #fecaca' }}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl p-2.5 bg-white">
              <AlertTriangle size={22} color="#dc2626" />
            </div>
            <div>
              <p className="font-bold" style={{ color: '#b91c1c', fontFamily: 'Comfortaa, sans-serif' }}>
                {run.error_code === 'dataset_invalid'
                  ? pick('Dataset della demo non valido', 'Demo dataset invalid')
                  : pick('Esecuzione demo non riuscita', 'Demo run failed')}
              </p>
              <p className="text-sm mt-1" style={{ color: '#7f1d1d', fontFamily: 'Afacad Flux, sans-serif' }}>
                {run.error_message ?? pick(
                  'Controlla i log del Raspberry Pi prima di riavviare la dimostrazione.',
                  'Check the Raspberry Pi logs before restarting the demonstration.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {run?.status === 'complete' && (
        <>
          <div
            className="rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 flex-wrap"
            style={{ backgroundColor: '#fff7ed', border: '1.5px solid #fed7aa' }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl p-2.5 bg-white">
                <Bug size={23} color="#ea580c" />
              </div>
              <div>
                <p className="font-bold" style={{ color: '#c2410c', fontFamily: 'Comfortaa, sans-serif' }}>
                  {pick('Varroa rilevata su', 'Varroa detected on')}{' '}
                  {run.infected_bees ?? 0} {pick('di', 'of')} {run.total_bees ?? 0}{' '}
                  {pick('api analizzate', 'analyzed bees')}
                </p>
                <p className="text-xs mt-1" style={{ color: '#9a3412', fontFamily: 'Afacad Flux, sans-serif' }}>
                  {pick('Completato', 'Completed')} {formatTimestamp(run.completed_at, language)}
                </p>
              </div>
            </div>
            <div
              className="rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ backgroundColor: '#ffffff', color: '#c2410c', fontFamily: 'Afacad Flux, sans-serif' }}
            >
              {pick('Prove caricate', 'Evidence uploaded')}: {evidence.length}
            </div>
          </div>

          {run.sensor_status !== 'online' && (
            <div
              className="rounded-2xl px-5 py-3 flex items-center gap-3"
              style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}
            >
              <AlertCircle size={18} color="#d97706" />
              <p className="text-sm" style={{ color: '#92400e', fontFamily: 'Afacad Flux, sans-serif' }}>
                {pick(
                  'Sensore offline. Classificazione completata senza temperatura e umidità.',
                  'Sensor offline. Classification completed without temperature and humidity.'
                )}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={<FlaskConical size={18} />}
              label={pick('Conteggio api', 'Bee Count')}
              value={String(run.total_bees ?? 0)}
              detail={pick('Una singola ape per immagine analizzata', 'One bee per analyzed image')}
              iconBg="#f5f0f8"
              iconColor="#6B2D8C"
            />
            <StatCard
              icon={<ShieldCheck size={18} />}
              label={pick('Api sane', 'Healthy Bees')}
              value={String(run.healthy_bees ?? 0)}
              detail={pick('Classificate sotto la soglia Varroa', 'Classified below the Varroa threshold')}
              iconBg="#dcfce7"
              iconColor="#15803d"
            />
            <StatCard
              icon={<Bug size={18} />}
              label={pick('Api infette', 'Infected Bees')}
              value={String(run.infected_bees ?? 0)}
              detail={pick('Immagini conservate e caricate', 'Evidence images retained and uploaded')}
              iconBg="#ffedd5"
              iconColor="#ea580c"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={<Thermometer size={18} />}
              label={pick('Temperatura', 'Temperature')}
              value={run.temperature_c === null ? '--' : `${Number(run.temperature_c).toFixed(1)} C`}
              detail={run.sensor_status === 'online'
                ? pick('Mediana di cinque letture SHT40', 'Median of five SHT40 readings')
                : pick('Sensore non disponibile', 'Sensor unavailable')}
              iconBg="#fffbd9"
              iconColor="#b45309"
            />
            <StatCard
              icon={<Droplets size={18} />}
              label={pick('Umidità', 'Humidity')}
              value={run.humidity_percent === null ? '--' : `${Number(run.humidity_percent).toFixed(1)}%`}
              detail={run.sensor_status === 'online'
                ? pick('Mediana di cinque letture SHT40', 'Median of five SHT40 readings')
                : pick('Sensore non disponibile', 'Sensor unavailable')}
              iconBg="#e0f2fe"
              iconColor="#0284c7"
            />
            <StatCard
              icon={<Clock3 size={18} />}
              label={pick('Tempo di elaborazione', 'Processing Time')}
              value={run.processing_ms === null ? '--' : `${(run.processing_ms / 1000).toFixed(1)}s`}
              detail={pick("Ultimo batch completato", 'Latest completed batch')}
              iconBg="#f3f4f6"
              iconColor="#4b5563"
            />
          </div>

          <EnvironmentChart
            samples={environmentSamples}
            live={!deviceOffline && run.sensor_status === 'online'}
          />

          <div className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: 'white' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
                  {pick('Prove delle api infette', 'Infected Bee Evidence')}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                  {pick(
                    'Classificazioni dell\'ultimo batch completato',
                    'Image-level classifications from the latest completed batch'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                <HeartPulse size={14} />
                {pick('Ultimo heartbeat', 'Last heartbeat')} {formatTimestamp(run.updated_at, language)}
              </div>
            </div>

            {evidence.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {evidence.map(item => (
                  <button
                    key={item.path}
                    onClick={() => setSelectedImage(item)}
                    className="group text-left rounded-xl overflow-hidden border transition-all hover:shadow-md hover:-translate-y-0.5"
                    style={{ borderColor: '#f3f4f6', backgroundColor: '#f9fafb' }}
                  >
                    <div className="aspect-[4/5] overflow-hidden relative">
                      <img
                        src={item.public_url}
                        alt={`${pick('Ape infetta', 'Infected bee')} ${item.filename}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                        <ExternalLink size={20} color="white" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-semibold text-gray-700 truncate" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                        {item.filename}
                      </p>
                      <p className="text-[11px] mt-0.5 text-gray-400" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                        {formatShotTimestamp(item.capturedAt, language)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl p-8 flex flex-col items-center text-center" style={{ backgroundColor: '#f9fafb' }}>
                <ImageIcon size={30} color="#9ca3af" />
                <p className="text-sm text-gray-400 mt-2" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
                  {pick('I metadati delle prove non sono ancora arrivati.', 'Evidence metadata has not arrived yet.')}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-3xl p-5 shadow-2xl"
            style={{ backgroundColor: 'white' }}
            onClick={event => event.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 rounded-full p-2 bg-white shadow"
              aria-label={pick('Chiudi immagine di prova', 'Close evidence image')}
            >
              <X size={18} color="#374151" />
            </button>
            <img
              src={selectedImage.public_url}
              alt={`${pick('Dimensione completa', 'Full size')} ${selectedImage.filename}`}
              className="w-full max-h-[70vh] object-contain rounded-2xl"
            />
            <div className="mt-4">
              <p className="font-semibold text-gray-700" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
                {selectedImage.filename}
              </p>
            </div>
            <p className="text-sm text-gray-400 mt-2" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
              {pick('Scattata il', 'Captured on')} {formatShotTimestamp(selectedImage.capturedAt, language)}
            </p>
          </div>
        </div>
      )}

      {!isSupabaseConfigured && (
        <p className="sr-only">
          {pick('Configurazione Supabase mancante.', 'Supabase configuration is missing.')}
        </p>
      )}
    </main>
  );
}
