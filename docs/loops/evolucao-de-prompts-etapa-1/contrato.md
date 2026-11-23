# Contrato — evolucao-de-prompts-etapa-1

## Requisito

Implementar as Tasks 1 a 6 do plano de medição e evolução de prompts do loop-eng (etapa 1: só o
planejador evolui). O plano e o design são a especificação detalhada e **valem como parte deste
contrato** (interfaces, nomes, assinaturas, testes e valores):

- Plano: `C:/Users/salem/AppData/Local/Temp/claude/6f7b0f2808425d87/d17d9bad-3e9e-4d0c-af06-386fef7a7f3b/scratchpad/ref-evolucao/2026-11-23-evolucao-de-prompts.md`
- Design: `C:/Users/salem/AppData/Local/Temp/claude/6f7b0f2808425d87/d17d9bad-3e9e-4d0c-af06-386fef7a7f3b/scratchpad/ref-evolucao/2026-11-23-evolucao-de-prompts-design.md`

(Os dois arquivos estão fora da worktree; leia-os pelo caminho absoluto, somente leitura. Em
conflito entre plano e design, vale o plano; em conflito com este contrato, vale este contrato.)

Por quê: medir quão bons são os prompts do loop (retrabalho, custo, contrato com lacuna) e evoluir
o `planejador.md` com base em falhas reais, no plugin e em override do usuário.

## Critérios de aceite

1. C1 — Task 1 do plano: `scripts/lib/prompts.mjs` (`dadosHome`, `skillDir`, `promptsEfetivos`,
   `hashConjunto`, `overridesVelhos`), subcomando `hash-prompts`, `init` grava `prompts` e
   `prompts_origem` no `estado.md` (modelo atualizado), `status` avisa override velho, helper
   `cliEnv` em `test/helpers.mjs`; testes de `test/prompts.test.mjs` com os casos listados na Task 1.
   - verificação: `node --test test/prompts.test.mjs` (exige `# fail 0` e `# pass` ≥ 6)
2. C2 — Task 2 do plano: `scripts/lib/metricas.mjs` (`estadosDoRepo`, `contaMarcas`,
   `metricasLoop`, `agrega`) e subcomando `metricas [--repo] [--json]`; testes de
   `test/metricas.test.mjs` com os casos listados na Task 2 (inclui loop arquivado, branch apagada
   via `--full-history`, marcas fixas, log inferido, custo aproximado, estado ilegível, repo sem loops).
   - verificação: `node --test test/metricas.test.mjs` (exige `# fail 0` e `# pass` ≥ 8)
3. C3 — Task 3 do plano: `skills/loop-eng/SKILL.md` com as cinco marcas fixas no Log, leitura dos
   prompts pelo caminho do `hash-prompts`, registro de despachos em `despachos/` e a rota
   `evoluir plugin|usuario` → `evoluir.md`; demais regras do `SKILL.md` inalteradas; `test/skill.test.mjs`.
   - verificação: `node --test test/skill.test.mjs` (exige `# fail 0`)
4. C4 — Task 4 do plano: `scripts/lib/casos.mjs` (`lerTranscricao`, `extraiCasos`,
   `contratoLacunas`) e subcomando `casos --repo --projeto [--saida]`; testes de
   `test/casos.test.mjs` com os casos listados na Task 4. Sobre os dados reais do dnsSecurity a
   extração produz pelo menos 5 casos `plano-reprovado` e pelo menos 3 `plano-aprovado-1a`.
   - verificação: `node --test test/casos.test.mjs` (exige `# fail 0` e `# pass` ≥ 9) **e**
     `node scripts/loop-eng.mjs casos --repo "C:/Users/salem/go/src/maltrap_dnsSecurity" --projeto "C:/Users/salem/.claude/projects/c--Users-salem-go-src-maltrap-dnsSecurity" --saida "C:/Users/salem/AppData/Local/Temp/claude/6f7b0f2808425d87/d17d9bad-3e9e-4d0c-af06-386fef7a7f3b/scratchpad/casos-dns.json"`
     seguido de `node -e "const j=require('C:/Users/salem/AppData/Local/Temp/claude/6f7b0f2808425d87/d17d9bad-3e9e-4d0c-af06-386fef7a7f3b/scratchpad/casos-dns.json');const n=t=>j.casos.filter(c=>c.tipo===t).length;const r=n('plano-reprovado'),a=n('plano-aprovado-1a');console.log('reprovado',r,'aprovado-1a',a);process.exit(r>=5&&a>=3?0:1)"`
5. C5 — Task 5 do plano: `scripts/lib/placar.mjs` (`divide`, `placarCandidato`, `ordena`,
   `aceita`) e subcomandos `evolucao divide` / `evolucao placar`; testes de `test/placar.test.mjs`
   com os casos listados na Task 5.
   - verificação: `node --test test/placar.test.mjs` (exige `# fail 0` e `# pass` ≥ 6)
6. C6 — Task 6 do plano: `skills/loop-eng/evoluir.md`, `skills/loop-eng/prompts/juiz-evolucao.md`
   e `skills/loop-eng/prompts/refletor-evolucao.md` com o procedimento e os formatos da Task 6;
   asserções novas em `test/skill.test.mjs`.
   - verificação: `node --test test/skill.test.mjs` (exige `# fail 0`)
7. C7 — Suíte inteira verde, nenhum teste existente removido ou afrouxado.
   - verificação: `npm test` (exige `# fail 0` e `# pass` ≥ 52 + os novos)
8. C8 — (julgamento humano) os prompts `juiz-evolucao.md` e `refletor-evolucao.md` e o
   procedimento do `evoluir.md` estão bons o bastante para a primeira evolução real (Task 7 do
   plano, fora deste loop). Quem julga: salemarsm, no PR.
   - verificação: pendente no PR

## Não-metas

- Tasks 7 (primeira evolução real) e 8 (README, SVG, ADR, design.md) do plano.
- Alterar `planejador.md`, `revisor-plano.md` ou qualquer prompt existente, e `refinamento.md`.
- Evoluir refinamento, implementador ou revisores.
- Versionar transcrições, casos ou qualquer dado do `maltrap_dnsSecurity` no repo.

## Restrições

- Sem dependências novas; Node ≥ 22, stdlib, `node --test`.
- Testes nunca leem nem escrevem o `~/.claude/loop-eng` real: sempre `LOOP_ENG_HOME` num tmpdir.
- Fixtures de transcrição são sintéticas, geradas pelo teste; nenhum trecho dos dados reais vai para o repo.
- O único acesso aos dados reais é o comando de verificação de C4, somente leitura sobre o
  dnsSecurity e `~/.claude/projects`, com saída no scratchpad.
- Mensagens e nomes em português, no estilo do CLI atual.

## Fronteiras do projeto

- Pode criar/editar: `scripts/loop-eng.mjs`, `scripts/lib/prompts.mjs`, `scripts/lib/metricas.mjs`,
  `scripts/lib/casos.mjs`, `scripts/lib/placar.mjs`, `skills/loop-eng/SKILL.md`,
  `skills/loop-eng/evoluir.md`, `skills/loop-eng/modelos/estado.md`,
  `skills/loop-eng/prompts/juiz-evolucao.md`, `skills/loop-eng/prompts/refletor-evolucao.md`,
  `test/prompts.test.mjs`, `test/metricas.test.mjs`, `test/skill.test.mjs`, `test/casos.test.mjs`,
  `test/placar.test.mjs`.
- `test/helpers.mjs`: só acrescentar `cliEnv`, sem mudar o que existe.
- Proibido tocar: demais arquivos de `skills/loop-eng/prompts/`, `skills/loop-eng/refinamento.md`,
  `scripts/lib/estado.mjs`, `scripts/lib/git.mjs`, `scripts/lib/gh.mjs`, testes existentes,
  `test/pressao/`, `test/fixtures/fake-gh.mjs`, `README*`, `LICENSE`, `docs/`, `.claude-plugin/`,
  `package.json`, `.gitignore`, `.gitattributes`, e qualquer arquivo fora da worktree (o
  `maltrap_dnsSecurity` e `~/.claude/projects` só são lidos pela verificação de C4).

## Comandos de verificação

- `npm test`

## Orçamento

- orcamento_tokens: 5310000
- orcamento_chamadas: 59

(conta: 6 tarefas → 2 + 6×3×2 + 1 = 39 chamadas × 1,5 = 58,5 → 59; 59 × 90 000 = 5 310 000)

## Quadro

off
