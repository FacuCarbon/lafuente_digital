import { useState } from 'react'
import { Building2, Wallet } from 'lucide-react'
import type { ClubData, Profile, Rental } from '../domain/types'
import { formatMoney } from '../domain/fees'
import type { Perform } from '../App'
import { Badge, Empty, PageHeading } from './ui'
import { ActivityEditor } from './ActivityEditor'
import { ScheduleView } from './Schedules'

export function Rentals({ data, profile, perform, busy, onConfigure }: { data: ClubData; profile: Profile; perform: Perform; busy: boolean; onConfigure?: () => void }) {
  const admin = profile.roles.includes('admin'), treasurer = profile.roles.includes('tesorero')
  const [showEnded, setShowEnded] = useState(false), [editing, setEditing] = useState<Rental | null>(null)
  const rentals = data.rentals.filter(r => showEnded || r.active)
  return <><PageHeading eyebrow="Profesor y uso del espacio" title="Acuerdo de la actividad" description="El responsable, los horarios y el alquiler se configuran junto con la actividad." action={admin && onConfigure && <button className="button primary" onClick={onConfigure}>Configurar actividad y acuerdo</button>} />
    <div className="toolbar"><label className="checkbox"><input type="checkbox" checked={showEnded} onChange={e => setShowEnded(e.target.checked)} /> Incluir acuerdos finalizados</label></div>
    <div className="activity-grid">{rentals.map(r => <article className="panel rental-card" key={r.id}><div className="flex-between"><Building2 size={24} /><Badge tone={r.active ? 'green' : 'neutral'}>{r.active ? 'Acuerdo activo' : 'Finalizado'}</Badge></div><h2>{data.activities.find(a => a.id === r.activity_id)?.name}</h2><p><strong>{r.contact_name || data.instructors?.find(i => i.id === r.instructor_id)?.display_name || 'Profesor responsable'}</strong></p><p>{r.space_name}</p><ScheduleView slots={data.activities.find(a => a.id === r.activity_id && a.schedule_label === r.schedule_label)?.schedule_slots} legacy={r.schedule_label} compact /><div className="rental-amount"><Wallet size={18} /><strong>{r.amount_cents === null ? 'Importe por definir' : formatMoney(r.amount_cents)}</strong></div><p>{r.basis}</p>{admin && <a className="button" href={`#actividades/${encodeURIComponent(r.activity_id)}`}>Ir a la actividad</a>}{treasurer && !admin && <button className="button" onClick={() => setEditing(r)}>Editar acuerdo</button>}</article>)}</div>
    {!rentals.length && <div className="panel"><Empty>No hay acuerdos para mostrar. Administración puede completarlos desde la configuración de la actividad externa.</Empty></div>}
    <p className="form-note">El registro de cobros y el control de disponibilidad del espacio quedan pendientes de la etapa de caja y reservas.</p>
    {editing && <ActivityEditor initial={data.activities.find(a => a.id === editing.activity_id)!} rental={editing} data={data} profile={profile} perform={perform} busy={busy} agreementOnly close={() => setEditing(null)} />}
  </>
}
