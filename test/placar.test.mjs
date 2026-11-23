import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CLI } from './helpers.mjs';
import { divide, placarCandidato, ordena, aceita } from '../scripts/lib/placar.mjs';

const casos = (falhas, controles) => [
  ...Array.from({ length: falhas }, (_, i) => ({ id: `f${i}`, tipo: 'plano-reprovado' })),
  ...Array.from({ length: controles }, (_, i) => ({ id: `c${i}`, tipo: 'plano-aprovado-1a' })),
];
const p = (candidato, falhas, controles, tokens, tamanho) => ({ candidato, conjunto: 'treino', falhas, controles, tokens, tamanho });

test('divide é determinístico', () => {
  const lista = casos(7, 4);
  const a = divide(lista, 20261123);
  assert.deepEqual(divide(lista, 20261123), a);
  assert.equal(a.holdout.filter((id) => id.startsWith('f')).length, 2);
  assert.equal(a.holdout.filter((id) => id.startsWith('c')).length, 1);
  assert.equal(a.treino.length + a.holdout.length, 11);
  assert.equal(a.treino.filter((id) => a.holdout.includes(id)).length, 0);
  assert.ok(Array.from({ length: 20 }, (_, s) => divide(lista, s).holdout.join()).some((h) => h !== a.holdout.join()));
});

test('divide recusa histórico curto', () => {
  assert.throws(() => divide(casos(3, 5), 1), /histórico insuficiente: 3/);
});

test('controle com pergunta vale 0', () => {
  const r = placarCandidato({
    candidato: 'x', conjunto: 'treino', tamanho: 10,
    resultados: [{ caso: 'c0', tipo: 'plano-aprovado-1a', nota: 1, perguntou: true, tokens: 5 }],
  });
  assert.equal(r.controles, 0);
});

test('placarCandidato agrega falhas, controles e tokens', () => {
  const r = placarCandidato({
    candidato: 'x', conjunto: 'holdout', tamanho: 10,
    resultados: [
      { caso: 'f0', tipo: 'plano-reprovado', nota: 0.5, perguntou: false, tokens: 100 },
      { caso: 'f1', tipo: 'plano-reprovado', nota: 1, perguntou: true, tokens: 200 },
      { caso: 'c0', tipo: 'plano-aprovado-1a', nota: 1, perguntou: false, tokens: 300 },
    ],
  });
  assert.deepEqual(r, { candidato: 'x', conjunto: 'holdout', falhas: 0.75, controles: 1, tokens: 200, tamanho: 10 });
});

test('perguntar tudo não vence', () => {
  const baseline = p('base', 0.5, 1, 100, 10);
  const pergunta = p('pergunta', 1, 0.5, 100, 10);
  assert.deepEqual(ordena([pergunta], baseline), []);
  assert.deepEqual(ordena([pergunta, p('ok', 0.6, 1, 100, 10)], baseline).map((x) => x.candidato), ['ok']);
});

test('desempate', () => {
  const baseline = p('base', 0, 1, 0, 0);
  const ordem = ordena([p('a', 0.5, 1, 200, 5), p('b', 0.5, 1, 100, 9), p('c', 0.5, 1, 100, 7)], baseline);
  assert.deepEqual(ordem.map((x) => x.candidato), ['c', 'b', 'a']);
});

test('aceita exige ganho no holdout', () => {
  const base = p('base', 0.5, 1, 1, 1);
  assert.equal(aceita(p('v', 0.5, 1, 1, 1), base), false);
  assert.equal(aceita(p('v', 0.7, 1, 1, 1), base), true);
  assert.equal(aceita(p('v', 0.7, 0.5, 1, 1), base), false);
});

test('cli divide e placar', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'placar '));
  const arq = (nome, obj) => { const f = path.join(dir, nome); writeFileSync(f, JSON.stringify(obj)); return f; };
  const d = spawnSync(process.execPath, [CLI, 'evolucao', 'divide', arq('casos.json', { casos: casos(7, 4) }), '--semente', '7'], { encoding: 'utf8' });
  assert.equal(d.status, 0, d.stderr);
  const div = JSON.parse(d.stdout);
  assert.equal(div.semente, 7);
  assert.equal(div.holdout.length, 3);
  const av = (candidato, conjunto, nota) => ({
    candidato, conjunto, tamanho: 10,
    resultados: [
      { caso: 'f0', tipo: 'plano-reprovado', nota, perguntou: false, tokens: 10 },
      { caso: 'c0', tipo: 'plano-aprovado-1a', nota: 1, perguntou: false, tokens: 10 },
    ],
  });
  const entrada = { baseline: [av('base', 'treino', 0.2), av('base', 'holdout', 0.2)], candidatos: [av('v1', 'treino', 0.8), av('v1', 'holdout', 0.6)] };
  const r = spawnSync(process.execPath, [CLI, 'evolucao', 'placar', arq('av.json', entrada)], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.vencedor.candidato, 'v1');
  assert.equal(out.aceito, true);
});
