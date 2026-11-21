import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../scripts/loop-eng.mjs';

test('slugify converte frase simples em kebab-case', () => {
  assert.equal(slugify('Exportar findings em CSV no console'), 'exportar-findings-em-csv-no-console');
});

test('slugify remove acentos e pontuação', () => {
  assert.equal(slugify('Ação  rápida: índice/ÇÃO!'), 'acao-rapida-indice-cao');
});

test('slugify tira hífens nas pontas', () => {
  assert.equal(slugify('---a---'), 'a');
});

test('slugify limita a 40 caracteres cortando em fronteira de hífen', () => {
  const texto = 'palavra '.repeat(10).trim(); // 80 chars
  const slug = slugify(texto);
  assert.ok(slug.length <= 40, `tamanho ${slug.length}`);
  assert.ok(!slug.endsWith('-'));
  assert.equal(slug, 'palavra-palavra-palavra-palavra-palavra');
});

test('slugify lança erro quando não sobra nada', () => {
  assert.throws(() => slugify('!!!'), (err) => err instanceof Error && /slug vazio/.test(err.message));
});
