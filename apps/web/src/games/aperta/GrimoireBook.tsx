import { AstroMedal } from './AstroMedal';
import type { AstroId } from './astros';
import { GEM_SLOTS, RARITY_GEMS, RARITY_LABEL, type Rarity } from './rarity';

export type BookSize = 'sm' | 'md' | 'lg';

type Props = {
  rarity: Rarity;
  astro: AstroId;
  /** Texto da plaquinha (nome curto). */
  name: string;
  /** Livro escondido: medalha de cadeado e "???". */
  locked?: boolean;
  size?: BookSize;
  /** Desliga brilho, anel e flutuação (listas longas). */
  still?: boolean;
  className?: string;
};

const SLOTS = Array.from({ length: GEM_SLOTS }, (_, i) => i);

/** Livro de grimório: lombada, bandas, moldura, medalha, plaquinha, gemas e fita. Puramente visual. */
export function GrimoireBook({
  rarity,
  astro,
  name,
  locked = false,
  size = 'md',
  still = false,
  className,
}: Props) {
  const gems = locked ? 0 : RARITY_GEMS[rarity];
  const label = locked ? 'Grimório escondido' : `Grimório ${name}, ${RARITY_LABEL[rarity].toLowerCase()}`;
  const cls = [
    'ap-book',
    `ap-book--${locked ? 'locked' : rarity}`,
    `ap-book--${size}`,
    still ? 'is-still' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="img" aria-label={label} data-rarity={locked ? 'locked' : rarity}>
      <i className="ap-book-band ap-book-band--1" />
      <i className="ap-book-band ap-book-band--2" />
      <i className="ap-book-band ap-book-band--3" />
      <i className="ap-book-frame" />
      <span className="ap-book-medal">
        <AstroMedal astro={locked ? 'lock' : astro} />
      </span>
      {rarity === 'proibido' && !locked && (
        <svg className="ap-book-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M70 0l-8 18 10 8-12 16 8 10-6 22" />
          <path d="M18 100l10-22-8-10 14-12-6-14" />
        </svg>
      )}
      <span className="ap-book-plate">{locked ? '???' : name}</span>
      <span className="ap-book-gems" aria-hidden="true">
        {SLOTS.map((i) => (
          <i key={i} className={i < gems ? 'on' : undefined} />
        ))}
      </span>
      <i className="ap-book-ribbon" />
      <i className="ap-book-shine" />
    </div>
  );
}
