# ADR-0002: injeção explícita muda o contrato e a mais nova vence

## Contexto

O design §4.4 dizia que injeção que "conflita com o contrato sem dizer qual vence" leva a `bloqueado`. Lida de forma ampla, qualquer injeção que contraria um critério bloquearia o loop. O cenário de pressão 3 (injeção "não precisa do filtro por data" com C3 = filtro por data) mostrou que a leitura estreita é a pretendida: o usuário disse claramente o que quer, e bloquear só o obrigaria a repetir.

## Decisão

Classificação no checkpoint:

- `dentro-do-contrato`: preferência, prioridade ou dica; aplica sem mudar o contrato.
- `muda-contrato`: pedido explícito de remover, trocar ou acrescentar algo que o contrato nomeia. A injeção é mais nova e vence por padrão: grava-se o contrato v(N+1) (critério removido riscado e anotado, nunca apagado), seguido de planejamento corretivo, sem pedir aprovação.
- `conflito` (leva a `bloqueado`): só quando o efeito é indecidível, isto é, quebra um critério que a injeção não menciona ou contradiz outra injeção pendente.

## Consequências

- O usuário muda o rumo sem repetir a mesma instrução, e o único portão humano continua sendo a aprovação do contrato inicial.
- Risco: uma injeção ambígua pode ser lida como `muda-contrato`. Mitigação: o contrato anterior permanece versionado, e tarefas já aceitas ganham tarefa corretiva por cima, sem revert.
- `bloqueado` fica reservado a dúvida real.

## Status

Aceito.

## Data

2026-11-21
