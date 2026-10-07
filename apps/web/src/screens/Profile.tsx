import { Loader } from '@/components/Loader';
import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InstallApp } from '@/components/InstallApp';
import { Choice } from '@/components/RankingList';
import { Records } from '@/components/Records';
import { Field } from '@/components/Field';
import { Pencil } from '@/components/icons';
import { NAME_MAX } from '@/lib/account-form';
import { RuleList } from '@/components/RuleList';
import { ApiError } from '@/lib/api-client';
import {
  USERNAME_COOLDOWN_DAYS,
  normalizeUsername,
  usernameProblem,
  usernameRules,
} from '@/lib/account-form';
import { changeUsername, fetchUsernameStatus, logout, updateName, useAuth } from '@/lib/auth';
import { fetchStats, streakLabel } from '@/lib/stats';
import './profile.css';

type Tab = 'profile' | 'records';
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Perfil' },
  { id: 'records', label: 'Recordes' },
];

function NameEditor({
  name,
  username,
  onDone,
}: {
  name: string;
  username: string;
  onDone: () => void;
}) {
  const [text, setText] = useState(name);
  const [handle, setHandle] = useState(username);
  const [error, setError] = useState('');
  const [handleError, setHandleError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const status = useQuery({ queryKey: ['username-status'], queryFn: fetchUsernameStatus });
  const nextAt = status.data?.nextChangeAt ? new Date(status.data.nextChangeAt) : null;
  const locked = !!nextAt && nextAt > new Date();
  const wantsHandle = normalizeUsername(handle) !== username;

  const message = (e: unknown) =>
    e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível salvar.';

  const save = async (withHandle: boolean) => {
    setSaving(true);
    setError('');
    setHandleError('');
    try {
      if (text.trim() !== name) await updateName(text);
    } catch (e) {
      setError(message(e));
      setSaving(false);
      return;
    }
    if (withHandle) {
      try {
        await changeUsername(normalizeUsername(handle));
        void status.refetch();
      } catch (e) {
        setHandleError(message(e));
        setSaving(false);
        return;
      }
    }
    onDone();
  };

  const submit = () => {
    if (wantsHandle) {
      const problem = usernameProblem(handle);
      if (problem) return setHandleError(problem);
      setHandleError('');
      return setConfirming(true);
    }
    void save(false);
  };

  return (
    <form
      className="pf-edit"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field
        label="Nome"
        value={text}
        onChange={(e) => setText(e.target.value)}
        error={error || undefined}
        hint="Aparece no seu perfil. Pode trocar quando quiser."
        maxLength={NAME_MAX}
        autoFocus
      />
      <Field
        label="@usuário"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        error={handleError || undefined}
        hint={
          locked
            ? `Você trocou de @ há pouco. Poderá trocar de novo em ${nextAt!.toLocaleDateString('pt-BR')}.`
            : `Pode trocar a cada ${USERNAME_COOLDOWN_DAYS} dias. O @ antigo fica reservado a você por ${USERNAME_COOLDOWN_DAYS} dias e depois qualquer pessoa pode usá-lo.`
        }
        disabled={locked}
        autoCapitalize="none"
        autoCorrect="off"
      />
      {wantsHandle && !locked && (
        <RuleList title="O @USUÁRIO PRECISA TER" rules={usernameRules(handle)} />
      )}
      <div className="pf-actions">
        <button type="submit" className="btn alt" data-sfx="success" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" className="btn ghost" data-sfx="cancel" onClick={onDone}>
          Cancelar
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Trocar o seu @?"
        text={`Seu @ passa de @${username} para @${normalizeUsername(handle)}. Você só poderá trocar de novo daqui a ${USERNAME_COOLDOWN_DAYS} dias. O @${username} fica reservado a você por ${USERNAME_COOLDOWN_DAYS} dias e depois qualquer pessoa pode pegá-lo. Seus amigos não serão avisados.`}
        confirmLabel="Trocar @"
        confirmSfx="success"
        onConfirm={() => {
          setConfirming(false);
          void save(true);
        }}
        onCancel={() => setConfirming(false)}
      />
    </form>
  );
}

function VisitStreak() {
  const q = useQuery({ queryKey: ['stats'], queryFn: fetchStats });
  const visit = q.data?.visit;
  return (
    <section className="pf-streak" aria-label="Dias seguidos no NoCap">
      <div className="mono pf-streak-label">DIAS SEGUIDOS NO NOCAP</div>
      <div className="pf-streak-value">{visit ? streakLabel(visit.current) : '...'}</div>
      <div className="mono pf-streak-sub">
        {visit ? `MELHOR SEQUÊNCIA ${streakLabel(visit.best).toUpperCase()}` : 'CARREGANDO'}
      </div>
    </section>
  );
}

export function Profile() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);

  const signOut = async () => {
    await logout();
    queryClient.removeQueries({ queryKey: ['history'] });
    queryClient.removeQueries({ queryKey: ['stats'] });
    setConfirming(false);
    await navigate({ to: '/' });
  };

  if (status === 'loading') {
    return (
      <main className="pf">
        <h1>Perfil</h1>
        <Loader inline />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="pf">
        <h1>Perfil</h1>
        <p className="lead">
          Convidado só olha o app. Crie uma conta para jogar, guardar seu histórico e entrar nos
          rankings.
        </p>
        <div className="pf-actions">
          <Link to="/criar-conta" className="btn alt">
            Criar conta
          </Link>
          <Link to="/entrar" className="btn ghost">
            Entrar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pf">
      <h1>Perfil</h1>
      <Choice label="Seção" value={tab} options={TABS} onChange={setTab} />
      {tab === 'profile' ? (
        <>
          <section className="pf-card">
            <div className="pf-avatar" aria-hidden="true">
              {user.name.trim().charAt(0).toUpperCase() || '?'}
            </div>
            <div className="pf-id">
              <div className="pf-name">{user.name}</div>
              {user.username && <div className="pf-user">@{user.username}</div>}
              <div className="mono pf-email">{user.email}</div>
            </div>
            {!editing && (
              <button
                type="button"
                className="pf-pencil"
                data-sfx="select"
                aria-label="Editar nome"
                onClick={() => setEditing(true)}
              >
                <Pencil size={20} />
              </button>
            )}
          </section>
          {editing && (
            <NameEditor
              name={user.name}
              username={user.username ?? ''}
              onDone={() => setEditing(false)}
            />
          )}
          <VisitStreak />
          <InstallApp />
          <div className="pf-actions">
            <button
              type="button"
              className="btn ghost"
              data-sfx="select"
              onClick={() => setConfirming(true)}
            >
              Sair
            </button>
          </div>
        </>
      ) : (
        <Records />
      )}
      <ConfirmDialog
        open={confirming}
        title="Sair da conta?"
        text="Você precisará entrar de novo para jogar. Seu histórico e seus recordes ficam guardados."
        confirmLabel="Sair"
        confirmSfx="bye"
        onConfirm={() => void signOut()}
        onCancel={() => setConfirming(false)}
      />
    </main>
  );
}
