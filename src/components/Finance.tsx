import { useMemo, useState } from 'react'
import { HeartHandshake, Info } from 'lucide-react'
import { formatMoney, monthNames, planFees, type FeePlan } from '../domain/fees'
import { Badge, Field, PageHeading } from './ui'

const defaultPlan: FeePlan = { year: 2026, billableMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], decemberSplit: [6, 8], rates: [{ month: 1, amountCents: 3000000 }], joinedMonth: 3, siblingDiscountPercent: 0, scholarshipPercent: 0 }
export function Finance() {
  const [plan, setPlan] = useState(defaultPlan), [increase, setIncrease] = useState(0), [increaseMonth, setIncreaseMonth] = useState(7)
  const result = useMemo(() => {
    try { return { charges: planFees({ ...plan, rates: increase > 0 ? [...plan.rates, { month: increaseMonth, amountCents: Math.round(increase * 100) }] : plan.rates }), error: '' } }
    catch (error) { return { charges: [], error: (error as Error).message } }
  }, [plan, increase, increaseMonth])
  const monthTotals = monthNames.map((_, i) => result.charges.filter(c => c.month === i + 1).reduce((sum, c) => sum + c.amountCents, 0))
  const max = Math.max(...monthTotals, 1)
  return <><PageHeading eyebrow="Acompañar también es dar tiempo" title="Tesorería" description="Cuotas claras, con la flexibilidad que necesitan las familias." />
    <div className="notice"><Info size={20} /><div><strong>Planificador de cuotas · simulación</strong><p>Probá las reglas acordadas. No emite cargos, no guarda tarifas ni registra cobros. La caja operativa se incorpora en la próxima etapa.</p></div></div>
    <div className="finance-layout"><section className="panel planner"><h2>Armá un ejemplo</h2><div className="form-grid">
      <Field label="Cuota mensual ($)"><input type="number" min={0} step="0.01" value={plan.rates[0].amountCents / 100} onChange={e => setPlan({ ...plan, rates: [{ month: 1, amountCents: Math.round(Number(e.target.value) * 100) }] })} /></Field>
      <Field label="Año"><input type="number" min={2000} max={2200} value={plan.year} onChange={e => setPlan({ ...plan, year: Number(e.target.value) })} /></Field>
      <Field label="Mes de ingreso"><select value={plan.joinedMonth} onChange={e => setPlan({ ...plan, joinedMonth: Number(e.target.value) })}>{monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
      <Field label="Último mes de actividad"><select value={plan.leftMonth ?? 12} onChange={e => setPlan({ ...plan, leftMonth: Number(e.target.value) })}>{monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
      <Field label="Descuento por hermanos (%)"><input type="number" min={0} max={100} value={plan.siblingDiscountPercent} onChange={e => setPlan({ ...plan, siblingDiscountPercent: Number(e.target.value) })} /></Field>
      <Field label="Beca (%)"><input type="number" min={0} max={100} value={plan.scholarshipPercent} onChange={e => setPlan({ ...plan, scholarshipPercent: Number(e.target.value) })} /></Field>
      <Field label="Primera mitad de diciembre"><select value={plan.decemberSplit[0]} onChange={e => setPlan({ ...plan, decemberSplit: [Number(e.target.value), plan.decemberSplit[1]] })}>{monthNames.slice(0, 11).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
      <Field label="Segunda mitad de diciembre"><select value={plan.decemberSplit[1]} onChange={e => setPlan({ ...plan, decemberSplit: [plan.decemberSplit[0], Number(e.target.value)] })}>{monthNames.slice(0, 11).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
      <Field label="Nueva cuota mensual ($, opcional)"><input type="number" min={0} step="0.01" value={increase} onChange={e => setIncrease(Number(e.target.value))} /></Field>
      <Field label="Aumento desde"><select value={increaseMonth} onChange={e => setIncreaseMonth(Number(e.target.value))}>{monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
      <fieldset className="full month-picker"><legend>Meses cobrables</legend>{monthNames.map((m, i) => <label key={m}><input type="checkbox" checked={plan.billableMonths.includes(i + 1)} onChange={e => setPlan({ ...plan, billableMonths: e.target.checked ? [...plan.billableMonths, i + 1] : plan.billableMonths.filter(n => n !== i + 1) })} />{m.slice(0, 3)}</label>)}</fieldset>
    </div></section><section className="panel planner-summary"><div className="flex-between"><span className="eyebrow">Proyección {plan.year}</span><Badge tone="blue">Sin emitir</Badge></div><p className="big-amount">{formatMoney(monthTotals.reduce((a, b) => a + b, 0))}</p><p className="muted">Total previsto, sin considerar pagos.</p>
    {result.error ? <p className="error" role="alert">{result.error}</p> : <><div className="chart" role="img" aria-label={`Proyección mensual. Total ${formatMoney(monthTotals.reduce((a, b) => a + b, 0))}`}>{monthTotals.map((amount, i) => <div className="chart-column" key={i} title={`${monthNames[i]}: ${formatMoney(amount)}`}><div className={`chart-bar ${plan.decemberSplit.includes(i + 1) ? 'coral' : ''}`} style={{ height: `${Math.max(amount ? 4 : 0, amount / max * 100)}%` }} /><span>{monthNames[i].slice(0, 1)}</span></div>)}</div><div className="fee-lines">{monthTotals.map((amount, i) => <div key={i}><span>{monthNames[i]}{result.charges.some(c => c.month === i + 1 && c.kind === 'diciembre') && <small>Incluye parte de diciembre</small>}</span><strong>{amount ? formatMoney(amount) : 'Sin cargo nuevo'}</strong></div>)}</div></>}
    </section></div><div className="social-note"><HeartHandshake size={24} /><p>Las cuotas pueden pagarse cuando la familia pueda. Sin recargos, pérdida de beneficios ni restricciones para participar.</p></div>
  </>
}

export { Rentals } from './Rentals'
