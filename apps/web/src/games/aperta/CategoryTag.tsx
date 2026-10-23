import { GRIMOIRE_CATEGORIES, type GrimoireCategory } from '@nocap/games';
import './category.css';

/** A categoria do grimório na carta ("Toque", "Objetos", "Geradores", "Energia e sorte"): o que ele ajuda, à vista. */
const ICON: Record<GrimoireCategory, string> = {
  touch: 'M9 11V5.5a2 2 0 0 1 4 0V10l4 1.2V16l-2.5 4H9.5L6 14.5l3-1.2z',
  objects: 'M12 3l2.6 5.8 6.4.7-4.8 4.3 1.4 6.2L12 16.8 6.4 20l1.4-6.2L3 9.5l6.4-.7z',
  generators: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2L19 19M19 5l-2.8 2.8M7.8 16.2L5 19',
  luck: 'M13 2L5 13.5h6L10 22l9-12h-6z',
};

/** Com `compact` a categoria vira só um ícone redondo na cor dela (o nome fica no title e no leitor de tela). */
export function CategoryTag({ category, compact = false }: { category: GrimoireCategory; compact?: boolean }) {
  const def = GRIMOIRE_CATEGORIES.find((c) => c.id === category);
  if (!def) return null;
  if (compact) {
    return (
      <span className="ap-cat-ico" data-cat={category} title={`${def.label}: ${def.hint}`} role="img" aria-label={`Categoria: ${def.label}`}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path d={ICON[category]} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="ap-cat" data-cat={category} title={def.hint}>
      {def.label}
    </span>
  );
}
