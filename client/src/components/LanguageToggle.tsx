import { useTranslation } from 'react-i18next';

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('de') ? 'de' : 'en';

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {(['en', 'de'] as const).map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          style={{
            background: 'none',
            padding: '2px 6px',
            fontSize: 11,
            fontWeight: current === lng ? 700 : 400,
            color: current === lng ? 'var(--accent)' : 'var(--text-dim)',
            borderRadius: 4,
            border: `1px solid ${current === lng ? 'var(--accent)' : 'transparent'}`,
            cursor: 'pointer',
            lineHeight: 1.4,
            textTransform: 'uppercase',
          }}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
