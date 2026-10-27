import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Activity, TrainingSlot } from '../src/domain/types.ts'
import { scheduleGroups, scheduleText, validateSlots } from '../src/domain/schedules.ts'
import { saveActivitySetupState } from '../src/domain/activity-setup.ts'
import { initialDemo } from '../src/data/demo.ts'

export const footballSlots: TrainingSlot[] = [
  { id: 's1', label: '2019 / 2020', days: [2,5], start: '18:00', end: '' },
  { id: 's2', label: '2017 / 2018', days: [2,5], start: '19:00', end: '' },
  { id: 's3', label: '2015 / 2016', days: [2,5], start: '20:00', end: '' },
  { id: 's4', label: '2013 / 2014', days: [2,5], start: '21:00', end: '' },
]
describe('horarios por categoría y días', () => {
  it('reúne los cuatro grupos de martes y viernes, ordenados por hora', () => {
    validateSlots(footballSlots)
    const groups = scheduleGroups([...footballSlots].reverse())
    assert.equal(groups.length,1)
    assert.deepEqual(groups[0].days,[2,5])
    assert.deepEqual(groups[0].slots.map(s=>s.start),['18:00','19:00','20:00','21:00'])
    assert.match(scheduleText(footballSlots),/2019 \/ 2020 · Martes y Viernes · 18:00 hs/)
  })
  it('permite otros días para la misma categoría sin imponer hora de finalización', () => {
    const slots = [...footballSlots,{ id:'s5',label:'2019 / 2020',days:[3],start:'18:30',end:'19:30' }]
    validateSlots(slots)
    assert.equal(scheduleGroups(slots).length,2)
    assert.match(scheduleText(slots),/Miércoles · 18:30 a 19:30 hs/)
  })
  it('rechaza bloques incompletos, días inválidos y duración invertida', () => {
    for(const changes of [{label:''},{days:[]},{days:[0]},{days:[2,2]},{start:'25:00'},{start:''},{end:'17:00'},{end:'18:00'}]) assert.throws(()=>validateSlots([{...footballSlots[0],...changes}]))
    assert.throws(()=>validateSlots([...footballSlots,{...footballSlots[0],id:'repeated'}]))
    assert.throws(()=>validateSlots(Array.from({length:41},(_,i)=>({...footballSlots[0],id:String(i),label:String(i)}))))
  })
  it('guarda bloques con la actividad y no crea grupos ni inscripciones automáticamente', () => {
    const original=initialDemo(), activity: Activity={...original.activities[0],schedule_slots:footballSlots,schedule_label:scheduleText(footballSlots)}
    const changed=saveActivitySetupState(original,{activity,agreement:null})
    assert.deepEqual(changed.activities[0].schedule_slots,footballSlots)
    assert.deepEqual(changed.groups,original.groups)
    assert.deepEqual(changed.enrollments,original.enrollments)
    assert.equal(original.activities[0].schedule_slots,undefined)
  })
  it('sincroniza el resumen de la externa y soporta más de 300 caracteres', () => {
    const original=initialDemo(), slots=footballSlots.map(s=>({...s,label:`Grupo de entrenamiento con nombre largo ${s.label}`}))
    const summary=scheduleText(slots)
    assert.ok(summary.length>300)
    const activity:Activity={...original.activities[1],schedule_slots:slots,schedule_label:summary}
    const agreement={...original.rentals[0],contact_name:'Profesora',schedule_label:summary}
    assert.doesNotThrow(()=>saveActivitySetupState(original,{activity,agreement}))
    assert.throws(()=>saveActivitySetupState(original,{activity:{...activity,schedule_label:'Otro texto'},agreement}))
  })
})
