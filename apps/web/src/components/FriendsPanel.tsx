import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Field } from '@/components/Field';
import { LoadFailed } from '@/components/LoadFailed';
import { useOnline } from '@/lib/network';
import { PlayGate } from '@/components/PlayGate';
import { GAME_LABEL } from '@/components/GameArt';
import { CODE_RE } from '@/lib/rooms';
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
    'Corrida: todos veem a mesma sequência ao mesmo tempo e repetem; quem erra ou demora vira plateia, e vence quem sobrar.',
    'O host escolhe o modo: Clássico, Escalada, Velocidade ou Reverso.',
    'De 2 a 12 pessoas. (O Siga o Líder chega depois.)',
  ],
};

/** Jogar com amigos: criar sala deste jogo ou entrar pelo código. A sala em si abre em /sala. */
export function FriendsPanel({ game }: { game: GameId }) {
  const online = useOnline();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!CODE_RE.test(c)) return setError('O código tem 4 letras.');
    void navigate({ to: '/sala/$code', params: { code: c } });
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
        <section className="fp-card">
          <h2 className="fp-h">Criar sala de {GAME_LABEL[game]}</h2>
          <p className="fp-text">
            Você vira o host, define as regras e chama os amigos pelo código ou convite.
          </p>
          <button
            type="button"
            className="btn alt"
            data-sfx="start"
            onClick={() => void navigate({ to: '/sala', search: { jogo: game } })}
          >
            Criar sala
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
                setError('');
              }}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              hint="4 letras, como ABCD"
              error={error || undefined}
            />
            <button type="submit" className="btn ghost" data-sfx="roomJoin">
              Entrar
            </button>
          </form>
        </section>
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
