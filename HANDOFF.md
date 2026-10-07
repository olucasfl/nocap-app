# HANDOFF: retomando o NoCap em outro computador

Leia este arquivo primeiro. Ele diz onde o projeto parou e como voltar a trabalhar em 10 minutos.

## Estado atual (atualizado em 07/10/2026)

Tudo está em `main` e publicado (API no Render, web na Vercel, banco no Supabase). O Lucas escreve em português, muitas vezes em caixa alta; responda em português e trabalhe direto na `main` (commit só quando ele pedir; mensagem em inglês, Conventional Commits, com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).

**Pronto e no ar** (detalhes em `specs/010-daily-rankings-profile.md`, que é atualizada a cada mudança):

- **Cor:** Clássico e Flash (3 rodadas), Rápido (1), Às cegas (5), Sobrevivência (3 vidas, nota mínima de 6 a 9, até 30 rodadas) e Daily (5 rodadas, tela própria com abas).
- **Tempo:** Clássico e Sem estourar (3), Rápido (1), Sequência (5 alvos), Sobrevivência (mesma regra da Cor) e Daily. Alvos de 1 a 18 s com centésimos e espaçados entre si. Nada de cronômetro, número ou som rítmico durante a contagem.
- **Contas obrigatórias para jogar**, histórico com filtros e paginação, perfil com recordes, amigos e perfil de amigo, rankings por jogo, salas (host, pronto, convites, revanche por votação) para Cor e Tempo.
- **App:** PWA com splash animada, offline (continua logado, avisos, pull to refresh), layouts de tablet e desktop, sons por toque real, vidas em corações, animações de nota, aviso de **atualização obrigatória** (tela cheia até tocar em Atualizar).

**Em andamento: o Intruso** (`specs/011-impostor.md`). Variante da Cor só para sala (3 a 8 pessoas): a turma vê a cor, os intrusos recebem só uma dica, todos recriam e votam (intrusos também votam; voto aberto ou anônimo, escolhido no lobby). Com 3 pessoas pode ter até 2 intrusos; sempre sobra pelo menos 1 normal.

- Feito: regras puras e testes em `packages/games/src/impostor`; motor e sala em `apps/api/src/rooms/impostor` (estado por pessoa: a seed nunca sai, a cor só vai para a tripulação, a dica só para o intruso); telas em `apps/web/src/screens/room/ImpostorPlay.tsx` e `Lobby.tsx`; o modo aparece na lista da Cor e leva a "Criar sala".
- **Falta:** (1) escrever o resto da paleta de dicas: hoje só `apps/api/src/rooms/impostor/palette-1.ts` (36 cores quentes, 324 dicas); a meta é mais de 1000. Faltam verdes/azuis, roxos/rosas e neutros/escuros/pastéis em `palette-2..4.ts` no mesmo formato (`color('Nome', h, s, b, [9 dicas])`) e importar em `palette.ts`; (2) trocar o `it.skip` de "tem mais de 1000 dicas" por `it` em `impostor-room.engine.test.ts`; (3) **testar com 3 contas de verdade** (criar sala, lobby, decorar, recriar, votar, revelar, pódio): nunca foi jogado ao vivo; (4) o Intruso não salva no histórico nem tem estatísticas (decisão da spec, pode virar etapa futura).

**Banco:** os dados de jogos foram zerados em 07/10/2026 (partidas, pontos e recordes); a conta do Lucas foi mantida. Schema e migrations intactos.

**Ideias que o Lucas aprovou ou pediu para pensar** (ainda sem spec): jogos sociais como Sincro (todos contam o mesmo tempo em silêncio), Blefe de Nota, Sabotador, Telefone Sem Fio, Caça-Cor, Dicionário de Cores; e jogos de sentidos (Tom, Eco de Ritmo, Sombra). Ver a conversa de 07/10 ou peça novas ideias.

## Armadilhas conhecidas (poupam tempo)

- Nesta máquina (Windows) o `pnpm` não estava no PATH do bash e o Turbo não o achava: rode `npx tsc --noEmit` e `npx vitest run` dentro de cada pacote (`packages/games`, `apps/api`, `apps/web`). **Depois de mudar `packages/games`, rode `npx tsup src/index.ts --format esm,cjs --dts --clean` lá**, senão api e web não veem o código novo.
- Arquivos do repo têm CRLF: edições por script devem normalizar `
`. Heredocs longos no bash do Windows falharam; use a ferramenta de escrita de arquivos.
- O Vite pode guardar uma versão vazia de um arquivo que foi regravado: se a tela ficar em branco com "does not provide an export", mexa no arquivo (ou reinicie o `vite`).
- A API real tentava conectar no Supabase (às vezes dá ETIMEDOUT). Para testar telas sem banco, havia um servidor falso na porta 3333; mate a API real antes.
- `requestAnimationFrame` para quando a aba está oculta: as telas de resultado têm timeout de segurança por causa disso.

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

- [ ] **Trocar a senha do banco no Supabase** e o `BETTER_AUTH_SECRET` (apareceram em capturas de tela) e colocar os novos só no `.env` e nas variáveis do Render.
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
