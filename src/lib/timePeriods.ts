import type { Language } from '../i18n/LanguageContext';

export interface TimeSlot {
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

export function getTimeSlots(language: Language): TimeSlot[] {
  const localize = (italian: string, english: string) =>
    language === 'it' ? italian : english;

  return [
    {
      start: 6,
      end: 11,
      label: localize('Mattina', 'Morning'),
      time: '06:00 - 11:00',
      fill: '#fef9e7',
      textColor: '#b45309',
      icon: 'sunrise',
      description: localize(
        'Ripresa intensa delle attività. Le bottinatrici raccolgono nettare e polline fresco.',
        'Activity rises quickly as foragers collect fresh nectar and pollen.'
      ),
    },
    {
      start: 14,
      end: 16,
      label: localize('Primo pomeriggio', 'Early afternoon'),
      time: '14:00 - 16:00',
      fill: '#fef3c7',
      textColor: '#a16207',
      icon: 'sun',
      description: localize(
        'Picco di calore giornaliero. Monitorare ventilazione e stabilità dei voli.',
        'Daily heat peak. Monitor ventilation and flight stability.'
      ),
    },
    {
      start: 16,
      end: 19,
      label: localize('Volo della regina', 'Queen flight'),
      time: '16:00 - 19:00',
      fill: '#fde8c8',
      textColor: '#b45309',
      icon: 'crown',
      description: localize(
        "Finestra critica per il volo nuziale della regina e l'orientamento dei giovani fuchi.",
        'Critical window for the queen mating flight and orientation of young drones.'
      ),
      warning: localize(
        "Evitare urti, aperture o altri disturbi fisici dell'alveare.",
        'Avoid impacts, opening the hive, or other physical disturbance.'
      ),
    },
    {
      start: 19,
      end: 24,
      label: localize('Sera', 'Evening'),
      time: '19:00 - 24:00',
      fill: '#dce8f5',
      textColor: '#3b82f6',
      icon: 'moon',
      description: localize(
        'Rientro delle api, riposo, ventilazione notturna e termoregolazione.',
        'Bees return for rest, night ventilation, and thermoregulation.'
      ),
    },
  ];
}
