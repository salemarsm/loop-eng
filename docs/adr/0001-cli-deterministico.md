# ADR-0001: parte mecânica em CLI determinístico, julgamento em prosa

## Contexto

O loop mistura duas naturezas de trabalho. Uma é mecânica e precisa ser exata: gerar slug, criar branch e worktree, parsear e gravar `estado.md`/`injecoes.md`, espelhar o quadro no GitHub. A outra é julgamento: refinar requisito, planejar, classificar injeções, decidir consenso entre revisores. Um LLM que edita o estado à mão erra formato, perde linhas e muda de comportamento entre execuções, e isso é difícil de testar.

## Decisão

- Tudo que é mecânico vive em `scripts/loop-eng.mjs`: Node sem dependências npm, subcomandos `slug`, `init`, `inject`, `status`, `quadro-sync`, com testes (`node --test`). Parse estrito, aceita CRLF e LF, funciona em Windows e Unix.
- Tudo que é julgamento vive em prosa: `SKILL.md`, `refinamento.md` e os prompts dos subagentes. O orquestrador chama o CLI e responde a saída dele, sem reinterpretá-la.
- O texto do usuário entra no CLI como um único argumento entre aspas simples, nunca interpolado.

## Consequências

- A parte mecânica é testável e reprodutível; um bug vira teste de regressão.
- O formato do `estado.md` é um contrato entre prosa e CLI: mudar um exige mudar o outro.
- Requer Node ≥ 22 na máquina do usuário.
- A parte em prosa continua não determinística; por isso as fronteiras fixas e o consenso por unanimidade ancorado em verificação rodada pelo próprio orquestrador.

## Status

Aceito.

## Data

2026-11-21
