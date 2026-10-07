import { impostorLimit } from '@nocap/games';
import type { RoomGame, RoomSnapshot } from '@/lib/rooms';

/**
 * As regras do lobby, descritas uma vez só: o líder as edita e os membros as leem a partir
 * da mesma lista, então as duas telas nunca mostram coisas diferentes.
 */

export type RuleValue = string | number;

export interface RuleDef {
  id: string;
  label: string;
  values: RuleValue[];
  current: RuleValue;
  format: (v: RuleValue) => string;
  /** O que mandar ao servidor (`configure`) ao escolher um valor. */
  patch: (v: RuleValue) => Record<string, unknown>;
  /** Frase que explica a opção escolhida. */
  note?: string;
}

const ROUNDS = [1, 3, 5, 7, 10];
const SHOW = [400, 1000, 3000, 5000];
const PICK = [15_000, 30_000, 60_000];
const IMP_ROUNDS = [1, 3, 5];
const LEADER_ROUNDS = [4, 6, 8, 10, 12];
const IMP_PICK = [30_000, 45_000, 60_000];
const IMP_VOTE = [20_000, 30_000, 60_000];
const IMP_COUNT = [1, 2, 3];

/** Quantas pessoas cada jogo precisa para começar. */
export const MIN_PLAYERS: Record<RoomGame, number> = {
  color: 2,
  time: 2,
  impostor: 3,
  eco: 2,
};

export const GAME_NAME: Record<RoomGame, string> = {
  color: 'Mesmíssima',
  time: 'Já Deu?',
  impostor: 'Intruso',
  eco: 'Ecooo',
};

/** "Entra na minha sala ___": com a preposição certa para o convite. */
export const GAME_OF: Record<RoomGame, string> = {
  color: 'da Mesmíssima',
  time: 'de Já Deu?',
  impostor: 'do Intruso',
  eco: 'do Ecooo',
};

/** Modos de cada jogo na sala, com uma linha que explica cada um. */
export const MODES: Record<RoomGame, { id: string; label: string; note: string }[]> = {
  eco: [
    {
      id: 'classic',
      label: 'Clássico',
      note: 'A sequência cresce um passo por rodada. Quem erra ou demora 8 s sai.',
    },
    { id: 'escalada', label: 'Escalada', note: 'A cada 3 rodadas entra um botão novo, até 9.' },
    {
      id: 'velocidade',
      label: 'Velocidade',
      note: 'A sequência acelera a cada rodada. Vai até 30 passos.',
    },
    { id: 'reverso', label: 'Reverso', note: 'Repita de trás para frente.' },
    {
      id: 'leader',
      label: 'Siga o Líder',
      note: 'Um cria a sequência dentro das regras da rodada e os outros repetem. O criador muda a cada rodada.',
    },
  ],
  impostor: [
    {
      id: 'impostor',
      label: 'Intruso',
      note: 'Alguns não veem a cor: só uma dica. Todo mundo recria e vota em quem desconfia.',
    },
  ],
  color: [
    { id: 'classic', label: 'Clássico', note: 'A cor aparece e some. Recrie de memória.' },
    { id: 'flash', label: 'Flash', note: 'A cor pisca por 0,4 s: confie no olho.' },
    { id: 'blind', label: 'Às cegas', note: 'Ninguém vê a cor que monta. Só a revelação mostra.' },
  ],
  time: [
    { id: 'classic', label: 'Clássico', note: 'Alvos de 1 a 18 s, alternando curtos e longos.' },
    { id: 'strict', label: 'Sem estourar', note: 'Passou do alvo, a rodada vale zero.' },
    {
      id: 'sequence',
      label: 'Sequência',
      note: 'Alvos curtos (2 a 6 s), um atrás do outro e sem pausa: o próximo aparece para todos assim que todos pararem. O resultado vem só no fim.',
    },
  ],
};

const seconds = (ms: RuleValue) => `${Number(ms) / 1000}s`.replace('.', ',');

export const modeOf = (s: RoomSnapshot) => MODES[s.game].find((m) => m.id === s.mode);

/** Uma linha: "Cor · Clássico · 3 rodadas". */
export function rulesSummary(s: RoomSnapshot): string {
  const rounds = s.settings.rounds;
  // O Intruso só tem um modo, com o mesmo nome do jogo: não repete.
  const mode = modeOf(s)?.label;
  return [
    GAME_NAME[s.game],
    mode === GAME_NAME[s.game] ? undefined : mode,
    s.game === 'eco' && s.mode !== 'leader'
      ? 'Corrida'
      : `${rounds} ${rounds === 1 ? 'rodada' : 'rodadas'}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function rulesFor(s: RoomSnapshot): RuleDef[] {
  const out: RuleDef[] = [];
  const cfg = s.settings;

  if (s.game !== 'impostor') {
    out.push({
      id: 'mode',
      label: 'MODO',
      values: MODES[s.game].map((m) => m.id),
      current: s.mode,
      format: (id) => MODES[s.game].find((m) => m.id === id)?.label ?? String(id),
      patch: (v) => ({ mode: v }),
    });
  }

  // Corrida do Ecooo: as rodadas vêm do modo (a partida acaba quando sobra um).
  if (s.game !== 'eco' || s.mode === 'leader')
    out.push({
      id: 'rounds',
      label: 'RODADAS',
      values: s.game === 'impostor' ? IMP_ROUNDS : s.game === 'eco' ? LEADER_ROUNDS : ROUNDS,
      current: cfg.rounds,
      format: String,
      patch: (v) => ({ rounds: v }),
    });

  if (s.game === 'impostor') {
    const players = Math.max(s.members.length, 3);
    const limit = impostorLimit(players);
    out.push(
      {
        id: 'impostors',
        label: 'INTRUSOS',
        values: IMP_COUNT,
        current: cfg.impostors,
        format: String,
        patch: (v) => ({ impostors: v }),
        note: `Com ${players} pessoas: até ${limit} ${limit === 1 ? 'intruso' : 'intrusos'}. O número se ajusta a quem estiver na sala.`,
      },
      {
        id: 'vote',
        label: 'VOTO',
        values: ['open', 'anon'],
        current: cfg.anonymous ? 'anon' : 'open',
        format: (v) => (v === 'anon' ? 'Anônimo' : 'Aberto'),
        patch: (v) => ({ anonymous: v === 'anon' }),
        note: cfg.anonymous
          ? 'Ninguém vê em quem cada um votou, só quantos votos cada um recebeu.'
          : 'No fim, todo mundo vê o voto de cada pessoa.',
      },
      {
        id: 'show',
        label: 'TEMPO PARA DECORAR',
        values: SHOW.filter((v) => v >= 1000),
        current: cfg.showMs,
        format: seconds,
        patch: (v) => ({ showMs: v }),
      },
      {
        id: 'pick',
        label: 'TEMPO PARA RECRIAR',
        values: IMP_PICK,
        current: cfg.pickMs,
        format: seconds,
        patch: (v) => ({ pickMs: v }),
      },
      {
        id: 'voteTime',
        label: 'TEMPO PARA VOTAR',
        values: IMP_VOTE,
        current: cfg.voteMs,
        format: seconds,
        patch: (v) => ({ voteMs: v }),
      },
    );
  }

  if (s.game === 'color') {
    if (s.mode !== 'flash') {
      out.push({
        id: 'show',
        label: 'TEMPO PARA DECORAR',
        values: SHOW,
        current: cfg.showMs,
        format: seconds,
        patch: (v) => ({ showMs: v }),
      });
    }
    out.push({
      id: 'pick',
      label: 'TEMPO PARA RECRIAR',
      values: PICK,
      current: cfg.pickMs,
      format: seconds,
      patch: (v) => ({ pickMs: v }),
    });
  }

  return out;
}
