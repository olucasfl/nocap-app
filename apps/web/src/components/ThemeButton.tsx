import { nextTheme, setTheme, useTheme, type ThemePref } from '@/lib/theme';
import { ThemeIcon } from './icons';

const LABEL: Record<ThemePref, string> = {
  light: 'claro',
  dark: 'escuro',
};

export function ThemeButton() {
  const pref = useTheme();
  return (
    <button
      type="button"
      className="chip"
      aria-label={`Tema: ${LABEL[pref]}. Trocar para ${LABEL[nextTheme(pref)]}`}
      onClick={() => setTheme(nextTheme(pref))}
    >
      <ThemeIcon mode={pref} />
    </button>
  );
}
