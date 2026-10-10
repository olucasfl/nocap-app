import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { BackButton } from '@/components/BackButton';
import { Field } from '@/components/Field';
import { RoomBanner } from '@/components/RoomBanner';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useRoomEntry } from '@/lib/my-room';
import { useAuth } from '@/lib/auth';

export function NocapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const entry = useRoomEntry();
  const [code, setCode] = useState('');

  const join = (e: FormEvent) => {
    e.preventDefault();
    void entry.join(code);
  };

  const createRoom = () => {
    if (!user) {
      void navigate({ to: '/entrar' });
      return;
    }
    void entry.create('party');
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
        <RoomBanner />
        <div className="stack">
          <button type="button" className="btn alt" disabled={entry.busy} onClick={createRoom}>
            {entry.busy ? 'Criando...' : 'Criar sala'}
          </button>
        </div>
        <form className="rm-join" onSubmit={join} noValidate>
          <Field
            label="Entrar com código"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              entry.clearError();
            }}
            error={entry.error || undefined}
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            hint="4 letras, como ABCD"
          />
          <button type="submit" className="btn ghost" disabled={entry.busy}>
            Entrar
          </button>
        </form>
        <RoomConflictDialog
          open={!!entry.conflict}
          code={entry.conflict?.code ?? null}
          onBack={entry.backToCurrent}
          onLeave={() => void entry.leaveAndContinue()}
          onCancel={entry.dismissConflict}
        />
      </section>
    </div>
  );
}
