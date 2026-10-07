# 007: Contas (cadastro e login)

> **Status: implementada e verificada contra o Supabase (2026-10-06); falta definir e-mail (verificação/recuperação) e Google.** Decisão #2 do brief: **Better Auth**, e-mail + senha. Google fica para depois.

## Objetivo

Quem joga pode criar uma conta para ter um nome de usuário único (@usuario), usado para convidar e adicionar amigos (Etapa 3), e para não perder histórico ao trocar de aparelho.

## Regras

- **Cadastro:** nome de usuário, nome real, e-mail, senha e confirmação da senha (a confirmação é só no app; o servidor recebe uma senha).
- **Login:** nome de usuário **ou** e-mail + senha.
- **Nome de usuário:** 3 a 20 caracteres; letras minúsculas, números e `_`; único, sem diferenciar maiúscula de minúscula (guardado em minúsculas).
- **Nome real:** 2 a 60 caracteres. **Senha:** mínimo 8 caracteres.
- **Sem verificação de e-mail e sem "esqueci a senha" por enquanto** (não há provedor de e-mail). Decidir antes de lançar (ver abaixo).
- **Sessão:** token _bearer_ guardado no aparelho e enviado em `Authorization` (web e API ficam em origens diferentes; PWA).
- **Convidado vira conta:** ao entrar ou criar conta, o `guestId` do aparelho é vinculado à conta (`players.user_id`). Nada é copiado nem apagado: o histórico daquele aparelho passa a pertencer à conta, e em outro aparelho o login traz o histórico de todos os aparelhos vinculados.
- **Jogar continua possível sem conta.** A conta é opcional.
- Limite de tentativas de login/cadastro no servidor.

## Telas

`/entrar`, `/criar-conta` e a aba **Perfil** (deslogado: convite para entrar ou criar conta; logado: nome, @usuario, e-mail e **Sair**).

## API

- Better Auth em `/api/auth/*` (`sign-up/email`, `sign-in/username`, `sign-in/email`, `sign-out`, `get-session`).
- `POST /players/claim { guestId }` (autenticado): vincula o convidado à conta; `409` se já for de outra conta.
- `GET /me/matches` (autenticado): histórico de todos os aparelhos da conta.

## Modelo de dados

Migration **aditiva**: `auth_user`, `auth_session`, `auth_account`, `auth_verification` e a coluna `players.user_id` (nula).

## Critérios de aceite

- [x] Criar conta com os 5 campos; senhas diferentes bloqueiam no app; usuário ou e-mail repetido dá erro claro.
- [x] Entrar com usuário e com e-mail funciona; senha errada dá erro claro.
- [x] Depois de entrar, o histórico do aparelho aparece na conta; num segundo aparelho o login traz o mesmo histórico.
- [x] Sair volta ao modo convidado.
- [x] Sessão sobrevive a fechar e reabrir o app.

## Fora de escopo

Google, verificação de e-mail, recuperar senha, foto/avatar (brief #11), amigos (Etapa 3).

## Como ficou

- `apps/api/src/auth/` (instância do Better Auth, guard, módulo) e rotas `players/claim` e `me/matches` em `matches/`. O proteção CSRF do Better Auth exige o header `Origin` (o navegador manda; clientes sem origem recebem 403).
- **Variável nova no `.env` (obrigatória em produção):** `BETTER_AUTH_SECRET` (gere com `openssl rand -base64 32`); `API_URL` (URL pública da API) e `WEB_ORIGIN` já existente.
- Migration `0001` aplicada no Supabase em 2026-10-06 (aditiva).

## Decisões em aberto

- Verificação de e-mail e recuperação de senha: exigem provedor de e-mail (Resend, etc.).
- Entrar com Google (o brief previa e-mail + Google).

## Pendente: editar nome (pedido do Lucas em 07/10/2026)

> **Status: implementado só para o Nome de exibição (o @usuário continua fixo; troca de @ fica em aberto).** Pedido: "uma opção de editar nome", para fazer no futuro.

Hoje o cadastro tem dois campos: **@usuário** (único, aparece em ranking, amigos, salas e histórico) e **Nome**. Falta uma forma de mudar depois de criada a conta, no Perfil.

**Proposta:** botão "Editar" no Perfil, com confirmação e validação igual à do cadastro.

- **Nome** (de exibição): livre para trocar a qualquer hora.
- **@usuário**: mais delicado, porque amigos, ranking e histórico apontam para ele. Se for permitido, precisa de unicidade, intervalo mínimo entre trocas e propagação para tudo que o referencia.

**Perguntas abertas para o Lucas**

- "Editar nome" é o **Nome** de exibição, o **@usuário**, ou os dois?
- Se o @usuário puder mudar: qual o intervalo mínimo entre trocas (ex.: 30 dias)? O @antigo fica reservado por um tempo?
- Os amigos são avisados da troca?

**Critérios de aceite (pendentes)**

- [ ] O Perfil permite editar o nome, com as mesmas regras de tamanho e caracteres do cadastro.
- [ ] Salvar pede confirmação e o novo nome aparece em ranking, amigos, salas e histórico.
- [ ] (Se @usuário) nome já em uso é recusado com mensagem clara.
