import { AlertTriangle, TrendingUp, AlertCircle } from 'lucide-react';

interface HealthIndicatorProps {
  totalBees: number;
  temp: number;
  humidity: number;
}

export default function HealthIndicator({ totalBees, temp, humidity }: HealthIndicatorProps) {
  // Determine optimal ranges
  const isTempOptimal = temp >= 34 && temp <= 36; // Optimal for brood
  const isHumidityOptimal = humidity >= 40 && humidity <= 60; // Optimal range
  const isActivityGood = totalBees > 800; // Threshold for good activity

  // Determine health status
  const hasIssue = !isActivityGood && (isTempOptimal || isHumidityOptimal);
  const isCritical = !isActivityGood && !isTempOptimal && !isHumidityOptimal;
  const isHealthy = isActivityGood && isTempOptimal && isHumidityOptimal;

  let alertMessage = '';
  let alertType: 'success' | 'warning' | 'critical' | null = null;
  let alertColor = '';
  let alertBg = '';
  let alertIcon = null;

  if (isCritical) {
    alertMessage = 'Condizioni critiche. Controllare immediatamente le api e l\'ambiente.';
    alertType = 'critical';
    alertColor = '#dc2626';
    alertBg = '#fee2e2';
    alertIcon = <AlertTriangle size={20} strokeWidth={2.5} />;
  } else if (hasIssue) {
    alertMessage = 'Attività bassa nonostante condizioni ambientali favorevoli. Indagare possibili problemi.';
    alertType = 'warning';
    alertColor = '#ff823a';
    alertBg = '#fff0e8';
    alertIcon = <AlertCircle size={20} strokeWidth={2.5} />;
  } else if (isHealthy) {
    alertMessage = 'Alveare in ottime condizioni. Continua il monitoraggio regolare.';
    alertType = 'success';
    alertColor = '#22c55e';
    alertBg = '#f0fdf4';
    alertIcon = <TrendingUp size={20} strokeWidth={2.5} />;
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Total Bees - Vertical Card */}
      <div
        className="rounded-[10px] p-4 shadow-sm flex flex-col items-center justify-between h-40"
        style={{ backgroundColor: '#f5f0f8' }}
      >
        <div className="text-center">
          <p className="text-gray-400 text-xs mb-2" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            Attività Totale
          </p>
          <p
            className="font-bold text-3xl text-center"
            style={{
              color: '#6B2D8C',
              fontFamily: 'Comfortaa, sans-serif',
            }}
          >
            {totalBees.toLocaleString()}
          </p>
        </div>
        <div className="w-8 h-0.5 bg-gray-300 mt-2" />
        <p className="text-xs text-gray-500 mt-2 text-center" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
          {isActivityGood ? 'Buona' : 'Bassa'}
        </p>
      </div>

      {/* Temperature - Vertical Card */}
      <div
        className="rounded-[10px] p-4 shadow-sm flex flex-col items-center justify-between h-40"
        style={{ backgroundColor: '#fffbd9' }}
      >
        <div className="text-center">
          <p className="text-gray-400 text-xs mb-2" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            Temperatura
          </p>
          <p
            className="font-bold text-3xl"
            style={{
              color: '#6B2D8C',
              fontFamily: 'Comfortaa, sans-serif',
            }}
          >
            {temp.toFixed(1)}°
          </p>
        </div>
        <div className="w-8 h-0.5 bg-gray-300 mt-2" />
        <p className="text-xs text-gray-500 mt-2 text-center" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
          {isTempOptimal ? 'Ottimale' : temp > 36 ? 'Calda' : 'Fresca'}
        </p>
      </div>

      {/* Humidity - Vertical Card */}
      <div
        className="rounded-[10px] p-4 shadow-sm flex flex-col items-center justify-between h-40"
        style={{ backgroundColor: '#e6faf5' }}
      >
        <div className="text-center">
          <p className="text-gray-400 text-xs mb-2" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
            Umidità
          </p>
          <p
            className="font-bold text-3xl"
            style={{
              color: '#20C997',
              fontFamily: 'Comfortaa, sans-serif',
            }}
          >
            {humidity}%
          </p>
        </div>
        <div className="w-8 h-0.5 bg-gray-300 mt-2" />
        <p className="text-xs text-gray-500 mt-2 text-center" style={{ fontFamily: 'Afacad Flux, sans-serif' }}>
          {isHumidityOptimal ? 'Ottimale' : humidity > 60 ? 'Alta' : 'Bassa'}
        </p>
      </div>

      {/* Alert Box */}
      {alertType && (
        <div
          className="rounded-[10px] p-4 shadow-sm flex flex-col items-start justify-center h-40"
          style={{ backgroundColor: alertBg }}
        >
          <div className="flex items-start gap-3">
            <div style={{ color: alertColor, display: 'flex', flexShrink: 0, marginTop: '2px' }}>
              {alertIcon}
            </div>
            <p
              className="text-sm leading-tight"
              style={{
                color: '#374151',
                fontFamily: 'Afacad Flux, sans-serif',
              }}
            >
              <span style={{ color: alertColor, fontWeight: 'bold' }}>
                {alertType === 'success' ? 'Tutto bene:' : alertType === 'critical' ? 'Critico:' : 'Attenzione:'}
              </span>{' '}
              {alertMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
