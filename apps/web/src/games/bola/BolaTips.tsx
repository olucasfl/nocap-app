import { GameTips, type TipRow } from '@/components/GameTips';
import { IcCamera, IcGear, IcJump, Key } from './BolaIcons';

export const BOLA_TIPS_KEY = 'nocap-bola-tips';

/** Os controles do Fut Fox (no celular e no teclado): a primeira partida e o item "Controles" do menu mostram estes. */
export function bolaTipRows(touch: boolean): TipRow[] {
  return touch
    ? [
        {
          keys: <b className="bola-tip-tag">Joystick</b>,
          text: 'Arraste na metade esquerda para mover',
        },
        { keys: <IcJump size={20} />, text: 'Toque em Pular; de novo no ar, pulo duplo' },
        {
          keys: <b className="bola-tip-tag">Correr</b>,
          text: 'Toque em Correr para ligar e desligar. O número é o fôlego (0 a 100): gasta correndo e recarrega devagar',
        },
        {
          keys: <b className="bola-tip-tag">Mortal</b>,
          text: 'Pule duas vezes mexendo o joystick: o mortal chuta a bola',
        },
        {
          keys: <IcCamera size={20} />,
          text: 'A câmera começa solta; o botão prende na bola e solta de novo',
        },
        {
          keys: <IcGear size={20} />,
          text: 'Menu: convidar, tabela, trocar de time, espectar, comandos e sair',
        },
        {
          keys: <b className="bola-tip-tag">Parede</b>,
          text: 'Corra contra a parede para subir; no teto anda de cabeça para baixo. O grude acaba e ela cai (pular solta)',
        },
        {
          keys: <b className="bola-tip-tag">Chat</b>,
          text: 'Botão do balão (em sala): abre e fecha o chat',
        },
      ]
    : [
        {
          keys: (
            <>
              <Key k="W" />
              <Key k="A" />
              <Key k="S" />
              <Key k="D" />
            </>
          ),
          text: 'Mover a raposa',
        },
        { keys: <Key k="Espaço" wide />, text: 'Pular; de novo no ar, pulo duplo' },
        {
          keys: <Key k="Shift" wide />,
          text: 'Segure para correr. A barra é o fôlego (0 a 100): gasta correndo, fica parada um tempo ao soltar e recarrega devagar',
        },
        {
          keys: (
            <>
              <Key k="Espaço" wide />
              <b className="bola-tip-plus">2x</b>
            </>
          ),
          text: 'Com uma direção apertada vira o mortal, que chuta a bola',
        },
        {
          keys: <IcCamera size={20} />,
          text: 'O mouse gira a câmera (clique na tela para prender)',
        },
        { keys: <Key k="F" />, text: 'Prende a câmera na bola ou solta' },
        {
          keys: <b className="bola-tip-tag">Parede</b>,
          text: 'Corra contra a parede para subir; no teto anda de cabeça para baixo. O grude acaba e ela cai (pular solta)',
        },
        { keys: <Key k="Tab" />, text: 'Segure para ver a tabela de estatísticas' },
        { keys: <Key k="Esc" />, text: 'Menu (convidar, times, espectar, comandos, rede, sair)' },
        { keys: <Key k="T" />, text: 'Abre e fecha o chat da sala (Enter também abre; Esc fecha)' },
        {
          keys: (
            <>
              <Key k="Q" />
              <Key k="E" />
            </>
          ),
          text: 'Espectando: troca quem você acompanha (jogadores e a bola)',
        },
      ];
}

/** Controles do jogo, mostrados uma vez só (na primeira partida) por cima da contagem. */
export function BolaTips({ touch }: { touch: boolean }) {
  return (
    <GameTips
      storageKey={BOLA_TIPS_KEY}
      rows={bolaTipRows(touch)}
      testId="bola-tips"
      okTestId="bola-tips-ok"
    />
  );
}
