# HANDOFF: retomando o NoCap em outro computador

Leia este arquivo primeiro. Ele diz onde o projeto parou e como voltar a trabalhar em 10 minutos.

## Estado atual

- **Esqueleto montado e validado** (`pnpm build` e `pnpm test` passam): monorepo, web (React + Vite + PWA),
  api (NestJS + Drizzle), `packages/games` (contrato + RNG com testes), docs e automações do Claude.
- **Nenhuma regra de jogo implementada ainda.** O próximo passo é a Etapa 1, passo 2 (jogo da Cor).
- **Banco não configurado**: nenhuma migration foi gerada nem aplicada.
- Repositório: `https://github.com/olucasfl/nocap-app` (branch `main`). Deve estar **privado**.

## Ritual de setup no computador novo

```bash
git clone https://github.com/olucasfl/nocap-app.git && cd nocap-app
nvm use                      # Node 22 (mínimo 20.19)
corepack enable && pnpm install
cp .env.example .env         # depois preencha a senha do Supabase (ver abaixo)
pnpm build && pnpm test      # deve passar sem banco
pnpm dev                     # web em :5173, api em :3333 (GET /health)
```

O `.env` **não vai para o git**. Leve a senha do Supabase por um gerenciador de senhas, nunca por chat.

## Antes de tudo (pendências de segurança)

- [ ] **Trocar a senha do banco no Supabase** (ela vazou em chat) e colocar a nova só no `.env`.
- [ ] Confirmar que o repositório no GitHub está privado.

## Onde está cada contexto

| Preciso de...                                          | Arquivo                               |
| ------------------------------------------------------ | ------------------------------------- |
| Visão, decisões tomadas e em aberto, regras, roadmap   | `docs/PROJECT-BRIEF.md`               |
| Passo a passo até o projeto ficar pronto               | `docs/ROADMAP.md`                     |
| Design (Pop Brutal), como abrir as telas de referência | `docs/DESIGN.md`                      |
| Telas e protótipo de referência (HTML)                 | `docs/reference/*.html`               |
| Prompt original da Etapa 1                             | `docs/prompts/etapa-1.md`             |
| Arquitetura técnica                                    | `ARCHITECTURE.md`                     |
| Regras para agentes                                    | `CLAUDE.md`, `.claude/rules/RULES.md` |
| Specs de cada feature                                  | `specs/` (índice em `specs/INDEX.md`) |

## Como ver o design no outro PC

Abra `docs/reference/prototipo-cor.html` no navegador (duplo clique): é o jogo da Cor jogável, a fonte da
verdade de fluxo, animação e sons. As outras três (`design-*.html`) são as telas do Hub e dos resultados.
Detalhes em `docs/DESIGN.md`.

## Como retomar com o Claude Code

Abra a pasta do repo no Claude Code e diga: _"Leia HANDOFF.md, CLAUDE.md e docs/ROADMAP.md e continue do
próximo passo pendente."_ Os comandos `/new-game`, `/spec`, `/ship` e `/status` estão em `.claude/commands/`.

## Decisões em aberto que mais travam

Ver `docs/PROJECT-BRIEF.md` seção 6. As três que importam primeiro: presencial vs remoto (#1), auth (#2) e
curva da nota do Tempo (#4). Não decida sozinho: pergunte ao Lucas.

## Nota técnica

Esta máquina tinha Node 20.19; o projeto recomenda Node 22 (`.nvmrc`). Funciona nos dois.
