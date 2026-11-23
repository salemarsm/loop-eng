import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { criaRepo, criaLoop, cliEnv } from './helpers.mjs';
import { promptsEfetivos, hashConjunto, overridesVelhos, skillDir } from '../scripts/lib/prompts.mjs';
import { parseEstado } from '../scripts/lib/estado.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const tmp = () => mkdtempSync(path.join(tmpdir(), 'loop eng prompts '));

function criaSkill(refinamento, a) {
  const skill = tmp();
  mkdirSync(path.join(skill, 'prompts'));
  writeFileSync(path.join(skill, 'refinamento.md'), refinamento);
  writeFileSync(path.join(skill, 'prompts', 'a.md'), a);
  return skill;
}

test('hashConjunto é estável e ignora CRLF', () => {
  const home = tmp();
  const s1 = criaSkill('um\ndois\n', 'x\ny\n');
  const s2 = criaSkill('um\r\ndois\r\n', 'x\r\ny\r\n');
  const s3 = criaSkill('um\ndois\n', 'x\nz\n');
  const h1 = hashConjunto(promptsEfetivos({ skill: s1, home }));
  assert.equal(h1.length, 12);
  assert.equal(hashConjunto(promptsEfetivos({ skill: s2, home })), h1);
  assert.notEqual(hashConjunto(promptsEfetivos({ skill: s3, home })), h1);
});

test('hashConjunto segue a fórmula nome, quebra, conteúdo, quebra, em ordem', () => {
  const skill = criaSkill('um\n', 'x\n');
  const h = createHash('sha256');
  h.update('prompts/a.md\nx\n\n');
  h.update('refinamento.md\num\n\n');
  assert.equal(hashConjunto(promptsEfetivos({ skill, home: tmp() })), h.digest('hex').slice(0, 12));
});

test('override substitui só o arquivo existente', () => {
  const home = tmp();
  mkdirSync(path.join(home, 'prompts'));
  writeFileSync(path.join(home, 'prompts', 'planejador.md'), 'meu planejador\n');
  const lista = promptsEfetivos({ home });
  const plan = lista.find((p) => p.nome === 'prompts/planejador.md');
  assert.equal(plan.origem, 'override');
  assert.equal(plan.caminho, path.join(home, 'prompts', 'planejador.md'));
  for (const p of lista.filter((x) => x !== plan)) assert.equal(p.origem, 'plugin');
  assert.deepEqual(lista.map((p) => p.nome), [...lista.map((p) => p.nome)].sort());
});

test('overridesVelhos: base antiga, desconhecida e igual', () => {
  const home = tmp();
  mkdirSync(path.join(home, 'prompts'));
  writeFileSync(path.join(home, 'prompts', 'planejador.md'), 'meu planejador\n');
  assert.deepEqual(overridesVelhos({ home }), [{ nome: 'prompts/planejador.md', motivo: 'base-desconhecida' }]);

  const hashPlugin = promptsEfetivos({ home: tmp() }).find((p) => p.nome === 'prompts/planejador.md').hash;
  const base = path.join(home, 'prompts', 'base.json');
  writeFileSync(base, JSON.stringify({ 'prompts/planejador.md': 'ffffffffffff' }));
  assert.deepEqual(overridesVelhos({ home }), [{ nome: 'prompts/planejador.md', motivo: 'base-antiga' }]);
  writeFileSync(base, JSON.stringify({ 'prompts/planejador.md': hashPlugin }));
  assert.deepEqual(overridesVelhos({ home }), []);
});

test('init grava prompts e prompts_origem', () => {
  const { repo, contrato } = criaRepo();
  const antes = process.env.LOOP_ENG_HOME;
  process.env.LOOP_ENG_HOME = tmp();
  try {
    const wt = criaLoop(repo, contrato, 'demo');
    const { cab } = parseEstado(readFileSync(path.join(wt, 'docs', 'loops', 'demo', 'estado.md'), 'utf8'));
    assert.match(cab.prompts, /^[0-9a-f]{12}$/);
    assert.equal(cab.prompts_origem, 'plugin');
  } finally {
    if (antes === undefined) delete process.env.LOOP_ENG_HOME;
    else process.env.LOOP_ENG_HOME = antes;
  }
});

test('status avisa override velho', () => {
  const { repo, contrato } = criaRepo();
  const home = tmp();
  mkdirSync(path.join(home, 'prompts'));
  writeFileSync(path.join(home, 'prompts', 'planejador.md'), 'meu planejador\n');
  writeFileSync(path.join(home, 'prompts', 'base.json'), JSON.stringify({ 'prompts/planejador.md': 'ffffffffffff' }));
  const ini = cliEnv(repo, { LOOP_ENG_HOME: home }, 'init', 'demo', contrato);
  assert.equal(ini.status, 0, ini.stderr);
  const wt = path.join(repo, '.claude', 'worktrees', 'loop-demo');
  assert.match(readFileSync(path.join(wt, 'docs', 'loops', 'demo', 'estado.md'), 'utf8'), /prompts_origem: override/);
  const r = cliEnv(repo, { LOOP_ENG_HOME: home }, 'status');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('override de prompts/planejador.md evoluído sobre versão antiga do plugin; rode /loop-eng evoluir usuario'), r.stdout);
});

test('cli hash-prompts', () => {
  const { repo } = criaRepo();
  const r = cliEnv(repo, { LOOP_ENG_HOME: tmp() }, 'hash-prompts');
  assert.equal(r.status, 0, r.stderr);
  const linhas = r.stdout.trim().split(/\r?\n/);
  assert.match(linhas[0], /^prompts: [0-9a-f]{12} \(plugin\)$/);
  assert.ok(linhas.some((l) => l.startsWith('refinamento.md plugin ')));
  assert.ok(linhas.some((l) => l.includes(path.join(skillDir(), 'prompts', 'planejador.md'))));
});
