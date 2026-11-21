import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { criaRepo, criaLoop, cli, git } from './helpers.mjs';

const arq = (wt, slug) => path.join(wt, 'docs', 'loops', slug, 'injecoes.md');

test('inject com 1 loop e sem slug grava a entrada e commita', () => {
  const { repo, contrato } = criaRepo();
  const wt = criaLoop(repo, contrato, 'demo');
  const antes = git(wt, 'rev-list', '--count', 'HEAD');
  const r = cli(repo, 'inject', 'faça', 'isso');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /injeção gravada em .*injecoes\.md; será lida no próximo checkpoint/);
  assert.match(readFileSync(arq(wt, 'demo'), 'utf8'), /^# Injeções — demo\n- \[ \] \d{4}-\d{2}-\d{2}T\d{2}:\d{2} — faça isso\n$/);
  assert.equal(git(wt, 'log', '-1', '--format=%s'), 'chore(loop): injeção');
  assert.equal(Number(git(wt, 'rev-list', '--count', 'HEAD')), Number(antes) + 1);
  assert.equal(git(wt, 'status', '--porcelain'), '');
});

test('inject multilinha vira 1 entrada com continuação indentada', () => {
  const { repo, contrato } = criaRepo();
  const wt = criaLoop(repo, contrato, 'demo');
  assert.equal(cli(repo, 'inject', 'linha1\nlinha2 | # x').status, 0);
  const linhas = readFileSync(arq(wt, 'demo'), 'utf8').split('\n');
  assert.equal(linhas.filter((l) => l.startsWith('- [ ]')).length, 1);
  assert.match(linhas[1], / — linha1$/);
  assert.equal(linhas[2], '  linha2 | # x');
});

test('inject sem loop falha sem criar arquivo', () => {
  const { repo } = criaRepo();
  const r = cli(repo, 'inject', 'texto');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /nenhum loop ativo/);
  assert.equal(existsSync(path.join(repo, 'docs')), false);
});

test('inject com 2 loops sem slug falha e não toca nos arquivos', () => {
  const { repo, contrato } = criaRepo();
  const a = criaLoop(repo, contrato, 'loop-a');
  const b = criaLoop(repo, contrato, 'loop-b');
  const r = cli(repo, 'inject', 'texto qualquer');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /mais de um loop ativo/);
  assert.equal(readFileSync(arq(a, 'loop-a'), 'utf8'), '# Injeções — loop-a\n');
  assert.equal(readFileSync(arq(b, 'loop-b'), 'utf8'), '# Injeções — loop-b\n');
});

test('inject <slug> <texto> grava no loop indicado', () => {
  const { repo, contrato } = criaRepo();
  const a = criaLoop(repo, contrato, 'loop-a');
  const b = criaLoop(repo, contrato, 'loop-b');
  const r = cli(repo, 'inject', 'loop-a', 'texto', 'certo');
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(arq(a, 'loop-a'), 'utf8'), / — texto certo\n$/);
  assert.equal(readFileSync(arq(b, 'loop-b'), 'utf8'), '# Injeções — loop-b\n');
});

test('primeiro argumento que não é slug existente faz parte do texto', () => {
  const { repo, contrato } = criaRepo();
  const wt = criaLoop(repo, contrato, 'demo');
  assert.equal(cli(repo, 'inject', 'outra', 'coisa').status, 0);
  assert.match(readFileSync(arq(wt, 'demo'), 'utf8'), / — outra coisa\n$/);
});

test('inject sem texto dá erro de uso', () => {
  const { repo, contrato } = criaRepo();
  criaLoop(repo, contrato, 'demo');
  const r = cli(repo, 'inject');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /uso: loop-eng inject/);
});

test('mensagem varia com estado_terminal', () => {
  const { repo, contrato } = criaRepo();
  const wt = criaLoop(repo, contrato, 'demo');
  const estado = path.join(wt, 'docs', 'loops', 'demo', 'estado.md');
  const base = readFileSync(estado, 'utf8');
  const com = (t) => writeFileSync(estado, base.replace('- estado_terminal:', `- estado_terminal: ${t}`));
  com('bloqueado');
  assert.match(cli(repo, 'inject', 'x').stdout, /; responde ao bloqueio — retome o loop/);
  com('sucesso');
  assert.match(cli(repo, 'inject', 'y').stdout, /; vale no próximo retomar/);
});
