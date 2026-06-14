import { Activity, FileText, FlaskConical } from 'lucide-react';
import LanguageSwitch from './LanguageSwitch';
import { useLanguage } from '../i18n/LanguageContext';

export type ViewType = 'realtime' | 'daily' | 'demo';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { pick } = useLanguage();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-24 md:w-32 flex flex-col items-center py-6 z-50 shadow-sm"
      style={{ backgroundColor: 'white' }}
    >
      <div className="flex items-center justify-center w-full mb-8 px-1.5">
        <img
          src="/pollinsight-logo.png"
          alt="PollinSight"
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Navigation items */}
      <nav className="flex flex-col gap-3 flex-1 w-full px-2">
        <button
          onClick={() => onViewChange('realtime')}
          className={`group relative flex items-center justify-start gap-3 w-full rounded-2xl py-3 px-3 transition-all ${currentView === 'realtime'
              ? 'shadow-sm'
              : 'hover:bg-gray-50'
            }`}
          style={{
            backgroundColor: currentView === 'realtime' ? '#f5f0f8' : 'transparent',
          }}
          title={pick('Metriche in tempo reale', 'Live metrics')}
        >
          <Activity
            size={20}
            strokeWidth={2.5}
            color={currentView === 'realtime' ? '#6B2D8C' : '#9ca3af'}
            className="flex-shrink-0"
          />
          <span
            className="text-xs md:text-sm font-medium leading-tight hidden md:block"
            style={{
              color: currentView === 'realtime' ? '#6B2D8C' : '#9ca3af',
              fontFamily: 'Afacad Flux, sans-serif',
            }}
          >
            {pick('Attività', 'Activity')}
          </span>
        </button>

        <button
          onClick={() => onViewChange('daily')}
          className={`group relative flex items-center justify-start gap-3 w-full rounded-2xl py-3 px-3 transition-all ${currentView === 'daily'
              ? 'shadow-sm'
              : 'hover:bg-gray-50'
            }`}
          style={{
            backgroundColor: currentView === 'daily' ? '#f5f0f8' : 'transparent',
          }}
          title={pick('Rapporto giornaliero', 'Daily report')}
        >
          <FileText
            size={20}
            strokeWidth={2.5}
            color={currentView === 'daily' ? '#6B2D8C' : '#9ca3af'}
            className="flex-shrink-0"
          />
          <span
            className="text-xs md:text-sm font-medium leading-tight hidden md:block"
            style={{
              color: currentView === 'daily' ? '#6B2D8C' : '#9ca3af',
              fontFamily: 'Afacad Flux, sans-serif',
            }}
          >
            Report
          </span>
        </button>

        <button
          onClick={() => onViewChange('demo')}
          className={`group relative flex items-center justify-start gap-3 w-full rounded-2xl py-3 px-3 transition-all ${currentView === 'demo'
              ? 'shadow-sm'
              : 'hover:bg-gray-50'
            }`}
          style={{
            backgroundColor: currentView === 'demo' ? '#f5f0f8' : 'transparent',
          }}
          title="Raspberry Pi Demo"
        >
          <FlaskConical
            size={20}
            strokeWidth={2.5}
            color={currentView === 'demo' ? '#6B2D8C' : '#9ca3af'}
            className="flex-shrink-0"
          />
          <span
            className="text-xs md:text-sm font-medium leading-tight hidden md:block"
            style={{
              color: currentView === 'demo' ? '#6B2D8C' : '#9ca3af',
              fontFamily: 'Afacad Flux, sans-serif',
            }}
          >
            Demo
          </span>
        </button>
      </nav>
      <LanguageSwitch />
    </aside>
  );
}
