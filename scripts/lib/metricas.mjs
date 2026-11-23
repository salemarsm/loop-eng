import { git } from './git.mjs';
import { parseEstado } from './estado.mjs';

const MARCAS = ['[plano-reprovado]', '[plano-aprovado]', '[muda-contrato forçada]', '[muda-contrato espontânea]'];

// Versão mais recente não deletada de docs/loops/<slug>/estado.md, em todo o histórico
// (inclui loops arquivados e branches apagadas).
export function estadosDoRepo(repo) {
  const raiz = git(repo, ['rev-parse', '--show-toplevel']);
  const saida = git(raiz, ['log', '--all', '--full-history', '--topo-order', '--diff-filter=AM', '--name-only',
    '--format=%x00%H', '--', 'docs/loops/*/estado.md']);
  const estados = [];
  const vistos = new Set();
  for (const bloco of saida.split('\0')) {
    const [commit, ...nomes] = bloco.split(/\r?\n/).filter(Boolean);
    for (const nome of nomes) {
      const m = /^docs\/loops\/([^/]+)\/estado\.md$/.exec(nome);
      if (!m || vistos.has(m[1])) continue;
      vistos.add(m[1]);
      estados.push({ slug: m[1], commit, texto: git(raiz, ['show', `${commit}:${nome}`]) });
    }
  }
  return estados;
}

const conta = (log, marca) => log.split(marca).length - 1;

export function contaMarcas(log) {
  const escaladas = [...log.matchAll(/\[escalada ([^\]\s]+)\]/g)].map((m) => m[1]);
  const fixas = {
    planoReprovado: conta(log, '[plano-reprovado]'),
    planoAprovado: conta(log, '[plano-aprovado]'),
    escaladas,
    mudaForcada: conta(log, '[muda-contrato forçada]'),
    mudaEspontanea: conta(log, '[muda-contrato espontânea]'),
  };
  const achouMarca = escaladas.length > 0 || MARCAS.some((m) => log.includes(m));
  if (achouMarca) return { ...fixas, inferido: false };
  const linhas = log.split(/\r?\n/);
  return {
    planoReprovado: linhas.filter((l) => /revisor de plano[^\n]*reprov/i.test(l)).length,
    planoAprovado: 0,
    escaladas: linhas.filter((l) => /escala|sobe (um )?n[ií]vel/i.test(l)).map((l) => /T\d+/.exec(l)?.[0]).filter(Boolean),
    mudaForcada: 0,
    mudaEspontanea: 0,
    inferido: true,
  };
}

const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : null);

export function metricasLoop({ slug, texto }) {
  let estado;
  try {
    estado = parseEstado(texto);
  } catch (err) {
    return { slug, ilegivel: err.message };
  }
  const { cab, tarefas, log } = estado;
  const marcas = contaMarcas(log);
  const aceitas = tarefas.filter((t) => t.status === 'aceita');
  const primeira = aceitas.filter((t) => t.rodada === 1 && !marcas.escaladas.includes(t.id)).length;
  const tokens = Number(cab.tokens_subagentes ?? 0);
  const versao = /^v(\d+)$/.exec(cab.contrato ?? '');
  return {
    slug,
    terminal: cab.estado_terminal || 'em andamento',
    prompts: cab.prompts || 'desconhecido',
    tarefasAceitas: aceitas.length,
    primeiraRodadaPct: pct(primeira, aceitas.length),
    planoReprovado: marcas.planoReprovado,
    tokensPorAceita: aceitas.length ? Math.round(tokens / aceitas.length) : null,
    orcamentoTokensPct: pct(tokens, Number(cab.orcamento_tokens)),
    orcamentoChamadasPct: pct(Number(cab.chamadas ?? 0), Number(cab.orcamento_chamadas)),
    contratoMudancas: versao ? Number(versao[1]) - 1 : 0,
    contratoForcadas: marcas.inferido ? null : marcas.mudaForcada,
    custoAproximado: /somad[oa] 0|estimad/i.test(log),
    inferido: marcas.inferido,
  };
}

export function agrega(lista) {
  const grupos = new Map();
  for (const m of lista) {
    if (m.ilegivel || m.terminal === 'em andamento') continue;
    if (!grupos.has(m.prompts)) grupos.set(m.prompts, []);
    grupos.get(m.prompts).push(m);
  }
  return [...grupos].map(([prompts, loops]) => {
    const aceitas = loops.reduce((s, m) => s + m.tarefasAceitas, 0);
    const ponderada = (campo) => {
      const validos = loops.filter((m) => m[campo] !== null && m.tarefasAceitas > 0);
      const peso = validos.reduce((s, m) => s + m.tarefasAceitas, 0);
      return peso ? Math.round(validos.reduce((s, m) => s + m[campo] * m.tarefasAceitas, 0) / peso) : null;
    };
    return {
      prompts,
      loops: loops.length,
      tarefasAceitas: aceitas,
      primeiraRodadaPct: ponderada('primeiraRodadaPct'),
      planoReprovadoPorLoop: Math.round((loops.reduce((s, m) => s + m.planoReprovado, 0) / loops.length) * 100) / 100,
      tokensPorAceita: ponderada('tokensPorAceita'),
    };
  });
}
