import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Field } from '@/components/Field';
import {
  USERNAME_MAX,
  validateRegister,
  type RegisterErrors,
  type RegisterForm,
} from '@/lib/account-form';
import { register } from '@/lib/auth';
import './account.css';

const EMPTY: RegisterForm = { username: '', name: '', email: '', password: '', confirm: '' };

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>(EMPTY);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof RegisterForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateRegister(form);
    setErrors(found);
    setFailure('');
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await register(form);
      await navigate({ to: '/perfil' });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Não foi possível criar a conta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="top">
        <Link to="/" className="logo" aria-label="Voltar aos jogos">
          no cap<span>!</span>
        </Link>
      </header>
      <form className="screen acc" onSubmit={submit} noValidate>
        <h1>Criar conta</h1>
        <Field
          label="Nome de usuário"
          hint="É como seus amigos vão te achar: @usuario"
          value={form.username}
          onChange={set('username')}
          error={errors.username}
          maxLength={USERNAME_MAX + 5}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <Field
          label="Nome"
          value={form.name}
          onChange={set('name')}
          error={errors.name}
          autoComplete="name"
        />
        <Field
          label="E-mail"
          type="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
          autoComplete="email"
          autoCapitalize="none"
        />
        <Field
          label="Senha"
          type="password"
          hint="Mínimo de 8 caracteres"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          autoComplete="new-password"
        />
        <Field
          label="Repita a senha"
          type="password"
          value={form.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
          autoComplete="new-password"
        />
        {failure && (
          <p className="acc-failure mono" role="alert">
            {failure}
          </p>
        )}
        <div className="stack">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Criando...' : 'Criar conta'}
          </button>
          <Link to="/entrar" className="btn ghost">
            Já tenho conta
          </Link>
        </div>
      </form>
    </div>
  );
}
