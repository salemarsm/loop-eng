import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criaRepo, criaLoop, git, CLI } from './helpers.mjs';

const FAKE = fileURLToPath(new URL('./fixtures/fake-gh.mjs', import.meta.url));
const OPCOES = 'pendente,executando,verificando,revisando,aceita,bloqueada,estagnada';
const linha = (id, status) => `| T${id} | titulo ${id} | ${status} | sonnet | 1 | — | — | — | — |`;

function preparaLoop(quadro, tarefas) {
  const { repo, contrato } = criaRepo();
  const wt = criaLoop(repo, contrato, 'demo');
  const f = path.join(wt, 'docs', 'loops', 'demo', 'estado.md');
  let s = readFileSync(f, 'utf8').replace('- quadro: off', `- quadro: ${quadro}`);
  s = s.replace(/(\|----.*\|\n)/, `$1${tarefas.join('\n')}\n`);
  writeFileSync(f, s);
  const logGh = path.join(mkdtempSync(path.join(tmpdir(), 'fake gh ')), 'chamadas.log');
  return { repo, wt, estado: f, quadroJson: path.join(wt, 'docs', 'loops', 'demo', '.quadro.json'), logGh };
}

function sync(ctx, extraEnv = {}) {
  return spawnSync(process.execPath, [CLI, 'quadro-sync'], {
    cwd: ctx.repo,
    encoding: 'utf8',
    env: { ...process.env, LOOP_ENG_GH_FAKE: FAKE, FAKE_GH_LOG: ctx.logGh, ...extraEnv },
  });
}

const chamadas = (ctx) => (existsSync(ctx.logGh)
  ? readFileSync(ctx.logGh, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : []);
const comando = (a) => a.slice(0, 2).join(' ');
const valor = (a, flag) => a[a.indexOf(flag) + 1];
const quadroDe = (ctx) => /^- quadro: (.*)$/m.exec(readFileSync(ctx.estado, 'utf8'))[1];

test('primeiro sync cria Project, campo Etapa, itens e etapas', () => {
  const ctx = preparaLoop('github', [linha(1, 'pendente'), linha(2, 'executando')]);
  const r = sync(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /Etapa/); // aviso único: agrupar a visão por Etapa
  const cs = chamadas(ctx).filter((a) => comando(a) !== 'project item-list');
  assert.deepEqual(cs.map(comando), [
    'project create', 'project view', 'project field-list', 'project field-create', 'project field-list',
    'project item-create', 'project item-create', 'project item-edit', 'project item-edit',
  ]);
  assert.equal(valor(cs[0], '--title'), 'loop-eng: demo');
  assert.equal(valor(cs[0], '--owner'), '@me');
  assert.equal(valor(cs[3], '--name'), 'Etapa');
  assert.equal(valor(cs[3], '--data-type'), 'SINGLE_SELECT');
  assert.equal(valor(cs[3], '--single-select-options'), OPCOES);
  assert.equal(valor(cs[5], '--title'), 'T1 [sonnet] r1 — titulo 1');
  assert.equal(valor(cs[7], '--id'), 'PVTI_1');
  assert.equal(valor(cs[7], '--project-id'), 'PVT_proj7');
  assert.equal(valor(cs[7], '--field-id'), 'PVTSSF_etapa');
  assert.equal(valor(cs[7], '--single-select-option-id'), 'opt-pendente');
  assert.equal(valor(cs[8], '--single-select-option-id'), 'opt-executando');

  const q = JSON.parse(readFileSync(ctx.quadroJson, 'utf8'));
  assert.equal(q.number, 7);
  assert.equal(q.projectId, 'PVT_proj7');
  assert.equal(q.fieldId, 'PVTSSF_etapa');
  assert.equal(q.options.aceita, 'opt-aceita');
  assert.deepEqual(q.items, {
    T1: { itemId: 'PVTI_1', draftId: 'DI_1' },
    T2: { itemId: 'PVTI_2', draftId: 'DI_2' },
  });
  assert.equal(quadroDe(ctx), 'github');
  assert.match(readFileSync(ctx.estado, 'utf8'), /- project: https:\/\/github\.com\/users\/fulano\/projects\/7/);
  assert.equal(git(ctx.wt, 'log', '-1', '--format=%s'), 'chore(loop): quadro');
  assert.equal(git(ctx.wt, 'status', '--porcelain'), '');
});

test('segundo sync não cria nada e move T1 para aceita', () => {
  const ctx = preparaLoop('github', [linha(1, 'pendente'), linha(2, 'executando')]);
  assert.equal(sync(ctx).status, 0);
  const antes = chamadas(ctx).length;
  writeFileSync(ctx.estado, readFileSync(ctx.estado, 'utf8').replace(linha(1, 'pendente'), linha(1, 'aceita')));
  const r = sync(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /Etapa/);
  const novas = chamadas(ctx).slice(antes);
  assert.ok(novas.every((a) => !comando(a).endsWith('create')), 'nenhum create');
  const etapaT1 = novas.find((a) => comando(a) === 'project item-edit' && valor(a, '--id') === 'PVTI_1');
  assert.equal(valor(etapaT1, '--single-select-option-id'), 'opt-aceita');
  const rascunhoT1 = novas.find((a) => comando(a) === 'project item-edit' && valor(a, '--id') === 'DI_1');
  assert.equal(valor(rascunhoT1, '--title'), 'T1 [sonnet] r1 — titulo 1');
  assert.match(valor(rascunhoT1, '--body'), /conformidade/);
  assert.equal(quadroDe(ctx), 'github');
});

test('falha do gh: exit 0, dessincronizado; sync seguinte recupera', () => {
  const ctx = preparaLoop('github', [linha(1, 'pendente')]);
  const falha = sync(ctx, { FAKE_GH_FAIL: '1' });
  assert.equal(falha.status, 0, falha.stderr);
  assert.notEqual(falha.stderr.trim(), '');
  assert.equal(quadroDe(ctx), 'dessincronizado');
  const ok = sync(ctx);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(quadroDe(ctx), 'github');
});

test('quadro: off não chama o gh', () => {
  const ctx = preparaLoop('off', [linha(1, 'pendente')]);
  const r = sync(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(chamadas(ctx).length, 0);
  assert.equal(quadroDe(ctx), 'off');
});

const contaCreate = (ctx) => chamadas(ctx).filter((a) => comando(a) === 'project create').length;
const urlNoEstado = (ctx) => /^- project: (.*)$/m.exec(readFileSync(ctx.estado, 'utf8'))[1];

test('falha em field-create: retry não cria 2º Project e o project: fica preenchido', () => {
  const ctx = preparaLoop('github', [linha(1, 'pendente')]);
  const r1 = sync(ctx, { FAKE_GH_FAIL_ON: 'field-create' });
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(quadroDe(ctx), 'dessincronizado');
  assert.equal(urlNoEstado(ctx), 'https://github.com/users/fulano/projects/7');
  const r2 = sync(ctx);
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(quadroDe(ctx), 'github');
  assert.equal(contaCreate(ctx), 1);
  assert.equal(urlNoEstado(ctx), 'https://github.com/users/fulano/projects/7');
  assert.equal(JSON.parse(readFileSync(ctx.quadroJson, 'utf8')).options.aceita, 'opt-aceita');
});

test('field-create ok mas depois falha: retry usa field-list e não recria o campo', () => {
  const ctx = preparaLoop('github', [linha(1, 'pendente')]);
  sync(ctx, { FAKE_GH_FAIL_ON: 'item-create' });
  assert.equal(quadroDe(ctx), 'dessincronizado');
  assert.equal(sync(ctx).status, 0);
  assert.equal(quadroDe(ctx), 'github');
  assert.equal(contaCreate(ctx), 1);
  assert.equal(chamadas(ctx).filter((a) => comando(a) === 'project field-create').length, 1);
  assert.equal(chamadas(ctx).filter((a) => comando(a) === 'project item-create').length, 2); // 1 falha + 1 ok
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(ctx.quadroJson, 'utf8')).items), ['T1']);
});

test('começando de dessincronizado o sync roda', () => {
  const ctx = preparaLoop('dessincronizado', [linha(1, 'pendente')]);
  const r = sync(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(quadroDe(ctx), 'github');
});

test('item-list pede limite alto', () => {
  const ctx = preparaLoop('github', [linha(1, 'pendente')]);
  sync(ctx);
  const lista = chamadas(ctx).find((a) => comando(a) === 'project item-list');
  assert.ok(Number(valor(lista, '--limit')) >= 1000);
});

test('quadro com valor desconhecido: erro explícito e gh não é chamado', () => {
  const ctx = preparaLoop('on', [linha(1, 'pendente')]);
  const r = sync(ctx);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /quadro inválido/);
  assert.equal(chamadas(ctx).length, 0);
});

for (const [nome, env] of [['sucesso', {}], ['falha do gh', { FAKE_GH_FAIL: '1' }]]) {
  test(`quadro-sync (${nome}) commita só arquivos do loop; staged fora de docs/loops continua staged`, () => {
    const ctx = preparaLoop('github', [linha(1, 'pendente')]);
    writeFileSync(path.join(ctx.wt, 'fora.txt'), 'fora\n');
    git(ctx.wt, 'add', 'fora.txt');
    assert.equal(sync(ctx, env).status, 0);
    assert.equal(git(ctx.wt, 'log', '-1', '--format=%s'), 'chore(loop): quadro');
    const commitados = git(ctx.wt, 'show', '--name-only', '--format=', 'HEAD').split('\n');
    assert.ok(commitados.every((f) => f.startsWith('docs/loops/demo/')), commitados.join(','));
    assert.equal(git(ctx.wt, 'diff', '--cached', '--name-only'), 'fora.txt');
  });
}
