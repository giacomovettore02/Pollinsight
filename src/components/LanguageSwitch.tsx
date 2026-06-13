import { Languages } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function LanguageSwitch() {
  const { language, setLanguage, pick } = useLanguage();

  return (
    <div className="w-full px-2">
      <div
        className="rounded-2xl p-1 shadow-sm"
        style={{ backgroundColor: '#f5f0f8' }}
        aria-label={pick('Seleziona lingua', 'Select language')}
      >
        <div className="flex items-center justify-center gap-1 mb-1 md:mb-1.5">
          <Languages size={13} color="#6B2D8C" />
          <span
            className="hidden md:block text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: '#6B2D8C', fontFamily: 'Afacad Flux, sans-serif' }}
          >
            {pick('Lingua', 'Language')}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {(['it', 'en'] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setLanguage(option)}
              aria-pressed={language === option}
              className="rounded-xl py-1.5 text-[10px] md:text-xs font-bold transition-all"
              style={{
                backgroundColor: language === option ? 'white' : 'transparent',
                color: language === option ? '#6B2D8C' : '#9ca3af',
                fontFamily: 'Afacad Flux, sans-serif',
                boxShadow: language === option ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
