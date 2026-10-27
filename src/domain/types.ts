export type Role = 'admin' | 'tesorero' | 'cobranza' | 'profe' | 'tutor'
export type Page = 'inicio' | 'personas' | 'actividades' | 'grupos' | 'partidos' | 'tesoreria' | 'alquileres'
export type ActivityStatus = 'activa' | 'inscripciones_cerradas' | 'pausada' | 'finalizada'
export interface Profile { id: string; display_name: string; roles: Role[]; externalActivities?: string[] }
export interface TrainingSlot { id: string; label: string; days: number[]; start: string; end: string }
export interface Activity {
  id: string; name: string; management: 'club' | 'externa'; status: ActivityStatus
  description: string; color: string; schedule_label?: string; schedule_slots?: TrainingSlot[]
}
// La ficha deportiva no contiene becas, descuentos, cargos ni saldos.
export interface Person {
  id: string; first_name: string; last_name: string; birth_date: string
  validation_status: 'pendiente' | 'validada'; created_at: string
}
export interface Enrollment {
  id: string; person_id: string; activity_id: string; start_date: string
  end_date: string | null; status: 'pendiente' | 'activa' | 'pausada' | 'baja'
}
export interface TrainingGroup {
  id: string; activity_id: string; season: number; name: string; birth_years: number[]
}
export interface GroupMember { group_id: string; enrollment_id: string }
export interface Attendance {
  id: string; group_id: string; enrollment_id: string; class_date: string; present: boolean
}
export interface Match {
  id: string; group_id: string | null; opponent: string; venue: 'local' | 'visitante'
  jornada_id?: string; activity_id?: string; category?: string; series?: string; location_name?: string; address?: string
  scheduled_at: string; status: 'programado' | 'postergado' | 'finalizado' | 'anulado'
  home_score: number | null; away_score: number | null
  result_status: 'sin_cargar' | 'pendiente' | 'confirmado'
}
export interface Rental {
  id: string; instructor_id: string | null; activity_id: string; space_name: string; contact_name?: string
  schedule_label: string; amount_cents: number | null; basis: string; active: boolean
}
export interface ClubData {
  activities: Activity[]; people: Person[]; enrollments: Enrollment[]
  groups: TrainingGroup[]; members: GroupMember[]; attendance: Attendance[]
  matches: Match[]; rentals: Rental[]
  club_address?: string
  instructors?: { id: string; display_name: string; activity_id: string }[]
}
export type StudentInput = { first_name: string; last_name: string; birth_date: string; activity_id: string; start_date: string; group_id?: string }
