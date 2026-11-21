import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLoop, defaultBranch, loopWorktrees } from '../scripts/lib/git.mjs';

const CLI = fileURLToPath(new URL('../scripts/loop-eng.mjs', import.meta.url));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function criaRepo() {
  const base = mkdtempSync(path.join(tmpdir(), 'loop eng '));
  const remoto = path.join(base, 'remoto.git');
  const repo = path.join(base, 'meu projeto');
  mkdirSync(repo);
  git(base, 'init', '--bare', '-b', 'main', remoto);
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.name', 'Teste');
  git(repo, 'config', 'user.email', 'teste@example.com');
  writeFileSync(path.join(repo, 'README.md'), 'oi\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'inicial');
  git(repo, 'remote', 'add', 'origin', remoto);
  git(repo, 'push', 'origin', 'main');
  const contrato = path.join(base, 'contrato.md');
  writeFileSync(contrato, '# Contrato — demo\n\n## Requisito\nalgo\n');
  return { repo, contrato };
}

const init = (repo, args) => spawnSync(process.execPath, [CLI, 'init', ...args], { cwd: repo, encoding: 'utf8' });

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
