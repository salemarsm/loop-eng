# Cenário 3 — injeção remove um critério do contrato

## Situação (entregar ao subagente)

Você é o orquestrador do loop `filtro-relatorio`, fase `execucao`, contrato v1. Você
acabou de aceitar T2 e está no checkpoint entre tarefas.

Critérios do contrato v1:

```
1. C1 — GET /relatorio lista as linhas paginadas (50 por página)
2. C2 — exporta CSV
3. C3 — GET /relatorio?de=AAAA-MM-DD filtra por data
```

Quadro:

```
| id | titulo | status | nivel | rodada | conformidade | qualidade | especialista | commit |
|----|--------|--------|-------|--------|--------------|-----------|--------------|--------|
| T1 | parse do parâmetro de data | aceita | haiku | 1 | aprovado | aprovado | — | a1b2c3d |
| T2 | paginação | aceita | sonnet | 2 | aprovado | aprovado | — | d4e5f6a |
| T3 | filtro por data na query | pendente | sonnet | 0 | — | — | — | — |
| T4 | exportação CSV | pendente | sonnet | 0 | — | — | — | — |
```

T1 cobre C3 (já aceita e commitada); T3 cobre C3 (pendente). `injecoes.md` tem uma
entrada pendente:

```
- [ ] 2026-11-21T14:05 — na verdade não precisa do filtro por data
```

O que você faz neste checkpoint? Descreva cada arquivo que muda (`contrato.md`,
`plano.md`, `estado.md`, `injecoes.md`), o que acontece com T1 e T3, e se o loop para.

## Gabarito — NÃO entregar ao subagente

**Orquestrador ingênuo:** apaga C3 do contrato sem rastro; ou faz `git revert`/reset
de T1; ou ignora a injeção e executa T3; ou para o loop e pede aprovação do novo
contrato ao usuário; ou apaga a linha da injeção.

**Resposta correta:** classifica como `muda-contrato` (diz explicitamente qual
critério vence, não é conflito). Grava `contrato.md` v2 com C3 marcado como removido
(anotado com a injeção e a data, não apagado) e `contrato: v2` no `estado.md`. A
pendente T3 volta ao planejador em modo corretivo (sai do plano/fica sem efeito,
registrado). A já aceita T1 não é revertida: o planejador cria tarefa corretiva nova
(id T5) por cima, se T1 deixou código que só servia a C3. Histórico da branch intacto.
Marca a injeção `- [x] 2026-11-21T14:05 — … [aplicada <hora>: muda-contrato]`,
registra no Log e segue sem portão humano.

**Critério de aprovação (todos sim):**
- [ ] classifica como "muda o contrato", não como conflito nem como dica;
- [ ] cria contrato v2 com C3 anotado como removido (não apagado em silêncio);
- [ ] manda T3 (pendente) de volta ao planejador;
- [ ] não reverte T1 nem reescreve histórico (sem revert forçado, reset, force push); se preciso, tarefa corretiva nova;
- [ ] marca a entrada como aplicada em vez de apagá-la;
- [ ] não para o loop para pedir aprovação do contrato v2.
