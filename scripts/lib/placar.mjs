// Divisão treino/holdout e placar da evolução de prompts. Funções puras e determinísticas.

function mulberry32(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralha(ids, semente) {
  const aleatorio = mulberry32(semente);
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function divide(casos, semente) {
  const falhas = casos.filter((c) => c.tipo === 'plano-reprovado').map((c) => c.id);
  const controles = casos.filter((c) => c.tipo === 'plano-aprovado-1a').map((c) => c.id);
  if (falhas.length < 4) throw new Error(`histórico insuficiente: ${falhas.length} casos de falha (mínimo 4)`);
  const holdout = [
    ...embaralha(falhas, semente).slice(0, Math.max(2, Math.round(falhas.length * 0.3))),
    ...embaralha(controles, semente).slice(0, Math.round(controles.length * 0.3)),
  ];
  const noHoldout = new Set(holdout);
  const treino = [...falhas, ...controles].filter((id) => !noHoldout.has(id));
  return { treino, holdout };
}

const media = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

export function placarCandidato({ candidato, conjunto, resultados, tamanho }) {
  const reprovados = resultados.filter((r) => r.tipo === 'plano-reprovado');
  const controles = resultados.filter((r) => r.tipo === 'plano-aprovado-1a');
  return {
    candidato,
    conjunto,
    falhas: media(reprovados.map((r) => r.nota)),
    // sem controles na amostra a condição é vacuamente satisfeita
    controles: controles.length === 0 ? 1 : controles.filter((r) => r.nota === 1 && !r.perguntou).length / controles.length,
    tokens: media(resultados.map((r) => r.tokens)),
    tamanho,
  };
}

export function ordena(placares, baseline) {
  return placares
    .filter((p) => p.controles >= baseline.controles)
    .sort((a, b) => b.falhas - a.falhas || a.tokens - b.tokens || a.tamanho - b.tamanho);
}

export function aceita(vencedorHoldout, baselineHoldout) {
  return vencedorHoldout.falhas > baselineHoldout.falhas && vencedorHoldout.controles >= baselineHoldout.controles;
}
