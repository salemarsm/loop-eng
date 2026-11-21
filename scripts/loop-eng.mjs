#!/usr/bin/env node
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { git, defaultBranch, branchExiste } from './lib/git.mjs';

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
  const tokens = opcaoNumerica(args, '--orcamento-tokens', ORCAMENTO_TOKENS_PADRAO);
  const chamadas = opcaoNumerica(args, '--orcamento-chamadas', ORCAMENTO_CHAMADAS_PADRAO);

  const raiz = path.resolve(git(process.cwd(), ['rev-parse', '--show-toplevel']));
  const branch = `loop/${slug}`;
  const worktree = path.join(raiz, '.claude', 'worktrees', `loop-${slug}`);
  if (branchExiste(raiz, branch)) throw new Error(`o loop já existe: branch ${branch}`);
  if (fs.existsSync(worktree)) throw new Error(`o loop já existe: ${worktree}`);
  const contrato = fs.readFileSync(path.resolve(contratoPath), 'utf8');

  git(raiz, ['worktree', 'add', '-b', branch, worktree, `origin/${defaultBranch(raiz)}`]);
  const dir = path.join(worktree, 'docs', 'loops', slug);
  fs.mkdirSync(dir, { recursive: true });
  const preenche = (t) => t.replaceAll('<slug>', slug)
    .replaceAll('<orcamento_tokens>', String(tokens))
    .replaceAll('<orcamento_chamadas>', String(chamadas));
  fs.writeFileSync(path.join(dir, 'contrato.md'), contrato);
  fs.writeFileSync(path.join(dir, 'estado.md'), preenche(modelo('estado.md')));
  fs.writeFileSync(path.join(dir, 'plano.md'), preenche(modelo('plano.md')));
  fs.writeFileSync(path.join(dir, 'injecoes.md'), `# Injeções — ${slug}\n`);
  git(worktree, ['add', path.join('docs', 'loops', slug)]);
  git(worktree, ['commit', '-m', `docs: contrato do loop ${slug}`]);
  return worktree;
}

const COMANDOS = {
  init,
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
