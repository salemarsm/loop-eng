<p align="center">
  <img src="docs/assets/banner.svg" alt="loop-eng" width="100%">
</p>

<p align="center">
  <a href="https://github.com/salemarsm/loop-eng/actions/workflows/ci.yml"><img src="https://github.com/salemarsm/loop-eng/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2022-339933.svg" alt="Node >= 22">
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-D97757.svg" alt="Claude Code plugin">
  <img src="https://img.shields.io/badge/version-0.1.0-informational.svg" alt="Version 0.1.0">
</p>

<p align="center">
  English | <a href="README.pt-BR.md">Português</a>
</p>

# loop-eng

A Claude Code plugin to develop a whole requirement in a **loop**: you refine the requirement until no doubt is left and approve the contract; then agents plan, implement, review and deliver a PR on their own, with consensus anchored in tests. You only inject changes along the way.

Design: [docs/design.md](docs/design.md). Based on: Macedo, *Stop Hand-Holding Your Coding Agent* (arXiv:2607.00038).

![loop-eng cycle: refine, approved contract, plan, execute with verification and review, PR](docs/assets/ciclo.svg)

## Installation

```
/plugin marketplace add salemarsm/loop-eng
/plugin install loop-eng@loop-eng
```

## Prerequisites

- Node ≥ 22 (the CLI has no npm dependencies) and git.
- `gh` authenticated (`gh auth login`) to open the PR.
- Only for `quadro: github`: the `project` scope, via `gh auth refresh -s project`.
- Windows: the worktree lives at `.claude/worktrees/loop-<slug>` and paths get long; enable `git config --global core.longpaths true` to avoid hitting the 260-character limit.

The `.claude/worktrees/` worktree shows up as untracked in the main checkout. To hide it without touching the project's `.gitignore`, add `.claude/worktrees/` to `.git/info/exclude`.

## Usage

Type in Claude Code, at the root of the target project. Depending on the version, the skill also appears namespaced: `/loop-eng:loop-eng`.

| Command | What it does |
|---|---|
| `/loop-eng <requirement>` | Starts: refinement until zero doubts, contract, approval, then the autonomous loop |
| `/loop-eng inject [slug] '<text>'` | Records an injection (preference, hint or requirement change); takes effect at the next checkpoint |
| `/loop-eng status [slug]` | Shows phase, tasks, terminal state and the loop's worktree |
| `/loop-eng retomar <slug>` | Resumes a stopped loop, from what is on disk |

`slug` is optional when only one loop is active.

```
/loop-eng exportar relatório de pedidos em CSV, filtrável por data
  ... questions, one at a time; you approve the contract ...
/loop-eng inject exportar-relatorio 'não precisa do filtro por data'
/loop-eng status
```

The injection text goes in single quotes.

## How it works

1. **Phase 0, refinement**: the only human gate. It ends with the approved contract (criteria `C1`, `C2`… each with a verification).
2. **Planning**: the plan is reviewed and covers every criterion.
3. **Execution**: task by task; the orchestrator runs the verification and only accepts when every reviewer says `aprovado`.
4. **Delivery**: final review and PR (only on `sucesso`).

Terminal states: `sucesso` (PR opened), `no-op` (already satisfied), `bloqueado` (needs an answer from you; reply with `inject`), `estagnado` (round limits exhausted), `esgotado` (token/call budget exhausted).

State lives in `docs/loops/<slug>/` (`contrato.md`, `plano.md`, `estado.md`, `injecoes.md`), inside the worktree `.claude/worktrees/loop-<slug>`, on the branch `loop/<slug>`. On delivery, a final commit `chore(loop): estado fora do PR` takes that folder out of the PR; the state stays in the branch history and `/loop-eng status` reads it from there.

### GitHub Project board (optional)

With `quadro: github` in the contract, the loop mirrors the tasks into a Project `loop-eng: <slug>` with the field `Etapa` (`pendente`, `executando`, `verificando`, `revisando`, `aceita`, `bloqueada`, `estagnada`). `gh` does not create views: to see columns, in the Project use Board > Column field > `Etapa`. A GitHub failure never stops the loop; the board is marked `dessincronizado` and resynced at the next checkpoint.

### Limitations

- Cost is dominated by the number of calls, not by code size: each subagent costs ~90k tokens of initial context. Refinement estimates the budget from that.
- The orchestrator's own tokens are not measured; the cap on subagent calls covers that.
- Sequential execution, one task at a time.
- The loop never pushes to the main branch, merges, deploys or releases, nor writes outside the worktree: merging the PR is up to you.
- If `init` fails midway (for example, after creating the worktree), clean up by hand before trying again, at the project root:

  ```
  git worktree remove --force .claude/worktrees/loop-<slug>
  git branch -D loop/<slug>
  ```

## Decisions

ADRs in [docs/adr/](docs/adr/).

## License

[MIT](LICENSE) © 2026 salemarsm
