# Skill `loop-eng` — projeto inteiro em loop, com consenso entre agentes

Data: 2026-11-21 · Base: Macedo, *Stop Hand-Holding Your Coding Agent* (arXiv:2607.00038)

## 1. Intenção

O usuário passa um requisito, afina-o até não restar dúvida e sai do caminho.
A partir daí os agentes planejam, implementam, revisam e entregam sozinhos;
quem decide se está bom e se está pronto é o **consenso entre agentes**,
ancorado em verificação determinística (testes, build). O usuário só
**injeta** (correção, prioridade, informação nova) com o loop rodando.

Custo × qualidade: tarefa simples vai para modelo barato, tarefa difícil para
modelo forte — mas a régua de aceite é a mesma para todas.

## 2. Metas, não-metas, anti-metas

**Metas**
- Fase de refinamento interativa que só termina com zero dúvidas → contrato congelado.
- Execução autônoma após o contrato, sem portão humano intermediário.
- Escolha de modelo por tarefa (`haiku` / `sonnet` / `opus`).
- Consenso: ninguém aprova o próprio trabalho; testes verdes são veto.
- Injeção a qualquer momento, sem parar o loop.
- Estado em disco: o loop retoma após compactação ou queda da sessão.
- Estados terminais nomeados e orçamento com freio.

**Não-metas**
- Merge, deploy, release. O loop termina no PR aberto (regra vigente: merge/deploy só com ok do usuário).
- Execução em segundo plano via Workflow ou Hermes (abordagens B/C, possíveis depois).
- Paralelizar tarefas na v1 (sequencial; worktree única).

**Anti-metas** (se acontecer, falhou mesmo "funcionando")
- Agente aprovando o próprio trabalho, ou orquestrador aceitando "terminei" sem rodar a verificação ele mesmo.
- Testes enfraquecidos, apagados ou `t.Skip` para passar (specification gaming).
- Loop que gasta sem progresso e não para.
- Loop que adivinha o que o contrato não diz em vez de marcar *bloqueado*.

## 3. Abordagens consideradas

| | Abordagem | Troca |
|---|---|---|
| **A (escolhida)** | Skill; a sessão atual orquestra subagentes com `model` por tarefa; estado em disco | Injeção pelo chat natural, reaproveita agentes revisores existentes. Sessão fica ocupada; projeto longo depende de retomar do disco |
| B | Script Workflow gerado do contrato, em segundo plano | Parada/orçamento garantidos por código e paralelo, mas não aceita injeção com o loop rodando |
| C | Hermes via kanban | Fora da sessão, mas consenso/verificação lentos e frágeis (travou 26–29/09) |

Usuário escolheu A em 2026-11-21.

## 4. Desenho

### 4.1 Nome e local
- **Repo próprio `salemarsm/loop-eng` (privado), no formato de plugin do Claude Code** (`.claude-plugin/plugin.json` + `marketplace.json`, `skills/loop-eng/`). Instala em qualquer projeto com `/plugin marketplace add salemarsm/loop-eng` + `/plugin install`. README com instalação e uso; este design e ADRs em `docs/`. Nome evita colisão com a skill nativa `loop` (execução por intervalo).
- Nada específico de projeto na skill: comandos de verificação, pastas permitidas e arquivos críticos vêm do contrato (refinamento pergunta ou descobre olhando o projeto: `go.mod`, `package.json`, CLAUDE.md…).
- Comandos: `/loop-eng <requisito>` inicia; `/loop-eng inject [slug] <texto>` injeta (§4.4); `/loop-eng retomar <slug>` retoma; `/loop-eng status <slug>` mostra o estado. `slug` é opcional quando só há um loop ativo.


### 4.2 Fases

**Fase 0 — Refinamento (interativa, única com o usuário).**
Perguntas uma por vez, como no brainstorming. Sai só quando o checklist "zero dúvidas" fecha:
- todo critério de aceite é verificável no nível 1–3 da escada (comando, teste, regra) — ou declarado explicitamente nível 4/5 com quem julga;
- não-metas e restrições escritas;
- fronteira de autonomia: o que o loop pode tocar (pastas, arquivos críticos) e o que nunca faz;
- orçamento (tokens totais, rodadas por tarefa) e comandos de verificação;
- nenhuma pergunta aberta na lista do orquestrador.
Saída: `contrato.md` v1, aprovado pelo usuário. **Único portão humano.**

**Fase 1 — Planejamento (autônoma).**
Planejador (`opus`) quebra o contrato em tarefas: arquivos, critério de aceite ligado ao contrato, comando de verificação, **nível de modelo** e justificativa do nível.
Revisor de plano (`opus`, instância separada) confere cobertura do contrato e níveis. Consenso = revisor aprova; até 2 rodadas, senão *estagnado*.

**Fase 2 — Execução (autônoma), por tarefa:**
1. Implementador no nível da tarefa recebe tarefa + trecho do contrato (não o histórico).
2. **Orquestrador roda a verificação ele mesmo** (nível 1). Vermelho → volta ao implementador com a saída.
3. Verde → revisores em paralelo, cada um recebe o **diff + contrato**, nunca o resumo do implementador:
   - revisor de conformidade (`sonnet`): faz o que a tarefa pede, nada a mais;
   - revisor de qualidade (`opus`): correção, testes, e **guarda anti-gaming** (diff de teste removendo/afrouxando asserção ou adicionando skip = reprovação);
   - especialista quando a tarefa toca área sensível: `security-scanner` (auth, rede, crypto, dados de tenant), `migration-reviewer` (schema), `perf-analyzer` (hot path).
4. **Consenso** = verificação verde + todos os revisores aprovam. Senão, feedback consolidado volta ao implementador.
5. Freios por tarefa: 3 rodadas; se 2 rodadas seguidas sem progresso (mesmas falhas), sobe **um** nível de modelo (haiku→sonnet→opus) e zera a contagem uma vez; depois disso → *estagnado*.
6. Aceita → commit na branch do loop, ledger atualizado.

**Fase 3 — Entrega (autônoma).**
Revisor final (`opus`) lê o diff inteiro da branch contra o contrato; orquestrador marca cada critério de aceite com evidência (comando + saída). Tudo OK → push + PR com o relatório. *Sucesso.*
Reprovação → cada achado vira tarefa corretiva nova (planejador atribui nível) e volta à Fase 2; até 2 rodadas de revisão final, depois *estagnado*. *(decisão do orquestrador)*

### 4.3 Níveis de modelo

| Nível | Quando | Exemplos |
|---|---|---|
| `haiku` | mecânico, 1–2 arquivos, spec sem ambiguidade | renomear, doc, teste a partir de casos dados, i18n |
| `sonnet` | feature padrão, multi-arquivo, spec clara | handler + teste, query + índice |
| `opus` | desenho, concorrência, segurança, transversal, depuração | lock, protocolo agente×hub, bug sem causa conhecida |

Regra: revisor de qualidade sempre `opus`; **nenhum revisor abaixo do implementador** — vale para conformidade e especialistas também: cada revisor é chamado com `model = max(nível padrão dele, nível do implementador)` (o parâmetro `model` da ferramenta Agent sobrepõe o frontmatter). Qualidade acima de custo, a pedido do usuário. Orquestrador = modelo da sessão.

Especialistas: usa os agentes globais (`security-scanner`, `migration-reviewer`, `perf-analyzer`) se existirem; senão `general-purpose` com o mesmo foco no prompt. Eles só têm Read/Grep/Glob, então **o orquestrador roda `git diff` e manda o diff inline** a todo revisor.

### 4.4 Injeções
- Canal oficial: **`/loop-eng inject [slug] <texto>`** — acrescenta entrada datada em `docs/loops/<slug>/injecoes.md` da worktree do loop. Funciona de qualquer sessão (a do loop, outra sessão Claude, Remote Control no celular), porque o destino é o arquivo, não a conversa.
  - Na sessão do loop rodando: a mensagem chega no próximo ponto entre ferramentas; o orquestrador grava no arquivo e trata no checkpoint seguinte.
  - Loop parado em *bloqueado*: a injeção que responde ao bloqueio retoma o loop.
  - Loop parado em outro estado terminal ou sessão fechada: só grava; vale no próximo `retomar`.
  - Resposta do comando: confirma gravação e diz quando será lida (próximo checkpoint / próximo retomar).
- Mensagem solta no chat da sessão do loop também vale como injeção (mesmo tratamento); escrever direto no `injecoes.md` também.
- Lidas em todo checkpoint (entre tarefas e entre rodadas).
- Classificação pelo orquestrador, registrada no estado:
  - **dentro do contrato** (preferência, prioridade, dica) → aplica;
  - **muda o contrato** → nova versão do contrato com a mudança anotada; tarefas pendentes afetadas voltam ao planejador; tarefas **já aceitas** afetadas ganham tarefa corretiva por cima — histórico da branch nunca é reescrito (sem revert forçado, sem force push);
  - **conflita com o contrato** sem dizer qual vence → *bloqueado*, pergunta ao usuário.
- `injecoes.md`: cada entrada consumida ganha marca `[aplicada <hora>]`, nunca é apagada.

### 4.5 Estado em disco — `docs/loops/<slug>/`
- `contrato.md` — versionado (v1, v2…), critérios numerados.
- `plano.md` — tarefas com nível, arquivos, verificação.
- `estado.md` — fase atual, ledger por tarefa (status, rodadas, modelo, tokens, commit), log de injeções, tokens acumulados, custo por mudança aceita.
- `injecoes.md` — caixa de entrada do usuário.
Tudo commitado na branch do loop; `retomar` lê só esses arquivos.

### 4.5.1 Quadro das tarefas (kanban)
- **Fonte da verdade: tabela-quadro no `estado.md`** — colunas `pendente → executando → verificando → revisando → aceita`, mais `bloqueada` e `estagnada`. Cartão = id, título, nível de modelo, rodada, veredito por revisor, commit.
- **Espelho opcional: GitHub Projects (v2)**, ligado no contrato (`quadro: github`). Um Project por loop (`loop-eng: <slug>`), tarefas como **itens de rascunho** (não issues), campo single-select `Status` com as colunas acima, campos `Nível` e `Rodada`. Orquestrador cria/move via `gh project` a cada checkpoint.
- Espelho nunca bloqueia: falha de rede/GitHub → loop segue, marca `quadro: dessincronizado` no `estado.md` e ressincroniza no checkpoint seguinte.
- Pré-requisito: token do `gh` com escopo `project` (`gh auth refresh -s project`, feito pelo usuário). Sem escopo → loop avisa e roda só com o quadro do `estado.md`.
- Ao fim (qualquer estado terminal), o Project fica como registro; link no PR.

### 4.6 Estados terminais e orçamento
- **sucesso** — PR aberto, todos os critérios com evidência.
- **no-op** — nada a fazer (requisito já atendido), com evidência.
- **bloqueado** — falta informação ou permissão; loop pergunta e espera.
- **estagnado** — freio de progresso disparou; relatório do impasse.
- **esgotado** — orçamento do contrato acabou; relatório do que foi aceito.
Esgotado/erro nunca vira sucesso.
Orçamento = **tokens de subagentes** (o resultado da ferramenta Agent traz `subagent_tokens`) + teto de rodadas por tarefa e de chamadas totais. Tokens do próprio orquestrador não são medidos — limitação declarada no `estado.md`; o teto de chamadas é o freio que cobre isso. *(decisão do orquestrador)*

### 4.7 Fronteiras fixas (não negociáveis no contrato)
- Branch e worktree próprias (`loop/<slug>` em `.claude/worktrees/loop-<slug>`), criadas do `origin/master` **logo após o contrato ser aprovado**; primeiro commit = `contrato.md`. Fase 0 escreve o rascunho no scratchpad. Orquestrador passa caminho absoluto da worktree a todo subagente; `retomar` acha o loop por `git worktree list` / branch `loop/<slug>`.
- Nunca: push na branch principal, merge, deploy, release, ou escrita fora da worktree do loop.
- Fronteiras do projeto entram no contrato: infra e caminhos proibidos (no BinaryDome: VPS, `C:Program FilesDNSSecurity`) e arquivos críticos que exigem menção explícita (no BinaryDome: CLAUDE.md §10). O refinamento lê CLAUDE.md/AGENTS.md do projeto para propor essa lista.

## 5. Arquivos da skill
- `skills/loop-eng/SKILL.md` — fluxo do orquestrador (fases, consenso, freios, injeções, estados).
- `skills/loop-eng/refinamento.md` — checklist zero dúvidas + como conduzir as perguntas.
- `modelos/contrato.md`, `modelos/estado.md` — templates.
- `prompts/planejador.md`, `prompts/implementador.md`, `prompts/revisor-conformidade.md`, `prompts/revisor-qualidade.md`, `prompts/revisor-final.md`.

## 6. Validação da própria skill
Rodar um loop real pequeno no BinaryDome (requisito de 2–3 tarefas, ex.: um card simples do kanban) e conferir: contrato fecha, níveis variam, consenso reprova ao menos uma vez algo plantado (teste afrouxado), injeção pelo arquivo é consumida, `retomar` funciona após interromper.

## 7. Deixado ao construtor
Redação exata dos prompts; formato de tabela do ledger; heurística de "mesmas falhas" (sugestão: mesmo conjunto de testes falhando ou mesmos achados do revisor).
