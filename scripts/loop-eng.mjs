#!/usr/bin/env node
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { git, defaultBranch, branchExiste, loopWorktrees, resolveLoop } from './lib/git.mjs';
import { parseEstado, serializeEstado, STATUS } from './lib/estado.mjs';
import { runGh } from './lib/gh.mjs';
import { estadosDoRepo, metricasLoop, agrega } from './lib/metricas.mjs';
import { promptsEfetivos, hashConjunto, overridesVelhos } from './lib/prompts.mjs';

const TAMANHO_MAXIMO_SLUG = 40;

export function slugify(texto) {
  let slug = texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length > TAMANHO_MAXIMO_SLUG) {
    slug = slug.slice(0, TAMANHO_MAXIMO_SLUG);
    const corte = slug.lastIndexOf('-');
    if (corte > 0) slug = slug.slice(0, corte);
  }

  if (!slug) throw new Error('slug vazio: o texto não tem letras ou dígitos');
  return slug;
}

const ORCAMENTO_TOKENS_PADRAO = 2000000;
const ORCAMENTO_CHAMADAS_PADRAO = 200;

function modelo(nome) {
  return fs.readFileSync(fileURLToPath(new URL(`../skills/loop-eng/modelos/${nome}`, import.meta.url)), 'utf8');
}

function opcaoNumerica(args, nome, padrao) {
  const i = args.indexOf(nome);
  if (i === -1) return padrao;
  const valor = args[i + 1];
  if (!/^\d+$/.test(valor ?? '')) throw new Error(`${nome} exige um inteiro, recebeu: ${valor ?? '(nada)'}`);
  return Number(valor);
}

function init(args) {
  const posicionais = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) i++;
    else posicionais.push(args[i]);
  }
  const [slug, contratoPath] = posicionais;
  if (!slug || !contratoPath) {
    throw new Error('uso: loop-eng init <slug> <contrato-path> [--orcamento-tokens N] [--orcamento-chamadas N]');
  }
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug inválido: "${slug}" (permitido: ^[a-z0-9-]+$)`);
  const tokens = opcaoNumerica(args, '--orcamento-tokens', ORCAMENTO_TOKENS_PADRAO);
  const chamadas = opcaoNumerica(args, '--orcamento-chamadas', ORCAMENTO_CHAMADAS_PADRAO);

  const raiz = path.resolve(git(process.cwd(), ['rev-parse', '--show-toplevel']));
  const branch = `loop/${slug}`;
  const worktree = path.join(raiz, '.claude', 'worktrees', `loop-${slug}`);
  if (branchExiste(raiz, branch)) throw new Error(`o loop já existe: branch ${branch}`);
  if (fs.existsSync(worktree)) throw new Error(`o loop já existe: ${worktree}`);
  const contrato = fs.readFileSync(path.resolve(contratoPath), 'utf8');

  const prompts = promptsEfetivos();
  const base = defaultBranch(raiz);
  try {
    git(raiz, ['fetch', 'origin', base]);
  } catch (err) {
    throw new Error(`falha ao atualizar origin/${base} (git fetch): ${String(err.stderr ?? err.message).trim()}`);
  }
  git(raiz, ['worktree', 'add', '-b', branch, worktree, `origin/${base}`]);
  const dir = path.join(worktree, 'docs', 'loops', slug);
  fs.mkdirSync(dir, { recursive: true });
  const preenche = (t) => t.replaceAll('<slug>', slug)
    .replaceAll('<base>', base)
    .replaceAll('<orcamento_tokens>', String(tokens))
    .replaceAll('<orcamento_chamadas>', String(chamadas))
    .replaceAll('<prompts>', hashConjunto(prompts))
    .replaceAll('<prompts_origem>', prompts.some((p) => p.origem === 'override') ? 'override' : 'plugin');
  fs.writeFileSync(path.join(dir, 'contrato.md'), contrato);
  fs.writeFileSync(path.join(dir, 'estado.md'), preenche(modelo('estado.md')));
  fs.writeFileSync(path.join(dir, 'plano.md'), preenche(modelo('plano.md')));
  fs.writeFileSync(path.join(dir, 'injecoes.md'), `# Injeções — ${slug}\n`);
  git(worktree, ['add', path.join('docs', 'loops', slug)]);
  git(worktree, ['commit', '-m', `docs: contrato do loop ${slug}`]);
  return worktree;
}

function agora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function pendingInjections(textoBruto) {
  const linhas = textoBruto.replace(/\r\n/g, '\n').split('\n');
  const pendentes = [];
  let atual = null;
  linhas.forEach((l, i) => {
    const m = /^- \[( |x)\] (\S+) — (.*)$/.exec(l);
    if (m) {
      atual = m[1] === ' ' ? { linha: i + 1, quando: m[2], texto: m[3] } : null;
      if (atual) pendentes.push(atual);
    } else if (atual && l.startsWith('  ')) {
      atual.texto += `\n${l.slice(2)}`;
    } else {
      atual = null;
    }
  });
  return pendentes;
}

function carregaLoop(args) {
  const raiz = process.cwd();
  const [primeiro, ...resto] = args;
  const conhecido = primeiro !== undefined && loopWorktrees(raiz).some((l) => l.slug === primeiro);
  return { loop: resolveLoop(raiz, conhecido ? primeiro : undefined), resto: conhecido ? resto : args };
}

function inject(args) {
  const { loop, resto } = carregaLoop(args);
  exigeAtivo(loop);
  const texto = resto.join(' ');
  if (!texto.trim()) throw new Error('uso: loop-eng inject [slug] <texto...>');
  const rel = path.join('docs', 'loops', loop.slug);
  const arquivo = path.join(loop.path, rel, 'injecoes.md');
  const terminal = parseEstado(fs.readFileSync(path.join(loop.path, rel, 'estado.md'), 'utf8')).cab.estado_terminal;
  const atual = fs.readFileSync(arquivo, 'utf8');
  const [primeira, ...demais] = texto.replace(/\r\n/g, '\n').split('\n');
  const entrada = [`- [ ] ${agora()} — ${primeira}`, ...demais.map((l) => `  ${l}`)].join('\n');
  fs.writeFileSync(arquivo, `${atual}${atual.endsWith('\n') || atual === '' ? '' : '\n'}${entrada}\n`);
  git(loop.path, ['add', path.join(rel, 'injecoes.md')]);
  git(loop.path, ['commit', '-m', 'chore(loop): injeção', '--', path.join(rel, 'injecoes.md')]);
  const quando = !terminal ? 'será lida no próximo checkpoint'
    : terminal === 'bloqueado' ? 'responde ao bloqueio — retome o loop'
      : 'vale no próximo retomar';
  return `injeção gravada em ${arquivo}; ${quando}`;
}

// Loop entregue: a Fase 3 tira docs/loops/<slug> do PR num commit final e o estado vive
// no commit anterior a essa remoção. Devolve esse commit, ou null se o loop está ativo.
function commitArquivado(loop) {
  const rel = `docs/loops/${loop.slug}`;
  if (fs.existsSync(path.join(loop.path, rel, 'estado.md'))) return null;
  const remocao = git(loop.path, ['log', '-1', '--format=%h', '--diff-filter=D', '--', `${rel}/estado.md`]);
  if (!remocao) throw new Error(`estado.md ausente em ${path.join(loop.path, rel)} e sem commit de remoção no histórico`);
  return git(loop.path, ['rev-parse', '--short', `${remocao}^`]);
}

function exigeAtivo(loop) {
  const arquivado = commitArquivado(loop);
  if (arquivado) throw new Error(`loop entregue: estado arquivado no commit ${arquivado}; nada a gravar — abra um loop novo`);
}

function status(args) {
  const loop = resolveLoop(process.cwd(), args[0]);
  const dir = path.join(loop.path, 'docs', 'loops', loop.slug);
  const arquivado = commitArquivado(loop);
  const ler = arquivado
    ? (nome) => git(loop.path, ['show', `${arquivado}:docs/loops/${loop.slug}/${nome}`])
    : (nome) => fs.readFileSync(path.join(dir, nome), 'utf8');
  const { cab, tarefas } = parseEstado(ler('estado.md'));
  const pendentes = pendingInjections(ler('injecoes.md'));
  const aceitas = tarefas.filter((t) => t.status === 'aceita').length;
  const tokens = Number(cab.tokens_subagentes ?? 0);
  const custo = aceitas === 0 ? '—' : String(Math.round(tokens / aceitas));
  return [
    `loop: ${loop.slug}`,
    `worktree: ${loop.path}`,
    `base: ${cab.base || '—'}`,
    `fase: ${cab.fase}`,
    `estado_terminal: ${cab.estado_terminal || '—'}`,
    'quadro:',
    ...STATUS.map((c) => `  ${c}: ${tarefas.filter((t) => t.status === c).length}`),
    `injeções pendentes: ${pendentes.length}`,
    `tokens_subagentes: ${cab.tokens_subagentes}`,
    `chamadas: ${cab.chamadas}`,
    `custo por mudança aceita: ${custo}`,
    ...(arquivado ? [`estado arquivado no commit ${arquivado} (removido do PR)`] : []),
    ...overridesVelhos().map((o) => `aviso: override de ${o.nome} evoluído sobre versão antiga do plugin; rode /loop-eng evoluir usuario`),
  ].join('\n');
}

const gh = (args) => JSON.parse(runGh([...args, '--format', 'json']));

function corpoTarefa(t) {
  return [`conformidade: ${t.conformidade}`, `qualidade: ${t.qualidade}`, `especialista: ${t.especialista}`, `commit: ${t.commit}`].join('\n');
}

const tituloTarefa = (t) => `${t.id} [${t.nivel}] r${t.rodada} — ${t.titulo}`;

const listaEtapa = (n) => gh(['project', 'field-list', n, '--owner', '@me']).fields.find((f) => f.name === 'Etapa');

// Completa o que falta em .quadro.json; cada passo é salvo, então uma falha no meio é retomável.
function preparaProject(slug, quadro, salva) {
  if (!quadro.number) {
    const { number, url } = gh(['project', 'create', '--owner', '@me', '--title', `loop-eng: ${slug}`]);
    Object.assign(quadro, { number, url });
    salva();
    console.error('quadro: no GitHub, agrupe a visão do Project por "Etapa" (Board > Column field > Etapa) — o gh não cria views.');
  }
  const n = String(quadro.number);
  if (!quadro.projectId) {
    quadro.projectId = gh(['project', 'view', n, '--owner', '@me']).id;
    salva();
  }
  if (!quadro.fieldId) {
    let etapa = listaEtapa(n);
    if (!etapa) {
      gh(['project', 'field-create', n, '--owner', '@me', '--name', 'Etapa',
        '--data-type', 'SINGLE_SELECT', '--single-select-options', STATUS.join(',')]);
      etapa = listaEtapa(n);
    }
    if (!etapa) throw new Error('campo Etapa não encontrado após a criação');
    quadro.options = Object.fromEntries(etapa.options.map((o) => [o.name, o.id]));
    quadro.fieldId = etapa.id;
    salva();
  }
}

function sincroniza(tarefas, quadro, salva) {
  const n = String(quadro.number);
  const novas = new Set();
  for (const t of tarefas) {
    if (quadro.items[t.id]) continue;
    const item = gh(['project', 'item-create', n, '--owner', '@me', '--title', tituloTarefa(t), '--body', corpoTarefa(t)]);
    quadro.items[t.id] = { itemId: item.id, draftId: '' };
    novas.add(t.id);
    salva();
  }
  if (tarefas.some((t) => !quadro.items[t.id].draftId)) {
    const porItem = new Map(gh(['project', 'item-list', n, '--owner', '@me', '--limit', '1000']).items.map((i) => [i.id, i.content?.id]));
    for (const t of tarefas) quadro.items[t.id].draftId = porItem.get(quadro.items[t.id].itemId) ?? '';
    salva();
  }
  for (const t of tarefas) {
    const { itemId, draftId } = quadro.items[t.id];
    if (!novas.has(t.id)) {
      if (!draftId) throw new Error(`rascunho de ${t.id} não encontrado no Project`);
      gh(['project', 'item-edit', '--id', draftId, '--title', tituloTarefa(t), '--body', corpoTarefa(t)]);
    }
    gh(['project', 'item-edit', '--id', itemId, '--project-id', quadro.projectId, '--field-id', quadro.fieldId,
      '--single-select-option-id', quadro.options[t.status]]);
  }
}

function quadroSync(args) {
  const loop = resolveLoop(process.cwd(), args[0]);
  exigeAtivo(loop);
  const rel = path.join('docs', 'loops', loop.slug);
  const arquivoEstado = path.join(loop.path, rel, 'estado.md');
  const arquivoQuadro = path.join(loop.path, rel, '.quadro.json');
  const estado = parseEstado(fs.readFileSync(arquivoEstado, 'utf8'));
  if (estado.cab.quadro === 'off') return 'quadro: off — nada a sincronizar';
  if (!['github', 'dessincronizado'].includes(estado.cab.quadro)) {
    throw new Error(`quadro inválido em estado.md: "${estado.cab.quadro}" (permitidos: off, github, dessincronizado)`);
  }

  const quadro = fs.existsSync(arquivoQuadro) ? JSON.parse(fs.readFileSync(arquivoQuadro, 'utf8')) : { items: {} };
  const salva = () => fs.writeFileSync(arquivoQuadro, `${JSON.stringify(quadro, null, 2)}\n`);
  let resultado;
  try {
    preparaProject(loop.slug, quadro, salva);
    sincroniza(estado.tarefas, quadro, salva);
    estado.cab.quadro = 'github';
    resultado = `quadro sincronizado: ${quadro.url}`;
  } catch (err) {
    estado.cab.quadro = 'dessincronizado';
    console.error(`quadro: falha no GitHub, o loop segue sem espelho — ${String(err.stderr ?? err.message).trim()}`);
    resultado = 'quadro: dessincronizado';
  }
  if (quadro.url) estado.cab.project = quadro.url;
  fs.writeFileSync(arquivoEstado, serializeEstado(estado));
  const arquivos = [path.join(rel, 'estado.md'), ...(fs.existsSync(arquivoQuadro) ? [path.join(rel, '.quadro.json')] : [])];
  git(loop.path, ['add', ...arquivos]);
  if (git(loop.path, ['status', '--porcelain', '--', ...arquivos])) git(loop.path, ['commit', '-m', 'chore(loop): quadro', '--', ...arquivos]);
  return resultado;
}

function hashPrompts() {
  const lista = promptsEfetivos();
  return [
    `prompts: ${hashConjunto(lista)} (${lista.some((p) => p.origem === 'override') ? 'override' : 'plugin'})`,
    ...lista.map((p) => `${p.nome} ${p.origem} ${p.hash} ${p.caminho}`),
  ].join('\n');
}

function metricas(args) {
  const i = args.indexOf('--repo');
  if (i !== -1 && (args[i + 1] === undefined || args[i + 1].startsWith('--'))) throw new Error('--repo exige um caminho');
  const repo = path.resolve(i === -1 ? process.cwd() : args[i + 1]);
  const loops = estadosDoRepo(repo).map(metricasLoop);
  if (loops.length === 0) return 'nenhum loop encontrado';
  const agregado = agrega(loops);
  if (args.includes('--json')) return JSON.stringify({ loops, agregado }, null, 2);
  const n = (v, sufixo = '') => (v === null ? '—' : `${v}${sufixo}`);
  return [
    'loops:',
    ...loops.map((m) => (m.ilegivel
      ? `  ${m.slug}: ilegível: ${m.ilegivel}`
      : `  ${m.slug}: ${m.terminal}, prompts ${m.prompts}, aceitas ${m.tarefasAceitas}, 1ª rodada ${n(m.primeiraRodadaPct, '%')}, plano reprovado ${m.planoReprovado}, tokens/aceita ${n(m.tokensPorAceita)}, orçamento tokens ${n(m.orcamentoTokensPct, '%')}, chamadas ${n(m.orcamentoChamadasPct, '%')}, contrato +${m.contratoMudancas} (forçadas ${n(m.contratoForcadas)})${m.custoAproximado ? ', custo aproximado' : ''}${m.inferido ? ', marcas inferidas' : ''}`)),
    'agregado por prompts (loops encerrados):',
    ...agregado.map((a) => `  ${a.prompts}: ${a.loops} loops, aceitas ${a.tarefasAceitas}, 1ª rodada ${n(a.primeiraRodadaPct, '%')}, plano reprovado/loop ${a.planoReprovadoPorLoop}, tokens/aceita ${n(a.tokensPorAceita)}`),
  ].join('\n');
}

const COMANDOS = {
  metricas,
  init,
  'hash-prompts': hashPrompts,
  inject,
  status,
  'quadro-sync': quadroSync,
  slug: ([texto]) => {
    if (texto === undefined) throw new Error('uso: loop-eng slug "<texto>"');
    return slugify(texto);
  },
};

export function main(argv) {
  const [comando, ...resto] = argv;
  const handler = COMANDOS[comando];
  if (!handler) {
    throw new Error(`comando desconhecido: ${comando ?? '(nenhum)'}. Disponíveis: ${Object.keys(COMANDOS).join(', ')}`);
  }
  return handler(resto);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(main(process.argv.slice(2)));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
