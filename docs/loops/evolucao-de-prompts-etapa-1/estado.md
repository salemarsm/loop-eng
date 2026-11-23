# Estado — evolucao-de-prompts-etapa-1

- fase: execucao
- estado_terminal:
- contrato: v1
- base: main
- quadro: off
- project:
- tokens_subagentes: 157794
- chamadas: 2
- orcamento_tokens: 5310000
- orcamento_chamadas: 59

## Quadro

| id | titulo | status | nivel | rodada | conformidade | qualidade | especialista | commit |
|----|--------|--------|-------|--------|--------------|-----------|--------------|--------|
| T1 | Prompts efetivos, hash de conjunto, override, hash-prompts, campos prompts/prompts_origem no init e aviso no status | executando | sonnet | 1 | — | — | — | — |
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
