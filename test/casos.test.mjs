import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { criaRepo, git, cliEnv } from './helpers.mjs';
import { lerTranscricao, extraiCasos, contratoLacunas } from '../scripts/lib/casos.mjs';

// Transcrições sintéticas no formato do Claude Code (uma linha JSON por evento).
const user = (timestamp, content) => ({ type: 'user', timestamp, message: { role: 'user', content } });
const usa = (timestamp, id, name, input) => ({ type: 'assistant', timestamp, message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
const resultado = (timestamp, id, content) => user(timestamp, [{ type: 'tool_result', tool_use_id: id, content }]);
const jsonl = (linhas) => linhas.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n');
const numera = (texto) => texto.split('\n').map((l, i) => `${String(i + 1).padStart(6)}\t${l}`).join('\n');

const WT = 'C:\\Users\\x\\loop eng\\.claude\\worktrees\\loop-';

function transcricao({ inicio, papel, slug, saida, inline = false, corpo = '' }) {
  const prompt = `# Papel: ${papel}\n\nEntradas.\n${slug ? `Worktree: ${WT}${slug}\n` : ''}${corpo}`;
  const t = (s) => new Date(Date.parse(inicio) + s * 1000).toISOString();
  const abertura = inline
    ? [user(inicio, prompt)]
    : [user(inicio, 'Leia o arquivo C:/tmp/prompt.md e siga-o.'), usa(t(1), 'r1', 'Read', { file_path: 'C:/tmp/prompt.md' }), resultado(t(2), 'r1', numera(prompt))];
  return jsonl([...abertura, usa(t(3), 'h1', 'SubagentHandback', { message: saida })]);
}

function projeto(arquivos) {
  const dir = mkdtempSync(path.join(tmpdir(), 'loop eng projeto '));
  for (const [rel, texto] of Object.entries(arquivos)) {
    const caminho = path.join(dir, rel);
    mkdirSync(path.dirname(caminho), { recursive: true });
    writeFileSync(caminho, texto);
  }
  return dir;
}

const PLANO = '| id | titulo | nivel |\n| T1 | Faz a coisa | sonnet |\n| T2 | Testa a coisa | haiku |';
const REPROVADO = 'VEREDITO: reprovado\n- arquivo X fora das fronteiras\n- cadência indefinida';

test('entrada via Read', () => {
  const contrato = 'C:\\tmp\\contrato demo.md';
  const prompt = `# Papel: Planejador\nContrato em ${contrato}\nWorktree: C:/Users/x/loop eng/.claude/worktrees/loop-demo\n`;
  const t = lerTranscricao(jsonl([
    user('2026-11-01T10:00:00.000Z', 'Leia C:/tmp/p.md e siga-o.'),
    usa('2026-11-01T10:00:01.000Z', 'a', 'Read', { file_path: 'C:/tmp/p.md' }),
    resultado('2026-11-01T10:00:02.000Z', 'a', numera(prompt)),
    usa('2026-11-01T10:00:03.000Z', 'b', 'Read', { file_path: 'C:/tmp/contrato demo.md' }),
    resultado('2026-11-01T10:00:04.000Z', 'b', numera('# Contrato — demo')),
    usa('2026-11-01T10:00:05.000Z', 'c', 'Read', { file_path: 'C:/outro.md' }),
    resultado('2026-11-01T10:00:06.000Z', 'c', numera('não citado')),
  ]));
  assert.equal(t.papel, 'Planejador');
  assert.ok(t.entrada.startsWith('# Papel: Planejador\nContrato em'));
  assert.doesNotMatch(t.entrada, /^\s*\d+\t/m);
  assert.equal(t.worktree, 'demo');
  assert.match(t.entrada, /\n\n<!-- arquivo: contrato demo\.md -->\n# Contrato — demo/);
  assert.doesNotMatch(t.entrada, /não citado/);
  assert.equal(t.inicio, '2026-11-01T10:00:00.000Z');
});

test('entrada inline', () => {
  const t = lerTranscricao(transcricao({ inicio: '2026-11-01T10:00:00.000Z', papel: 'Revisor de plano', slug: 'demo', saida: 'VEREDITO: aprovado', inline: true }));
  assert.equal(t.papel, 'Revisor de plano');
  assert.ok(t.entrada.startsWith('# Papel: Revisor de plano'));
  assert.equal(t.veredito, 'aprovado');
});

test('saída via SubagentHandback', () => {
  const t = lerTranscricao(transcricao({ inicio: '2026-11-01T10:05:00.000Z', papel: 'Revisor de plano', slug: 'demo', saida: REPROVADO }));
  assert.equal(t.saida, REPROVADO);
  assert.equal(t.veredito, 'reprovado');
  const { repo } = criaRepo();
  const dir = projeto({
    's1/subagents/agent-1.jsonl': transcricao({ inicio: '2026-11-01T10:00:00.000Z', papel: 'Planejador', slug: 'demo', saida: PLANO }),
    's1/subagents/agent-2.jsonl': transcricao({ inicio: '2026-11-01T10:05:00.000Z', papel: 'Revisor de plano', slug: 'demo', saida: REPROVADO }),
  });
  const { casos } = extraiCasos({ repo, projeto: dir });
  assert.equal(casos.length, 1);
  assert.equal(casos[0].tipo, 'plano-reprovado');
  assert.equal(casos[0].id, 'demo-001');
  assert.equal(casos[0].defeitos.length, 2);
  assert.match(casos[0].entrada, /^# Papel: Planejador/);
});

test('tool_result em array', () => {
  const t = lerTranscricao(jsonl([
    user('2026-11-01T10:00:00.000Z', 'Leia C:/tmp/p.md'),
    usa('2026-11-01T10:00:01.000Z', 'a', 'Read', { file_path: 'C:/tmp/p.md' }),
    resultado('2026-11-01T10:00:02.000Z', 'a', [{ type: 'text', text: '1\t# Papel: Planejador\n2\tC:/x/.claude/worktrees/loop-demo\n' }]),
  ]));
  assert.equal(t.papel, 'Planejador');
  assert.equal(t.worktree, 'demo');
});

test('linha corrompida pulada', () => {
  const linhas = transcricao({ inicio: '2026-11-01T10:00:00.000Z', papel: 'Planejador', slug: 'demo', saida: PLANO }).split('\n');
  linhas.splice(2, 0, '{nao json');
  const t = lerTranscricao(linhas.join('\n'));
  assert.equal(t.papel, 'Planejador');
  assert.equal(t.saida, PLANO);
});

test('pareamento por slug e ordem', () => {
  const { repo } = criaRepo();
  const dir = projeto({
    's1/subagents/agent-1.jsonl': transcricao({ inicio: '2026-11-01T10:00:00.000Z', papel: 'Planejador', slug: 'aa', saida: PLANO, corpo: 'plano de aa' }),
    's1/subagents/agent-2.jsonl': transcricao({ inicio: '2026-11-01T10:01:00.000Z', papel: 'Planejador', slug: 'bb', saida: PLANO, corpo: 'plano de bb' }),
    's1/subagents/agent-3.jsonl': transcricao({ inicio: '2026-11-01T10:02:00.000Z', papel: 'Revisor de plano', slug: 'aa', saida: REPROVADO }),
    's1/subagents/agent-4.jsonl': transcricao({ inicio: '2026-11-01T10:03:00.000Z', papel: 'Revisor de plano', slug: 'bb', saida: 'VEREDITO: aprovado' }),
    's1/subagents/agent-5.jsonl': transcricao({ inicio: '2026-11-01T10:04:00.000Z', papel: 'Planejador', slug: 'aa', saida: PLANO, corpo: 'plano 2 de aa' }),
    's1/subagents/agent-6.jsonl': transcricao({ inicio: '2026-11-01T10:05:00.000Z', papel: 'Revisor de plano', slug: 'aa', saida: 'VEREDITO: aprovado' }),
  });
  const { casos, descartados } = extraiCasos({ repo, projeto: dir });
  assert.deepEqual(descartados, []);
  const aa = casos.filter((c) => c.slug === 'aa');
  const bb = casos.filter((c) => c.slug === 'bb');
  assert.deepEqual(aa.map((c) => c.tipo), ['plano-reprovado']);
  assert.match(aa[0].entrada, /plano de aa/);
  assert.deepEqual(bb.map((c) => [c.tipo, c.id]), [['plano-aprovado-1a', 'bb-001']]);
  assert.match(bb[0].entrada, /plano de bb/);
});

test('sem worktree → descartado', () => {
  const { repo } = criaRepo();
  const dir = projeto({
    's1/subagents/agent-1.jsonl': transcricao({ inicio: '2026-11-01T10:00:00.000Z', papel: 'Planejador', slug: null, saida: PLANO }),
    's1/subagents/agent-2.jsonl': transcricao({ inicio: '2026-11-01T10:01:00.000Z', papel: 'Revisor de plano', slug: null, saida: REPROVADO, corpo: '| T9 | Outra coisa |' }),
  });
  const { casos, descartados } = extraiCasos({ repo, projeto: dir });
  assert.equal(casos.length, 0);
  assert.deepEqual(descartados.map((d) => d.motivo), ['sem worktree', 'sem worktree']);
  assert.ok(descartados.every((d) => d.arquivo.endsWith('.jsonl')));
});

test('papel alheio ignorado', () => {
  const { repo } = criaRepo();
  const dir = projeto({
    's1/subagents/agent-1.jsonl': transcricao({ inicio: '2026-11-01T10:00:00.000Z', papel: 'Revisor de qualidade', slug: 'demo', saida: REPROVADO }),
    's1/subagents/agent-2.jsonl': transcricao({ inicio: '2026-11-01T10:01:00.000Z', papel: 'Revisor de qualidade', slug: null, saida: REPROVADO }),
    's1/subagents/agent-3.jsonl': jsonl([user('2026-11-01T10:02:00.000Z', 'pesquise algo')]),
  });
  assert.deepEqual(extraiCasos({ repo, projeto: dir }), { casos: [], descartados: [] });
});

test('revisor sem worktree herda o slug do plano embutido', () => {
  const { repo } = criaRepo();
  const plano = PLANO.replace('| sonnet |', '| opus |');
  const dir = projeto({
    's1/subagents/agent-1.jsonl': transcricao({ inicio: '2026-11-01T10:00:00.000Z', papel: 'Planejador', slug: 'demo', saida: PLANO }),
    's1/subagents/agent-2.jsonl': transcricao({ inicio: '2026-11-01T10:01:00.000Z', papel: 'Planejador', slug: 'outro', saida: '| T1 | Coisa alheia | haiku |' }),
    's1/subagents/agent-3.jsonl': transcricao({ inicio: '2026-11-01T10:02:00.000Z', papel: 'Revisor de plano', slug: null, saida: REPROVADO, corpo: `<plano>\n${plano}\n</plano>` }),
  });
  const { casos, descartados } = extraiCasos({ repo, projeto: dir });
  assert.deepEqual(descartados, []);
  assert.deepEqual(casos.map((c) => [c.slug, c.tipo]), [['demo', 'plano-reprovado']]);
});

test('P resolvido', () => {
  const { repo } = criaRepo();
  mkdirSync(path.join(repo, 'docs', 'loops', 'demo'), { recursive: true });
  writeFileSync(path.join(repo, 'docs', 'loops', 'demo', 'contrato.md'), '# Contrato — demo\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'contrato demo');
  const commit = git(repo, 'rev-parse', 'HEAD');
  const inicio = new Date(Date.now() + 3600 * 1000).toISOString();
  const depois = new Date(Date.now() + 3660 * 1000).toISOString();
  const dir = projeto({
    's1/subagents/agent-1.jsonl': transcricao({ inicio, papel: 'Planejador', slug: 'demo', saida: PLANO }),
    's1/subagents/agent-2.jsonl': transcricao({ inicio: depois, papel: 'Revisor de plano', slug: 'demo', saida: 'VEREDITO: aprovado' }),
    's1/subagents/agent-3.jsonl': transcricao({ inicio: '2020-01-01T00:00:00.000Z', papel: 'Planejador', slug: 'velho', saida: PLANO }),
    's1/subagents/agent-4.jsonl': transcricao({ inicio: '2020-01-01T00:01:00.000Z', papel: 'Revisor de plano', slug: 'velho', saida: 'VEREDITO: aprovado' }),
  });
  const { casos } = extraiCasos({ repo, projeto: dir });
  assert.equal(casos.find((c) => c.slug === 'demo').P, commit);
  assert.equal(casos.find((c) => c.slug === 'velho').P, null);
});

test('contratoLacunas pega v1 e versão final', () => {
  const { repo } = criaRepo();
  const dir = path.join(repo, 'docs', 'loops', 'demo');
  mkdirSync(dir, { recursive: true });
  const estado = (v) => `# Estado — demo\n\n- fase: execucao\n- estado_terminal: sucesso\n- contrato: ${v}\n- base: main\n- quadro: off\n- project:\n- tokens_subagentes: 0\n- chamadas: 0\n- orcamento_tokens: 1\n- orcamento_chamadas: 1\n\n## Quadro\n\n| id | titulo | status | nivel | rodada | conformidade | qualidade | especialista | commit |\n|----|--------|--------|-------|--------|--------------|-----------|--------------|--------|\n\n## Log\n`;
  writeFileSync(path.join(dir, 'contrato.md'), 'contrato v1\n');
  writeFileSync(path.join(dir, 'estado.md'), estado('v1'));
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'v1');
  writeFileSync(path.join(dir, 'contrato.md'), 'contrato v2\n');
  writeFileSync(path.join(dir, 'estado.md'), estado('v2'));
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'v2');
  git(repo, 'rm', '-r', '-q', 'docs/loops/demo');
  git(repo, 'commit', '-m', 'arquiva');
  const lacunas = contratoLacunas({ repo });
  assert.equal(lacunas.length, 1);
  assert.equal(lacunas[0].tipo, 'contrato-lacuna');
  assert.equal(lacunas[0].slug, 'demo');
  assert.equal(lacunas[0].v1, 'contrato v1');
  assert.equal(lacunas[0].final, 'contrato v2');
  assert.equal(lacunas[0].versoes, 2);
});

test('cli grava em LOOP_ENG_HOME', () => {
  const { repo } = criaRepo();
  const home = mkdtempSync(path.join(tmpdir(), 'loop eng home '));
  const dir = projeto({
    's1/subagents/agent-1.jsonl': transcricao({ inicio: '2026-11-01T10:00:00.000Z', papel: 'Planejador', slug: 'demo', saida: PLANO }),
    's1/subagents/agent-2.jsonl': transcricao({ inicio: '2026-11-01T10:01:00.000Z', papel: 'Revisor de plano', slug: 'demo', saida: REPROVADO }),
  });
  const r = cliEnv(repo, { LOOP_ENG_HOME: home }, 'casos', '--repo', repo, '--projeto', dir);
  assert.equal(r.status, 0, r.stderr);
  const arquivo = path.join(home, 'evolucao', path.basename(repo), 'casos.json');
  assert.ok(existsSync(arquivo));
  const j = JSON.parse(readFileSync(arquivo, 'utf8'));
  assert.equal(j.casos.length, 1);
  assert.deepEqual(j.lacunas, []);
  assert.deepEqual(j.descartados, []);
  assert.match(r.stdout, /plano-reprovado: 1/);
  assert.ok(r.stdout.includes(arquivo));
});
