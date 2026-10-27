import { useState } from 'react'
import { Plus, ArrowUpRight, UsersRound, CalendarDays, Check } from 'lucide-react'
import type { Activity, ClubData, Profile } from '../domain/types'
import { canManage, canTeach } from '../domain/permissions'
import { live } from '../data/repository'
import type { Perform } from '../App'
import { Badge, Dialog, Empty, Field, PageHeading } from './ui'
import { People } from './People'
import { Jornadas } from './Jornadas'
import { Rentals } from './Rentals'
import { ScheduleView } from './Schedules'
import { ActivityEditor, statusLabels } from './ActivityEditor'
export { Jornadas as Matches } from './Jornadas'

type Props = { data: ClubData; profile: Profile; perform: Perform; busy: boolean }
export function Activities({ data, profile, perform, busy, initialActivityId = '', onSelect }: Props & { initialActivityId?: string; onSelect?: (id: string) => void }) {
  const [editing, setEditing] = useState<Partial<Activity> | null>(null)
  const [opened, setOpened] = useState(initialActivityId), [tab, setTab] = useState('personas')
  const activity = data.activities.find(a => a.id === opened)
  if (activity && !editing) {
    const groups = data.groups.filter(g => g.activity_id === activity.id)
    const enrollments = data.enrollments.filter(e => e.activity_id === activity.id)
    const scoped = { ...data, activities: [activity], people: data.people.filter(p => enrollments.some(e => e.person_id === p.id)), enrollments, rentals: data.rentals.filter(r => r.activity_id === activity.id), groups, matches: data.matches.filter(m => m.activity_id === activity.id || groups.some(g => g.id === m.group_id)) }
    const props = { data: scoped, profile, perform, busy }
    return <><button className="button" onClick={() => { setOpened(''); onSelect?.('') }}>← Todas las actividades</button><div className="workspace-heading"><h1>{activity.name}</h1>{canManage(profile.roles) && <button className="button" onClick={() => setEditing(activity)}>Configurar actividad</button>}</div><nav className="workspace-tabs" aria-label={`Gestionar ${activity.name}`}><button className={`button ${tab === 'personas' ? 'primary' : ''}`} onClick={() => setTab('personas')}>Inscriptos</button>{(canTeach(profile.roles) || profile.roles.includes('tutor')) && <><button className={`button ${tab === 'grupos' ? 'primary' : ''}`} onClick={() => setTab('grupos')}>Grupos y asistencia</button><button className={`button ${tab === 'jornadas' ? 'primary' : ''}`} onClick={() => setTab('jornadas')}>Jornadas y resultados</button></>}{(activity.management === 'externa' || scoped.rentals.length > 0) && profile.roles.some(r => r === 'admin' || r === 'tesorero' || r === 'profe') && <button className={`button ${tab === 'alquiler' ? 'primary' : ''}`} onClick={() => setTab('alquiler')}>Profesor y acuerdo</button>}<button className={`button ${tab === 'horarios' ? 'primary' : ''}`} onClick={() => setTab('horarios')}>Horarios</button></nav>{tab === 'horarios' && <section className="panel schedule-panel"><h2>Horarios de {activity.name}</h2><ScheduleView slots={activity.schedule_slots} legacy={activity.schedule_label} /></section>}{tab === 'personas' && <People {...props} activityId={activity.id} />}{tab === 'grupos' && <Groups {...props} />}{tab === 'jornadas' && <Jornadas {...props} />}{tab === 'alquiler' && <Rentals {...props} onConfigure={() => setEditing(activity)} />}</>
  }
  return <><PageHeading eyebrow="Un club, muchas formas de encontrarse" title="Nuestras actividades" description="Cada propuesta tiene su espacio y su propia manera de funcionar." action={canManage(profile.roles) && <button className="button primary" onClick={() => setEditing({})}><Plus size={18} /> Nueva actividad</button>} />
    <div className="activity-grid">{data.activities.map((a, index) => <article className="panel activity-card" key={a.id}><div className={`activity-art art-${index % 4}`} style={{ '--activity-color': a.color } as React.CSSProperties}><span className="activity-symbol">{index === 0 ? '↗' : index === 1 ? '✳' : index === 2 ? '◈' : '↔'}</span><span className="art-label">CLUB SOCIAL LA FUENTE</span></div><div className="activity-content"><div className="flex-between"><Badge tone={a.status === 'activa' ? 'green' : 'neutral'}>{statusLabels[a.status]}</Badge><small>{a.management === 'club' ? 'Formativa del club' : 'Profesor externo'}</small></div><h2>{a.name}</h2><button className="button primary" onClick={() => { setOpened(a.id); setTab('personas'); onSelect?.(a.id) }}>Gestionar actividad <ArrowUpRight size={18} /></button><p className="muted">{a.description}</p><ScheduleView slots={a.schedule_slots} legacy={a.schedule_label} compact /><div className="activity-bottom"><span><UsersRound size={16} /> {data.enrollments.filter(e => e.activity_id === a.id && e.status === 'activa').length} inscripciones visibles</span>{canManage(profile.roles) && <button className="button small" aria-label={`Configurar ${a.name}`} onClick={() => setEditing(a)}><span>Configurar</span><ArrowUpRight size={20} /></button>}</div></div></article>)}</div>
    {editing && <ActivityEditor initial={editing} data={data} profile={profile} perform={perform} busy={busy} close={() => setEditing(null)} />}
  </>
}

export function Groups({ data, profile, perform, busy }: Props) {
  const [adding, setAdding] = useState(false), [selected, setSelected] = useState(''), [activityId, setActivityId] = useState(data.activities[0]?.id ?? '')
  const [bulk, setBulk] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]), [season, setSeason] = useState('')
  const activityGroups = data.groups.filter(g => g.activity_id === activityId)
  const seasons = [...new Set(activityGroups.map(g => g.season))].sort((a, b) => b - a)
  const visibleSeason = seasons.includes(Number(season)) ? Number(season) : seasons[0]
  const groups = activityGroups.filter(g => g.season === visibleSeason)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const group = groups.find(g => g.id === selected) ?? groups[0]
  const members = data.members.filter(m => m.group_id === group?.id)
  const eligible = data.enrollments.filter(e => e.activity_id === group?.activity_id && e.status === 'activa' && !members.some(m => m.enrollment_id === e.id))
  const admin = canManage(profile.roles)
  return <><PageHeading eyebrow="Aprender en equipo" title="Grupos y asistencia" description="Agrupaciones por temporada. Cada año, una nueva historia." action={admin && <button className="button primary" onClick={() => setAdding(true)}><Plus size={18} /> Crear grupo</button>} />
    <div className="toolbar"><Field label="Actividad"><select value={activityId} onChange={e => { setActivityId(e.target.value); setSelected(''); setSeason('') }}>{data.activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field><Field label="Temporada"><select value={visibleSeason ?? ''} onChange={e => { setSeason(e.target.value); setSelected('') }}>{seasons.map(s => <option key={s} value={s}>{s}</option>)}</select></Field></div>
    {!groups.length ? <div className="panel"><Empty>Todavía no hay grupos para mostrar.</Empty></div> : <div className="groups-layout"><aside className="group-list">{groups.map(g => <button className={`group-option ${group?.id === g.id ? 'selected' : ''}`} key={g.id} onClick={() => setSelected(g.id)}><span className="eyebrow">Temporada {g.season}</span><strong>{g.name}</strong><small>{data.activities.find(a => a.id === g.activity_id)?.name}</small></button>)}</aside>
    <section className="panel"><div className="panel-heading"><div><h2>{group?.name}</h2><p className="muted">{group?.birth_years.join(' / ') || 'Sin restricción de año configurada'}</p></div><label className="date-control"><CalendarDays size={17} /><input aria-label="Fecha de asistencia" type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
    {members.length ? <div className="roster">{members.map(member => {
      const enrollment = data.enrollments.find(e => e.id === member.enrollment_id), person = data.people.find(p => p.id === enrollment?.person_id)
      if (!person) return null
      const record = data.attendance.find(a => a.enrollment_id === member.enrollment_id && a.group_id === group?.id && a.class_date === date)
      const active = enrollment?.status === 'activa'
      return <div className="roster-row" key={member.enrollment_id}><span className="avatar">{person.first_name[0]}{person.last_name[0]}</span><div className="grow"><strong>{person.first_name} {person.last_name}</strong><small>{active ? 'Inscripción activa' : 'Inscripción cerrada o en pausa'}</small></div>{canTeach(profile.roles) ? <button className={`button small ${record?.present ? 'present' : ''}`} disabled={busy || !active || !date} aria-pressed={record?.present ?? false} onClick={() => {
        const row = { group_id: group!.id, enrollment_id: member.enrollment_id, class_date: date, present: !record?.present }
        void perform(() => live.attendance(row, profile.id), state => ({ ...state, attendance: [...state.attendance.filter(a => !(a.group_id === row.group_id && a.enrollment_id === row.enrollment_id && a.class_date === date)), { ...row, id: record?.id ?? crypto.randomUUID() }] }), 'Asistencia guardada.')
      }}><Check size={15} />{record ? record.present ? 'Presente' : 'Ausente' : 'Marcar presente'}</button> : <Badge>{record ? record.present ? 'Presente' : 'Ausente' : 'Sin registrar'}</Badge>}</div>
    })}</div> : <Empty>Este grupo todavía no tiene integrantes.</Empty>}
    {admin && <button className="button" onClick={() => { setSelectedMembers([]); setBulk(true) }}><UsersRound size={17} /> Agregar integrantes</button>}
    {bulk && group && <Dialog title={`Agregar integrantes · ${group.name}`} close={() => setBulk(false)}><form onSubmit={e => {
      e.preventDefault(); const ids = new FormData(e.currentTarget).getAll('enrollments').map(String)
      if (!ids.length) return
      void perform(() => live.members(group.id, ids), state => ({ ...state, members: [...state.members, ...ids.map(enrollment_id => ({ group_id: group.id, enrollment_id }))] }), 'Integrantes agregados.').then(ok => { if (ok) setBulk(false) })
    }}><p>Elegí varias personas y agregalas juntas. Los años del grupo son una referencia; el club decide quién participa.</p>{eligible.length ? <button className="button" type="button" onClick={() => setSelectedMembers(selectedMembers.length === eligible.length ? [] : eligible.map(e => e.id))}>{selectedMembers.length === eligible.length ? 'Desmarcar todos' : 'Seleccionar todos'}</button> : <p>No hay inscripciones activas pendientes de asignar a este grupo.</p>}<div className="bulk-list">{eligible.map(e => {
      const person = data.people.find(p => p.id === e.person_id)
      return <label className="checkbox" key={e.id}><input type="checkbox" name="enrollments" value={e.id} checked={selectedMembers.includes(e.id)} onChange={event => setSelectedMembers(event.target.checked ? [...selectedMembers, e.id] : selectedMembers.filter(id => id !== e.id))} /> {person?.first_name} {person?.last_name} · {person?.birth_date.slice(0, 4)}</label>
    })}</div><div className="dialog-actions"><button type="button" className="button" onClick={() => setBulk(false)}>Cancelar</button><button className="button primary" disabled={busy || !selectedMembers.length}>Agregar seleccionados ({selectedMembers.length})</button></div></form></Dialog>}

    </section></div>}
    {adding && <Dialog title="Nuevo grupo por temporada" close={() => setAdding(false)}><form className="form-grid" onSubmit={e => {
      e.preventDefault(); const form = new FormData(e.currentTarget)
      const group = { id: crypto.randomUUID(), name: String(form.get('name')).trim(), season: Number(form.get('season')), activity_id: String(form.get('activity_id')), birth_years: String(form.get('years')).split(',').map(s => s.trim()).filter(Boolean).map(Number) }
      void perform(() => live.group(group), state => ({ ...state, groups: [...state.groups, group] }), 'Grupo creado. Ahora podés elegir sus integrantes.').then(ok => { if (ok) { setAdding(false); setSelected(group.id); setActivityId(group.activity_id); setSeason(String(group.season)); setSelectedMembers([]); setBulk(true) } })
    }}><div className="full"><Field label="Nombre del grupo"><input name="name" required maxLength={100} placeholder="Formativo · 2015 / 2016" autoFocus /></Field></div><Field label="Temporada"><input name="season" type="number" min={2000} max={2200} required defaultValue={new Date().getFullYear()} /></Field><Field label="Años de nacimiento (separados por coma)"><input name="years" pattern="\s*(19|20)[0-9]{2}(\s*,\s*(19|20)[0-9]{2})*\s*" placeholder="2015, 2016" /></Field><div className="full"><Field label="Actividad"><select name="activity_id" required defaultValue={activityId}>{data.activities.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></Field></div><div className="dialog-actions full"><button type="button" className="button" onClick={() => setAdding(false)}>Cancelar</button><button className="button primary" disabled={busy}>Crear grupo</button></div></form></Dialog>}
  </>
}

