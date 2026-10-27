import type { TrainingSlot } from './types.ts'

export const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export function daysLabel(days: number[]) { return [...days].sort((a,b) => a-b).map(d => weekDays[d-1]).join(' y ') }
export function validateSlots(slots: TrainingSlot[]) {
  if (!Array.isArray(slots) || slots.length > 40) throw new Error('Podés cargar hasta 40 bloques de horarios.')
  const seen = new Set<string>(), ids = new Set<string>()
  for (const s of slots) {
    if (!s.id || ids.has(s.id) || !s.label.trim() || s.label.length > 100 || !s.days.length || s.days.some(d => !Number.isInteger(d) || d < 1 || d > 7) || new Set(s.days).size !== s.days.length || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start) || s.end !== '' && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end) || s.end <= s.start)) throw new Error('Cada bloque necesita categoría o grupo, al menos un día y hora de inicio. La hora de fin, si se indica, debe ser posterior.')
    ids.add(s.id)
    for (const day of s.days) {
      const key = `${s.label.trim().toLocaleLowerCase('es')}:${day}:${s.start}`
      if (seen.has(key)) throw new Error('Hay horarios repetidos para la misma categoría o grupo.')
      seen.add(key)
    }
  }
}
export function scheduleText(slots: TrainingSlot[]) {
  return slots.map(s => `${s.label.trim()} · ${daysLabel(s.days)} · ${s.start}${s.end ? ` a ${s.end}` : ''} hs`).join('\n')
}
export function scheduleGroups(slots: TrainingSlot[]) {
  const groups = new Map<string, { days: number[]; slots: TrainingSlot[] }>()
  for (const s of slots) {
    const days = [...s.days].sort((a,b) => a-b), key = days.join(',')
    const group = groups.get(key) ?? { days, slots: [] }; group.slots.push(s); groups.set(key, group)
  }
  return [...groups.values()].sort((a,b) => a.days[0]-b.days[0]).map(g => ({ ...g, slots: [...g.slots].sort((a,b) => a.start.localeCompare(b.start) || a.label.localeCompare(b.label)) }))
}
