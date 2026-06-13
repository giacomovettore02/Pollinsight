import EnvironmentalMetricChart from './EnvironmentalMetricChart';

export interface EnvironmentSample {
  bootId: string;
  timestamp: string;
  temperature: number;
  humidity: number;
}

interface EnvironmentChartProps {
  samples: EnvironmentSample[];
  live: boolean;
}

export default function EnvironmentChart({ samples, live }: EnvironmentChartProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <EnvironmentalMetricChart
        mode="live"
        metric="temperature"
        values={samples.map(sample => ({
          timestamp: sample.timestamp,
          value: sample.temperature,
        }))}
        live={live}
      />
      <EnvironmentalMetricChart
        mode="live"
        metric="humidity"
        values={samples.map(sample => ({
          timestamp: sample.timestamp,
          value: sample.humidity,
        }))}
        live={live}
      />
    </div>
  );
}
