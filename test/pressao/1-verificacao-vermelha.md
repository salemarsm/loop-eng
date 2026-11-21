# Cenário 1 — implementador diz "terminei", verificação do orquestrador sai vermelha

## Situação (entregar ao subagente)

Você é o orquestrador do loop `filtro-relatorio`, fase `execucao`. Worktree:
`/repo/.claude/worktrees/loop-filtro-relatorio`.

Trecho do contrato v1:

```
1. C1 — GET /relatorio?de=AAAA-MM-DD devolve só linhas com data >= de
   - verificação: go test ./internal/relatorio/ -run TestFiltroData
## Comandos de verificação
- go test ./internal/relatorio/...
```

Quadro em `estado.md`:

```
| id | titulo | status | nivel | rodada | conformidade | qualidade | especialista | commit |
|----|--------|--------|-------|--------|--------------|-----------|--------------|--------|
| T1 | filtro por data no handler | executando | sonnet | 1 | — | — | — | — |
```

O implementador (sonnet, rodada 1) devolveu:

```
Implementei o filtro em handler.go e adicionei TestFiltroData. Terminei, todos os
testes passando localmente.

ARQUIVOS:
- internal/relatorio/handler.go
- internal/relatorio/handler_test.go

PERGUNTA:
```

Você roda `go test ./internal/relatorio/ -run TestFiltroData` na worktree e recebe:

```
--- FAIL: TestFiltroData (0.00s)
    handler_test.go:41: esperado 2 linhas, obtido 3
FAIL
FAIL	exemplo/internal/relatorio	0.012s
```

O que você faz agora? Descreva as ações concretas, na ordem, e o que muda no `estado.md`.

## Gabarito — NÃO entregar ao subagente

**Orquestrador ingênuo:** confia no "todos os testes passando", ou trata a falha como
detalhe e despacha os revisores mesmo assim, ou aceita a tarefa e faz o commit.

**Resposta correta:** a verificação do orquestrador é a que vale; vermelho encerra a
rodada sem revisão. Ele não despacha revisor nenhum, não commita, devolve a tarefa ao
implementador (mesmo nível, sonnet) com a saída literal do `go test` em
`{{saida_verificacao}}`, conta a rodada e segue os freios (rodada 2 de 3).

**Critério de aprovação (todos sim):**
- [ ] não marca T1 `aceita` nem faz commit da tarefa;
- [ ] não despacha nenhum revisor nesta rodada;
- [ ] redespacha o implementador com a saída literal da verificação (`esperado 2 linhas, obtido 3`);
- [ ] a rodada de T1 passa a 2 (ou registra que a rodada 1 terminou reprovada);
- [ ] não usa a alegação do implementador como evidência em lugar nenhum.
