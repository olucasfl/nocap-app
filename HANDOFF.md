# HANDOFF: retomando o NoCap em outro computador

Leia este arquivo primeiro. Ele diz onde o projeto parou e como voltar a trabalhar em 10 minutos.

## Estado atual

- **Esqueleto montado e validado** (`pnpm build` e `pnpm test` passam): monorepo, web (React + Vite + PWA),
  api (NestJS + Drizzle), `packages/games` (contrato + RNG com testes), docs e automações do Claude.
- **Cor jogável** de ponta a ponta: lógica (`packages/games/src/color`), API e telas (Hub, início com Clássico/Flash/Daily, memorizar, recriar, resultado com carimbo, final, sons). A partida salva no Supabase e a nota é recalculada no servidor. PWA feito (ícones, precache, prompt de atualização, fila offline em IndexedDB); falta só testar offline num Chrome real. Histórico feito (lista paginada + detalhe). Próximo: passo 6 (critério de pronto: validar tudo no banco real e offline). Nota da Cor já na curva v2.
- **Banco:** migration `0000` aplicada no Supabase (4 tabelas). Em outro PC basta preencher o `.env`; não rode a migration de novo (`pnpm db:migrate` é idempotente, mas confira antes).
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

## Pendências pedidas (só escritas, nada codado)

Ver `docs/ROADMAP.md` > Etapa 1b e as specs 001, 005 e 006:

1. ~~Nota da Cor mais generosa~~ (feito, curva v2; falta validar os parâmetros jogando).
2. ~~Jogo rápido de 1 rodada~~ (Cor feito; Tempo na Etapa 4).
3. ~~Modo noturno~~ (feito; a tela de abertura da PWA ainda abre clara).

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

Rode `pnpm dev` e abra http://localhost:5173 (o app já tem Hub e o jogo da Cor), ou abra `docs/reference/prototipo-cor.html` com duplo clique (jogo autônomo, fonte da verdade de fluxo, animação e sons). As `design-*.html` precisam de um `support.js` que não está na pasta e não renderizam sozinhas; servem só como referência de layout.
Detalhes em `docs/DESIGN.md`.

## Como retomar com o Claude Code

Abra a pasta do repo no Claude Code e diga: _"Leia HANDOFF.md, CLAUDE.md e docs/ROADMAP.md e continue do
próximo passo pendente."_ Os comandos `/new-game`, `/spec`, `/ship` e `/status` estão em `.claude/commands/`.

## Decisões em aberto que mais travam

Ver `docs/PROJECT-BRIEF.md` seção 6. As três que importam primeiro: presencial vs remoto (#1), auth (#2) e
curva da nota do Tempo (#4). Não decida sozinho: pergunte ao Lucas.

## Nota técnica

Esta máquina tinha Node 20.19; o projeto recomenda Node 22 (`.nvmrc`). Funciona nos dois.
