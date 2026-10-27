import { api } from "../lib/supabase";
import type { ActivitySetup } from '../domain/activity-setup';
import type {
  Attendance,
  ClubData,
  Match,
  Profile,
  Role,
  StudentInput,
  TrainingGroup,
  Rental,
} from "../domain/types";

export async function loadProfile(userId: string): Promise<Profile> {
  const [profiles, roles, assignments] = await Promise.all([
    api<{ id: string; display_name: string }[]>("profiles", {
      query: `select=id,display_name&id=eq.${encodeURIComponent(userId)}`,
    }),
    api<{ role: Role }[]>("user_roles", {
      query: `select=role&user_id=eq.${encodeURIComponent(userId)}`,
    }),
    api<{ activity_id: string; mode: string; start_date: string; end_date: string | null }[]>("instructor_assignments", {
      query: `select=activity_id,mode,start_date,end_date&user_id=eq.${encodeURIComponent(userId)}`,
    }),
  ]);
  if (!profiles[0] || !roles.length)
    throw new Error(
      "Tu cuenta todavía no tiene un perfil y permisos asignados. Contactá a administración.",
    );
  const today = new Date().toISOString().slice(0, 10);
  return { ...profiles[0], roles: roles.map((r) => r.role), externalActivities: assignments.filter(a => a.mode === 'externo' && a.start_date <= today && (!a.end_date || a.end_date >= today)).map(a => a.activity_id) };
}
export async function loadClub(): Promise<ClubData> {
  const tables = [
    "activities",
    "people",
    "enrollments",
    "training_groups",
    "group_members",
    "attendance",
    "matches",
    "rental_agreements",
    "club_settings",
  ] as const;
  const results = await Promise.all(
    tables.map((table) =>
      api<unknown[]>(table, { query: "select=*&limit=1000" }),
    ),
  );
  if (results.some((r) => r.length >= 1000))
    throw new Error(
      "La consulta alcanzó el límite inicial. Se necesita paginación antes de operar con este volumen.",
    );
  const [
    activities,
    people,
    enrollments,
    groups,
    members,
    attendance,
    matches,
    rentals,
    settings,
  ] = results;
  const instructors = await api<{ id: string; display_name: string; activity_id: string }[]>("rpc/rental_instructors", { method: "POST", body: {} });
  return {
    activities,
    people,
    enrollments,
    groups,
    members,
    attendance,
    matches,
    rentals,
    club_address: (settings[0] as { address?: string } | undefined)?.address ?? '',
    instructors,
  } as ClubData;
}
const rpc = (name: string, body: unknown) =>
  api<unknown>(`rpc/${name}`, { method: "POST", body });
export const live = {
  register: (input: StudentInput) => {
    const { group_id, ...student } = input;
    return group_id ? rpc('register_student_in_group', { ...student, group_id }) : rpc('register_student', student);
  },
  validate: (person: string) => rpc("validate_student", { person }),
  end: (enrollment: string, effective_date: string) =>
    rpc("end_enrollment", { enrollment, effective_date }),
  activitySetup: ({ activity, agreement }: ActivitySetup) => rpc('save_activity_setup', { activity, agreement }),
  group: (body: Omit<TrainingGroup, "id">) =>
    api("training_groups", { method: "POST", body }),
  members: (group_id: string, enrollment_ids: string[]) => rpc('add_group_members', { group_id, enrollment_ids }),
  jornada: (rows: Match[], original_ids?: string[]) => rpc('save_jornada', { rows, original_ids: original_ids ?? null }),
  clubAddress: (address: string) => api('club_settings', { method: 'PATCH', query: 'id=eq.1', body: { address } }),
  rental: (rental: Rental) => rpc('save_rental', { agreement: rental }),
  attendance: (row: Omit<Attendance, "id">, userId: string) =>
    api("attendance", {
      method: "POST",
      body: { ...row, recorded_by: userId },
      query: "on_conflict=group_id,enrollment_id,class_date",
      upsert: true,
    }),
  result: (
    match_id: string,
    home: number,
    away: number,
    confirm_result: boolean,
  ) => rpc("save_result", { match_id, home, away, confirm_result }),
};
