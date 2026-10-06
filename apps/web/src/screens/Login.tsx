import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Field } from '@/components/Field';
import { validateLogin } from '@/lib/account-form';
import { login } from '@/lib/auth';
import './account.css';

export function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateLogin(identifier, password);
    setErrors(found);
    setFailure('');
    if (found.identifier || found.password) return;
    setBusy(true);
    try {
      await login(identifier, password);
      await navigate({ to: '/perfil' });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Não foi possível entrar.');
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
        <h1>Entrar</h1>
        <Field
          label="Usuário ou e-mail"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={errors.identifier}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <Field
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />
        {failure && (
          <p className="acc-failure mono" role="alert">
            {failure}
          </p>
        )}
        <div className="stack">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Entrando...' : 'Entrar'}
          </button>
          <Link to="/criar-conta" className="btn ghost">
            Criar conta
          </Link>
        </div>
      </form>
    </div>
  );
}
