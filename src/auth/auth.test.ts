import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { accounts, app, loginAs, resetDatabase } from '../test/helpers.js'

beforeAll(resetDatabase)

describe('contas (F1)', () => {
  it('cadastra participante, entra na sessão e sai', async () => {
    const agent = request.agent(app)
    const signup = await agent.post('/signup').type('form').send({ name: 'Ana Souza', email: 'ana@ex.com', password: 'senha-forte' })
    expect(signup.status).toBe(303)
    expect((await agent.get('/')).text).toContain('Ana Souza')

    const logout = await agent.post('/logout')
    expect(logout.status).toBe(303)
    const after = await agent.get('/')
    expect(after.text).not.toContain('Ana Souza')
    expect(after.text).toContain('Entrar')
  })

  it('recusa e-mail repetido', async () => {
    const res = await request(app).post('/signup').type('form').send({ name: 'Outra', email: 'ANA@ex.com', password: 'senha-forte' })
    expect(res.status).toBe(422)
    expect(res.text).toContain('E-mail já cadastrado')
  })

  it('recusa senha curta e e-mail inválido', async () => {
    expect((await request(app).post('/signup').type('form').send({ name: 'X', email: 'x@ex.com', password: '123' })).status).toBe(422)
    expect((await request(app).post('/signup').type('form').send({ name: 'X', email: 'nao-e-email', password: 'senha-forte' })).status).toBe(
      422,
    )
  })

  it('as três contas da seed entram', async () => {
    for (const account of Object.values(accounts)) {
      await expect(loginAs(account)).resolves.toBeDefined()
    }
  })

  it('recusa senha errada', async () => {
    const res = await request(app).post('/login').type('form').send({ email: accounts.orgA.email, password: 'errada' })
    expect(res.status).toBe(401)
    expect(res.text).toContain('E-mail ou senha inválidos')
  })

  it('cookie adulterado não abre sessão', async () => {
    const res = await request(app).get('/').set('Cookie', 'catraca_session=usr_qualquer.assinatura-falsa')
    expect(res.text).toContain('Entrar')
  })
})

describe('área de organizador (F1.P2, R13)', () => {
  it('visitante vai para o login', async () => {
    const res = await request(app).get('/organizer')
    expect(res.status).toBe(303)
    expect(res.headers.location).toMatch(/^\/login/)
  })

  it('participante recebe 403 sem dados', async () => {
    const agent = await loginAs(accounts.participant)
    const res = await agent.get('/organizer')
    expect(res.status).toBe(403)
    expect(res.text).toContain('Acesso negado')
  })
})
