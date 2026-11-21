import { execFileSync } from 'node:child_process';
import path from 'node:path';

export function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function ok(cwd, args) {
  try {
    git(cwd, args);
    return true;
  } catch {
    return false;
  }
}

export function branchExiste(repoDir, branch) {
  return ok(repoDir, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
}

export function defaultBranch(repoDir) {
  try {
    return git(repoDir, ['symbolic-ref', 'refs/remotes/origin/HEAD']).replace(/^refs\/remotes\/origin\//, '');
  } catch {
    return ok(repoDir, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main']) ? 'main' : 'master';
  }
}

export function loopWorktrees(repoDir) {
  const saida = git(repoDir, ['worktree', 'list', '--porcelain']);
  const loops = [];
  for (const bloco of saida.split(/\r?\n\r?\n/)) {
    const caminho = /^worktree (.+)$/m.exec(bloco);
    const branch = /^branch refs\/heads\/(loop\/.+)$/m.exec(bloco);
    if (caminho && branch) {
      loops.push({ slug: branch[1].slice('loop/'.length), path: path.resolve(caminho[1]), branch: branch[1] });
    }
  }
  return loops;
}

export function resolveLoop(repoDir, slug) {
  const loops = loopWorktrees(repoDir);
  if (slug !== undefined) {
    const achado = loops.find((l) => l.slug === slug);
    if (!achado) throw new Error(`loop não encontrado: ${slug}`);
    return { slug: achado.slug, path: achado.path };
  }
  if (loops.length === 0) throw new Error('nenhum loop ativo');
  if (loops.length > 1) {
    throw new Error(`mais de um loop ativo: ${loops.map((l) => l.slug).join(', ')} — informe o slug`);
  }
  return { slug: loops[0].slug, path: loops[0].path };
}
