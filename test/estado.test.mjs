import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEstado, serializeEstado, STATUS, TERMINAIS, NIVEIS } from '../scripts/lib/estado.mjs';

const modelo = readFileSync(new URL('../skills/loop-eng/modelos/estado.md', import.meta.url), 'utf8')
  .replaceAll('<slug>', 'exportar-csv')
  .replaceAll('<orcamento_tokens>', '2000000')
  .replaceAll('<orcamento_chamadas>', '200');

const SEPARADOR = '|----|--------|--------|-------|--------|--------------|-----------|--------------|--------|\n';

const preenchido = modelo
  .replace(
    SEPARADOR,
    SEPARADOR +
      '| T1 | Primeira | aceita | sonnet | 2 | aprovado | aprovado | — | abc1234 |\n' +
      '| T2 | Segunda | pendente | opus | 0 | — | — | — | — |\n',
  )
  .replace('## Log\n', '## Log\n- 2026-11-21 T1 aceita\n');

test('ida e volta do template preenchido com 2 tarefas', () => {
  const e = parseEstado(preenchido);
  assert.equal(e.tarefas.length, 2);
  assert.equal(serializeEstado(e), preenchido);
});

test('ida e volta do template vazio', () => {
  assert.equal(serializeEstado(parseEstado(modelo)), modelo);
});

test('parse lê cabeçalho, rodada numérica e log', () => {
  const e = parseEstado(preenchido);
  assert.equal(e.cab.slug, 'exportar-csv');
  assert.equal(e.cab.fase, 'planejamento');
  assert.equal(e.cab.estado_terminal, '');
  assert.equal(e.cab.orcamento_tokens, '2000000');
  assert.strictEqual(e.tarefas[0].rodada, 2);
  assert.equal(e.tarefas[0].commit, 'abc1234');
  assert.equal(e.log, '- 2026-11-21 T1 aceita\n');
});

test('enums exportados', () => {
  assert.equal(STATUS.length, 7);
  assert.deepEqual(TERMINAIS, ['sucesso', 'no-op', 'bloqueado', 'estagnado', 'esgotado']);
  assert.deepEqual(NIVEIS, ['haiku', 'sonnet', 'opus']);
});

// A linha da tarefa cai na linha 14 do texto.
const minimo = (linha) =>
  [
    '# Estado — x', '', '- fase: execucao', '- estado_terminal:', '- contrato: v1', '- quadro: off', '- project:', '- chamadas: 0',
    '', '## Quadro', '',
    '| id | titulo | status | nivel | rodada | conformidade | qualidade | especialista | commit |',
    '|----|--------|--------|-------|--------|--------------|-----------|--------------|--------|',
    linha, '', '## Log', '',
  ].join('\n');

test('texto mínimo válido faz parse', () => {
  assert.equal(parseEstado(minimo('| T1 | a | pendente | sonnet | 0 | — | — | — | — |')).tarefas.length, 1);
});

test('status fora do enum aponta a linha', () => {
  assert.throws(
    () => parseEstado(minimo('| T1 | a | feito | sonnet | 0 | — | — | — | — |')),
    (err) => /^Error: estado\.md:14:/.test(String(err)) && /status/.test(err.message),
  );
});

test('nivel e veredito fora do enum falham', () => {
  assert.throws(() => parseEstado(minimo('| T1 | a | pendente | gpt | 0 | — | — | — | — |')), /estado\.md:14:.*nivel/);
  assert.throws(() => parseEstado(minimo('| T1 | a | pendente | opus | 0 | ok | — | — | — |')), /estado\.md:14:.*conformidade/);
});

test('linha com 8 colunas falha com o número da linha', () => {
  assert.throws(() => parseEstado(minimo('| T1 | a | pendente | sonnet | 0 | — | — | — |')), /estado\.md:14:.*colunas/);
});

const crlf = (t) => t.replace(/\n/g, '\r\n');

test('CRLF: template convertido faz parse igual ao LF', () => {
  const e = parseEstado(crlf(preenchido));
  assert.deepEqual(e, parseEstado(preenchido));
  assert.equal(serializeEstado(e), preenchido);
});

test('CRLF: status inválido ainda aponta a linha 14', () => {
  assert.throws(
    () => parseEstado(crlf(minimo('| T1 | a | feito | sonnet | 0 | — | — | — | — |'))),
    /estado\.md:14:.*status/,
  );
});
