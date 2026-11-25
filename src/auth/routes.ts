import { Router } from 'express'
import { html, page, type Html } from '../shared/html.js'
import { checkPassword } from './password.js'
import { currentUser, endSession, startSession } from './session.js'
import { createUser, EmailTakenError, findUserByEmail } from './users.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function field(body: unknown, name: string) {
  const value = (body as Record<string, unknown> | undefined)?.[name]
  return typeof value === 'string' ? value : ''
}

// Só caminhos internos: evita redirecionar para outro site.
function safeNext(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null
}

function signupForm(error: string | null, values: { name: string; email: string }): Html {
  return html`<h1>Criar conta</h1>
    ${error ? html`<p class="erro">${error}</p>` : ''}
    <form method="post" action="/signup">
      <label>Nome <input name="name" value="${values.name}" required /></label>
      <label>E-mail <input name="email" type="email" value="${values.email}" required /></label>
      <label>Senha (mínimo 8 caracteres) <input name="password" type="password" minlength="8" required /></label>
      <button type="submit">Criar conta</button>
    </form>`
}

function loginForm(error: string | null, email: string, next: string | null): Html {
  return html`<h1>Entrar</h1>
    ${error ? html`<p class="erro">${error}</p>` : ''}
    <form method="post" action="/login">
      ${next ? html`<input type="hidden" name="next" value="${next}" />` : ''}
      <label>E-mail <input name="email" type="email" value="${email}" required /></label>
      <label>Senha <input name="password" type="password" required /></label>
      <button type="submit">Entrar</button>
    </form>
    <p>Ainda não tem conta? <a href="/signup">Criar conta</a></p>`
}

export const authRoutes = Router()

authRoutes.get('/signup', (_req, res) => {
  res.send(page('Criar conta', currentUser(res), signupForm(null, { name: '', email: '' })))
})

authRoutes.post('/signup', async (req, res) => {
  const name = field(req.body, 'name').trim()
  const email = field(req.body, 'email').trim()
  const password = field(req.body, 'password')
  let error: string | null = null
  if (!name) error = 'Informe o nome'
  else if (!EMAIL.test(email)) error = 'E-mail inválido'
  else if (password.length < 8) error = 'A senha precisa ter pelo menos 8 caracteres'
  if (!error) {
    try {
      const user = await createUser({ name, email, password, role: 'participant' })
      startSession(res, user.id)
      return res.redirect(303, '/')
    } catch (err) {
      if (!(err instanceof EmailTakenError)) throw err
      error = err.message
    }
  }
  res.status(422).send(page('Criar conta', currentUser(res), signupForm(error, { name, email })))
})

authRoutes.get('/login', (req, res) => {
  res.send(page('Entrar', currentUser(res), loginForm(null, '', safeNext(req.query.next))))
})

authRoutes.post('/login', async (req, res) => {
  const email = field(req.body, 'email').trim()
  const password = field(req.body, 'password')
  const next = safeNext(field(req.body, 'next'))
  const user = email ? await findUserByEmail(email) : null
  if (!user || !(await checkPassword(password, user.password_hash))) {
    return res.status(401).send(page('Entrar', null, loginForm('E-mail ou senha inválidos', email, next)))
  }
  startSession(res, user.id)
  res.redirect(303, next ?? (user.role === 'organizer' ? '/organizer' : '/'))
})

authRoutes.post('/logout', (_req, res) => {
  endSession(res)
  res.redirect(303, '/')
})
