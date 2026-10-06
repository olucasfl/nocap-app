# NoCap

Hub de jogos para jogar com amigos, no navegador e como PWA. Lançamento: **Cor** e **Tempo**.

> Retomando o projeto (ou em outro computador)? Comece por [`HANDOFF.md`](HANDOFF.md).

## Stack

pnpm + Turborepo · TypeScript strict · React 19 + Vite + TanStack Router/Query + Zustand + PWA ·
NestJS + Drizzle + Supabase Postgres · Vitest · (Colyseus e Redis nas próximas etapas)

## Setup

```bash
nvm use                        # Node 22 (mínimo 20.19)
corepack enable && pnpm install
cp .env.example .env           # preencha DATABASE_URL e DATABASE_URL_MIGRATIONS
pnpm dev                       # web :5173, api :3333
```

## Scripts

`pnpm dev` · `pnpm build` · `pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm format` ·
`pnpm db:generate` · `pnpm db:migrate`

## Mapa

|                                      |                                                              |
| ------------------------------------ | ------------------------------------------------------------ |
| `docs/PROJECT-BRIEF.md`              | visão, decisões, roadmap                                     |
| `docs/ROADMAP.md`                    | passo a passo                                                |
| `docs/DESIGN.md` + `docs/reference/` | design Pop Brutal e telas de referência (abrir no navegador) |
| `ARCHITECTURE.md`                    | arquitetura técnica                                          |
| `specs/`                             | specs por feature                                            |
| `CLAUDE.md`, `.claude/`              | guia e automações para agentes                               |
