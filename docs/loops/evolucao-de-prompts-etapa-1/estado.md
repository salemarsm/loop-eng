# Estado — evolucao-de-prompts-etapa-1

- fase: execucao
- estado_terminal: bloqueado
- contrato: v1
- base: main
- quadro: off
- project:
- tokens_subagentes: 589504
- chamadas: 8
- orcamento_tokens: 5310000
- orcamento_chamadas: 59

## Quadro

| id | titulo | status | nivel | rodada | conformidade | qualidade | especialista | commit |
|----|--------|--------|-------|--------|--------------|-----------|--------------|--------|
| T1 | Prompts efetivos, hash de conjunto, override, hash-prompts, campos prompts/prompts_origem no init e aviso no status | bloqueada | sonnet | 2 | aprovado | reprovado | — | — |
| T2 | Subcomando metricas com estadosDoRepo, contaMarcas, metricasLoop e agrega | pendente | sonnet | 0 | — | — | — | — |
| T3 | SKILL.md grava as cinco marcas fixas, lê prompts pelo caminho do hash-prompts, registra despachos e roteia evoluir | pendente | sonnet | 0 | — | — | — | — |
| T4 | Subcomando casos com lerTranscricao, extraiCasos e contratoLacunas sobre transcrições sintéticas e dados reais | pendente | opus | 0 | — | — | — | — |
| T5 | Divisão treino/holdout e placar determinísticos com subcomandos evolucao divide e evolucao placar | pendente | sonnet | 0 | — | — | — | — |
| T6 | Skill evoluir.md com o procedimento e os prompts juiz-evolucao.md e refletor-evolucao.md | pendente | opus | 0 | — | — | — | — |

## Log
- 2026-11-23T19:01 contrato v1 aprovado; worktree criada. Tokens do orquestrador não são medidos; o teto de chamadas cobre isso.
- 2026-11-23T19:03 planejador r1: T1–T6, cobertura conferida; 86410 tokens.
- 2026-11-23T19:04 [plano-aprovado] revisor de plano r1: aprovado (notas: fixtures só em tmpdir; T6 só acrescenta asserções em skill.test.mjs; helpers.mjs só cliEnv); 71384 tokens.
- 2026-11-23T19:05 T1 r1 (sonnet): despacho do implementador.
- 2026-11-23T19:06 T1 r1: implementador devolveu (sem pergunta); guarda ok; verificando.
- 2026-11-23T19:07 T1 r1: verificação verde (prompts 6/6, npm test 58/58); implementador 100992 tokens; revisando.
- 2026-11-23T19:09 T1 r1: guarda pós-revisão ok (diff idêntico); conformidade reprovado (81924 tokens), qualidade reprovado (86479 tokens): teste 'status avisa override velho' roda init sem LOOP_ENG_HOME e lê o ~/.claude/loop-eng real.
- 2026-11-23T19:09 nota da qualidade: testes existentes (via helpers init/cli/criaLoop) também passam a ler o ~/.claude/loop-eng real; corrigir exige mexer em helpers.mjs além de cliEnv ou em package.json (fora das fronteiras) — contrato não resolve; levado ao usuário sem bloquear (resposta vira injeção).
- 2026-11-23T19:09 T1 r2 (sonnet): despacho do implementador com os achados.
- 2026-11-23T19:10 T1 r2: implementador devolveu (sem pergunta); guarda ok; verificando.
- 2026-11-23T19:10 T1 r2: verificação verde (6/6, 58/58); implementador 72559 tokens; revisando.
- 2026-11-23T19:12 T1 r2: guarda pós-revisão ok; conformidade aprovado (89756 tokens); qualidade reprovado (tokens ainda não informados, somado 0): testes existentes via helpers init/cli/criaLoop leem o ~/.claude/loop-eng real; correção exige mexer em test/helpers.mjs além de cliEnv (ou package.json), fora das fronteiras.
- 2026-11-23T19:12 bloqueado: contrato não resolve o conflito entre a Restrição (testes nunca leem o ~/.claude/loop-eng real) e as Fronteiras (helpers.mjs só cliEnv; testes existentes e package.json proibidos). Pergunta ao usuário.
