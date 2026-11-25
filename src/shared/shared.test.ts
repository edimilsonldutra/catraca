import { describe, expect, it } from 'vitest'
import { formatDateTime, parseLocalDateTime, toInputValue, toIsoBrt } from './dates.js'
import { escape, html } from './html.js'
import { centsToInput, formatCents, parseReais } from './money.js'

describe('dinheiro', () => {
  it('lê reais em vários formatos', () => {
    expect(parseReais('100')).toBe(10000)
    expect(parseReais('100,00')).toBe(10000)
    expect(parseReais('100.00')).toBe(10000)
    expect(parseReais('1.234,50')).toBe(123450)
    expect(parseReais('1.234')).toBe(123400)
    expect(parseReais('R$ 20,5')).toBe(2050)
    expect(parseReais('abc')).toBeNull()
    expect(parseReais('-5')).toBeNull()
  })

  it('formata centavos', () => {
    expect(formatCents(35000)).toBe('R$ 350,00')
    expect(formatCents(123450)).toBe('R$ 1.234,50')
    expect(formatCents(0)).toBe('R$ 0,00')
    expect(centsToInput(123450)).toBe('1234,50')
  })
})

describe('datas no horário de Brasília', () => {
  it('ida e volta do campo datetime-local', () => {
    const date = parseLocalDateTime('2026-12-05T21:00') as Date
    expect(date.toISOString()).toBe('2026-12-06T00:00:00.000Z')
    expect(toInputValue(date)).toBe('2026-12-05T21:00')
    expect(toIsoBrt(date)).toBe('2026-12-05T21:00:00-03:00')
    expect(formatDateTime(date)).toBe('05/12/2026 21:00')
  })

  it('recusa formato inválido', () => {
    expect(parseLocalDateTime('05/12/2026')).toBeNull()
    expect(parseLocalDateTime('')).toBeNull()
  })
})

describe('html', () => {
  it('escapa o que é interpolado', () => {
    expect(escape('<script>"x"&\'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;')
    expect(html`<p>${'<b>'}</p>${html`<i>ok</i>`}`.value).toBe('<p>&lt;b&gt;</p><i>ok</i>')
  })
})
