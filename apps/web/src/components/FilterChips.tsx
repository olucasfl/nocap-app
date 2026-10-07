import './filter-chips.css';

/**
 * Um grupo de filtro de escolha única, em "pílulas" que quebram de linha (tudo visível, sem
 * rolagem lateral). A opção ligada fica preenchida; tocar na ligada não desliga (use "Todos").
 */
export function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="fc">
      <div className="mono fc-label">{label}</div>
      <div className="fc-row" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            data-sfx="select"
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
