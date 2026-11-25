import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'
import { findUserById, type Role } from './users.js'

export type SessionUser = { id: string; name: string; role: Role }

const COOKIE = 'catraca_session'

function sign(value: string) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url')
}

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function startSession(res: Response, userId: string) {
  const value = `${userId}.${sign(userId)}`
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`)
}

export function endSession(res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

function userIdFromCookie(req: Request) {
  const raw = readCookie(req, COOKIE)
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const id = raw.slice(0, dot)
  const signature = Buffer.from(raw.slice(dot + 1))
  const expected = Buffer.from(sign(id))
  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) return null
  return id
}

// Carrega o usuário da sessão em res.locals.user (F1.P1).
export async function loadSession(req: Request, res: Response, next: NextFunction) {
  const id = userIdFromCookie(req)
  const user = id ? await findUserById(id) : null
  res.locals.user = user ? ({ id: user.id, name: user.name, role: user.role } satisfies SessionUser) : null
  next()
}

export function currentUser(res: Response): SessionUser | null {
  return (res.locals.user as SessionUser | null) ?? null
}
