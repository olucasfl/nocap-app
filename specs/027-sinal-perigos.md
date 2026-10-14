# 027 · Sinal Vermelho: arremessadores, perseguidores, Vigia apressado e itens

Status: **implementada (núcleo, servidor, tela e som); falta jogar para calibrar.** Pedido do Lucas (14/10/2026). Complementa a [spec 026](026-sinal-vermelho-2.md).

## Arremessadores (jogam coisas em você)

- Ficam na borda do corredor (catapulta na horta, canhão-robô na rua, estátua de pedra no deserto), nunca nos primeiros 36 m. Jogam no ritmo deles (cada um tem o seu ciclo) quando você está a até 24 m à frente deles.
- **Lob:** uma marca vermelha aparece no chão, **0,9 s** de aviso mais **0,55 s** de voo; o alvo é onde você vai estar daqui a pouco (a mira "adianta" um pouco). Sair da marca basta. Atingido: joga você para longe e te **atordoa** (estrelas na cabeça); se o Vigia olhar nesse tempo, é o fim, como nos obstáculos.
- **Roll (a partir do nível 3):** uma faixa vermelha acende de lado a lado por 1,1 s e depois uma bola rola por ela. Dá para esperar a bola passar ou estar fora da faixa.
- **Justiça com o Vigia:** de 1,2 s antes de ele olhar até o fim do olhar nenhuma pancada vale (os arremessos viram "festim", com a marca apagada). Sem isso o jogador teria de escolher entre ser atingido parado ou desviar e ser visto.
- Quem está escondido (esconderijo ou Sombra) não é atingido.
- Com a dificuldade ficam mais seguidos e jogam mais depressa.

## Perseguidores

- A partir da fase 2 do Clássico (e depois de uns 70 m no Infinito) aparece **um bicho à frente que corre atrás de você** (cachorro bravo, cão-robô, chacal), de 2,3 a 3,5 m/s: **sempre mais lento** que o boneco (4,2 m/s).
- **Só anda enquanto você anda.** Parou, ele para (fica espreitando, com um "?"). **Se esconde, ele para** também. Também espera enquanto o Vigia está para olhar ou olhando.
- Não atravessa os obstáculos sólidos (dá para usá-los). Desiste se ficar muito para trás.
- Se te alcança: joga você para longe e te atordoa; ele fica tonto por 2 s (tem como fugir).

## O Vigia apressado

- De vez em quando (nunca no começo; de 12% a 32% dos ciclos conforme a dificuldade) a cantiga vem **bem mais depressa** (compasso 38% menor, mínimo de 0,26 s). O aviso continua com pelo menos 0,55 s.
- Sinais: o aviso vermelho **ACELEROU!** treme sobre a faixa da cantiga, a melodia sobe dois tons e ganha um tique.

## Itens do jogador (os "poderes")

Decididos pelo Lucas em 14/10/2026: nenhum item mexe no Vigia.

- Itens no caminho, em lugares fixos pela seed (nunca nos primeiros 20 m, nunca dentro de um obstáculo); passar por cima pega, **1 por vez**.
- **Sombra:** fica escondido em qualquer lugar por **2 s** (protege do Vigia, dos arremessos e dos perseguidores). **Impulso:** corre **1,6x** mais rápido por 2 s.
- Usar: tecla **E** ou **Espaço**, ou o botão grande que aparece embaixo à direita no celular. O uso entra nos movimentos gravados (`x` 127, `y` 0, no mesmo instante de uma mudança do analógico se preciso) e o servidor refaz a corrida com ele.
- A **sala online não usa itens ainda** (`itemsEnabled` desligado); os arremessadores e perseguidores valem lá também.
- Itens que atrapalham outros jogadores ficam para o redesenho da sala.
