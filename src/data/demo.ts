import type { ClubData, Profile } from '../domain/types.ts'

export const demoProfiles: Profile[] = [
  { id: 'admin', display_name: 'Administración', roles: ['admin'] },
  { id: 'tesoreria', display_name: 'Tesorería', roles: ['tesorero'] },
  { id: 'profe', display_name: 'Profesor formativo', roles: ['profe'] },
  { id: 'externo', display_name: 'Profesora externa', roles: ['profe'], externalActivities: ['patin'] },
  { id: 'tutor', display_name: 'Familia de ejemplo', roles: ['tutor'] },
]
export function initialDemo(): ClubData {
  return {
    club_address: 'Dr. A Melo 3951, Remedios de Escalada.',
    instructors: [{ id: 'externo', display_name: 'Profesora externa', activity_id: 'patin' }],
    activities: [
      { id: 'futbol', name: 'Fútbol formativo', management: 'club', status: 'activa', description: 'Crecer jugando, aprender en equipo.', color: '#1360b3' },
      { id: 'patin', name: 'Patín artístico', management: 'externa', status: 'activa', description: 'Equilibrio, movimiento y expresión.', color: '#8c4d6b' },
      { id: 'taekwondo', name: 'Taekwon-Do ITF', management: 'externa', status: 'activa', description: 'Disciplina y confianza en cada encuentro.', color: '#244b85' },
      { id: 'gimnasio', name: 'Gimnasio deportivo', management: 'externa', status: 'inscripciones_cerradas', description: 'Un espacio para mantenerse en movimiento.', color: '#a43532' },
    ],
    people: [
      { id: 'p1', first_name: 'Mateo', last_name: 'Ejemplo', birth_date: '2015-04-12', validation_status: 'validada', created_at: '2026-03-01T12:00:00Z' },
      { id: 'p2', first_name: 'Valentina', last_name: 'Ejemplo', birth_date: '2016-08-22', validation_status: 'validada', created_at: '2026-03-02T12:00:00Z' },
      { id: 'p3', first_name: 'Joaquín', last_name: 'Muestra', birth_date: '2015-09-03', validation_status: 'pendiente', created_at: '2026-10-20T12:00:00Z' },
      { id: 'p4', first_name: 'Emma', last_name: 'Muestra', birth_date: '2014-02-17', validation_status: 'validada', created_at: '2026-04-01T12:00:00Z' },
    ],
    enrollments: [
      { id: 'e1', person_id: 'p1', activity_id: 'futbol', start_date: '2026-03-01', end_date: null, status: 'activa' },
      { id: 'e2', person_id: 'p2', activity_id: 'futbol', start_date: '2026-03-01', end_date: null, status: 'activa' },
      { id: 'e3', person_id: 'p3', activity_id: 'futbol', start_date: '2026-10-20', end_date: null, status: 'pendiente' },
      { id: 'e4', person_id: 'p4', activity_id: 'patin', start_date: '2026-04-01', end_date: null, status: 'activa' },
    ],
    groups: [
      { id: 'g1', activity_id: 'futbol', season: 2026, name: 'Formativo · 2015 / 2016', birth_years: [2015, 2016] },
      { id: 'g2', activity_id: 'patin', season: 2026, name: 'Patín · Inicial', birth_years: [] },
    ],
    members: [{ group_id: 'g1', enrollment_id: 'e1' }, { group_id: 'g1', enrollment_id: 'e2' }, { group_id: 'g2', enrollment_id: 'e4' }],
    attendance: [],
    matches: [
      { id: 'm1', group_id: 'g1', opponent: 'Club visitante (ejemplo)', venue: 'local', scheduled_at: '2026-10-31T13:00:00Z', status: 'programado', home_score: null, away_score: null, result_status: 'sin_cargar' },
      { id: 'm2', group_id: 'g1', opponent: 'Club rival (ejemplo)', venue: 'visitante', scheduled_at: '2026-10-24T13:00:00Z', status: 'finalizado', home_score: 2, away_score: 3, result_status: 'confirmado' },
    ],
    rentals: [{ id: 'r1', instructor_id: 'externo', activity_id: 'patin', space_name: 'Salón principal', schedule_label: 'Martes y jueves · 17:00 a 19:00', amount_cents: null, basis: 'Acuerdo pendiente de configurar', active: true }],
  }
}

export function scopeDemo(data: ClubData, profile: Profile): ClubData {
  if (profile.roles.includes('admin')) return data
  const finance = profile.roles.some(r => ['tesorero', 'cobranza'].includes(r))
  const activityIds = profile.id === 'externo' ? ['patin'] : profile.id === 'profe' ? ['futbol'] : []
  const enrollments = data.enrollments.filter(e => finance || activityIds.includes(e.activity_id) || (profile.id === 'tutor' && ['p1', 'p2'].includes(e.person_id)))
  const peopleIds = new Set(enrollments.map(e => e.person_id))
  const groups = data.groups.filter(g => activityIds.includes(g.activity_id) || (profile.id === 'tutor' && data.members.some(m => m.group_id === g.id && enrollments.some(e => e.id === m.enrollment_id))))
  return { ...data, enrollments, people: data.people.filter(p => peopleIds.has(p.id)), groups,
    members: data.members.filter(m => groups.some(g => g.id === m.group_id)),
    attendance: data.attendance.filter(a => groups.some(g => g.id === a.group_id) && enrollments.some(e => e.id === a.enrollment_id)),
    matches: data.matches.filter(m => groups.some(g => g.id === m.group_id) || Boolean(m.activity_id && enrollments.some(e => e.activity_id === m.activity_id) && !finance)),
    instructors: profile.roles.includes('tesorero') ? data.instructors : [],
    rentals: data.rentals.filter(r => finance || r.instructor_id === profile.id),
  }
}
