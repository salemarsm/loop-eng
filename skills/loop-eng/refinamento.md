# Refinamento (Fase 0) — até zero dúvidas

Esta é a única fase com o usuário e o único portão humano. Depois do contrato aprovado
o loop roda sozinho; toda dúvida que sobrar aqui vira adivinhação ou `bloqueado` depois.

## Antes de perguntar

1. Leia `CLAUDE.md`, `AGENTS.md` e `README` do projeto, se existirem.
2. Olhe o projeto: manifesto de build (`go.mod`, `package.json`, `pyproject.toml`,
   `Cargo.toml`…), pasta de testes, CI (`.github/workflows/`), código perto do requisito.
3. Descubra sozinho o que dá para descobrir: comandos de teste/build, pastas, arquivos
   críticos e caminhos proibidos declarados no CLAUDE.md/AGENTS.md. Não pergunte o que
   o projeto já responde; **proponha** e peça confirmação.

## Como perguntar

- **Uma pergunta por mensagem.** Espere a resposta antes da próxima.
- Prefira múltipla escolha com a sua recomendação primeiro; pergunta aberta só quando
  não há opções razoáveis.
- Cada resposta é anotada no rascunho do contrato na hora.
- Se a resposta abre dúvida nova, ela entra na fila; a fila precisa chegar a zero.
- Requisito grande demais para um loop (vários subsistemas independentes): diga e
  proponha quebrar em loops separados antes de detalhar.

## Checklist "zero dúvidas"

O contrato só vai para aprovação quando todos os itens estão fechados:

- [ ] **Requisito** em poucas frases: o que e por quê.
- [ ] **Critérios de aceite numerados** (`C1`, `C2`…), cada um verificável por comando,
      teste ou regra checável (níveis 1–3), com a `verificação:` escrita. Critério que
      só um humano julga (nível 4/5) é declarado como tal, com quem julga.
- [ ] **Não-metas**: o que fica fora, por escrito.
- [ ] **Restrições**: técnicas, de escopo, de compatibilidade.
- [ ] **Fronteiras do projeto**: pastas/arquivos que o loop pode tocar; caminhos
      proibidos e infra que nunca toca; arquivos críticos que só mudam com menção
      explícita no contrato (proponha a lista a partir do CLAUDE.md/AGENTS.md).
- [ ] **Comandos de verificação** de build/teste, conferidos no projeto (rode-os uma vez
      na árvore atual para saber se já passam). Com a linha de base vermelha o contrato
      não fecha: ou a correção vira critério, ou os comandos são estreitados ao que passa.
- [ ] **Orçamento**: `orcamento_tokens` (tokens de subagentes) e `orcamento_chamadas`
      (chamadas de subagente). Cada chamada custa ~90 000 tokens de piso (contexto
      inicial), qualquer que seja a tarefa. Estime: `chamadas` = 2 (plano) + tarefas × 3
      (implementador + 2 revisores) × 2 (uma reprovação cada) + 1 (final); `orcamento_chamadas`
      = `chamadas` × 1,5; `orcamento_tokens` = `orcamento_chamadas` × 90 000. Ex.: 2 tarefas →
      15 chamadas → 23 / 2 070 000. Mostre a conta ao usuário.
- [ ] **Quadro**: `off` ou `github` (espelho no GitHub Projects; exige `gh` com escopo
      `project` — `gh auth refresh -s project`, feito pelo usuário).
- [ ] **Nenhuma pergunta aberta** na sua fila.

Fronteiras fixas que não se negociam (não pergunte, só informe se o usuário tentar
mudar): branch/worktree próprias, nunca push na branch principal, merge, deploy,
release ou escrita fora da worktree. O loop termina no PR aberto.

## Saída

1. Escreva o contrato preenchendo `modelos/contrato.md` (mesmas seções, mesma ordem;
   em `## Quadro` só `off` ou `github`) no scratchpad da sessão — nunca no projeto.
2. Mostre o contrato inteiro ao usuário e peça **aprovação explícita**: "Aprova este
   contrato? Depois dele o loop roda sozinho até o PR." Só "sim"/"aprovo" ou
   equivalente inequívoco conta; pedido de ajuste volta ao checklist.
3. Se o requisito já está atendido (você verificou com os comandos), proponha encerrar
   como **no-op** com a evidência, em vez de abrir loop.
4. Aprovado → volte ao `SKILL.md`, passo "Contrato aprovado".
