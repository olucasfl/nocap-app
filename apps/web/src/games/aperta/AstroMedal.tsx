import { ASTRO_LABEL, type AstroId } from './astros';

type Props = {
  astro: AstroId;
  /** Lado em px, ou qualquer medida CSS. Padrão: preenche o pai. */
  size?: number | string;
  /** Cor do aro (qualquer cor CSS). Padrão: --ap-trim do pai, ou o ouro do tema. */
  trim?: string;
  /** Sem rótulo, o SVG é decorativo (aria-hidden). */
  label?: string;
  className?: string;
};

/** Medalhão redondo com o astro em SVG, de esfera com sombreamento radial. Precisa do SpaceArtSprite montado. */
export function AstroMedal({ astro, size = '100%', trim, label, className }: Props) {
  const accessible = label !== undefined;
  return (
    <svg
      className={`ap-medal${className ? ` ${className}` : ''}`}
      viewBox="0 0 72 72"
      width={size}
      height={size}
      role={accessible ? 'img' : undefined}
      aria-label={accessible ? label || ASTRO_LABEL[astro] : undefined}
      aria-hidden={accessible ? undefined : true}
      focusable="false"
      data-astro={astro}
    >
      <circle cx="36" cy="36" r="35" fill="#05060c" opacity=".5" />
      <circle cx="36" cy="36" r="32.5" fill="url(#ap-g-medal-bg)" />
      <circle
        cx="36"
        cy="36"
        r="32.5"
        fill="none"
        strokeWidth="3"
        style={{ stroke: trim ?? 'var(--ap-trim, var(--space-gold))' }}
      />
      <use href={`#ap-art-${astro}`} x="6" y="6" width="60" height="60" />
    </svg>
  );
}
