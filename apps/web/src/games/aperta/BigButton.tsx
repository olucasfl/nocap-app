import type { ButtonHTMLAttributes } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  /** Força o visual afundado (o :active já afunda sozinho). */
  pressed?: boolean;
  /** Destaque do tutorial: halo dourado que pulsa só em opacity. */
  highlight?: boolean;
  /** Medida CSS do botão inteiro. Padrão: 54vmin, no máximo 330px. */
  size?: string;
  label?: string;
};

/** O botão vermelho sobre a base metálica da Perigeu. */
export function BigButton({
  pressed = false,
  highlight = false,
  size = 'min(54vmin, 330px)',
  label = 'Apertar o botão',
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <span className="ap-bigbtn-wrap" style={{ width: size }}>
      <span className="ap-bigbtn-shadow" aria-hidden="true" />
      <span className="ap-bigbtn-base" aria-hidden="true" />
      <span className="ap-bigbtn-stem" aria-hidden="true" />
      {highlight && <span className="ap-bigbtn-halo" aria-hidden="true" />}
      <button
        {...rest}
        type={type}
        aria-label={label}
        className={`ap-bigbtn${pressed ? ' is-down' : ''}${className ? ` ${className}` : ''}`}
      />
    </span>
  );
}
