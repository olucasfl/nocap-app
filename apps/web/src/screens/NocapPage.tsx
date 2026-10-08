import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { BackButton } from '@/components/BackButton';
import { Field } from '@/components/Field';
import { CODE_RE } from '@/lib/rooms';
import { useAuth } from '@/lib/auth';

export function NocapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [error] = useState('');
  const [busy] = useState(false);

  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!CODE_RE.test(c)) return;
    void navigate({ to: '/sala/$code', params: { code: c } });
  };

  const createRoom = () => {
    if (!user) {
      void navigate({ to: '/entrar' });
      return;
    }
    void navigate({ to: '/sala', search: { jogo: 'party' } });
  };

  return (
    <div className="app">
      <header className="top">
        <Link to="/" className="logo" aria-label="Voltar aos jogos">
          no cap<span>!</span>
        </Link>
      </header>
      <section className="screen rm">
        <BackButton to="/" label="Voltar aos jogos" />
        <h1>NoCap!</h1>
        <p className="lead">
          Party game de micro-desafios rápidos e minijogos grandes.
          <br />
          Quem lê rápido e age com precisão ganha de quem vai só no reflexo.
          <br />
          Jogue online com amigos em salas de 2 a 12 pessoas.
        </p>
        {error && (
          <p className="acc-failure mono" role="alert">
            {error}
          </p>
        )}
        <div className="stack">
          <button type="button" className="btn alt" disabled={busy} onClick={createRoom}>
            Criar sala
          </button>
        </div>
        <form className="rm-join" onSubmit={join} noValidate>
          <Field
            label="Entrar com código"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            hint="4 letras, como ABCD"
          />
          <button type="submit" className="btn ghost" disabled={busy}>
            Entrar
          </button>
        </form>
      </section>
    </div>
  );
}
