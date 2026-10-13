import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Field } from './Field';
import './confirm-dialog.css';

interface Nick {
  open: boolean;
  error: string;
  initial: string;
  submit: (nickname: string) => void;
  cancel: () => void;
}

/**
 * "Coloque seu apelido": quem joga a sala sem conta escolhe como aparecer. O apelido vale só na
 * sala e quem tem conta nunca vê este diálogo.
 */
export function NicknameDialog({ nick }: { nick: Nick }) {
  const [value, setValue] = useState(nick.initial);
  const input = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nick.open) return;
    setValue(nick.initial);
    input.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && nick.cancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [nick.open]);

  if (!nick.open) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    nick.submit(value);
  };
  return (
    <div className="cd-backdrop" onClick={nick.cancel}>
      <form
        className="cd"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nick-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        noValidate
      >
        <h2 id="nick-title" className="cd-title">
          Coloque seu apelido
        </h2>
        <p className="cd-text">
          Você está sem conta. O apelido vale só nesta sala, para os outros saberem quem é você.
          Nada da partida fica salvo.
        </p>
        <div ref={input}>
          <Field
            label="Apelido"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={16}
            autoComplete="off"
            autoCorrect="off"
            hint="De 2 a 16 letras, números, espaço, ponto, traço ou sublinhado"
            error={nick.error || undefined}
          />
        </div>
        <div className="cd-actions">
          <button
            type="submit"
            className="btn alt"
            data-sfx="roomJoin"
            disabled={value.trim().length < 2}
          >
            Entrar na sala
          </button>
          <button type="button" className="btn ghost" data-sfx="back" onClick={nick.cancel}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
