import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { criaRepo, git, cli } from './helpers.mjs';
import { estadosDoRepo, contaMarcas, metricasLoop, agrega } from '../scripts/lib/metricas.mjs';

const CAB = '| id | titulo | status | nivel | rodada | conformidade | qualidade | especialista | commit |\n|----|--------|--------|-------|--------|--------------|-----------|--------------|--------|';

function estado(slug, { terminal = '', contrato = 'v1', prompts = 'abc123abc123', tokens = 0, orcTokens = 1000000, chamadas = 0, orcChamadas = 100, linhas = [], log = '' } = {}) {
  return [
    `# Estado — ${slug}`, '', '- fase: execucao', `- estado_terminal: ${terminal}`, `- contrato: ${contrato}`,
    `- prompts: ${prompts}`, '- base: main', '- quadro: off', '- project:', `- tokens_subagentes: ${tokens}`,
    `- chamadas: ${chamadas}`, `- orcamento_tokens: ${orcTokens}`, `- orcamento_chamadas: ${orcChamadas}`,
    '', '## Quadro', '', CAB, ...linhas, '', '## Log', log, '',
  ].join('\n');
}

const tarefa = (id, rodada, status = 'aceita') => `| ${id} | t${id} | ${status} | sonnet | ${rodada} | aprovado | aprovado | — | abc |`;

function grava(repo, slug, texto) {
  const dir = path.join(repo, 'docs', 'loops', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'estado.md'), texto);
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', `estado ${slug}`);
}

test('loop arquivado entra', () => {
  const { repo } = criaRepo();
  grava(repo, 'a', estado('a', {
    terminal: 'sucesso', contrato: 'v3', tokens: 300000, orcTokens: 600000,
    linhas: [tarefa('T1', 1), tarefa('T2', 1), tarefa('T3', 2)],
  }));
  git(repo, 'rm', '-r', 'docs/loops/a');
  git(repo, 'commit', '-m', 'tira loop do PR');
  const achado = estadosDoRepo(repo).find((e) => e.slug === 'a');
  assert.ok(achado);
  const m = metricasLoop(achado);
  assert.equal(m.primeiraRodadaPct, 67);
  assert.equal(m.tokensPorAceita, 100000);
  assert.equal(m.orcamentoTokensPct, 50);
  assert.equal(m.contratoMudancas, 2);
});

test('branch apagada entra com --full-history', () => {
  const { repo } = criaRepo();
  git(repo, 'checkout', '-b', 'loop/b');
  grava(repo, 'b', estado('b', { terminal: 'sucesso', linhas: [tarefa('T1', 1)] }));
  git(repo, 'rm', '-r', 'docs/loops/b');
  git(repo, 'commit', '-m', 'tira loop do PR');
  git(repo, 'checkout', 'main');
  git(repo, 'merge', '--no-ff', 'loop/b', '-m', 'merge');
  git(repo, 'branch', '-D', 'loop/b');
  assert.ok(estadosDoRepo(repo).some((e) => e.slug === 'b'));
});

test('estadosDoRepo fica com a versão mais recente de cada slug', () => {
  const { repo } = criaRepo();
  grava(repo, 'c', estado('c', { tokens: 1 }));
  grava(repo, 'c', estado('c', { tokens: 2 }));
  const achados = estadosDoRepo(repo).filter((e) => e.slug === 'c');
  assert.equal(achados.length, 1);
  assert.match(achados[0].texto, /tokens_subagentes: 2/);
});

test('marcas fixas', () => {
  const log = '- [plano-reprovado] r1\n- [plano-reprovado] r2\n- [plano-aprovado] r3\n- [escalada T2] sobe\n- [muda-contrato forçada] bloqueio\n';
  const marcas = contaMarcas(log);
  assert.equal(marcas.planoReprovado, 2);
  assert.equal(marcas.planoAprovado, 1);
  assert.deepEqual(marcas.escaladas, ['T2']);
  assert.equal(marcas.mudaForcada, 1);
  assert.equal(marcas.mudaEspontanea, 0);
  assert.equal(marcas.inferido, false);
  const m = metricasLoop({ slug: 'm', texto: estado('m', { terminal: 'sucesso', linhas: [tarefa('T1', 1), tarefa('T2', 1)], log }) });
  assert.equal(m.planoReprovado, 2);
  assert.equal(m.primeiraRodadaPct, 50);
  assert.equal(m.contratoForcadas, 1);
  assert.equal(m.inferido, false);
});

test('log antigo inferido', () => {
  const log = '- revisor de plano rodada 1: reprovado\n- revisor de plano reprovou de novo\n- T3 escala para opus\n';
  const m = metricasLoop({ slug: 'i', texto: estado('i', { terminal: 'sucesso', linhas: [tarefa('T3', 1)], log }) });
  assert.equal(m.planoReprovado, 2);
  assert.equal(m.inferido, true);
  assert.equal(m.contratoForcadas, null);
  assert.equal(m.primeiraRodadaPct, 0);
});

test('custo aproximado', () => {
  const m = metricasLoop({ slug: 'k', texto: estado('k', { log: '- tokens somado 0 nesta rodada\n' }) });
  assert.equal(m.custoAproximado, true);
  assert.equal(metricasLoop({ slug: 'k', texto: estado('k') }).custoAproximado, false);
});

test('prompts ausente vira desconhecido e sem terminal vira em andamento', () => {
  const m = metricasLoop({ slug: 'p', texto: estado('p', { prompts: '' }) });
  assert.equal(m.prompts, 'desconhecido');
  assert.equal(m.terminal, 'em andamento');
});

test('estado ilegível não derruba', () => {
  const { repo } = criaRepo();
  const ruim = estado('ruim', { linhas: ['| T1 | t | aceita | sonnet | 1 | — | — | — | abc | extra |'] });
  grava(repo, 'ruim', ruim);
  grava(repo, 'bom', estado('bom', { terminal: 'sucesso', linhas: [tarefa('T1', 1)] }));
  const lista = estadosDoRepo(repo).map(metricasLoop);
  assert.match(lista.find((m) => m.slug === 'ruim').ilegivel, /colunas/);
  assert.equal(lista.find((m) => m.slug === 'bom').tarefasAceitas, 1);
  const r = cli(repo, 'metricas');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ruim: ilegível:/);
  const j = JSON.parse(cli(repo, 'metricas', '--json').stdout);
  assert.equal(j.loops.length, 2);
  assert.equal(j.agregado.length, 1);
});

test('repo sem loops', () => {
  const { repo } = criaRepo();
  const r = cli(repo, 'metricas');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'nenhum loop encontrado');
});

test('metricas --repo aceita caminho com espaço', () => {
  const { repo } = criaRepo();
  grava(repo, 'z', estado('z', { terminal: 'sucesso', linhas: [tarefa('T1', 1)] }));
  const r = cli(path.dirname(repo), 'metricas', '--repo', repo);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /z: sucesso/);
});

test('agrega ignora em andamento', () => {
  const fim = metricasLoop({ slug: 'f', texto: estado('f', { terminal: 'sucesso', tokens: 200000, linhas: [tarefa('T1', 1), tarefa('T2', 2)] }) });
  const andamento = metricasLoop({ slug: 'g', texto: estado('g', { linhas: [tarefa('T1', 1)] }) });
  const ilegivel = { slug: 'h', ilegivel: 'x' };
  const [grupo, ...resto] = agrega([fim, andamento, ilegivel]);
  assert.equal(resto.length, 0);
  assert.equal(grupo.loops, 1);
  assert.equal(grupo.tarefasAceitas, 2);
  assert.equal(grupo.primeiraRodadaPct, 50);
  assert.equal(grupo.tokensPorAceita, 100000);
});
