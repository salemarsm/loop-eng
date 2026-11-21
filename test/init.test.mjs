import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveLoop, defaultBranch, loopWorktrees } from '../scripts/lib/git.mjs';
import { criaRepo, init, git } from './helpers.mjs';

test('init cria branch, worktree, 4 arquivos e 1 commit', () => {
  const { repo, contrato } = criaRepo();
  const r = init(repo, ['demo', contrato, '--orcamento-tokens', '500']);
  assert.equal(r.status, 0, r.stderr);
  const wt = path.join(repo, '.claude', 'worktrees', 'loop-demo');
  assert.equal(path.resolve(r.stdout.trim()), wt);
  assert.equal(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'loop/demo');
  const dir = path.join(wt, 'docs', 'loops', 'demo');
  for (const f of ['contrato.md', 'estado.md', 'plano.md', 'injecoes.md']) assert.ok(existsSync(path.join(dir, f)), f);
  assert.equal(readFileSync(path.join(dir, 'contrato.md'), 'utf8'), readFileSync(contrato, 'utf8'));
  assert.equal(readFileSync(path.join(dir, 'injecoes.md'), 'utf8'), '# Injeções — demo\n');
  const estado = readFileSync(path.join(dir, 'estado.md'), 'utf8');
  assert.match(estado, /^# Estado — demo$/m);
  assert.match(estado, /^- orcamento_tokens: 500$/m);
  assert.match(estado, /^- orcamento_chamadas: 200$/m);
  assert.match(readFileSync(path.join(dir, 'plano.md'), 'utf8'), /^# Plano — demo$/m);
  assert.equal(git(wt, 'rev-list', '--count', 'origin/main..HEAD'), '1');
  assert.equal(git(wt, 'log', '-1', '--format=%s'), 'docs: contrato do loop demo');
  assert.equal(git(wt, 'status', '--porcelain'), '');
});

test('segunda chamada com o mesmo slug falha sem alterar nada', () => {
  const { repo, contrato } = criaRepo();
  assert.equal(init(repo, ['demo', contrato]).status, 0);
  const wt = path.join(repo, '.claude', 'worktrees', 'loop-demo');
  const antes = git(wt, 'rev-parse', 'HEAD');
  const r = init(repo, ['demo', contrato]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /já existe/);
  assert.equal(git(wt, 'rev-parse', 'HEAD'), antes);
  assert.equal(git(wt, 'status', '--porcelain'), '');
});

test('defaultBranch cai em main quando origin/HEAD não está definido', () => {
  const { repo } = criaRepo();
  assert.equal(defaultBranch(repo), 'main');
});

test('resolveLoop com 0, 1 e 2 loops e slug inexistente', () => {
  const { repo, contrato } = criaRepo();
  assert.throws(() => resolveLoop(repo), /nenhum loop ativo/);
  assert.equal(init(repo, ['a', contrato]).status, 0);
  const um = resolveLoop(repo);
  assert.equal(um.slug, 'a');
  assert.equal(um.path, path.join(repo, '.claude', 'worktrees', 'loop-a'));
  assert.equal(init(repo, ['b', contrato]).status, 0);
  assert.throws(() => resolveLoop(repo), /mais de um loop ativo: a, b — informe o slug/);
  assert.equal(resolveLoop(repo, 'b').slug, 'b');
  assert.throws(() => resolveLoop(repo, 'zzz'), /loop não encontrado: zzz/);
  assert.equal(loopWorktrees(repo).length, 2);
});

test('init parte do estado mais novo do remoto (fetch antes do worktree)', () => {
  const { repo, contrato } = criaRepo();
  const remoto = git(repo, 'remote', 'get-url', 'origin');
  const outro = path.join(path.dirname(repo), 'outro clone');
  git(path.dirname(repo), 'clone', remoto, outro);
  git(outro, 'config', 'user.name', 'Outro');
  git(outro, 'config', 'user.email', 'outro@example.com');
  writeFileSync(path.join(outro, 'novo.txt'), 'novo\n');
  git(outro, 'add', '.');
  git(outro, 'commit', '-m', 'segundo');
  git(outro, 'push', 'origin', 'main');
  const novo = git(outro, 'rev-parse', 'HEAD');
  const r = init(repo, ['demo', contrato]);
  assert.equal(r.status, 0, r.stderr);
  const wt = path.join(repo, '.claude', 'worktrees', 'loop-demo');
  git(wt, 'merge-base', '--is-ancestor', novo, 'HEAD');
});

test('init com fetch falhando dá erro explícito e não cria nada', () => {
  const { repo, contrato } = criaRepo();
  git(repo, 'remote', 'set-url', 'origin', path.join(path.dirname(repo), 'inexistente.git'));
  const r = init(repo, ['demo', contrato]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /git fetch/);
  assert.equal(existsSync(path.join(repo, '.claude', 'worktrees', 'loop-demo')), false);
  assert.equal(git(repo, 'branch', '--list', 'loop/demo'), '');
});
