import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'loop-eng', 'SKILL.md'),
  'utf8',
);

test('SKILL.md contém as cinco marcas fixas do Log', () => {
  for (const marca of ['[plano-reprovado]', '[plano-aprovado]', '[escalada <id>]', '[muda-contrato forçada]', '[muda-contrato espontânea]']) {
    assert.ok(skill.includes(marca), `falta a marca ${marca}`);
  }
});

test('SKILL.md grava a marca de muda-contrato fora do parêntese das pendentes', () => {
  const item = skill.split('\n').findIndex((l) => l.includes('**muda-contrato**'));
  const bloco = skill.split('\n').slice(item, item + 12).join('\n');
  const antes = bloco.split('**Pendentes**')[0];
  assert.ok(antes.includes('[muda-contrato forçada]') && antes.includes('[muda-contrato espontânea]'));
});

test('SKILL.md lê prompts pelo hash-prompts e registra despachos', () => {
  assert.ok(skill.includes('hash-prompts'));
  assert.ok(skill.includes('caminho que o `hash-prompts` imprime'));
  assert.ok(skill.includes('despachos/'));
});

test('SKILL.md roteia evoluir plugin|usuario para evoluir.md', () => {
  const linha = skill.split('\n').find((l) => l.replaceAll('\\|', '|').includes('evoluir plugin|usuario'));
  assert.ok(linha, 'falta a linha de rota');
  assert.ok(linha.includes('evoluir.md'));
});

const daSkill = (...partes) => path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'loop-eng', ...partes);

test('evoluir.md descreve o procedimento com os subcomandos e o portão único', () => {
  assert.ok(existsSync(daSkill('evoluir.md')), 'falta skills/loop-eng/evoluir.md');
  const evoluir = readFileSync(daSkill('evoluir.md'), 'utf8');
  for (const trecho of ['evolucao divide', 'evolucao placar', 'worktree add --detach', 'base.json', 'pede aprovação']) {
    assert.ok(evoluir.includes(trecho), `evoluir.md não contém ${trecho}`);
  }
});

test('juiz-evolucao.md devolve NOTA e PERGUNTOU', () => {
  const juiz = readFileSync(daSkill('prompts', 'juiz-evolucao.md'), 'utf8');
  assert.ok(juiz.includes('NOTA:'));
  assert.ok(juiz.includes('PERGUNTOU:'));
});

test('refletor-evolucao.md delimita o prompt novo', () => {
  const refletor = readFileSync(daSkill('prompts', 'refletor-evolucao.md'), 'utf8');
  assert.ok(refletor.includes('<<<PROMPT'));
  assert.ok(refletor.includes('PROMPT>>>'));
});

test('prompts da evolução põem cada campo dentro de tag com nonce', () => {
  for (const [arquivo, campos] of [['juiz-evolucao.md', ['defeitos', 'saida_planejador']], ['refletor-evolucao.md', ['prompt_atual', 'falhas']]]) {
    const texto = readFileSync(daSkill('prompts', arquivo), 'utf8').replace(/\r\n/g, '\n');
    for (const campo of campos) {
      assert.ok(texto.includes(`<${campo}-{{nonce}}>\n{{${campo}}}\n</${campo}-{{nonce}}>`), `${arquivo}: {{${campo}}} fora da tag com nonce`);
    }
  }
});
