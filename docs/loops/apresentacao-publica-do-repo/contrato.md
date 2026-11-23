# Contrato — apresentacao-publica-do-repo

## Requisito

Preparar o repositório `salemarsm/loop-eng` para ficar público com apresentação profissional e atrativa:
README em inglês (principal) + versão em português, banner e diagrama do ciclo em SVG, badges
(CI, licença, Node, Claude Code plugin, versão), licença MIT e um workflow de CI que rode os testes.
A troca de visibilidade do repo para público é feita pelo usuário depois do merge (fora do loop).

## Critérios de aceite

1. C1 — `LICENSE` na raiz com o texto MIT padrão, começando por `MIT License` e com a linha
   `Copyright (c) 2026 salemarsm`; `package.json` com `"license": "MIT"`; `.claude-plugin/plugin.json`
   com `"license": "MIT"`, `"repository"` e `"homepage"` apontando para `https://github.com/salemarsm/loop-eng`.
   - verificação: `node -e "const f=require('fs');const t=f.readFileSync('LICENSE','utf8');const p=JSON.parse(f.readFileSync('package.json','utf8'));const g=JSON.parse(f.readFileSync('.claude-plugin/plugin.json','utf8'));const ok=/^MIT License/.test(t)&&t.includes('Copyright (c) 2026 salemarsm')&&t.includes('THE SOFTWARE IS PROVIDED \"AS IS\"')&&p.license==='MIT'&&g.license==='MIT'&&String(g.repository).includes('github.com/salemarsm/loop-eng')&&String(g.homepage).includes('github.com/salemarsm/loop-eng');console.log(ok?'C1 ok':'C1 FAIL');process.exit(ok?0:1)"`
2. C2 — `docs/assets/banner.svg` (nome, tagline curta) e `docs/assets/ciclo.svg` (fluxo refinamento →
   contrato aprovado → planejamento → execução com verificação/revisão → PR, rótulos em inglês). Cada um:
   raiz `<svg` com `viewBox`, contém `prefers-color-scheme` (legível em tema claro e escuro), sem `<script`,
   sem referência externa (`href`/`src` http(s)), menor que 50 KB. `ciclo.svg` contém (sem diferenciar
   maiúsculas) `refine`, `contract`, `plan`, `review` e `PR`.
   - verificação: `node -e "const f=require('fs');let ok=true;for(const n of ['banner','ciclo']){const p='docs/assets/'+n+'.svg';if(!f.existsSync(p)){console.log('falta',p);ok=false;continue}const s=f.readFileSync(p,'utf8');const c=[/<svg[^>]*viewBox=/.test(s),s.includes('prefers-color-scheme'),!/<script/i.test(s),!/(href|src)=[\"']https?:/i.test(s),f.statSync(p).size<51200];if(c.includes(false)){console.log(p,c);ok=false}}if(ok){const s=f.readFileSync('docs/assets/ciclo.svg','utf8').toLowerCase();for(const w of ['refine','contract','plan','review','pr'])if(!s.includes(w)){console.log('ciclo sem',w);ok=false}}console.log(ok?'C2 ok':'C2 FAIL');process.exit(ok?0:1)"`
3. C3 — `README.md` em inglês: banner (`docs/assets/banner.svg`) no topo; badges de CI
   (`actions/workflows/ci.yml/badge.svg`), licença MIT, Node ≥ 22, Claude Code plugin e versão 0.1.0 (via
   `img.shields.io`); link para `README.pt-BR.md`; diagrama `docs/assets/ciclo.svg`; comandos de instalação
   `/plugin marketplace add salemarsm/loop-eng` e `/plugin install loop-eng@loop-eng`; seções com os
   cabeçalhos `## Installation`, `## Usage`, `## How it works` e `## License`; sem a nota de repositório
   privado; todo link/imagem relativo aponta para arquivo existente. Conteúdo fiel ao comportamento atual
   (mesmos comandos `/loop-eng`, estados terminais, limitações e pré-requisitos do README atual; nada inventado).
   - verificação: `node -e "const f=require('fs');const s=f.readFileSync('README.md','utf8');const need=['docs/assets/banner.svg','actions/workflows/ci.yml/badge.svg','img.shields.io','README.pt-BR.md','docs/assets/ciclo.svg','/plugin marketplace add salemarsm/loop-eng','/plugin install loop-eng@loop-eng','## Installation','## Usage','## How it works','## License','MIT','0.1.0'];let ok=true;for(const w of need)if(!s.includes(w)){console.log('falta',w);ok=false}if(/private|privado/i.test(s)){console.log('menciona privado');ok=false}for(const m of s.matchAll(/(?:\]\(|src=\")([^)\"#\s]+)/g)){const l=m[1];if(/^(https?:|mailto:)/.test(l))continue;if(!f.existsSync(decodeURI(l))){console.log('link quebrado',l);ok=false}}console.log(ok?'C3 ok':'C3 FAIL');process.exit(ok?0:1)"`
4. C4 — `README.pt-BR.md` em português, mesma estrutura e conteúdo do `README.md`: mesmo banner, badges e
   diagrama; link de volta para `README.md`; mesmos comandos de instalação; cabeçalhos `## Instalação`,
   `## Uso`, `## Como funciona` e `## Licença`; sem a nota de repositório privado; links relativos válidos.
   - verificação: `node -e "const f=require('fs');const s=f.readFileSync('README.pt-BR.md','utf8');const need=['docs/assets/banner.svg','actions/workflows/ci.yml/badge.svg','img.shields.io','README.md','docs/assets/ciclo.svg','/plugin marketplace add salemarsm/loop-eng','/plugin install loop-eng@loop-eng','## Instalação','## Uso','## Como funciona','## Licença','MIT','0.1.0'];let ok=true;for(const w of need)if(!s.includes(w)){console.log('falta',w);ok=false}if(/private|privado/i.test(s)){console.log('menciona privado');ok=false}for(const m of s.matchAll(/(?:\]\(|src=\")([^)\"#\s]+)/g)){const l=m[1];if(/^(https?:|mailto:)/.test(l))continue;if(!f.existsSync(decodeURI(l))){console.log('link quebrado',l);ok=false}}console.log(ok?'C4 ok':'C4 FAIL');process.exit(ok?0:1)"`
5. C5 — `.github/workflows/ci.yml` com `name: CI`, disparo em `push` e `pull_request`, matriz
   `ubuntu-latest` e `windows-latest`, `actions/checkout`, `actions/setup-node` com `node-version: 22`, e passo
   `npm test`. Sem `npm install`/dependências novas.
   - verificação: `node -e "const s=require('fs').readFileSync('.github/workflows/ci.yml','utf8');const need=['name: CI','push','pull_request','ubuntu-latest','windows-latest','actions/checkout','actions/setup-node','node-version: 22','npm test'];const miss=need.filter(w=>!s.includes(w));if(/npm (install|ci)\b/.test(s))miss.push('nao instala deps');console.log(miss.length?'C5 FAIL '+miss:'C5 ok');process.exit(miss.length?1:0)"`
6. C6 — Suíte de testes existente continua verde (nenhum teste removido; 52 testes hoje).
   - verificação: `npm test` (exige `# fail 0` e `# pass` ≥ 52)
7. C7 — (julgamento humano, nível 4) o README renderizado no GitHub fica atrativo e legível em tema claro e
   escuro, e o CI do PR fica verde nas duas plataformas. Quem julga: salemarsm, no PR.
   - verificação: pendente no PR (revisão visual + aba Checks)

## Não-metas

- Trocar a visibilidade do repo, editar descrição/topics/website do repositório no GitHub (configuração do repo, feita pelo usuário depois do merge).
- Criar tag, release ou publicar o plugin em algum marketplace.
- CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, templates de issue/PR.
- Screenshots ou GIFs de sessão real.
- Traduzir `docs/design.md`, ADRs, skill, prompts ou qualquer outro arquivo além do README.
- Mudar código, testes ou comportamento do plugin.

## Restrições

- Sem dependências novas (npm ou outras); SVGs escritos à mão, sem fontes ou imagens externas.
- Badges só via `img.shields.io` e o badge nativo do GitHub Actions.
- README descreve só o que o plugin faz hoje; nada de features, números ou promessas que o código não sustenta.
- Os dois READMEs ficam em paridade de conteúdo (mesmas seções, na língua de cada um).

## Fronteiras do projeto

- Pode criar/editar: `README.md`, `README.pt-BR.md`, `LICENSE`, `docs/assets/**`, `.github/workflows/ci.yml`.
- Pode editar só metadados (`license`, `repository`, `homepage`): `package.json`, `.claude-plugin/plugin.json`.
- Proibido tocar: `scripts/`, `skills/`, `test/`, `docs/adr/`, `docs/design.md`, `docs/plans/`, `.claude-plugin/marketplace.json`, `.gitignore`, `.gitattributes`, `.superpowers/`, `.remember/`.

## Comandos de verificação

- `npm test`

## Orçamento

- orcamento_tokens: 3690000
- orcamento_chamadas: 41

(conta: ~4 tarefas → 2 + 4×3×2 + 1 = 27 chamadas × 1,5 = 41; 41 × 90 000 = 3 690 000)

## Quadro

off
