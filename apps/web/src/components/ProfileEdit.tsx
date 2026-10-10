import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Field } from '@/components/Field';
import { RuleList } from '@/components/RuleList';
import { ApiError } from '@/lib/api-client';
import {
  NAME_MAX,
  USERNAME_COOLDOWN_DAYS,
  normalizeUsername,
  usernameProblem,
  usernameRules,
} from '@/lib/account-form';
import { changeUsername, fetchUsernameStatus, updateName } from '@/lib/auth';
import { sfx } from '@/lib/sfx';
import './profile-edit.css';

export type EditStep = 'menu' | 'name' | 'username' | null;

const message = (e: unknown) =>
  e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível salvar.';

/** Moldura dos popups de edição: fundo escuro, Esc e toque fora fecham (menos enquanto salva). */
function Modal({
  title,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    sfx.warn();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return (
    <div className="cd-backdrop" onClick={() => !busy && onClose()}>
      <div
        className="cd pe"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pe-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pe-title" className="cd-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** O que dá para editar: um toque abre o popup daquele item. */
function Menu({
  name,
  username,
  onPick,
  onClose,
}: {
  name: string;
  username: string;
  onPick: (step: 'name' | 'username') => void;
  onClose: () => void;
}) {
  return (
    <Modal title="O que editar?" onClose={onClose}>
      <ul className="pe-menu">
        <li>
          <button type="button" data-sfx="select" onClick={() => onPick('name')}>
            <span className="mono">NOME</span>
            <b>{name}</b>
            <small className="mono">Aparece no seu perfil</small>
          </button>
        </li>
        <li>
          <button type="button" data-sfx="select" onClick={() => onPick('username')}>
            <span className="mono">@USUÁRIO</span>
            <b>@{username}</b>
            <small className="mono">É como seus amigos te acham</small>
          </button>
        </li>
      </ul>
      <button type="button" className="btn ghost" data-sfx="cancel" onClick={onClose}>
        Fechar
      </button>
    </Modal>
  );
}

function NameDialog({
  name,
  onDone,
  onClose,
}: {
  name: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(name);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() === name) return onDone();
    setSaving(true);
    setError('');
    try {
      await updateName(text);
      onDone();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  };

  return (
    <Modal title="Editar nome" onClose={onClose} busy={saving}>
      <form className="pe-form" onSubmit={(e) => void submit(e)}>
        <Field
          label="Nome"
          value={text}
          onChange={(e) => setText(e.target.value)}
          error={error || undefined}
          hint="Aparece no seu perfil. Pode trocar quando quiser."
          maxLength={NAME_MAX}
          autoFocus
        />
        <div className="cd-actions">
          <button
            type="submit"
            className="btn alt"
            data-sfx="success"
            disabled={saving || !text.trim()}
          >
            {saving ? 'Salvando...' : 'Salvar nome'}
          </button>
          <button
            type="button"
            className="btn ghost"
            data-sfx="cancel"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Trocar o @: primeiro o texto claro do que acontece, depois uma confirmação final com o antes e
 * o depois e uma caixinha de "entendi". Só então a troca é feita.
 */
function UsernameDialog({
  username,
  onDone,
  onClose,
}: {
  username: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [handle, setHandle] = useState(username);
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [error, setError] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [saving, setSaving] = useState(false);
  const status = useQuery({ queryKey: ['username-status'], queryFn: fetchUsernameStatus });
  const nextAt = status.data?.nextChangeAt ? new Date(status.data.nextChangeAt) : null;
  const locked = !!nextAt && nextAt > new Date();
  const wanted = normalizeUsername(handle);
  const changed = wanted !== username;
  const days = USERNAME_COOLDOWN_DAYS;

  const next = (e: FormEvent) => {
    e.preventDefault();
    const problem = usernameProblem(handle);
    if (problem) return setError(problem);
    setError('');
    setUnderstood(false);
    setStep('confirm');
  };

  const confirm = async () => {
    setSaving(true);
    setError('');
    try {
      await changeUsername(wanted);
      onDone();
    } catch (err) {
      // Voltou para a edição com o motivo (ex.: o @ já existe).
      setError(message(err));
      setStep('edit');
      setSaving(false);
    }
  };

  if (step === 'confirm') {
    return (
      <Modal title="Confirmar a troca" onClose={() => setStep('edit')} busy={saving}>
        <div className="pe-swap" aria-label="Troca de @">
          <span className="mono">DE</span>
          <b>@{username}</b>
          <span className="mono">PARA</span>
          <b className="new">@{wanted}</b>
        </div>
        <p className="pe-warn">
          Depois de trocar, você <b>só poderá trocar de novo daqui a {days} dias</b>. O @{username}{' '}
          fica reservado a você por {days} dias e depois qualquer pessoa pode pegá-lo.
        </p>
        <label className="pe-check">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            disabled={saving}
          />
          <span>Entendi e quero trocar meu @ para @{wanted}</span>
        </label>
        <div className="cd-actions">
          <button
            type="button"
            className="btn alt"
            data-sfx="success"
            disabled={!understood || saving}
            onClick={() => void confirm()}
          >
            {saving ? 'Trocando...' : 'Sim, trocar meu @'}
          </button>
          <button
            type="button"
            className="btn ghost"
            data-sfx="back"
            disabled={saving}
            onClick={() => setStep('edit')}
          >
            Voltar
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Trocar @usuário" onClose={onClose}>
      <form className="pe-form" onSubmit={next}>
        <Field
          label="Novo @usuário"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            setError('');
          }}
          error={error || undefined}
          disabled={locked}
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
        />
        {locked ? (
          <p className="pe-warn" role="status">
            Você trocou de @ há pouco. Poderá trocar de novo em{' '}
            <b>{nextAt!.toLocaleDateString('pt-BR')}</b>.
          </p>
        ) : (
          <>
            {changed && <RuleList title="O @USUÁRIO PRECISA TER" rules={usernameRules(handle)} />}
            <section className="pe-what" aria-label="O que acontece se você trocar">
              <h3 className="mono">O QUE ACONTECE SE VOCÊ TROCAR</h3>
              <ul>
                <li>Seu @ muda em todo o app: ranking, amigos e salas.</li>
                <li>
                  Você só poderá trocar de novo <b>daqui a {days} dias</b>.
                </li>
                <li>
                  O @{username} fica reservado a você por {days} dias; depois qualquer pessoa pode
                  usá-lo.
                </li>
                <li>Seus amigos continuam seus amigos, mas não são avisados da troca.</li>
              </ul>
            </section>
          </>
        )}
        <div className="cd-actions">
          <button
            type="submit"
            className="btn alt"
            data-sfx="select"
            disabled={locked || !changed || !handle.trim()}
          >
            Continuar
          </button>
          <button type="button" className="btn ghost" data-sfx="cancel" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** O lápis do perfil: menu do que editar e, ao escolher, o popup daquele item. */
export function ProfileEdit({
  step,
  name,
  username,
  onStep,
}: {
  step: EditStep;
  name: string;
  username: string;
  onStep: (s: EditStep) => void;
}) {
  if (step === 'menu')
    return <Menu name={name} username={username} onPick={onStep} onClose={() => onStep(null)} />;
  if (step === 'name')
    return <NameDialog name={name} onDone={() => onStep(null)} onClose={() => onStep('menu')} />;
  if (step === 'username')
    return (
      <UsernameDialog
        username={username}
        onDone={() => onStep(null)}
        onClose={() => onStep('menu')}
      />
    );
  return null;
}
