import { useId, type InputHTMLAttributes } from 'react';
import './field.css';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/** Campo de formulário Pop Brutal: rótulo, input e erro ligados por aria. */
export function Field({ label, error, hint, ...input }: Props) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label mono">
        {label}
      </label>
      <input
        id={id}
        className="field-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? `${id}-note` : undefined}
        {...input}
      />
      {note && (
        <p
          id={`${id}-note`}
          className={`field-note mono${error ? ' err' : ''}`}
          role={error ? 'alert' : undefined}
        >
          {note}
        </p>
      )}
    </div>
  );
}
