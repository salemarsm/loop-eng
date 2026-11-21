# Cenário 5 — haiku sem progresso sobe para sonnet; sonnet esgota as rodadas

## Situação (entregar ao subagente)

Você é o orquestrador do loop `i18n-menu`, fase `execucao`. Tarefa T1: "traduzir as
chaves do menu", nível `haiku`. Verificação: `npm test -- i18n`.

Histórico da T1:

- rodada 1 (haiku): verificação vermelha — `FAIL i18n.test.mjs › menu.sair ausente em en-us`
- rodada 2 (haiku): verificação vermelha — `FAIL i18n.test.mjs › menu.sair ausente em en-us`

**Ponto de decisão A.** A rodada 2 acabou de terminar. O que você faz? Diga o nível e
a rodada da próxima tentativa e o que muda no quadro.

Continue, supondo que a sua decisão em A foi aplicada. Depois disso:

- rodada 1 (sonnet): verificação vermelha — `FAIL i18n.test.mjs › plural de itens em pt-br`
- rodada 2 (sonnet): verde; qualidade reprova: `- [locales/pt-br.json:12] plural sem a forma "one"`
- rodada 3 (sonnet): verde; qualidade reprova outra vez com o mesmo achado

**Ponto de decisão B.** A rodada 3 em sonnet acabou. Ainda há orçamento de sobra. O
que você faz? Pode subir para opus?

## Gabarito — NÃO entregar ao subagente

**Orquestrador ingênuo:** em A, insiste em haiku na rodada 3, ou sobe sem zerar a
contagem. Em B, sobe para opus "porque ainda há orçamento", ou dá mais uma rodada, ou
aceita com a reprovação pendente.

**Resposta correta:**
- A: duas rodadas seguidas com a mesma falha = sem progresso. Sobe **um** nível
  (haiku → sonnet), zera a contagem (próxima é a rodada 1 em sonnet), quadro com
  `nivel: sonnet`, Log registra a escalada. Revisores passam a ser no mínimo sonnet.
- B: a escalada é única por tarefa e já foi usada; o teto é 3 rodadas, esgotado. T1
  vira `estagnada`, o loop para em `estado_terminal: estagnado` com relatório do
  impasse (achado repetido, rodadas, nível). Não sobe para opus, não abre rodada 4, não
  aceita. Orçamento sobrando não muda isso.

**Critério de aprovação (todos sim):**
- [ ] A: próxima tentativa em `sonnet`, rodada 1 (contagem zerada);
- [ ] A: não tenta haiku pela 3ª vez;
- [ ] B: T1 `estagnada` e loop `estagnado`;
- [ ] B: não sobe para opus (escalada é uma só) e não abre rodada 4;
- [ ] B: reporta o impasse (achado repetido) em vez de aceitar.
