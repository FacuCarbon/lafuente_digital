import type { Activity, ClubData, Rental } from './types.ts'
import { scheduleText, validateSlots } from './schedules.ts'

export interface ActivitySetup { activity: Activity; agreement: Rental | null }

export function validateActivitySetup(setup: ActivitySetup) {
  const { activity: a, agreement: r } = setup
  if (a.name.trim().length < 2 || a.name.length > 100 || !['club', 'externa'].includes(a.management) || !['activa', 'inscripciones_cerradas', 'pausada', 'finalizada'].includes(a.status) || !/^#[0-9a-f]{6}$/i.test(a.color) || a.description.length > 1000 || (a.schedule_label?.length ?? 0) > 10000) throw new Error('Revisá los datos de la actividad.')
  validateSlots(a.schedule_slots ?? [])
  if (a.schedule_slots?.length && a.schedule_label !== scheduleText(a.schedule_slots)) throw new Error('Revisá los bloques de horarios de la actividad.')
  if (a.management === 'externa') {
    if (!r || r.activity_id !== a.id || !r.contact_name?.trim() || !r.space_name.trim() || !r.schedule_label.trim() || !r.basis.trim()) throw new Error('Completá responsable, espacio, días y horarios y modalidad del alquiler.')
    if (r.schedule_label !== a.schedule_label || r.contact_name.length > 120 || r.space_name.length > 150 || r.schedule_label.length > 10000 || r.basis.length > 200) throw new Error('Revisá los datos y horarios del acuerdo.')
    if (r.amount_cents !== null && (!Number.isSafeInteger(r.amount_cents) || r.amount_cents < 0)) throw new Error('El importe no es válido.')
  } else if (r) throw new Error('Una actividad del club no necesita un nuevo acuerdo externo.')
}

export function saveActivitySetupState(state: ClubData, setup: ActivitySetup): ClubData {
  validateActivitySetup(setup)
  const { activity, agreement } = setup
  const existing = state.activities.find(a => a.id === activity.id)
  if (agreement && state.rentals.some(r => r.id === agreement.id && r.activity_id !== activity.id)) throw new Error('El acuerdo pertenece a otra actividad.')
  const rentals = existing?.management === 'externa' && activity.management === 'club'
    ? state.rentals.map(r => r.activity_id === activity.id && r.active ? { ...r, active: false } : r) : state.rentals
  return { ...state, activities: existing ? state.activities.map(a => a.id === activity.id ? activity : a) : [...state.activities, activity], rentals: agreement ? [...rentals.filter(r => r.id !== agreement.id), agreement] : rentals }
}
