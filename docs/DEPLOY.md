# Deploy: API no Render, web na Vercel

Plano escolhido pelo Lucas (2026-10-06). O Fly.io deixou de ter plano grátis para conta nova.

## Web (Vercel)

- Projeto apontando para `apps/web` (root directory), framework Vite.
- Build: `pnpm --filter @nocap/web build` (o `turbo` já compila `packages/games` antes). Saída: `apps/web/dist`.
- `apps/web/vercel.json` reescreve todas as rotas para `index.html` (o app é SPA: `/amigos`, `/sala/ABCD`...).
- Variáveis: `VITE_SITE_URL` = URL pública do site (ex.: `https://nocap.vercel.app`, para a prévia do link ao compartilhar) e `VITE_API_URL` = URL pública da API no Render (ex.: `https://nocap-api.onrender.com`). O cliente das salas troca `https` por `wss` sozinho.

## API (Render, Web Service)

- Root: raiz do repositório. Build: `pnpm install --frozen-lockfile && pnpm --filter @nocap/games build && pnpm --filter @nocap/api build`. Start: `pnpm --filter @nocap/api start` (roda `node dist/main.js`).
- Node 22 (ver `.nvmrc`). Porta: o Render define `PORT`, a API já lê.
- Variáveis (nunca no git):
  - `DATABASE_URL` (transaction pooler do Supabase, 6543)
  - `BETTER_AUTH_SECRET` (obrigatória em produção; assina o login **e** as sessões do Tempo: trocar invalida partidas do Tempo em andamento)
  - `API_URL` = URL pública da própria API
  - `WEB_ORIGIN` = URL da Vercel (uma só; previews da Vercel não passam no CORS)
- **Uma instância só.** As salas moram na memória do processo.
- **Salas somem quando o serviço reinicia** (deploy, queda, plano grátis dormindo). Quem estava numa sala volta ao início.

## Plano grátis do Render

- Dorme após 15 min sem tráfego (conta requisição HTTP e mensagem de WebSocket) e leva cerca de 1 min para acordar.
- O Lucas vai usar o **UptimeRobot** chamando `GET /health` a cada 5 min para ele não dormir. Funciona; 750 h grátis por mês cobrem 1 serviço ligado 24 h (~744 h).
- Não há garantia de que o Render aceite isso para sempre. Se for um problema, o plano pago mais barato não dorme.

## Pendências antes de abrir ao público

- **Limite de login por IP:** o Better Auth lê o IP em `X-Forwarded-For` (já configurado). Atrás do Render o primeiro valor é o do cliente, mas ele pode ser forjado. Revisar `advanced.ipAddress.trustedProxies` antes de abrir.
- Limite de buscas em `/users/search` (hoje sem limite além do login).
- Verificação de e-mail e "esqueci a senha" (precisa de provedor de e-mail).
