export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const PASSWORD_MIN = 8;

export interface RegisterForm {
  username: string;
  name: string;
  email: string;
  password: string;
  confirm: string;
}

export type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** O nome de usuário é guardado em minúsculas e sem espaços nas pontas. */
export const normalizeUsername = (v: string) => v.trim().toLowerCase();

/** No login, quem digita "@" está usando o e-mail; senão é o nome de usuário. */
export const isEmail = (v: string) => v.includes('@');

/** Troca de @ e reserva do @ largado: o mesmo prazo do servidor. */
export const USERNAME_COOLDOWN_DAYS = 15;

export interface RuleCheck {
  ok: boolean;
  label: string;
}

/** O que está errado no @, dito com exatidão (ou `null` se vale). */
export function usernameProblem(raw: string): string | null {
  const v = normalizeUsername(raw);
  if (v.length < USERNAME_MIN) return `Muito curto: use pelo menos ${USERNAME_MIN} caracteres`;
  if (v.length > USERNAME_MAX) return `Muito longo: use no máximo ${USERNAME_MAX} caracteres`;
  if (/\s/.test(v)) return 'Não pode ter espaço';
  if (v.startsWith('@')) return 'Não escreva o @ no começo: ele já aparece sozinho';
  if (!/^[a-z0-9_]+$/.test(v)) {
    return 'Só pode letras minúsculas sem acento, números e _ (sem ponto, hífen ou símbolos)';
  }
  return null;
}

/** A lista de regras do @, com o que já está cumprido (para mostrar enquanto a pessoa digita). */
export function usernameRules(raw: string): RuleCheck[] {
  const v = normalizeUsername(raw);
  return [
    {
      ok: v.length >= USERNAME_MIN && v.length <= USERNAME_MAX,
      label: `De ${USERNAME_MIN} a ${USERNAME_MAX} caracteres`,
    },
    { ok: /^[a-z0-9_]*$/.test(v), label: 'Só letras (sem acento), números e _' },
    { ok: !/\s/.test(v) && !v.includes('@'), label: 'Sem espaço e sem @' },
  ];
}

export function passwordRules(pw: string): RuleCheck[] {
  return [{ ok: pw.length >= PASSWORD_MIN, label: `Pelo menos ${PASSWORD_MIN} caracteres` }];
}

export function validateName(name: string): string | undefined {
  const n = name.trim();
  return n.length < NAME_MIN || n.length > NAME_MAX
    ? n.length < NAME_MIN
      ? `Nome curto demais: use pelo menos ${NAME_MIN} letras`
      : `Nome longo demais: use no máximo ${NAME_MAX} caracteres`
    : undefined;
}

export function validateRegister(f: RegisterForm): RegisterErrors {
  const e: RegisterErrors = {};
  const userProblem = usernameProblem(f.username);
  if (userProblem) e.username = userProblem;
  const nameError = validateName(f.name);
  if (nameError) e.name = nameError;
  if (!EMAIL_RE.test(f.email.trim())) {
    e.email = 'E-mail inválido: use o formato nome@exemplo.com (sem espaços)';
  }
  if (f.password.length < PASSWORD_MIN) {
    e.password = `Senha curta demais: faltam ${PASSWORD_MIN - f.password.length} caracteres (mínimo ${PASSWORD_MIN})`;
  }
  if (f.confirm !== f.password) e.confirm = 'As duas senhas precisam ser iguais';
  return e;
}

export function validateLogin(identifier: string, password: string) {
  const e: { identifier?: string; password?: string } = {};
  if (!identifier.trim()) e.identifier = 'Digite seu usuário ou e-mail';
  if (!password) e.password = 'Digite sua senha';
  return e;
}
