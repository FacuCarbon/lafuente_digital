// Importes en centavos enteros. Esta planificación nunca registra un pago.
export interface Rate { month: number; amountCents: number }
export interface FeePlan {
  year: number; billableMonths: number[]; decemberSplit: [number, number]
  rates: Rate[]; joinedMonth: number; leftMonth?: number
  siblingDiscountPercent: number; scholarshipPercent: number
  firstMonthOverrideCents?: number; firstMonthReason?: string
}
export interface PlannedCharge {
  month: number; originMonth: number; kind: 'mensualidad' | 'diciembre'
  baseCents: number; amountCents: number; discountPercent: number
}
function validPercent(value: number) { return Number.isFinite(value) && value >= 0 && value <= 100 }
export function planFees(plan: FeePlan): PlannedCharge[] {
  const { billableMonths, decemberSplit: [first, second], rates, joinedMonth, leftMonth = 12 } = plan
  if (!Number.isInteger(plan.year) || plan.year < 2000 || plan.year > 2200) throw new Error('Año inválido.')
  const monthValid = (value: number) => Number.isInteger(value) && value >= 1 && value <= 12
  if (!monthValid(joinedMonth) || !monthValid(leftMonth) || leftMonth < joinedMonth) throw new Error('Período de inscripción inválido.')
  if (!monthValid(first) || !monthValid(second) || first >= second || second >= 12) throw new Error('Elegí dos meses distintos y ordenados, anteriores a diciembre.')
  if (new Set(billableMonths).size !== billableMonths.length || billableMonths.some(m => !monthValid(m))) throw new Error('Calendario inválido.')
  if (!billableMonths.includes(first) || !billableMonths.includes(second) || !billableMonths.includes(12)) throw new Error('Los meses de reparto y diciembre deben estar incluidos en el calendario.')
  if (!validPercent(plan.siblingDiscountPercent) || !validPercent(plan.scholarshipPercent)) throw new Error('Beneficio inválido.')
  if (!rates.length || rates.some(r => !monthValid(r.month) || !Number.isSafeInteger(r.amountCents) || r.amountCents < 0) || new Set(rates.map(r => r.month)).size !== rates.length) throw new Error('Tarifas inválidas.')
  const sorted = [...rates].sort((a, b) => a.month - b.month)
  const rateAt = (month: number) => {
    const rate = sorted.filter(r => r.month <= month).at(-1)
    if (!rate) throw new Error('Falta una tarifa vigente para el período.')
    return rate.amountCents
  }
  const discountPercent = Math.max(plan.siblingDiscountPercent, plan.scholarshipPercent)
  const discount = (base: number) => Math.round(base * (100 - discountPercent) / 100)
  const splitRegime = joinedMonth <= first
  const charges: PlannedCharge[] = []
  for (const month of [...billableMonths].sort((a, b) => a - b)) {
    if (month < joinedMonth || month > leftMonth || (month === 12 && splitRegime)) continue
    let baseCents = rateAt(month)
    if (month === joinedMonth && plan.firstMonthOverrideCents !== undefined) {
      const custom = plan.firstMonthOverrideCents
      if (!Number.isSafeInteger(custom) || custom < 0 || custom > baseCents || !plan.firstMonthReason?.trim()) throw new Error('El importe reducido necesita un monto válido y un motivo.')
      // Importe final autorizado: no volver a descontar sobre este monto.
      charges.push({ month, originMonth: month, kind: 'mensualidad', baseCents, amountCents: custom, discountPercent: 0 })
    } else charges.push({ month, originMonth: month, kind: 'mensualidad', baseCents, amountCents: discount(baseCents), discountPercent })
  }
  if (splitRegime) {
    const base = rateAt(first)
    // Descontar una sola vez y distribuir el redondeo en la última parte.
    const total = discount(base), half = Math.floor(total / 2), baseHalf = Math.floor(base / 2)
    for (const [index, month] of [first, second].entries()) {
      if (month > leftMonth) continue
      charges.push({ month, originMonth: 12, kind: 'diciembre', baseCents: index ? base - baseHalf : baseHalf, amountCents: index ? total - half : half, discountPercent })
    }
  }
  return charges.sort((a, b) => a.month - b.month || a.originMonth - b.originMonth)
}

export const formatMoney = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)
export const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
