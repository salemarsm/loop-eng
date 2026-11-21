// gh falso: registra os args (uma linha JSON por chamada) em FAKE_GH_LOG e responde JSON fixo.
import fs from 'node:fs';

const args = process.argv.slice(2);
// o runner de testes (node --test) também executa este arquivo, sem args: nada a fazer
if (args.length === 0) process.exit(0);
const log = process.env.FAKE_GH_LOG;
if (log) fs.appendFileSync(log, `${JSON.stringify(args)}\n`);
const falhaEm = process.env.FAKE_GH_FAIL_ON;
if (process.env.FAKE_GH_FAIL || (falhaEm && args[1] === falhaEm)) {
  console.error('fake gh: falha forçada');
  process.exit(1);
}

// estado do fake = chamadas que deram certo (a falha forçada sai antes de gravar aqui)
const ok = log ? `${log}.ok` : null;
if (ok) fs.appendFileSync(ok, `${JSON.stringify(args)}\n`);
const chamadas = ok ? fs.readFileSync(ok, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const etapaCriada = chamadas.some((a) => a[0] === 'project' && a[1] === 'field-create');
const criados = chamadas.filter((a) => a[0] === 'project' && a[1] === 'item-create').length;
const OPCOES = ['pendente', 'executando', 'verificando', 'revisando', 'aceita', 'bloqueada', 'estagnada'];
const sub = `${args[0]} ${args[1]}`;
let resposta;
if (sub === 'project create') {
  resposta = { number: 7, url: 'https://github.com/users/fulano/projects/7', title: 'x' };
} else if (sub === 'project view') {
  resposta = { number: 7, id: 'PVT_proj7', url: 'https://github.com/users/fulano/projects/7' };
} else if (sub === 'project field-create') {
  resposta = { id: 'PVTSSF_etapa', name: 'Etapa', type: 'ProjectV2SingleSelectField' };
} else if (sub === 'project field-list') {
  resposta = {
    fields: [
      { id: 'PVTF_titulo', name: 'Title', type: 'ProjectV2Field' },
      ...(etapaCriada ? [{ id: 'PVTSSF_etapa', name: 'Etapa', type: 'ProjectV2SingleSelectField', options: OPCOES.map((n) => ({ id: `opt-${n}`, name: n })) }] : []),
    ],
    totalCount: 2,
  };
} else if (sub === 'project item-create') {
  resposta = { id: `PVTI_${criados}`, title: 'x', body: 'x', type: 'DraftIssue' };
} else if (sub === 'project item-list') {
  resposta = {
    items: Array.from({ length: criados }, (_, i) => ({ id: `PVTI_${i + 1}`, content: { id: `DI_${i + 1}`, type: 'DraftIssue' } })),
    totalCount: criados,
  };
} else if (sub === 'project item-edit') {
  resposta = { id: args[args.indexOf('--id') + 1] };
} else {
  console.error(`fake gh: comando inesperado: ${args.join(' ')}`);
  process.exit(2);
}
console.log(JSON.stringify(resposta));
