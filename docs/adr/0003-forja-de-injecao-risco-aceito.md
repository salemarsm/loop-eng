# ADR-0003: forja de injeção pelo implementador é risco aceito

## Contexto

Após cada despacho do implementador, o orquestrador confere que `docs/loops` não mudou e que `HEAD` é o do último persist; senão restaura e reprova a rodada por gaming (SKILL.md, Fase 2). Há uma exceção necessária: commits `chore(loop): injeção` que só tocam `injecoes.md` são aceitos, porque são o `/loop-eng inject` legítimo do usuário chegando durante a rodada (de outra sessão ou do celular).

O implementador roda na mesma máquina, com as mesmas permissões, e pode produzir um commit idêntico (ou rodar o próprio CLI `inject`). Não existe canal fora de banda que distinga as duas origens: o Claude Code não oferece sandbox por subagente. Combinado ao ADR-0002 (`muda-contrato` vence sem aprovação), uma injeção forjada como "C3 não precisa" remove um critério sem humano ver.

Alternativa considerada: exigir confirmação de uma linha no chat da sessão do loop para injeção lida do arquivo que mude o contrato (o que o usuário digita no chat segue direto). Descartada pelo usuário em 2026-11-21: o uso principal é injetar de fora da sessão (outra sessão, Remote Control), e a confirmação reintroduz o portão humano que o loop quer evitar.

## Decisão

Manter a exceção como está e aceitar o risco. Nenhuma confirmação extra.

## Consequências

- Injeção de fora da sessão continua valendo sem atrito.
- Risco residual: um implementador confuso ou sob prompt injection (texto vindo do repositório) pode plantar uma injeção e mudar o contrato. Contrato, plano e estado editados direto continuam protegidos (restauro + reprovação).
- Detecção posterior: toda injeção aplicada fica em `injecoes.md` com hora e classe, e todo contrato anterior fica versionado; o usuário revisa isso no PR, onde merge e deploy continuam exigindo o ok dele.
- Revisitar se a plataforma passar a oferecer sandbox por subagente ou identidade de origem para commits.

## Status

Aceito.

## Data

2026-11-21
