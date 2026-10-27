import { useState, type FormEvent } from 'react'
import { Plus, Search, UserRound, Check, Archive } from 'lucide-react'
import type { ClubData, Profile, StudentInput } from '../domain/types'
import { canManage } from '../domain/permissions'
import { Badge, Dialog, Empty, Field, PageHeading } from './ui'
import { live } from '../data/repository'
import type { Perform } from '../App'
import { registrationState } from '../domain/workflows'

export function People({ data, profile, perform, busy, activityId }: { data: ClubData; profile: Profile; perform: Perform; busy: boolean; activityId?: string }) {
  const [search, setSearch] = useState(''), [filter, setFilter] = useState(activityId ?? 'all')
  const [adding, setAdding] = useState(false), [ending, setEnding] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const admin = canManage(profile.roles)
  const canAdd = admin || profile.roles.includes('profe') && Boolean(profile.externalActivities?.length)
  const available = data.activities.filter(a => (!activityId || a.id === activityId) && a.status === 'activa' && (admin || profile.externalActivities?.includes(a.id)))
  const [registrationActivity, setRegistrationActivity] = useState(available[0]?.id ?? '')
  const people = data.people.filter(p => `${p.first_name} ${p.last_name}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')) && (filter === 'all' || data.enrollments.some(e => e.person_id === p.id && e.activity_id === filter)))
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input = Object.fromEntries(form) as StudentInput
    setFormError('')
    if (!input.first_name.trim() || !input.last_name.trim()) { setFormError('Completá nombre y apellido.'); return }
    if (input.birth_date > new Date().toISOString().slice(0, 10) || input.start_date < input.birth_date) { setFormError('Revisá las fechas ingresadas.'); return }
    const success = await perform(() => live.register(input), state => registrationState(state, input, admin), admin ? 'Inscripción activa. No necesita otra aprobación.' : 'Inscripción registrada para revisión de administración.')
    if (success) setAdding(false)
  }
  return <>
    <PageHeading eyebrow="Cada persona cuenta" title="Personas e inscripciones" description="Un lugar para acompañar a quienes hacen el club." action={canAdd && <button className="button primary" disabled={!available.length} onClick={() => setAdding(true)}><Plus size={18} /> Nueva inscripción</button>} />
    <div className="panel"><div className="toolbar"><label className="search"><Search size={18} /><input aria-label="Buscar personas" placeholder="Buscar por nombre o apellido…" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Filtrar por actividad" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas las actividades</option>{data.activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
    {people.length ? <div className="table-scroll"><table className="people-table" aria-label="Personas e inscripciones"><thead><tr><th>Nombre</th><th>Actividad e inscripción</th><th>Año de nacimiento</th><th>Ficha</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{people.map(person => <tr key={person.id}>
      <td data-label="Persona"><div className="person-cell"><span className="avatar"><UserRound size={19} /></span><div><strong>{person.first_name} {person.last_name}</strong><small>Participante</small></div></div></td>
      <td data-label="Actividad e inscripción">{data.enrollments.filter(e => e.person_id === person.id).map(e => <div className="enrollment" key={e.id}><span>{data.activities.find(a => a.id === e.activity_id)?.name}<small>{e.status === 'activa' ? 'Inscripción activa' : e.status === 'baja' ? 'Baja registrada' : e.status === 'pausada' ? 'En pausa' : 'Pendiente de validación'}</small></span>{(admin || profile.externalActivities?.includes(e.activity_id)) && e.status !== 'baja' && <button className="button small enrollment-end" aria-label={`Dar de baja a ${person.first_name}`} title="Dar de baja la inscripción" onClick={() => setEnding(e.id)}><Archive size={16} /><span>Dar de baja</span></button>}</div>)}</td>
      <td data-label="Año de nacimiento">{person.birth_date.slice(0, 4)}</td><td data-label="Ficha"><Badge tone={person.validation_status === 'validada' ? 'green' : 'amber'}>{person.validation_status === 'validada' ? 'Validada' : 'Por validar'}</Badge></td>
      <td data-label="Acciones">{admin && person.validation_status !== 'validada' && <button className="button small" disabled={busy} onClick={() => void perform(() => live.validate(person.id), state => ({ ...state, people: state.people.map(p => p.id === person.id ? { ...p, validation_status: 'validada' } : p), enrollments: state.enrollments.map(e => e.person_id === person.id && e.status === 'pendiente' ? { ...e, status: 'activa' } : e) }), 'Ficha validada e inscripción activada.')}><Check size={15} /> Validar ficha</button>}</td>
    </tr>)}</tbody></table></div> : <Empty>No encontramos personas con esos filtros.</Empty>}
    <div className="panel-footer">{people.length} {people.length === 1 ? 'persona' : 'personas'} · Las bajas conservan su historial.</div></div>
    {adding && <Dialog title="Nueva inscripción" close={() => setAdding(false)}><form onSubmit={e => { void register(e).catch(() => {}) }} className="form-grid">
      <Field label="Nombre"><input name="first_name" required maxLength={100} autoFocus /></Field><Field label="Apellido"><input name="last_name" required maxLength={100} /></Field>
      <Field label="Fecha de nacimiento"><input name="birth_date" type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} /></Field>
      <Field label="Fecha de ingreso"><input name="start_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
      <div className="full"><Field label="Actividad"><select name="activity_id" required value={registrationActivity} onChange={e => setRegistrationActivity(e.target.value)}>{available.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></div>
      {admin && <div className="full"><Field label="Grupo de entrenamiento (opcional)"><select name="group_id" key={registrationActivity} defaultValue=""><option value="">Asignar más adelante</option>{data.groups.filter(g => g.activity_id === registrationActivity).map(g => <option key={g.id} value={g.id}>{g.name} · {g.season}</option>)}</select></Field></div>}
      {formError && <p className="error full" role="alert">{formError}</p>}
      <p className="form-note full">{admin ? 'Al guardar, la ficha queda validada y la inscripción activa.' : 'Administración revisará esta inscripción.'} Esta operación no genera cuotas ni registra pagos.</p><div className="dialog-actions full"><button type="button" className="button" onClick={() => setAdding(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Registrar inscripción'}</button></div>
    </form></Dialog>}
    {ending && <Dialog title="Dar de baja la inscripción" close={() => setEnding(null)}><form onSubmit={e => { e.preventDefault(); const date = String(new FormData(e.currentTarget).get('date')); void perform(() => live.end(ending, date), state => ({ ...state, enrollments: state.enrollments.map(row => row.id === ending ? { ...row, status: 'baja', end_date: date } : row) }), 'Baja registrada. El historial se conserva.').then(ok => { if (ok) setEnding(null) }) }}>
      <p>La ficha y la asistencia anterior se conservarán. Las partes futuras de diciembre no corresponden después de la baja.</p><Field label="Fecha efectiva"><input name="date" type="date" required max={new Date().toISOString().slice(0, 10)} min={data.enrollments.find(e => e.id === ending)?.start_date} defaultValue={new Date().toISOString().slice(0, 10)} /></Field><div className="dialog-actions"><button type="button" className="button" onClick={() => setEnding(null)}>Cancelar</button><button className="button primary" disabled={busy}>Confirmar baja</button></div>
    </form></Dialog>}
  </>
}
