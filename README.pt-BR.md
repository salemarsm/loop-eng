<p align="center">
  <img src="docs/assets/banner.svg" alt="loop-eng" width="100%">
</p>

<p align="center">
  <a href="https://github.com/salemarsm/loop-eng/actions/workflows/ci.yml"><img src="https://github.com/salemarsm/loop-eng/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Licença: MIT"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2022-339933.svg" alt="Node >= 22">
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-D97757.svg" alt="Plugin do Claude Code">
  <img src="https://img.shields.io/badge/version-0.1.0-informational.svg" alt="Versão 0.1.0">
</p>

<p align="center">
  <a href="README.md">English</a> | Português
</p>

# loop-eng

Plugin do Claude Code para desenvolver um requisito inteiro em **loop**: você afina o requisito até não restar dúvida e aprova o contrato; depois agentes planejam, implementam, revisam e entregam um PR sozinhos, com consenso ancorado em testes. Você só injeta mudanças pelo caminho.

Desenho: [docs/design.md](docs/design.md). Base: Macedo, *Stop Hand-Holding Your Coding Agent* (arXiv:2607.00038).

![Ciclo do loop-eng: refinamento, contrato aprovado, planejamento, execução com verificação e revisão, PR](docs/assets/ciclo.svg)

## Instalação

```
/plugin marketplace add salemarsm/loop-eng
/plugin install loop-eng@loop-eng
```

## Pré-requisitos

- Node ≥ 22 (o CLI não tem dependências npm) e git.
- `gh` autenticado (`gh auth login`) para abrir o PR.
- Só para `quadro: github`: escopo `project`, via `gh auth refresh -s project`.
- Windows: a worktree fica em `.claude/worktrees/loop-<slug>` e os caminhos ficam longos; ligue `git config --global core.longpaths true` para não estourar o limite de 260 caracteres.

A worktree `.claude/worktrees/` aparece como não rastreada no checkout principal. Para escondê-la sem mexer no `.gitignore` do projeto, acrescente `.claude/worktrees/` a `.git/info/exclude`.

## Uso

Digite no Claude Code, na raiz do projeto-alvo. Dependendo da versão, a skill também aparece com namespace: `/loop-eng:loop-eng`.

| Comando | O que faz |
|---|---|
| `/loop-eng <requisito>` | Inicia: refinamento até zero dúvidas, contrato, aprovação, e então o loop autônomo |
| `/loop-eng inject [slug] '<texto>'` | Grava uma injeção (preferência, dica ou mudança de requisito); vale no próximo checkpoint |
| `/loop-eng status [slug]` | Mostra fase, tarefas, estado terminal e a worktree do loop |
| `/loop-eng retomar <slug>` | Retoma um loop parado, a partir do que está em disco |

`slug` é opcional quando só há um loop ativo.

```
/loop-eng exportar relatório de pedidos em CSV, filtrável por data
  ... perguntas, uma por vez; você aprova o contrato ...
/loop-eng inject exportar-relatorio 'não precisa do filtro por data'
/loop-eng status
```

O texto da injeção vai entre aspas simples.

## Como funciona

1. **Fase 0, refinamento**: único portão humano. Termina no contrato aprovado (critérios `C1`, `C2`… com verificação).
2. **Planejamento**: o plano é revisado e cobre todos os critérios.
3. **Execução**: tarefa por tarefa; o orquestrador roda a verificação e só aceita com todos os revisores `aprovado`.
4. **Entrega**: revisão final e PR (só no `sucesso`).

Estados terminais: `sucesso` (PR aberto), `no-op` (já atendido), `bloqueado` (falta resposta sua; responda com `inject`), `estagnado` (freios de rodadas esgotados), `esgotado` (orçamento de tokens/chamadas).

Estado em `docs/loops/<slug>/` (`contrato.md`, `plano.md`, `estado.md`, `injecoes.md`), dentro da worktree `.claude/worktrees/loop-<slug>`, na branch `loop/<slug>`. Na entrega, um commit final `chore(loop): estado fora do PR` tira essa pasta do PR; o estado continua no histórico da branch e o `/loop-eng status` o lê de lá.

### Quadro no GitHub Project (opcional)

Com `quadro: github` no contrato, o loop espelha as tarefas num Project `loop-eng: <slug>` com o campo `Etapa` (`pendente`, `executando`, `verificando`, `revisando`, `aceita`, `bloqueada`, `estagnada`). O `gh` não cria views: para ver colunas, no Project use Board > Column field > `Etapa`. Falha do GitHub nunca para o loop; o quadro fica `dessincronizado` e é ressincronizado no checkpoint seguinte.

### Limitações

- O custo é dominado pelo número de chamadas, não pelo tamanho do código: cada subagente custa ~90 mil tokens de contexto inicial. O refinamento estima o orçamento a partir disso.
- Tokens do próprio orquestrador não são medidos; o teto de chamadas de subagentes cobre isso.
- Execução sequencial, uma tarefa por vez.
- O loop nunca faz push na branch principal, merge, deploy ou release, nem escreve fora da worktree: o merge do PR é seu.
- Se o `init` falhar no meio (por exemplo, depois de criar a worktree), limpe à mão antes de tentar de novo, na raiz do projeto:

  ```
  git worktree remove --force .claude/worktrees/loop-<slug>
  git branch -D loop/<slug>
  ```

## Decisões

ADRs em [docs/adr/](docs/adr/).

## Licença

[MIT](LICENSE) © 2026 salemarsm
