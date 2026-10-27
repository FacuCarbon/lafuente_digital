import type { TrainingSlot } from '../domain/types'
import { daysLabel, scheduleGroups, weekDays } from '../domain/schedules'
import { Field } from './ui'

export function ScheduleEditor({ slots, onChange, legacy, clearLegacy }: { slots: TrainingSlot[]; onChange: (slots: TrainingSlot[]) => void; legacy: string; clearLegacy: () => void }) {
  function update(id: string, changes: Partial<TrainingSlot>) { onChange(slots.map(s => s.id === id ? { ...s, ...changes } : s)) }
  return <section className="schedule-editor full" aria-label="Horarios de entrenamiento"><div className="flex-between"><h3>Días y horarios</h3><span>{slots.length} bloques</span></div><p>Agregá un bloque por categoría o grupo. Podés marcar varios días para el mismo horario.</p>
    {legacy && <div className="notice"><div><details><summary>Ver horario anterior en texto</summary><p className="legacy-schedule">{legacy}</p></details><p>{slots.length ? 'Al guardar, los bloques reemplazarán este texto.' : 'Podés conservarlo o reemplazarlo cargando bloques. Revisá las categorías; el texto anterior no se interpreta automáticamente.'}</p>{!slots.length && <button className="button small" type="button" onClick={clearLegacy}>Quitar texto anterior</button>}</div></div>}
    {!slots.length && <p className="form-note">Todavía no hay bloques. Por ejemplo: categoría 2019 / 2020, martes y viernes, a las 18:00.</p>}
    <div className="schedule-blocks">{slots.map((s, index) => <fieldset className="schedule-block" key={s.id}><legend>Bloque {index + 1}</legend><div className="schedule-block-heading"><Field label="Categoría / grupo"><input required maxLength={100} value={s.label} placeholder="2019 / 2020, Inicial, Todos…" onChange={e => update(s.id, { label: e.target.value })} /></Field><button type="button" className="button" aria-label={`Quitar bloque ${index + 1}`} onClick={() => onChange(slots.filter(row => row.id !== s.id))}>Quitar</button></div><fieldset className="weekday-picker"><legend>Días de entrenamiento</legend>{weekDays.map((day, i) => <label className={s.days.includes(i+1) ? 'chosen' : ''} key={day}><input type="checkbox" checked={s.days.includes(i+1)} onChange={e => update(s.id, { days: e.target.checked ? [...s.days, i+1].sort((a,b) => a-b) : s.days.filter(d => d !== i+1) })} />{day}</label>)}</fieldset><div className="schedule-times"><Field label="Desde"><input type="time" required value={s.start} onChange={e => update(s.id, { start: e.target.value })} /></Field><Field label="Hasta (opcional)"><input type="time" value={s.end} onChange={e => update(s.id, { end: e.target.value })} /></Field></div></fieldset>)}</div>
    <button className="button" type="button" disabled={slots.length >= 40} onClick={() => onChange([...slots, { id: crypto.randomUUID(), label: '', days: [...(slots.at(-1)?.days ?? [])], start: '', end: '' }])}>+ Agregar categoría / horario</button>
  </section>
}

export function ScheduleView({ slots = [], legacy = '', compact = false }: { slots?: TrainingSlot[]; legacy?: string; compact?: boolean }) {
  if (!slots.length) return legacy ? <details className="schedule-legacy"><summary>Horarios anteriores · por organizar</summary><p className="legacy-schedule">{legacy}</p></details> : <p className="form-note">Horarios por configurar.</p>
  const content = <div className="schedule-view">{scheduleGroups(slots).map(g => <section key={g.days.join(',')}><h3>{daysLabel(g.days)}</h3><div>{g.slots.map(s => <div className="schedule-line" key={s.id}><strong>{s.label}</strong><span>{s.start}{s.end ? ` – ${s.end}` : ''} hs</span></div>)}</div></section>)}</div>
  return compact ? <details className="schedule-overview"><summary>Ver horarios · {slots.length} {slots.length === 1 ? 'grupo / horario' : 'grupos / horarios'}</summary>{content}</details> : content
}
