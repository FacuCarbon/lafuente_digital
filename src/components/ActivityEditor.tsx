import { useState, type FormEvent } from 'react'
import type { Activity, ClubData, Profile, Rental } from '../domain/types'
import { saveActivitySetupState, validateActivitySetup } from '../domain/activity-setup'
import type { Perform } from '../App'
import { live } from '../data/repository'
import { Dialog, Field } from './ui'
import { ScheduleEditor } from './Schedules'
import { scheduleText } from '../domain/schedules'

export const statusLabels = { activa: 'Activa', inscripciones_cerradas: 'Inscripciones cerradas', pausada: 'En pausa', finalizada: 'Finalizada' }
type Props = { initial: Partial<Activity>; data: ClubData; profile: Profile; perform: Perform; busy: boolean; close: () => void; agreementOnly?: boolean; rental?: Rental }

export function ActivityEditor({ initial, data, profile, perform, busy, close, agreementOnly = false, rental }: Props) {
  const [mode, setMode] = useState(initial.management ?? 'club'), [error, setError] = useState('')
  const agreements = data.rentals.filter(r => r.activity_id === initial.id)
  const active = agreements.filter(r => r.active)
  const [agreementId, setAgreementId] = useState(rental?.id ?? active[0]?.id ?? agreements.at(-1)?.id ?? '')
  const agreement = agreements.find(r => r.id === agreementId)
  const [instructor, setInstructor] = useState(agreement?.instructor_id ?? '')
  const [schedule, setSchedule] = useState(initial.schedule_label ?? agreement?.schedule_label ?? '')
  const [slots, setSlots] = useState(initial.schedule_slots ?? [])
  const admin = profile.roles.includes('admin')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const f = new FormData(event.currentTarget)
    const summary = agreementOnly ? schedule.trim() : slots.length ? scheduleText(slots) : initial.schedule_slots?.length ? '' : schedule.trim()
    const a: Activity = { id: initial.id ?? crypto.randomUUID(), name: agreementOnly ? initial.name! : String(f.get('name')).trim(), management: mode, status: agreementOnly ? initial.status! : f.get('status') as Activity['status'], description: agreementOnly ? initial.description ?? '' : String(f.get('description')).trim(), color: agreementOnly ? initial.color! : String(f.get('color')), schedule_label: summary, schedule_slots: initial.schedule_slots }
    if (!agreementOnly) a.schedule_slots = slots
    const amount = String(f.get('amount') ?? '').trim()
    const r: Rental | null = mode === 'externa' || agreementOnly ? { id: agreement?.id ?? crypto.randomUUID(), activity_id: a.id, instructor_id: instructor || null, contact_name: String(f.get('contact_name')).trim(), space_name: String(f.get('space_name')).trim(), schedule_label: summary, amount_cents: amount === '' ? null : Math.round(Number(amount) * 100), basis: String(f.get('basis')).trim(), active: f.get('agreement_active') === 'on' } : null
    try {
      if (!agreementOnly) validateActivitySetup({ activity: a, agreement: r })
      else if (!r?.contact_name || !r.space_name || !r.schedule_label || !r.basis) throw new Error('Completá los datos del acuerdo.')
      const ok = await perform(() => agreementOnly ? live.rental(r!) : live.activitySetup({ activity: a, agreement: r }), state => agreementOnly ? { ...state, rentals: [...state.rentals.filter(item => item.id !== r!.id), r!] } : saveActivitySetupState(state, { activity: a, agreement: r }), agreementOnly ? 'Acuerdo actualizado.' : 'Actividad y configuración guardadas.')
      if (ok) close()
    } catch (failure) { setError((failure as Error).message) }
  }
  return <Dialog title={agreementOnly ? `Acuerdo · ${initial.name}` : initial.id ? `Configurar ${initial.name}` : 'Nueva actividad'} close={close}><form className="form-grid" onSubmit={e => void save(e)}>
    {!agreementOnly && <><div className="full"><Field label="Nombre"><input name="name" required minLength={2} maxLength={100} defaultValue={initial.name} autoFocus /></Field></div><Field label="Estado"><select name="status" defaultValue={initial.status ?? 'activa'}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Modalidad"><select value={mode} onChange={e => setMode(e.target.value as Activity['management'])}><option value="club">Formativa del club</option><option value="externa">Profesor externo</option></select></Field><div className="full"><Field label="Descripción"><textarea name="description" maxLength={1000} defaultValue={initial.description} /></Field></div></>}
    {agreementOnly ? <div className="full"><Field label="Horarios de uso del espacio"><textarea required maxLength={10000} value={schedule} onChange={e => setSchedule(e.target.value)} /></Field><p className="form-note">La grilla de entrenamiento se modifica desde la configuración general de la actividad.</p></div> : <ScheduleEditor slots={slots} onChange={setSlots} legacy={initial.schedule_slots?.length ? '' : schedule} clearLegacy={() => setSchedule('')} />}
    {!agreementOnly && <Field label="Color identificador"><input type="color" name="color" defaultValue={initial.color ?? '#1360b3'} /></Field>}
    {(mode === 'externa' || agreementOnly) && <fieldset className="full"><legend>Profesor y uso del espacio</legend><p>Completá el acuerdo acá, junto con la actividad.</p>{agreements.length > 1 && <Field label="Acuerdo que querés actualizar"><select value={agreementId} onChange={e => { const selected = agreements.find(r => r.id === e.target.value); setAgreementId(e.target.value); setInstructor(selected?.instructor_id ?? ''); setSchedule(selected?.schedule_label ?? schedule) }}>{agreements.map(r => <option key={r.id} value={r.id}>{r.contact_name || 'Profesor'} · {r.space_name}</option>)}</select></Field>}<div className="form-grid" key={agreementId}>
      <Field label="Profesor / responsable"><input name="contact_name" required maxLength={120} defaultValue={agreement?.contact_name || data.instructors?.find(i => i.id === agreement?.instructor_id)?.display_name} /></Field><Field label="Espacio utilizado"><input name="space_name" required maxLength={150} defaultValue={agreement?.space_name} placeholder="Salón principal" /></Field>
      <Field label="Importe del alquiler ($, opcional)"><input name="amount" type="number" min={0} max={1000000000} step="0.01" defaultValue={agreement?.amount_cents == null ? '' : agreement.amount_cents / 100} /></Field><Field label="Modalidad del importe"><input name="basis" required maxLength={200} defaultValue={agreement?.basis ?? 'Por mes'} placeholder="Por mes / por hora / a acordar" /></Field>
      <div className="full"><Field label="Cuenta del profesor (opcional)"><select value={instructor} onChange={e => setInstructor(e.target.value)}><option value="">Sin cuenta vinculada</option>{data.instructors?.filter(i => i.activity_id === initial.id).map(i => <option key={i.id} value={i.id}>{i.display_name}</option>)}{instructor && !data.instructors?.some(i => i.id === instructor && i.activity_id === initial.id) && <option value={instructor}>Conservar cuenta vinculada</option>}</select></Field><p className="form-note">El profesor puede tener un acuerdo sin cuenta. Una vez asignada su cuenta a esta actividad, podés vincularla acá.</p></div>
      <label className="checkbox full"><input type="checkbox" name="agreement_active" defaultChecked={agreement?.active ?? true} /> Acuerdo activo</label>
    </div></fieldset>}
    {initial.id && !agreementOnly && <div className="notice full"><p>Hay {data.enrollments.filter(e => e.activity_id === initial.id && e.status !== 'baja').length} inscripciones abiertas. Cerrar inscripciones impide altas nuevas; pausar o finalizar conserva las personas y el historial.</p>{initial.management === 'externa' && mode === 'club' && active.length > 0 && <p>Al pasar a formativa del club se finalizarán {active.length} acuerdos activos. Sus registros se conservan; no se convierten alquileres anteriores en cuotas.</p>}</div>}
    {error && <p className="error full" role="alert">{error}</p>}<div className="dialog-actions full"><button type="button" className="button" onClick={close}>Cancelar</button><button className="button primary" disabled={busy || !admin && !agreementOnly}>{agreementOnly ? 'Guardar acuerdo' : 'Guardar actividad'}</button></div>
  </form></Dialog>
}
