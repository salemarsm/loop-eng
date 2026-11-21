import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLI = fileURLToPath(new URL('../scripts/loop-eng.mjs', import.meta.url));
export const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

export function criaRepo() {
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

export const init = (repo, args) => spawnSync(process.execPath, [CLI, 'init', ...args], { cwd: repo, encoding: 'utf8' });

export const cli = (repo, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: repo, encoding: 'utf8' });

export function criaLoop(repo, contrato, slug) {
  const r = init(repo, [slug, contrato]);
  if (r.status !== 0) throw new Error(r.stderr);
  return path.join(repo, '.claude', 'worktrees', `loop-${slug}`);
}
