import { useState, type FormEvent } from 'react';
import { Field } from '@/components/Field';
import { LoadFailed } from '@/components/LoadFailed';
import { useOnline } from '@/lib/network';
import { PlayGate } from '@/components/PlayGate';
import { GAME_LABEL } from '@/components/GameArt';
import { RoomBanner } from '@/components/RoomBanner';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useRoomEntry } from '@/lib/my-room';
import type { GameId } from '@/lib/stats';
import './friends-panel.css';

const RULES: Record<GameId, string[]> = {
  color: [
    'Todo mundo vê a mesma cor ao mesmo tempo e recria de memória.',
    'O host escolhe rodadas, tempo para decorar e tempo para recriar.',
    'De 2 a 12 pessoas. Vence quem somar mais pontos.',
  ],
  time: [
    'Todo mundo recebe o mesmo alvo e conta de cabeça, cada um no seu relógio.',
    'O host escolhe as rodadas e se passar do alvo vale zero.',
    'De 2 a 12 pessoas. O servidor mede o tempo de cada um.',
  ],
  eco: [
    'Clássico, Escalada, Velocidade e Reverso: todo mundo joga a MESMA sequência, um de cada vez, em fila. Na sua vez você repete tudo e a sequência ganha um passo para o próximo. Errou, sai; vence quem sobrar.',
    'Siga o Líder: um cria a sequência dentro de regras, os outros repetem, e a cada rodada o criador muda.',
    'Dentro da sala o host escolhe o modo (Clássico, Escalada, Velocidade, Reverso ou Siga o Líder).',
    'De 2 a 12 pessoas.',
  ],
};

/** Jogar com amigos: criar sala deste jogo ou entrar pelo código. A sala em si abre em /sala. */
export function FriendsPanel({ game }: { game: GameId }) {
  const online = useOnline();
  const entry = useRoomEntry();
  const [code, setCode] = useState('');

  const join = (e: FormEvent) => {
    e.preventDefault();
    void entry.join(code);
  };

  if (!online) {
    return (
      <LoadFailed
        what="as salas"
        offlineText="Sem internet não dá para jogar com amigos: a sala precisa de conexão. Você ainda pode jogar sozinho nos Modos de partida."
      />
    );
  }

  return (
    <div className="fp">
      <PlayGate what="jogar em sala">
        <RoomBanner />
        <section className="fp-card">
          <h2 className="fp-h">Criar sala de {GAME_LABEL[game]}</h2>
          <p className="fp-text">
            Você vira o host, define as regras e chama os amigos pelo código ou convite.
          </p>
          <button
            type="button"
            className="btn alt"
            data-sfx="start"
            disabled={entry.busy}
            onClick={() => void entry.create(game)}
          >
            {entry.busy ? 'Criando...' : 'Criar sala'}
          </button>
        </section>
        <section className="fp-card">
          <h2 className="fp-h">Entrar com código</h2>
          <form className="fp-join" onSubmit={join} noValidate>
            <Field
              label="Código da sala"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                entry.clearError();
              }}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              hint="4 letras, como ABCD"
              error={entry.error || undefined}
            />
            <button type="submit" className="btn ghost" data-sfx="roomJoin" disabled={entry.busy}>
              Entrar
            </button>
          </form>
        </section>
        <RoomConflictDialog
          open={!!entry.conflict}
          code={entry.conflict?.code ?? null}
          onBack={entry.backToCurrent}
          onLeave={() => void entry.leaveAndContinue()}
          onCancel={entry.dismissConflict}
        />
      </PlayGate>
      <section className="fp-rules" aria-label="Como funciona">
        <div className="mono fp-rules-title">COMO FUNCIONA</div>
        <ul>
          {RULES[game].map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mono fp-note">Partida de sala não entra no ranking.</p>
      </section>
    </div>
  );
}
