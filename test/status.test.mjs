import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { criaRepo, criaLoop, cli } from './helpers.mjs';
import { pendingInjections } from '../scripts/loop-eng.mjs';

const linha = (id, status) => `| ${id} | t${id} | ${status} | sonnet | 1 | — | — | — | — |`;

function preparaEstado(wt, tarefas, tokens) {
  const f = path.join(wt, 'docs', 'loops', 'demo', 'estado.md');
  let s = readFileSync(f, 'utf8').replace('- tokens_subagentes: 0', `- tokens_subagentes: ${tokens}`);
  s = s.replace(/(\|----.*\|\n)/, `$1${tarefas.join('\n')}\n`);
  writeFileSync(f, s);
}

test('status: contagens, injeções pendentes e custo por mudança aceita', () => {
  const { repo, contrato } = criaRepo();
  const wt = criaLoop(repo, contrato, 'demo');
  preparaEstado(wt, [linha(1, 'aceita'), linha(2, 'aceita'), linha(3, 'revisando')], 90000);
  const inj = path.join(wt, 'docs', 'loops', 'demo', 'injecoes.md');
  writeFileSync(inj, '# Injeções — demo\n- [x] 2026-11-21T10:00 — velha [aplicada 2026-11-21T10:05: dentro-do-contrato]\n- [ ] 2026-11-21T11:00 — nova\n');
  const r = cli(repo, 'status');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /fase: planejamento/);
  assert.ok(r.stdout.split(/\r?\n/).includes(`worktree: ${path.resolve(wt)}`), r.stdout);
  assert.match(r.stdout, /aceita: 2/);
  assert.match(r.stdout, /revisando: 1/);
  assert.match(r.stdout, /pendente: 0/);
  assert.match(r.stdout, /injeções pendentes: 1/);
  assert.match(r.stdout, /tokens_subagentes: 90000/);
  assert.match(r.stdout, /custo por mudança aceita: 45000/);
});

test('status sem aceitas mostra —', () => {
  const { repo, contrato } = criaRepo();
  criaLoop(repo, contrato, 'demo');
  const r = cli(repo, 'status', 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /custo por mudança aceita: —/);
  assert.match(r.stdout, /injeções pendentes: 0/);
});

test('status sem loop falha', () => {
  const { repo } = criaRepo();
  const r = cli(repo, 'status');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /nenhum loop ativo/);
});

test('pendingInjections: pendentes com linha, continuacao e CRLF', () => {
  const texto = '# Injeções — demo\n- [x] 2026-11-21T10:00 — velha\n- [ ] 2026-11-21T11:00 — a\n  b | # c\n- [ ] 2026-11-21T12:00 — d\n';
  const esperado = [
    { linha: 3, quando: '2026-11-21T11:00', texto: 'a\nb | # c' },
    { linha: 5, quando: '2026-11-21T12:00', texto: 'd' },
  ];
  assert.deepEqual(pendingInjections(texto), esperado);
  assert.deepEqual(pendingInjections(texto.replace(/\n/g, '\r\n')), esperado);
  assert.deepEqual(pendingInjections('# Injeções — demo\n'), []);
});

test('status imprime a base gravada no estado.md', () => {
  const { repo, contrato } = criaRepo();
  criaLoop(repo, contrato, 'demo');
  const r = cli(repo, 'status', 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.split(/\r?\n/).includes('base: main'), r.stdout);
});

test('status de loop entregue lê o estado do commit anterior à remoção de docs/loops', () => {
  const { repo, contrato } = criaRepo();
  const wt = criaLoop(repo, contrato, 'demo');
  const f = path.join(wt, 'docs', 'loops', 'demo', 'estado.md');
  writeFileSync(f, readFileSync(f, 'utf8').replace('- estado_terminal:', '- estado_terminal: sucesso'));
  execFileSync('git', ['commit', '-qam', 'chore(loop): estado'], { cwd: wt });
  execFileSync('git', ['rm', '-rq', 'docs/loops/demo'], { cwd: wt });
  execFileSync('git', ['commit', '-qm', 'chore(loop): estado fora do PR'], { cwd: wt });
  const r = cli(repo, 'status', 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /estado_terminal: sucesso/);
  assert.match(r.stdout, /estado arquivado no commit [0-9a-f]{7,}/);
});
