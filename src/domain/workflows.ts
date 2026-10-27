import type { ClubData, Match, StudentInput } from './types.ts'

export function registrationState(state: ClubData, input: StudentInput, admin: boolean, person: string = crypto.randomUUID(), enrollment: string = crypto.randomUUID()): ClubData {
  if (!state.activities.some(a => a.id === input.activity_id && a.status === 'activa')) throw new Error('La actividad no acepta inscripciones.')
  if (input.group_id && (!admin || !state.groups.some(g => g.id === input.group_id && g.activity_id === input.activity_id))) throw new Error('El grupo debe pertenecer a la actividad y asignarlo administración.')
  return { ...state,
    people: [...state.people, { id: person, first_name: input.first_name.trim(), last_name: input.last_name.trim(), birth_date: input.birth_date, validation_status: admin ? 'validada' : 'pendiente', created_at: new Date().toISOString() }],
    enrollments: [...state.enrollments, { id: enrollment, person_id: person, activity_id: input.activity_id, start_date: input.start_date, end_date: null, status: admin ? 'activa' : 'pendiente' }],
    members: input.group_id ? [...state.members, { group_id: input.group_id, enrollment_id: enrollment }] : state.members,
  }
}

export interface JornadaInput {
  activity_id: string; opponent: string; venue: 'local' | 'visitante'; date: string
  series: string; location_name: string; address: string
  categories: { name: string; time: string }[]
}

export function buildJornada(input: JornadaInput, jornadaId: string = crypto.randomUUID()): Match[] {
  if (!input.activity_id || !input.opponent.trim() || !input.address.trim() || !input.location_name.trim()) throw new Error('Completá actividad, rival, cancha y dirección.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Elegí la fecha de la jornada.')
  if (!input.categories.length || input.categories.length > 30) throw new Error('Agregá entre 1 y 30 categorías.')
  const names = input.categories.map(c => c.name.trim().toLocaleLowerCase('es'))
  if (new Set(names).size !== names.length) throw new Error('Hay categorías repetidas en la jornada.')
  return input.categories.map(c => {
    if (!c.name.trim() || c.name.trim().length > 100 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time)) throw new Error('Cada categoría necesita nombre y horario válidos.')
    // El club opera en Argentina: la fecha no depende de la zona del dispositivo.
    const scheduled_at = new Date(`${input.date}T${c.time}:00-03:00`).toISOString()
    if (new Date(scheduled_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }) !== input.date) throw new Error('La fecha no es válida.')
    return { id: crypto.randomUUID(), jornada_id: jornadaId, activity_id: input.activity_id, group_id: null, category: c.name.trim(), series: input.series.trim(), opponent: input.opponent.trim(), venue: input.venue, location_name: input.location_name.trim(), address: input.address.trim(), scheduled_at, status: 'programado', home_score: null, away_score: null, result_status: 'sin_cargar' }
  })
}

export function announcement(matches: Match[], data: ClubData): string {
  if (!matches.length) return ''
  const first = matches[0]
  const date = new Date(first.scheduled_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' })
  return [`LA FUENTE · ${data.activities.find(a => a.id === first.activity_id)?.name ?? 'Partidos'}`, first.series && `Tira ${first.series}`, `vs. ${first.opponent}`, date, first.venue === 'local' ? 'LOCALES' : 'VISITANTES', first.location_name, first.address || 'Dirección pendiente de completar', ...[...matches].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)).map(m => `${m.category ?? data.groups.find(g => g.id === m.group_id)?.name ?? 'Categoría'} · ${new Date(m.scheduled_at).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })} hs`), first.address && `Mapa: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(first.address)}`].filter(Boolean).join('\n')
}

export function saveJornadaState(state: ClubData, rows: Match[], originals?: Match[] | null): ClubData {
  if (!originals) return { ...state, matches: [...state.matches, ...rows] }
  if (originals.length !== rows.length || originals.some(m => !state.matches.some(current => current.id === m.id))) throw new Error('La jornada cambió. Volvé a cargarla.')
  const hasResults = originals.some(m => m.home_score !== null)
  for (let i = 0; i < rows.length; i++) {
    const old = state.matches.find(m => m.id === originals[i].id)!, next = rows[i]
    const category = old.category ?? state.groups.find(g => g.id === old.group_id)?.name
    if (hasResults && (next.opponent !== old.opponent || next.venue !== old.venue || next.category !== category || next.series !== (old.series ?? ''))) throw new Error('No se pueden cambiar equipos ni categorías con resultados cargados.')
  }
  return { ...state, matches: state.matches.map(m => {
    const i = originals.findIndex(old => old.id === m.id)
    return i < 0 ? m : { ...m, ...rows[i], id: m.id, group_id: m.group_id, home_score: m.home_score, away_score: m.away_score, status: m.status, result_status: m.result_status }
  }) }
}
