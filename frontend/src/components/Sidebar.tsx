import { Activity, FileText } from 'lucide-react';

export type ViewType = 'realtime' | 'daily';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside
      className="fixed left-0 top-0 h-full w-24 md:w-32 flex flex-col items-center py-6 z-50 shadow-sm"
      style={{ backgroundColor: 'white' }}
    >
      {/* Logo at top */}
      <div
        className="rounded-2xl p-2.5 flex items-center justify-center shadow-sm mb-8"
        style={{ backgroundColor: '#6B2D8C' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2Z" />
        </svg>
      </div>

      {/* Navigation items */}
      <nav className="flex flex-col gap-3 flex-1">
        <button
          onClick={() => onViewChange('realtime')}
          className={`group relative flex flex-col items-center justify-center gap-2 w-20 md:w-28 rounded-2xl py-3 px-2 transition-all ${
            currentView === 'realtime'
              ? 'shadow-sm'
              : 'hover:bg-gray-50'
          }`}
          style={{
            backgroundColor: currentView === 'realtime' ? '#f5f0f8' : 'transparent',
          }}
          title="Realtime Metrics"
        >
          <Activity
            size={20}
            strokeWidth={2.5}
            color={currentView === 'realtime' ? '#6B2D8C' : '#9ca3af'}
          />
          <span
            className="text-xs md:text-sm font-medium text-center leading-tight"
            style={{
              color: currentView === 'realtime' ? '#6B2D8C' : '#9ca3af',
              fontFamily: 'Afacad Flux, sans-serif',
            }}
          >
            Realtime
          </span>
        </button>

        <button
          onClick={() => onViewChange('daily')}
          className={`group relative flex flex-col items-center justify-center gap-2 w-20 md:w-28 rounded-2xl py-3 px-2 transition-all ${
            currentView === 'daily'
              ? 'shadow-sm'
              : 'hover:bg-gray-50'
          }`}
          style={{
            backgroundColor: currentView === 'daily' ? '#f5f0f8' : 'transparent',
          }}
          title="Daily Report"
        >
          <FileText
            size={20}
            strokeWidth={2.5}
            color={currentView === 'daily' ? '#6B2D8C' : '#9ca3af'}
          />
          <span
            className="text-xs md:text-sm font-medium text-center leading-tight"
            style={{
              color: currentView === 'daily' ? '#6B2D8C' : '#9ca3af',
              fontFamily: 'Afacad Flux, sans-serif',
            }}
          >
            Daily
          </span>
        </button>
      </nav>
    </aside>
  );
}
