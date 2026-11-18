# Spec 090: Perfil e perfil de amigo (refazer o visual e completar os dados)

Pedido do Lucas (18/11/2026). Status: **rascunho, aguardando as respostas da seção 8.**

## 1. O que está ruim hoje (imagens que o Lucas mandou)

- **Perfil de amigo:** na lista, o amigo aparece bonito (online, "jogando Mini Golf"). Ao abrir o perfil, tudo vira blocos soltos: os recordes ficam colados nos dados da pessoa, os ícones dos jogos são formas genéricas (`GameArt`), o botão "Ver ranking entre amigos" é grande demais e o resto não tem organização.
- **Meu perfil:** quase vazio. Tem o cabeçalho azul, duas abas e só dois botões enormes ("Editar perfil" e "Sair da conta"). A aba Recordes repete o mesmo problema.
- **Dados:** o banco só guarda nome, e-mail, @usuário e data de criação. Não há como a pessoa se apresentar.

## 2. Metas

1. Os dois perfis usam **a mesma linguagem visual**, dentro dos tokens Pop Brutal (regra do `RULES.md`).
2. **Um desenho para celular e outro para PC.** Celular: uma coluna de cartões. PC: duas colunas (identidade fixa à esquerda, conteúdo à direita). Passa nos 11 tamanhos de celular e nos tamanhos de PC pela varredura `mobile-audit`.
3. **A ação da pessoa no momento** vira destaque: "Jogando Mini Golf" com a capa do jogo, não só uma linha pequena.
4. **Recordes intuitivos**, com a **capa de cada jogo** no lugar das formas genéricas.
5. Mais dados e mais opções no meu perfil.

## 3. Perfil de amigo

De cima para baixo (celular) ou em duas colunas (PC):

1. **Cartão de identidade:** avatar com a cor escolhida, nome em destaque, @usuário, frase de apresentação, selo "online agora" ou "visto há X", "membro desde mês/ano".
2. **Agora:** só quando online. Cartão grande com a capa do jogo e o texto "Jogando Mini Golf" (ou "Em uma sala", "No menu"). Se a pessoa escondeu a atividade, mostra só "Online".
3. **Destaques (4 números):** partidas, dias seguidos, melhor sequência, jogo mais jogado.
4. **Jogo favorito:** o que a pessoa escolheu, com capa.
5. **Recordes** (seção 5).
6. **Ações:** "Ver ranking entre amigos" (botão normal, não gigante) e "Remover amigo" (discreto, com confirmação como hoje).

## 4. Meu perfil

1. **Cartão de identidade** igual ao do amigo, com atalho "Editar" e minha frase.
2. **Destaques** com os mesmos 4 números.
3. **Abas:** Perfil, Recordes.
4. **Aba Perfil:**
   - **Sobre mim:** frase, cor do avatar, jogo favorito (cada um abre uma folha de edição).
   - **Editar perfil:** nome e @usuário (fluxo que já existe, com o intervalo de 15 dias).
   - **Privacidade:** mostrar quando estou online, mostrar o que estou jogando, mostrar meus recordes para amigos.
   - **Aplicativo:** instalar.
   - **Conta:** sair, discreto.
5. **Aba Recordes:** igual à seção 5, com as minhas marcas.

## 5. Recordes (tela nova, a mesma nos dois perfis)

- **Escolha do jogo** em faixa que rola na horizontal, cada jogo com a **capa** (a mesma arte dos cartões do início).
- **Destaque do jogo escolhido:** a melhor marca em número grande.
- **Lista de modos:** uma linha por modo com a melhor nota, a média, as partidas e uma barra da melhor nota contra o máximo do modo. Modo sem partida aparece apagado com "Jogue para criar o primeiro recorde".
- **Daily:** cartão próprio com a sequência atual e a melhor.
- **Word's:** fase em cada jogo (como hoje), com a capa.

## 6. Banco de dados (aditivo, nada é apagado nem alterado)

Uma tabela nova, sem tocar nas tabelas do Better Auth:

`user_profile`: `user_id` (chave, liga a `auth_user`), `bio` (até 140 caracteres, pode ser vazia), `avatar_color` (número da paleta, pode ser vazio), `favorite_game` (id do jogo, pode ser vazio), `show_online` (padrão ligado), `show_activity` (padrão ligado), `show_records` (padrão ligado), `updated_at`.

- "Membro desde" usa `auth_user.created_at`, que já existe.
- Partidas e jogo mais jogado saem das estatísticas que já existem.
- Quem nunca editou o perfil não tem linha na tabela: a API devolve os padrões, então nada quebra para as contas atuais.
- A migração é um arquivo novo em `apps/api/drizzle/`. **Quem aplica no banco real é o Lucas** (`pnpm db:migrate`), ou eu aplico se houver um "sim" e um ambiente com a conexão. A API nova só deve ir para a `main` depois da migração aplicada.

## 7. API e etapas

- `GET /me/profile` e `PATCH /me/profile` (validado com zod: frase aparada e até 140, cor na paleta, jogo na lista).
- O perfil de amigo (`/friends/:username/profile`) ganha frase, cor, jogo favorito, membro desde, partidas e jogo mais jogado, **respeitando a privacidade** (o que a pessoa escondeu volta vazio; `online` falso se ela escondeu).

Etapas:

1. Esta spec e o `INDEX`.
2. Tabela, migração, API e testes.
3. Biblioteca do app (tipos e chamadas).
4. Componentes compartilhados (cartão de identidade, destaques, "Agora", recordes novos).
5. Perfil de amigo.
6. Meu perfil e folhas de edição.
7. CSS de celular e de PC.
8. Varredura nos 11 tamanhos e no PC, testes de tela, `ARCHITECTURE.md`, `docs/ROADMAP.md` e revisão.

## 8. Perguntas em aberto

1. **Campos novos:** frase, cor do avatar, jogo favorito e as 3 opções de privacidade estão bons? Quer mais algum (por exemplo, "título" ou "lema")?
2. **Migração:** posso criar o arquivo da migração, e você aplica no banco com `pnpm db:migrate`? Aqui não tenho a conexão do banco.
3. **Amigo online dentro de uma sala:** o cartão "Agora" deve ter um botão "Entrar na sala" quando o amigo estiver numa sala aberta, ou fica só mostrando?
