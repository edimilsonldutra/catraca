import type { SessionUser } from '../auth/session.js'

// Texto confiável (já escapado) para compor páginas sem escapar duas vezes.
export class Html {
  constructor(readonly value: string) {}
  toString() {
    return this.value
  }
}

export function escape(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Template HTML: tudo o que é interpolado é escapado, exceto Html e listas de Html.
export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
  let out = strings[0] ?? ''
  values.forEach((value, i) => {
    if (value instanceof Html) out += value.value
    else if (Array.isArray(value)) out += value.map((v) => (v instanceof Html ? v.value : escape(v))).join('')
    else if (value === null || value === undefined || value === false) out += ''
    else out += escape(value)
    out += strings[i + 1] ?? ''
  })
  return new Html(out)
}

export function page(title: string, user: SessionUser | null, body: Html): string {
  const nav = user
    ? html`<span class="who">${user.name}</span>
        ${user.role === 'participant' ? html`<a href="/me/tickets">Meus ingressos</a>` : ''}
        ${user.role === 'organizer' ? html`<a href="/organizer">Área do organizador</a>` : ''}
        <form method="post" action="/logout" class="inline"><button type="submit">Sair</button></form>`
    : html`<a href="/login">Entrar</a> <a href="/signup">Criar conta</a>`
  return html`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · Catraca</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 860px; margin: 0 auto; padding: 1rem; }
      header { display: flex; gap: 1rem; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: .5rem; }
      header .brand { font-weight: bold; margin-right: auto; }
      .inline { display: inline; }
      .msg { padding: .5rem .75rem; background: #eef; border-left: 4px solid #55c; }
      .erro { padding: .5rem .75rem; background: #fee; border-left: 4px solid #c55; }
      .card { border: 1px solid #ddd; padding: .75rem 1rem; margin: .75rem 0; border-radius: 6px; }
      table { border-collapse: collapse; } td, th { padding: .25rem .75rem; border-bottom: 1px solid #eee; text-align: left; }
      label { display: block; margin: .4rem 0; }
    </style>
  </head>
  <body>
    <header><a class="brand" href="/">Catraca</a> ${nav}</header>
    <main>${body}</main>
  </body>
</html>`.value
}
