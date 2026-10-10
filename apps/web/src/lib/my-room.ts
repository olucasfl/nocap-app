import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api-client';
import { useAuth } from './auth';
import {
  CODE_RE,
  RoomConflictError,
  createRoom,
  joinRoom,
  leaveRoom,
  useRoom,
  type Phase,
  type RoomGame,
  type RoomSnapshot,
  type RoomStatus,
} from './rooms';
import { useState } from 'react';

/** O que o servidor diz sobre a sala da conta (`GET /me/room`). */
export interface MyRoom {
  code: string;
  game: RoomGame;
  phase: Phase;
  members: number;
  maxPlayers: number;
  host: string | null;
  /** A conta tem conexão ativa nela (falso = a conexão caiu e a vaga está só reservada). */
  connected: boolean;
}

export const MY_ROOM_KEY = ['my-room'] as const;

export const fetchMyRoom = () =>
  apiClient.get<{ room: MyRoom | null }>('/me/room').then((r) => r.room);

/** A sala da pessoa como o app mostra: ao vivo neste aparelho, ou só registrada no servidor. */
export interface RoomPresence {
  code: string;
  game: RoomGame;
  phase: Phase;
  members: number | null;
  maxPlayers: number | null;
  host: string | null;
  /** Conectada agora, neste aparelho. */
  live: boolean;
  reconnecting: boolean;
}

/** Junta o que este aparelho sabe (conexão ao vivo) com o que o servidor registrou. */
export function presenceOf(
  snapshot: RoomSnapshot | null,
  status: RoomStatus,
  server: MyRoom | null | undefined,
): RoomPresence | null {
  if (snapshot) {
    return {
      code: snapshot.code,
      game: snapshot.game,
      phase: snapshot.phase,
      members: snapshot.members.length,
      maxPlayers: snapshot.maxPlayers,
      host: snapshot.members.find((m) => m.isHost)?.username ?? null,
      live: true,
      reconnecting: status === 'reconnecting',
    };
  }
  if (!server) return null;
  return {
    code: server.code,
    game: server.game,
    phase: server.phase,
    members: server.members,
    maxPlayers: server.maxPlayers,
    host: server.host,
    live: false,
    reconnecting: status === 'reconnecting',
  };
}

/** A sala em que a pessoa está agora (ou `null`), para o aviso do início e os botões de criar. */
export function useMyRoom(): RoomPresence | null {
  const user = useAuth((s) => s.user);
  const snapshot = useRoom((s) => s.snapshot);
  const status = useRoom((s) => s.status);
  const server = useQuery({
    queryKey: MY_ROOM_KEY,
    queryFn: fetchMyRoom,
    enabled: !!user,
    // Com a sala ao vivo aqui, ela mesma manda; sem isso, pergunta ao servidor de tempos em tempos.
    refetchInterval: snapshot ? false : 15_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  if (!user) return null;
  return presenceOf(snapshot, status, server.data);
}

/** Sair da sala atual: libera a tela na hora e confirma com o servidor antes de seguir. */
export function useLeaveRoom() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    queryClient.setQueryData(MY_ROOM_KEY, null);
    await leaveRoom();
    await queryClient.invalidateQueries({ queryKey: MY_ROOM_KEY });
  }, [queryClient]);
}

type Attempt = { kind: 'create'; game: RoomGame } | { kind: 'join'; code: string };

/**
 * Criar ou entrar numa sala num toque só: faz a conexão, abre o lobby e, se a conta já está em
 * outra sala, devolve `conflict` para a tela perguntar o que fazer (voltar a ela ou sair dela).
 */
export function useRoomEntry() {
  const navigate = useNavigate();
  const leave = useLeaveRoom();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<{ code: string | null } | null>(null);
  const [pending, setPending] = useState<Attempt | null>(null);

  const run = useCallback(
    async (attempt: Attempt): Promise<boolean> => {
      setBusy(true);
      setError('');
      setConflict(null);
      try {
        if (attempt.kind === 'create') await createRoom(attempt.game);
        else await joinRoom(attempt.code);
        void queryClient.invalidateQueries({ queryKey: MY_ROOM_KEY });
        await navigate({ to: '/sala' });
        return true;
      } catch (e) {
        if (e instanceof RoomConflictError) {
          setPending(attempt);
          // Se o aparelho não sabe qual é a sala, o servidor sabe.
          const code = e.code ?? (await fetchMyRoom().catch(() => null))?.code ?? null;
          setConflict({ code });
        } else {
          setError(e instanceof Error ? e.message : 'Não foi possível entrar na sala.');
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [navigate, queryClient],
  );

  return {
    busy,
    error,
    conflict,
    clearError: () => setError(''),
    create: (game: RoomGame) => run({ kind: 'create', game }),
    join: (code: string) => {
      const c = code.trim().toUpperCase();
      if (!CODE_RE.test(c)) {
        setError('O código tem 4 letras.');
        return Promise.resolve(false);
      }
      return run({ kind: 'join', code: c });
    },
    /** "Voltar para a sala X" do aviso de conflito. */
    backToCurrent: () => {
      const code = conflict?.code;
      setConflict(null);
      void navigate(code ? { to: '/sala/$code', params: { code } } : { to: '/sala' });
    },
    /** "Sair dela e continuar": sai da sala atual e refaz o que a pessoa tinha pedido. */
    leaveAndContinue: async () => {
      const again = pending;
      setConflict(null);
      await leave();
      if (again) await run(again);
    },
    dismissConflict: () => setConflict(null),
  };
}
