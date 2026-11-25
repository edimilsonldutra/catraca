import crypto from 'node:crypto'

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
// Sem 0/O, 1/I/L: o código é lido em voz alta e digitado na portaria.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function random(alphabet: string, length: number) {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[(bytes[i] ?? 0) % alphabet.length]
  return out
}

export function newId(prefix: string) {
  return `${prefix}_${random(ID_ALPHABET, 10)}`
}

export function newTicketCode() {
  return random(CODE_ALPHABET, 8)
}
