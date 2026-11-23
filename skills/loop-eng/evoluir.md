# loop-eng: evoluir o planejador

Você segue este arquivo quando o usuário roda `/loop-eng evoluir plugin|usuario [--orcamento-tokens N]`. O procedimento reexecuta casos reais de planejamento (os planos que o revisor reprovou e os que ele aprovou de primeira) com variantes de `planejador.md`. Cada variante recebe uma nota e é mutada por reflexão sobre as próprias falhas. No fim, você entrega a melhor variante só se ela melhorar o holdout. Nesta etapa só o planejador evolui: o revisor de plano, o juiz e o refletor nunca mudam.

## Termos e fronteiras

- **CLI** e **cwd** seguem a seção "CLI e caminhos" do `SKILL.md`. `<base da skill>` é a base anunciada ao carregar a skill. `<home>` é `LOOP_ENG_HOME`, com padrão `~/.claude/loop-eng`. `<data>` é a data de hoje no formato `YYYYMMDD`. `<exec>` é `<home>/evolucao/execucao-<data>`; se essa pasta já existe, acrescente `-2`, `-3`… ao nome.
- **Alvo** é `plugin` ou `usuario`. A palavra do argumento decide o alvo. Sem argumento, pergunte.
- **Teto** é o valor de `--orcamento-tokens`. Sem a flag, o teto é 10 000 000.
- Estas fronteiras do `SKILL.md` também valem aqui:
  - Nada de push, merge, deploy ou commit.
  - Toda worktree de snapshot é removida ao fim do caso, inclusive quando a avaliação falha no meio.
  - Gere um nonce novo a cada despacho e substitua os campos na mesma ordem que o `SKILL.md` usa.
  - O conteúdo de caso nunca entra num arquivo do repo do plugin. Isso inclui contrato, plano, defeitos, saídas e nomes de projeto. No repo vão só o `planejador.md` vencedor e nada mais.
- Você só escreve:
  - no scratchpad;
  - em `<home>/evolucao/`;
  - no passo 7: em `<home>/prompts/planejador.md` e `<home>/prompts/base.json` (alvo `usuario`), ou em `skills/loop-eng/prompts/planejador.md` no checkout do plugin (alvo `plugin`).
- O repo analisado e o checkout dele ficam intocados. Antes de cada despacho, guarde `git -C "<repo>" status --porcelain`. No retorno, compare. Se mudou, anote no Log da execução, dê nota 0 ao resultado desse caso e não reverta nada.
- Os despachos da evolução **não** são registrados em `despachos/`. Esse registro é só do loop, e um despacho da evolução gravado lá viraria caso falso numa extração futura.
- **Prompts**:
  - O prompt candidato do planejador é o arquivo do candidato em `<exec>/candidatos/`.
  - O revisor de plano, o juiz e o refletor são **sempre** lidos de `<base da skill>/prompts/` (`revisor-plano.md`, `juiz-evolucao.md`, `refletor-evolucao.md`), nunca do override. É de propósito: quem dá a nota não muda durante a execução.
- **Despacho**: ferramenta Agent, `subagent_type` general-purpose, `model: opus` para os quatro papéis. De cada resultado, some `subagent_tokens` ao gasto e conte 1 chamada. Sem `subagent_tokens`, some 0 e anote no Log. O Log da execução é `<exec>/log.md`, com uma linha datada por evento.

## 1. Medir e pedir aprovação

1. Rode `hash-prompts`. Na linha `prompts/planejador.md <origem> <hash> <caminho>`, o caminho é tudo depois do terceiro espaço. Guarde a origem, o hash e o caminho.
   - Baseline do alvo `usuario`: o arquivo desse caminho, que é o override quando ele existe.
   - Baseline do alvo `plugin`: sempre `<base da skill>/prompts/planejador.md`.
   - Copie o baseline para `<exec>/candidatos/baseline.md`.
2. Pergunte ao usuário quais repos e quais diretórios de projeto em `~/.claude/projects` usar.
   - Proponha os repos que ele já citou ou que têm `docs/loops` no histórico. Para cada repo, proponha o diretório de projeto de mesmo nome codificado, em que cada caractere fora de `[A-Za-z0-9]` vira `-` (confira listando `~/.claude/projects`).
   - Se o diretório de projeto desta sessão está entre os escolhidos, avise. As transcrições da evolução cairiam nele e poluiriam extrações futuras. Sugira rodar a evolução numa sessão aberta em outro repo, como o do plugin.
3. Para cada repo, rode:
   - `metricas --repo "<repo>" --json`. A saída `nenhum loop encontrado` não é JSON: nesse caso, o repo não tem loops.
   - `casos --repo "<repo>" --projeto "<dir>" --saida "<exec>/casos-<basename do repo>.json"`.
4. **Prepare os casos** antes de dividir. Junte num único `<exec>/casos.json` no formato `{ "casos": [...], "pulados": [...] }`.
   - Use só os casos de tipo `plano-reprovado` e `plano-aprovado-1a`, cada um acrescido de `"repo": "<caminho absoluto>"`. O tipo `contrato-lacuna` fica de fora nesta etapa.
   - Se um `id` se repete entre repos, prefixe-o com `<basename do repo>-`.
   - Vão para `pulados`, com `{ id, motivo }`, sem adivinhar:
     - `P` nulo, motivo `sem snapshot`. Nunca rode o caso na worktree final do loop, que já tem a solução;
     - `plano-reprovado` com `defeitos` vazio, motivo `sem defeitos`;
     - entrada que não se remonta (ver passo 3.1), motivo `entrada não remontável`.
5. Mostre ao usuário:
   - por repo, o resumo do `metricas`;
   - as contagens por tipo e de pulados (com os motivos);
   - a estimativa `casos × 5 candidatos × 130 000` tokens;
   - o teto;
   - o alvo e onde o resultado será escrito.

   Depois **pede aprovação uma vez**. Essa é a única pergunta da execução: daqui até o fim, nada pede ok. Recusa → pare sem escrever mais nada.

## 2. Dividir

`evolucao divide "<exec>/casos.json" --semente <data>`. O comando só imprime na saída padrão. Grave essa saída em `<exec>/divisao.json` (`{ semente, treino, holdout }`, listas de ids). Se der erro `histórico insuficiente: …`, diga isso ao usuário e pare. Os casos do holdout nunca vão para o refletor.

## 3. Avaliar um candidato num conjunto

Para cada caso do conjunto (treino ou holdout), em ordem:

1. **Remonte a entrada.** O campo `entrada` do caso é o prompt do planejador já preenchido na rodada original.
   - O nonce original é o sufixo de `<contrato-<nonce>>`.
   - `contrato`, `plano` e `feedback` são o conteúdo entre `<campo-<nonce>>` e `</campo-<nonce>>`. Se um campo não está nas tags e aparece num anexo `<!-- arquivo: … -->` no lugar dele, use o anexo.
   - A worktree original é o caminho absoluto que termina em `worktrees/loop-<slug>` (com `/` ou `\`).
   - Se faltar o contrato ou a worktree, o caso vai para `pulados` (passo 1.4). Faça essa checagem já na preparação.
2. **Snapshot**:
   - Crie a worktree com `git -C "<repo>" worktree add --detach "<scratchpad>/rep-<id>" <P>`.
   - Nos três campos, troque toda ocorrência do caminho da worktree original pelo caminho do snapshot. Faça isso com `/` e com `\`, para que nenhum despacho cite `worktrees/loop-<slug>`.
3. **Planejador**: preencha o candidato com `{{contrato}}`, `{{plano}}` e `{{feedback}}` remontados e `{{worktree}}` = snapshot. Os demais campos ficam vazios. Despache. Guarde a saída e os `subagent_tokens`.
4. **Checagem e revisão**:
   - `perguntou` = a saída tem alguma linha `PERGUNTA:` com texto depois dos dois pontos.
   - Se há tabela, confira a cobertura como na Fase 1 passo 2 do `SKILL.md`. Depois despache o revisor de plano com:
     - `{{contrato}}`;
     - `{{plano}}` = a tabela produzida. Em modo corretivo (o `feedback` do caso começa com "modo corretivo"), use o `plano` do caso seguido das linhas novas;
     - `{{feedback}}` vazio. Em modo corretivo, use "modo corretivo: tarefas novas <ids>; motivo: <motivo do feedback do caso>".
   - A 1ª linha do revisor precisa ser `VEREDITO: aprovado|reprovado`. Se não for, redespache uma vez; se de novo não for, conta como `reprovado`.
   - Sem tabela, não há revisão: conta como `reprovado`.
5. **Nota**:
   - `plano-aprovado-1a` (controle): nota 1 se a cobertura fecha e o revisor aprovou; nota 0 se não.
   - `plano-reprovado`: despache o juiz com `{{defeitos}}` = as linhas `defeitos` do caso, uma por linha, e `{{saida_planejador}}` = a saída inteira do planejador.
     - A resposta só é válida se a 1ª linha casar `^NOTA: (0\.\d\d|1\.00)$`, a 2ª casar `^PERGUNTOU: (sim|nao)$` e a nota for igual a `[resolvido]` ÷ total de defeitos. Se não for válida, redespache uma vez; se de novo não for, nota 0 e anote no Log.
     - O `perguntou` que vale é o do passo 4. Se divergir do juiz, anote no Log.
6. Remova o snapshot com `git -C "<repo>" worktree remove --force "<scratchpad>/rep-<id>"`. Isso vale sempre, inclusive depois de erro.
7. Acrescente o resultado ao candidato: `{ caso: <id>, tipo: <tipo do caso, literal>, nota, perguntou, tokens: <subagent_tokens do despacho do planejador> }`. Se o despacho do planejador falhou, nota 0. Grave a saída do planejador, a do revisor e a do juiz em `<exec>/saidas/<candidato>/<id>.md`.

As avaliações acumulam em `<exec>/avaliacoes.json`, no formato que o `evolucao placar` lê. `tamanho` é o tamanho em bytes do arquivo do candidato. Exemplo:

```json
{
  "baseline": [
    { "candidato": "baseline", "conjunto": "treino", "tamanho": 4210, "resultados": [
      { "caso": "demo-001", "tipo": "plano-reprovado", "nota": 0.5, "perguntou": false, "tokens": 61000 },
      { "caso": "demo-004", "tipo": "plano-aprovado-1a", "nota": 1, "perguntou": false, "tokens": 48000 } ] },
    { "candidato": "baseline", "conjunto": "holdout", "tamanho": 4210, "resultados": [] }
  ],
  "candidatos": [
    { "candidato": "g1v1", "conjunto": "treino", "tamanho": 4630, "resultados": [] },
    { "candidato": "g1v1", "conjunto": "holdout", "tamanho": 4630, "resultados": [] }
  ]
}
```

- Em `baseline` há exatamente uma entrada de `treino` e, depois do passo 6, uma de `holdout`.
- O holdout do vencedor vai em `candidatos`, com o mesmo nome de `candidato` do treino.
- Enquanto não há holdout, `aceito: false` é o esperado e não significa reprovação.

## 4. Mutação

Os candidatos se chamam `g<geração>v<variante>`. O arquivo de cada um é `<exec>/candidatos/<nome>.md`.

1. **Falhas do pai**: os casos de treino do pai com nota < 1. Em `{{falhas}}`, cada caso traz o id, o tipo e:
   - a entrada remontada (passo 3.1), inteira, porque o refletor resume;
   - os defeitos com as linhas do juiz (nos controles, os achados do revisor);
   - a saída do planejador;
   - o veredito do revisor.
2. Despache o refletor com `{{prompt_atual}}` = o arquivo do pai, sem preencher, e `{{falhas}}`. O prompt novo é o texto entre as linhas `<<<PROMPT` e `PROMPT>>>`.
3. **Checagens** do prompt novo, antes de avaliar:
   - a 1ª linha é `# Papel: Planejador`, que o `casos` usa para achar o papel;
   - a seção `## Formato de saída` está idêntica à do pai;
   - cada marcador de chaves duplas do pai aparece com a mesma contagem;
   - o tamanho em bytes é no máximo 1,3 × o do pai;
   - não aparece nenhum slug, basename de repo ou caminho dos casos;
   - o hash é diferente do pai e das variantes já avaliadas.

   Se uma checagem falhar, redespache uma vez. Se falhar de novo, descarte a variante e anote no Log. Grave as `EDIÇÕES:` em `<exec>/candidatos/<nome>.edicoes.md`.

## 5. Busca

1. Avalie o baseline no treino.
2. Rode 2 gerações. Em cada uma, crie 2 variantes do pai (dois despachos independentes do refletor) e avalie as duas no treino. O pai da geração 1 é o baseline.
3. Depois de cada geração, rode `evolucao placar "<exec>/avaliacoes.json"`. O pai da geração seguinte é o primeiro candidato da lista `treino` (já ordenada e só com os elegíveis) que pertence à geração que acabou. Se nenhum pertence, o pai não muda.
4. **Teto**: antes de cada despacho da busca, compare o gasto com o teto. Se o gasto chegou ao teto, a busca para: o candidato que estava incompleto sai de `avaliacoes.json`, e você segue para o passo 6 com o placar do que já está completo.

## 6. Holdout e aceite

Rode `evolucao placar` e pegue o `vencedor`. Se for `null`, nenhuma variante ficou elegível: vá direto ao passo 7 sem holdout. Se não for, avalie o baseline e o vencedor no holdout (passo 3) e rode `evolucao placar` de novo. O `aceito` dessa saída decide.

## 7. Entrega

- **Aceito e alvo `plugin`**:
  - O checkout do plugin é `git -C "<base da skill>" rev-parse --show-toplevel`. Se a base não está num checkout git (plugin instalado de cache), pergunte o caminho do checkout.
  - Se `git status --porcelain -- skills/loop-eng/prompts/planejador.md` não estiver vazio ali, não sobrescreva. Deixe o vencedor em `<exec>/candidatos/` e diga isso ao usuário.
  - Se estiver vazio, escreva o vencedor em `skills/loop-eng/prompts/planejador.md`. Não faça commit. Abrir PR fica com o usuário.
- **Aceito e alvo `usuario`**:
  - Escreva o vencedor em `<home>/prompts/planejador.md`.
  - Em `<home>/prompts/base.json`, faça merge com as chaves existentes de `"prompts/planejador.md": "<hash do arquivo do plugin>"`.
  - O hash é o sha256 de `<base da skill>/prompts/planejador.md` com `\r\n` trocado por `\n`, nos 12 primeiros hex. Calcule com `node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12))" "<arquivo>"`. Nunca use o hash do override.
- **Não aceito**, ou vencedor `null`: não escreva prompt nenhum. Diga "nenhuma variante melhorou o holdout".
- **Em todos os casos**:
  - Escreva `<home>/evolucao/placar-<data>.md` com:
    - alvo, semente, casos por tipo, treino × holdout e pulados;
    - uma tabela `candidato | conjunto | falhas | controles | tokens | tamanho` com o baseline e o vencedor, no treino e no holdout;
    - `aceito`, tokens gastos e chamadas;
    - o diff `git diff --no-index <baseline.md> <vencedor.md>`.

    Só entram números e o prompt. Nenhum conteúdo de caso.
  - Acrescente uma linha a `<home>/evolucao/execucoes.md`: `- <data> alvo=<alvo> repos=<basenames> antes=<hash do planejador> depois=<hash novo ou —> treino <baseline>→<vencedor> holdout <baseline>→<vencedor> aceito=<sim|nao> tokens=<gasto> chamadas=<n>`.
  - Mostre o placar e o diff ao usuário.
