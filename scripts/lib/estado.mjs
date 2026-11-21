export const STATUS = ['pendente', 'executando', 'verificando', 'revisando', 'aceita', 'bloqueada', 'estagnada'];
export const TERMINAIS = ['sucesso', 'no-op', 'bloqueado', 'estagnado', 'esgotado'];
export const NIVEIS = ['haiku', 'sonnet', 'opus'];
const VEREDITOS = ['—', 'aprovado', 'reprovado'];

const COLUNAS = ['id', 'titulo', 'status', 'nivel', 'rodada', 'conformidade', 'qualidade', 'especialista', 'commit'];
const MARCA_LOG = '## Log\n';

function erro(linha, msg) {
  return new Error(`estado.md:${linha}: ${msg}`);
}

function celulas(linha) {
  return linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function validaEnum(valor, permitidos, campo, linha) {
  if (!permitidos.includes(valor)) {
    throw erro(linha, `${campo} inválido: "${valor}" (permitidos: ${permitidos.join(', ')})`);
  }
}

// `cab.slug` vem do título "# Estado — <slug>"; os demais campos, das linhas "- chave: valor".
export function parseEstado(textoBruto) {
  const texto = textoBruto.replace(/\r\n/g, '\n');
  const linhas = texto.split('\n');
  const cab = {};
  const tarefas = [];
  let i = 0;

  const titulo = /^# Estado — (.+)$/.exec(linhas[0] ?? '');
  if (!titulo) throw erro(1, 'título "# Estado — <slug>" ausente');
  cab.slug = titulo[1];

  for (i = 1; i < linhas.length && linhas[i] !== '## Quadro'; i++) {
    const m = /^- ([a-z_]+):\s*(.*)$/.exec(linhas[i]);
    if (m) cab[m[1]] = m[2].trim();
  }
  if (i >= linhas.length) throw erro(linhas.length, 'seção "## Quadro" ausente');
  if (cab.estado_terminal) validaEnum(cab.estado_terminal, TERMINAIS, 'estado_terminal', 1);

  // pula até a linha de separador da tabela (a 2ª linha que começa com '|')
  i++;
  while (i < linhas.length && !linhas[i].trim().startsWith('|')) i++;
  i += 2; // cabeçalho + separador

  for (; i < linhas.length && linhas[i].trim().startsWith('|'); i++) {
    const n = i + 1;
    const c = celulas(linhas[i]);
    if (c.length !== COLUNAS.length) {
      throw erro(n, `esperadas ${COLUNAS.length} colunas, encontradas ${c.length}`);
    }
    const [id, titulo, status, nivel, rodada, conformidade, qualidade, especialista, commit] = c;
    validaEnum(status, STATUS, 'status', n);
    validaEnum(nivel, NIVEIS, 'nivel', n);
    validaEnum(conformidade, VEREDITOS, 'conformidade', n);
    validaEnum(qualidade, VEREDITOS, 'qualidade', n);
    if (!/^\d+$/.test(rodada)) throw erro(n, `rodada inválida: "${rodada}"`);
    tarefas.push({ id, titulo, status, nivel, rodada: Number(rodada), conformidade, qualidade, especialista, commit });
  }

  const fim = texto.indexOf(MARCA_LOG);
  const log = fim === -1 ? '' : texto.slice(fim + MARCA_LOG.length);
  return { cab, tarefas, log };
}

export function serializeEstado({ cab, tarefas, log }) {
  const { slug, ...campos } = cab;
  const linhas = [`# Estado — ${slug}`, ''];
  for (const [k, v] of Object.entries(campos)) linhas.push(v === '' ? `- ${k}:` : `- ${k}: ${v}`);
  linhas.push('', '## Quadro', '');
  linhas.push(`| ${COLUNAS.join(' | ')} |`);
  linhas.push(`|${COLUNAS.map((c) => '-'.repeat(c.length + 2)).join('|')}|`);
  for (const t of tarefas) linhas.push(`| ${COLUNAS.map((c) => String(t[c])).join(' | ')} |`);
  linhas.push('', MARCA_LOG + log);
  return linhas.join('\n');
}
