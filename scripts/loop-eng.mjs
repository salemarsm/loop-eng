#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const TAMANHO_MAXIMO_SLUG = 40;

export function slugify(texto) {
  let slug = texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length > TAMANHO_MAXIMO_SLUG) {
    slug = slug.slice(0, TAMANHO_MAXIMO_SLUG);
    const corte = slug.lastIndexOf('-');
    if (corte > 0) slug = slug.slice(0, corte);
  }

  if (!slug) throw new Error('slug vazio: o texto não tem letras ou dígitos');
  return slug;
}

const COMANDOS = {
  slug: ([texto]) => {
    if (texto === undefined) throw new Error('uso: loop-eng slug "<texto>"');
    return slugify(texto);
  },
};

export function main(argv) {
  const [comando, ...resto] = argv;
  const handler = COMANDOS[comando];
  if (!handler) {
    throw new Error(`comando desconhecido: ${comando ?? '(nenhum)'}. Disponíveis: ${Object.keys(COMANDOS).join(', ')}`);
  }
  return handler(resto);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(main(process.argv.slice(2)));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
