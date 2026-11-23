import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function dadosHome() {
  return process.env.LOOP_ENG_HOME ?? path.join(os.homedir(), '.claude', 'loop-eng');
}

export function skillDir() {
  return fileURLToPath(new URL('../../skills/loop-eng', import.meta.url));
}

const normaliza = (caminho) => fs.readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');
const sha = (texto) => crypto.createHash('sha256').update(texto).digest('hex').slice(0, 12);

// refinamento.md + todos os prompts/*.md da skill; o override do usuário (<home>/prompts/<arquivo>.md)
// substitui só o arquivo que existe.
export function promptsEfetivos({ skill = skillDir(), home = dadosHome() } = {}) {
  const nomes = ['refinamento.md', ...fs.readdirSync(path.join(skill, 'prompts'))
    .filter((f) => f.endsWith('.md')).map((f) => `prompts/${f}`)];
  return nomes.sort().map((nome) => {
    const doOverride = path.join(home, 'prompts', path.basename(nome));
    const override = fs.existsSync(doOverride);
    const caminho = override ? doOverride : path.join(skill, nome);
    return { nome, caminho, origem: override ? 'override' : 'plugin', hash: sha(normaliza(caminho)) };
  });
}

export function hashConjunto(lista) {
  const ordenada = [...lista].sort((a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
  return sha(ordenada.map((p) => `${p.nome}\n${normaliza(p.caminho)}\n`).join(''));
}

export function overridesVelhos({ skill = skillDir(), home = dadosHome() } = {}) {
  let base = {};
  try {
    base = JSON.parse(fs.readFileSync(path.join(home, 'prompts', 'base.json'), 'utf8')) ?? {};
  } catch { /* base ausente ou ilegível: base desconhecida */ }
  const velhos = [];
  for (const p of promptsEfetivos({ skill, home })) {
    if (p.origem !== 'override') continue;
    const hashPlugin = sha(normaliza(path.join(skill, p.nome)));
    if (typeof base[p.nome] !== 'string') velhos.push({ nome: p.nome, motivo: 'base-desconhecida' });
    else if (base[p.nome] !== hashPlugin) velhos.push({ nome: p.nome, motivo: 'base-antiga' });
  }
  return velhos;
}
