import { GRIMOIRE_CATEGORIES, type GrimoireCategory } from '@nocap/games';
import './category.css';

/** A categoria do grimório na carta ("Toque", "Objetos", "Geradores", "Energia e sorte"): o que ele ajuda, à vista. */
export function CategoryTag({ category }: { category: GrimoireCategory }) {
  const def = GRIMOIRE_CATEGORIES.find((c) => c.id === category);
  if (!def) return null;
  return (
    <span className="ap-cat" data-cat={category} title={def.hint}>
      {def.label}
    </span>
  );
}
