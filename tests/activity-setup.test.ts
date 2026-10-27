import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { initialDemo, demoProfiles, scopeDemo } from '../src/data/demo.ts'
import { saveActivitySetupState } from '../src/domain/activity-setup.ts'
import type { Activity, Rental } from '../src/domain/types.ts'

const activity: Activity = { id: 'new-activity', name: 'Danza', status: 'activa', management: 'externa', description: 'Clases', color: '#1360b3', schedule_label: 'Lunes 18 a 19 hs' }
const agreement: Rental = { id: 'new-agreement', activity_id: activity.id, instructor_id: null, contact_name: 'Profesora nueva', space_name: 'Salón', schedule_label: activity.schedule_label!, amount_cents: 5000000, basis: 'Por mes', active: true }

describe('configuración unificada de actividades', () => {
  it('crea actividad externa y acuerdo juntos sin exigir cuenta de usuario', () => {
    const state = saveActivitySetupState(initialDemo(), { activity, agreement })
    assert.equal(state.activities.at(-1)?.schedule_label, 'Lunes 18 a 19 hs')
    assert.equal(state.rentals.at(-1)?.activity_id, activity.id)
    assert.equal(state.rentals.at(-1)?.instructor_id, null)
  })
  it('la formativa del club solo necesita los datos comunes', () => {
    const state = saveActivitySetupState(initialDemo(), { activity: { ...activity, management: 'club' }, agreement: null })
    assert.equal(state.activities.at(-1)?.management, 'club')
    assert.equal(state.rentals.length, initialDemo().rentals.length)
  })
  it('un acuerdo incompleto no deja una actividad creada a medias', () => {
    const original = initialDemo(), snapshot = structuredClone(original)
    for (const rental of [null, { ...agreement, contact_name: '' }, { ...agreement, activity_id: 'otro' }, { ...agreement, amount_cents: -1 }, { ...agreement, schedule_label: 'Otro horario' }]) assert.throws(() => saveActivitySetupState(original, { activity, agreement: rental }))
    assert.deepEqual(original, snapshot)
  })
  it('editar el acuerdo mantiene su identificador y los acuerdos históricos', () => {
    const state = saveActivitySetupState(initialDemo(), { activity, agreement })
    const changed = saveActivitySetupState(state, { activity: { ...activity, name: 'Danza artística' }, agreement: { ...agreement, amount_cents: 6000000 } })
    assert.equal(changed.rentals.filter(r => r.id === agreement.id).length, 1)
    assert.equal(changed.rentals.find(r => r.id === agreement.id)?.amount_cents, 6000000)
    assert.ok(changed.rentals.some(r => r.id === 'r1'))
  })
  it('pasar a formativa finaliza acuerdos activos y conserva sus importes e historial', () => {
    const state = saveActivitySetupState(initialDemo(), { activity, agreement })
    const changed = saveActivitySetupState(state, { activity: { ...activity, management: 'club' }, agreement: null })
    assert.equal(changed.rentals.find(r => r.id === agreement.id)?.active, false)
    assert.equal(changed.rentals.find(r => r.id === agreement.id)?.amount_cents, agreement.amount_cents)
    assert.equal(changed.rentals.find(r => r.id === 'r1')?.active, true)
  })
  it('profesores y familias no reciben importes de acuerdos ajenos', () => {
    const state = saveActivitySetupState(initialDemo(), { activity, agreement })
    for (const profile of [demoProfiles[2], demoProfiles[3], demoProfiles[4]]) assert.ok(!scopeDemo(state, profile).rentals.some(r => r.id === agreement.id))
    assert.equal(scopeDemo(state, demoProfiles[4]).activities.find(a => a.id === activity.id)?.schedule_label, activity.schedule_label)
  })
})
