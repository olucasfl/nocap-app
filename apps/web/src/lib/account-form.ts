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

const USERNAME_RE = new RegExp(`^[a-z0-9_]{${USERNAME_MIN},${USERNAME_MAX}}$`);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** O nome de usuário é guardado em minúsculas e sem espaços nas pontas. */
export const normalizeUsername = (v: string) => v.trim().toLowerCase();

/** No login, quem digita "@" está usando o e-mail; senão é o nome de usuário. */
export const isEmail = (v: string) => v.includes('@');

export function validateName(name: string): string | undefined {
  const n = name.trim();
  return n.length < NAME_MIN || n.length > NAME_MAX
    ? `Escreva seu nome (${NAME_MIN} a ${NAME_MAX} letras)`
    : undefined;
}

export function validateRegister(f: RegisterForm): RegisterErrors {
  const e: RegisterErrors = {};
  if (!USERNAME_RE.test(normalizeUsername(f.username))) {
    e.username = `Use ${USERNAME_MIN} a ${USERNAME_MAX} letras minúsculas, números ou _`;
  }
  const nameError = validateName(f.name);
  if (nameError) e.name = nameError;
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'E-mail inválido';
  if (f.password.length < PASSWORD_MIN) {
    e.password = `A senha precisa de ${PASSWORD_MIN} ou mais caracteres`;
  }
  if (f.confirm !== f.password) e.confirm = 'As senhas não são iguais';
  return e;
}

export function validateLogin(identifier: string, password: string) {
  const e: { identifier?: string; password?: string } = {};
  if (!identifier.trim()) e.identifier = 'Digite seu usuário ou e-mail';
  if (!password) e.password = 'Digite sua senha';
  return e;
}
