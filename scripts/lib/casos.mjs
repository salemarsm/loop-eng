import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';
import { parseEstado } from './estado.mjs';
import { estadosDoRepo } from './metricas.mjs';

// Títulos exatos de prompts/planejador.md e prompts/revisor-plano.md.
const PLANEJADOR = 'Planejador';
const REVISOR = 'Revisor de plano';

const textoDe = (content) => (typeof content === 'string'
  ? content
  : Array.isArray(content) ? content.filter((p) => p?.type === 'text').map((p) => p.text).join('\n') : '');

const semNumeros = (texto) => texto.split(/\r?\n/).map((l) => l.replace(/^\s*\d+\t/, '')).join('\n');
const normalizaCaminho = (c) => c.replace(/\\/g, '/').toLowerCase();

export function lerTranscricao(texto) {
  const linhas = [];
  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.trim()) continue;
    try {
      linhas.push(JSON.parse(linha));
    } catch {
      // linha truncada ou corrompida: pula
    }
  }
  const usos = new Map();
  let entrada = '';
  let primeiraUser = true;
  let saida = null;
  let ultimoAssistant = '';
  const anexados = new Set();
  for (const l of linhas) {
    const content = l.message?.content;
    if (l.type === 'assistant') {
      if (Array.isArray(content)) {
        for (const p of content) {
          if (p?.type !== 'tool_use') continue;
          usos.set(p.id, p);
          if (p.name === 'SubagentHandback' && typeof p.input?.message === 'string') saida = p.input.message;
        }
      }
      const t = textoDe(content);
      if (t.trim()) ultimoAssistant = t;
    } else if (l.type === 'user') {
      const resultados = Array.isArray(content) ? content.filter((p) => p?.type === 'tool_result') : [];
      if (primeiraUser && resultados.length === 0) {
        primeiraUser = false;
        if (textoDe(content).includes('# Papel:')) entrada = textoDe(content);
        continue;
      }
      primeiraUser = false;
      for (const r of resultados) {
        const uso = usos.get(r.tool_use_id);
        if (uso?.name !== 'Read') continue;
        const lido = textoDe(r.content);
        const arquivo = String(uso.input?.file_path ?? '');
        if (!entrada) {
          if (lido.includes('# Papel:')) entrada = semNumeros(lido);
        } else if (arquivo && !anexados.has(arquivo) && normalizaCaminho(entrada).includes(normalizaCaminho(arquivo))) {
          anexados.add(arquivo);
          entrada += `\n\n<!-- arquivo: ${path.basename(arquivo)} -->\n${semNumeros(lido)}`;
        }
      }
    }
  }
  if (saida === null) saida = ultimoAssistant;
  const veredito = saida.split(/\r?\n/).map((l) => /^VEREDITO:\s*(aprovado|reprovado)/i.exec(l)).find(Boolean);
  return {
    papel: /# Papel: *([^\r\n]+)/.exec(entrada)?.[1].trim() ?? null,
    entrada,
    saida,
    veredito: veredito ? veredito[1].toLowerCase() : null,
    inicio: linhas.find((l) => l.timestamp)?.timestamp ?? '',
    worktree: /[\\/]worktrees[\\/]loop-([a-z0-9-]+)/.exec(entrada)?.[1] ?? null,
  };
}

function transcricoes(projeto) {
  const arquivos = [];
  for (const sessao of fs.readdirSync(projeto, { withFileTypes: true })) {
    if (!sessao.isDirectory()) continue;
    const dir = path.join(projeto, sessao.name, 'subagents');
    if (!fs.existsSync(dir)) continue;
    for (const nome of fs.readdirSync(dir)) if (nome.endsWith('.jsonl')) arquivos.push(path.join(dir, nome));
  }
  return arquivos.sort();
}

function commitAntes(repo, slug, inicio) {
  try {
    return git(repo, ['log', '--all', '--full-history', '-1', '--format=%H', `--before=${inicio}`, '--', `docs/loops/${slug}`]) || null;
  } catch {
    return null;
  }
}

// Linhas `| Tn | titulo |` de um plano (as duas primeiras células; o orquestrador às vezes reescreve as demais).
const tarefasDoPlano = (texto) => texto.split(/\r?\n/)
  .map((l) => /^\|\s*(T\d+)\s*\|[^|]*\|/.exec(l))
  .filter(Boolean)
  .map((m) => ({ id: m[1], chave: m[0] }));
const ids = (tarefas) => [...new Set(tarefas.map((t) => t.id))].sort().join(',');

// Planejador mais recente, anterior ao revisor, com o mesmo conjunto de ids de tarefa do plano embutido
// na entrada do revisor e ao menos uma linha `| Tn | titulo |` idêntica.
function slugPeloPlano(revisor, planejadores) {
  const doRevisor = tarefasDoPlano(revisor.entrada);
  if (doRevisor.length === 0) return null;
  const chaves = new Set(doRevisor.map((t) => t.chave));
  const achados = planejadores
    .filter((p) => p.inicio < revisor.inicio)
    .filter((p) => {
      const doPlano = tarefasDoPlano(p.saida);
      return ids(doPlano) === ids(doRevisor) && doPlano.some((t) => chaves.has(t.chave));
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  return achados.at(-1)?.worktree ?? null;
}

export function extraiCasos({ repo, projeto }) {
  const descartados = [];
  const porSlug = new Map();
  const lidas = transcricoes(projeto)
    .map((arquivo) => ({ arquivo, ...lerTranscricao(fs.readFileSync(arquivo, 'utf8')) }))
    .filter((t) => t.papel === PLANEJADOR || t.papel === REVISOR);
  const planejadores = lidas.filter((t) => t.papel === PLANEJADOR && t.worktree);
  for (const t of lidas) {
    // Prompt antigo do revisor de plano não cita a worktree: o slug vem do plano embutido na entrada.
    const slug = t.worktree ?? (t.papel === REVISOR ? slugPeloPlano(t, planejadores) : null);
    if (!slug) {
      descartados.push({ arquivo: t.arquivo, motivo: 'sem worktree' });
      continue;
    }
    if (!porSlug.has(slug)) porSlug.set(slug, []);
    porSlug.get(slug).push(t);
  }
  const casos = [];
  for (const [slug, lista] of porSlug) {
    lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
    let planejador = null;
    let pares = 0;
    let n = 0;
    for (const t of lista) {
      if (t.papel === PLANEJADOR) {
        planejador = t;
        continue;
      }
      if (!planejador) {
        descartados.push({ arquivo: t.arquivo, motivo: 'sem planejador' });
        continue;
      }
      pares += 1;
      if (!t.veredito) {
        descartados.push({ arquivo: t.arquivo, motivo: 'sem veredito' });
        continue;
      }
      if (t.veredito === 'aprovado' && pares > 1) continue;
      n += 1;
      casos.push({
        id: `${slug}-${String(n).padStart(3, '0')}`,
        tipo: t.veredito === 'reprovado' ? 'plano-reprovado' : 'plano-aprovado-1a',
        slug,
        inicio: planejador.inicio,
        P: commitAntes(repo, slug, planejador.inicio),
        entrada: planejador.entrada,
        defeitos: t.veredito === 'reprovado' ? t.saida.split(/\r?\n/).filter((l) => l.startsWith('- ')) : [],
      });
    }
  }
  return { casos, descartados };
}

export function contratoLacunas({ repo }) {
  const lacunas = [];
  for (const { slug, texto } of estadosDoRepo(repo)) {
    let cab;
    try {
      ({ cab } = parseEstado(texto));
    } catch {
      continue;
    }
    const versoes = Number(/^v(\d+)$/.exec(cab.contrato ?? '')?.[1] ?? 0);
    if (versoes <= 1) continue;
    const caminho = `docs/loops/${slug}/contrato.md`;
    const adicoes = git(repo, ['log', '--all', '--full-history', '--diff-filter=A', '--format=%H', '--', caminho]).split(/\r?\n/).filter(Boolean);
    const ultima = git(repo, ['log', '--all', '--full-history', '--diff-filter=AM', '-1', '--format=%H', '--', caminho]);
    if (!adicoes.length || !ultima) continue;
    lacunas.push({
      id: `${slug}-lacuna`,
      tipo: 'contrato-lacuna',
      slug,
      v1: git(repo, ['show', `${adicoes.at(-1)}:${caminho}`]),
      final: git(repo, ['show', `${ultima}:${caminho}`]),
      versoes,
    });
  }
  return lacunas;
}
