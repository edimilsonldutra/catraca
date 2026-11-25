// Reais digitados ("100", "100,00", "100.00", "1.234,50") → centavos; null se inválido.
export function parseReais(input: string): number | null {
  const text = input.trim().replace(/^R\$\s*/i, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(text)) return null
  let normalized = text
  if (text.includes(',')) normalized = text.replaceAll('.', '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) normalized = text.replaceAll('.', '')
  const value = Math.round(Number(normalized) * 100)
  return Number.isFinite(value) ? value : null
}

export function formatCents(cents: number) {
  const reais = Math.trunc(Math.abs(cents) / 100)
  const rest = String(Math.abs(cents) % 100).padStart(2, '0')
  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cents < 0 ? '-' : ''}R$ ${grouped},${rest}`
}

// Centavos → valor do campo de formulário ("150,00").
export function centsToInput(cents: number) {
  return formatCents(cents).replace(/^R\$ /, '').replaceAll('.', '')
}
