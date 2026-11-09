# Spec 068: Daily, sala e partidas com o tema dos hubs

Status: implementada (09/11/2026). Complementa a spec 067 (pedidos do Lucas).

- **Daily dentro do hub** (Mesmíssima, Já Deu?, Ecooo): as páginas antigas (`DailyScreen`) saíram. O Daily é uma subtela do hub: à esquerda o estado de hoje (jogado com a nota ou ainda não), as regras do dia, o contador "FALTA hh:mm:ss" até a meia-noite de Brasília e o botão de jogar (convite de login sem conta, aviso sem internet); à direita Resumo, Ranking, Amigos e Regras do dia (`HubDaily`). O painel do Daily nas telas finais segue como estava.
- **Sala com amigos temática**: a sala (lobby) da Mesmíssima, do Intruso, do Já Deu? e do Ecooo usa a moldura temática (cenário, símbolo e cor do hub), com painéis sólidos (`LobbyShell`).
- **Sem "Como jogar" antes da partida** no Já Deu? e no Ecooo: as regras ficam no hub. A escolha de música do Eco Hero continua.
- **Partidas com o tema do hub** (`GameTheme`): cenário suave atrás e acento de cor nos cabeçalhos. Parado durante a rodada (decorar, contar, tocar) e animado nos resultados; o cenário não marca ritmo na contagem do Já Deu?.
- Voltar de uma partida abre o hub nos modos de jogo.
- Hub do Já Deu?: o quadro mostra um relógio em que o ponteiro oscila tentando acertar o alvo (sem números).
