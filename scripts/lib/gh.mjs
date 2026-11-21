import { execFileSync } from 'node:child_process';

// Executa `gh` (ou o gh falso dos testes, via LOOP_ENG_GH_FAKE) e devolve o stdout.
export function runGh(args) {
  const opcoes = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  const fake = process.env.LOOP_ENG_GH_FAKE;
  return fake
    ? execFileSync(process.execPath, [fake, ...args], opcoes)
    : execFileSync('gh', args, opcoes);
}
