# Plano — apresentacao-publica-do-repo

| id | titulo | nivel | justificativa_nivel | arquivos | criterios_contrato | verificacao |
|----|--------|-------|---------------------|----------|--------------------|-------------|
| T1 | Licença MIT e metadados de licença/repositório | sonnet | Mecânico, mas toca 3 arquivos (acima do limite de haiku), então sobe para sonnet. | LICENSE, package.json, .claude-plugin/plugin.json | C1,C6 | verificação de C1 do contrato + npm test |
| T2 | Banner e diagrama do ciclo em SVG escritos à mão | sonnet | Desenho visual com restrições de tema claro/escuro, sem script e sem referências externas, em 2 arquivos; exige julgamento de layout. | docs/assets/banner.svg, docs/assets/ciclo.svg | C2,C6,C7 | verificação de C2 do contrato + npm test |
| T3 | Workflow de CI com matriz Ubuntu/Windows | haiku | Um arquivo YAML com spec totalmente definida pelo contrato. | .github/workflows/ci.yml | C5,C6,C7 | verificação de C5 do contrato + npm test |
| T4 | README em inglês e README.pt-BR em paridade (roda por último: depende de T1, T2 e T3, porque a checagem de links relativos exige que LICENSE, os SVGs e o ci.yml existam) | sonnet | Reescrita fiel do README atual em duas línguas com paridade e checagem de links; exige ler o comportamento real sem inventar nada. | README.md, README.pt-BR.md | C3,C4,C6,C7 | verificação de C3 do contrato + verificação de C4 do contrato + npm test |
