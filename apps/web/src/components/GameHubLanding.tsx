import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MuteButton } from '@/components/MuteButton';
import { NicknameDialog } from '@/components/NicknameDialog';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import {
  WlBtn,
  WlPager,
  WlPanel,
  WordsLanding,
  type WordsGame,
} from '@/games/words/landing/WordsLanding';
import { useOnline } from '@/lib/network';
import { HubRanking } from '@/components/HubRanking';
import { HubDailyBoard, HubDailyPanel, useDailyData } from '@/components/HubDaily';
import type { ReactNode } from 'react';
import { useRoomEntry } from '@/lib/my-room';
import type { RoomGame } from '@/lib/rooms';

/** Um modo de partida do hub: nome, frase curta, explicação, números das regras e o recorde. */
export interface HubMode {
  id: string;
  label: string;
  sub: string;
  lead: string;
  rules: [string, string][];
  record?: string | null;
  /** Modo que só existe em sala (ex.: Intruso): o botão cria uma sala em vez de jogar. */
  roomGame?: RoomGame;
}

type Screen = 'main' | 'daily' | 'ranking' | 'modes' | 'mode' | 'friends' | 'rules' | 'settings';

/**
 * O hub de um jogo de rodadas (Mesmíssima, Já Deu?, Ecooo), no estilo das telas de jogo (spec 067): Daily em destaque, modos de
 * jogo, jogar com amigos, como jogar de cada modo e configurações. O Daily e as partidas seguem nas telas de sempre.
 */
export function GameHubLanding({
  game,
  roomGame,
  modes,
  dailyNote,
  dailyDone,
  dailyIntro,
  onStart,
  busy = false,
  error = '',
  initial = 'main',
}: {
  game: WordsGame;
  /** Jogo da sala ao criar com amigos. */
  roomGame: RoomGame;
  modes: HubMode[];
  dailyNote: string;
  dailyDone: boolean;
  /** Regras do dia mostradas antes de jogar. */
  dailyIntro?: { rules: { value: string; label: string }[]; text: ReactNode };
  onStart: (id: string) => void;
  busy?: boolean;
  error?: string;
  initial?: 'main' | 'friends' | 'modes' | 'daily';
}) {
  const navigate = useNavigate();
  const online = useOnline();
  const entry = useRoomEntry();
  const [screen, setScreen] = useState<Screen>(initial);
  const [modeId, setModeId] = useState<string>(modes[0]!.id);
  const [code, setCode] = useState('');
  const dailyData = useDailyData(roomGame as 'color' | 'time' | 'eco', screen === 'daily');
  const mode = modes.find((m) => m.id === modeId) ?? modes[0]!;

  const back = () => {
    entry.dismissConflict?.();
    if (screen === 'main') void navigate({ to: '/' });
    else if (screen === 'mode') setScreen('modes');
    else setScreen('main');
  };
  const join = (e: FormEvent) => {
    e.preventDefault();
    void entry.join(code);
  };

  let left;
  let right;
  if (screen === 'main') {
    left = (
      <nav className="gx-menu" aria-label="Menu do jogo" data-testid="wl-main">
        <WlBtn
          main
          title="Daily"
          sub={dailyNote}
          onClick={() => setScreen('daily')}
          sfx="start"
          testid="menu-daily"
        />
        <WlBtn
          title="Modos de jogo"
          sub={`${modes.length} modos`}
          onClick={() => setScreen('modes')}
          sfx="start"
          testid="menu-modes"
        />
        <WlBtn
          title="Jogar com amigos"
          sub="criar sala ou entrar"
          onClick={() => setScreen('friends')}
          sfx="start"
          testid="menu-friends"
        />
        <WlBtn
          title="Ranking"
          sub="por modo"
          onClick={() => setScreen('ranking')}
          testid="menu-ranking"
        />
        <WlBtn
          title="Como jogar"
          sub="cada modo explicado"
          onClick={() => setScreen('rules')}
          testid="menu-rules"
        />
        <WlBtn
          title="Configurações"
          sub="som do jogo"
          onClick={() => setScreen('settings')}
          testid="menu-settings"
        />
        <div className="gx-gap" />
        <WlBtn danger title="Voltar aos jogos" onClick={back} sfx="back" testid="wl-exit" />
      </nav>
    );
  } else if (screen === 'daily') {
    left = (
      <HubDailyPanel
        game={roomGame as 'color' | 'time' | 'eco'}
        data={dailyData}
        intro={dailyIntro}
        busy={busy}
        error={error}
        onPlay={() => onStart('daily')}
        onBack={back}
      />
    );
    right = <HubDailyBoard game={roomGame as 'color' | 'time' | 'eco'} data={dailyData} />;
  } else if (screen === 'ranking') {
    left = (
      <WlPanel
        title="Ranking"
        lead="Um quadro para cada modo."
        onBack={back}
        testid="ranking-panel"
      >
        <HubRanking game={roomGame as 'color' | 'time' | 'eco'} />
      </WlPanel>
    );
  } else if (screen === 'modes') {
    left = (
      <WlPanel
        title="Modos de jogo"
        lead={dailyDone ? 'O Daily de hoje já foi feito.' : 'Escolha como jogar.'}
        onBack={back}
        testid="modes-panel"
      >
        <div className="wl-modes">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"

              className="wl-mode"
              data-sfx="select"
              data-testid={`mode-${m.id}`}
              onClick={() => {
                setModeId(m.id);
                setScreen('mode');
              }}
            >
              <b>{m.label}</b>
              <span>{m.sub}</span>
              {m.record && <small>{m.record}</small>}
            </button>
          ))}
        </div>
      </WlPanel>
    );
  } else if (screen === 'mode') {
    left = (
      <WlPanel
        title={mode.label}
        lead={mode.sub.toLowerCase()}
        onBack={back}
        testid={`mode-panel-${mode.id}`}
      >
        {mode.record && (
          <div className="wl-state">
            <b>{mode.record}</b>
          </div>
        )}
        {(error || entry.error) && (
          <p className="gx-err" role="alert">
            {mode.roomGame ? entry.error : error}
          </p>
        )}
        {mode.roomGame ? (
          <button
            type="button"
            className="wl-cta"
            data-sfx="start"
            disabled={entry.busy}
            onClick={() => void entry.create(mode.roomGame!)}
            data-testid={`play-${mode.id}`}
          >
            <span>{entry.busy ? 'Criando...' : 'Criar sala'}</span>
            <small>→</small>
          </button>
        ) : (
          <button
            type="button"
            className="wl-cta"
            data-sfx="start"
            disabled={busy}
            onClick={() => onStart(mode.id)}
            data-testid={`play-${mode.id}`}
          >
            <span>{busy ? 'Preparando...' : 'Jogar'}</span>
            <small>→</small>
          </button>
        )}
      </WlPanel>
    );
    right = (
      <div className="wl-board" data-testid={`mode-board-${mode.id}`}>
        <h3>{mode.label}</h3>
        <div className="wl-rulechips">
          {mode.rules.map(([big, small]) => (
            <div key={small}>
              <b>{big}</b>
              {small}
            </div>
          ))}
        </div>
        <p>{mode.lead}</p>
      </div>
    );
  } else if (screen === 'friends') {
    left = (
      <WlPanel
        title="Com amigos"
        lead="Todo mundo na mesma sala, jogando junto."
        onBack={back}
        testid="friends-panel"
      >
        {!online ? (
          <div className="wl-state lost">
            <b>Sem internet</b>
            <span>A sala precisa de conexão. Você ainda pode jogar sozinho nos modos de jogo.</span>
          </div>
        ) : (
          <>
            {entry.error && (
              <p className="gx-err" role="alert">
                {entry.error}
              </p>
            )}
            <button
              type="button"
              className="wl-cta"
              data-sfx="start"
              disabled={entry.busy}
              onClick={() => void entry.create(roomGame)}
              data-testid="friends-create"
            >
              <span>{entry.busy ? 'Criando...' : 'Criar sala'}</span>
              <small>→</small>
            </button>
            <form className="wl-form" onSubmit={join} noValidate>
              <label className="lead" htmlFor="hub-code">
                Entrar com código
              </label>
              <input
                id="hub-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={4}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                placeholder="A B C D"
                data-testid="friends-code"
              />
              <button
                type="submit"
                className="gx-enter"
                disabled={entry.busy || code.trim().length < 4}
                data-sfx="start"
                data-testid="friends-join"
              >
                {entry.busy ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </>
        )}
      </WlPanel>
    );
    right = (
      <div className="wl-board">
        <h3>Como funciona a sala</h3>
        <p>
          Você cria a sala e vira o host: define as regras e chama os amigos pelo código ou pelo
          convite. De 2 a 12 pessoas, e quem somar mais pontos vence.
        </p>
      </div>
    );
  } else if (screen === 'rules') {
    left = (
      <WlPanel title="Como jogar" onBack={back} testid="rules">
        <WlPager
          testid="rules-pager"
          pages={modes.map((m) => ({
            title: m.label,
            body: (
              <>
                <p>{m.lead}</p>
                <div className="wl-rulechips">
                  {m.rules.map(([big, small]) => (
                    <div key={small}>
                      <b>{big}</b>
                      {small}
                    </div>
                  ))}
                </div>
              </>
            ),
          }))}
        />
      </WlPanel>
    );
  } else {
    left = (
      <WlPanel title="Configurações" onBack={back} testid="wl-settings">
        <div className="gx-row">
          <span>Som do jogo</span>
          <MuteButton />
        </div>
        <p className="lead">O recorde e o histórico ficam na sua conta.</p>
      </WlPanel>
    );
  }

  return (
    <>
      <WordsLanding
        game={game}
        screen={screen}
        onBack={back}
        left={left}
        right={right}
        pane={screen === 'modes' || screen === 'ranking' ? 'levels' : 'show'}
      />
      <NicknameDialog nick={entry.nick} />
      <RoomConflictDialog
        open={!!entry.conflict}
        code={entry.conflict?.code ?? null}
        onBack={entry.backToCurrent}
        onLeave={() => void entry.leaveAndContinue()}
        onCancel={entry.dismissConflict}
      />
    </>
  );
}
