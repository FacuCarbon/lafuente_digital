import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canFinance, canManage, canViewPage } from '../src/domain/permissions.ts'
import { initialDemo, scopeDemo, demoProfiles } from '../src/data/demo.ts'
describe('navegación y vistas de demostración',()=>{
  it('profesores y familias no tienen tesorería',()=>{
    assert.equal(canFinance(['profe']),false);assert.equal(canViewPage(['tutor'],'tesoreria'),false)
  })
  it('roles múltiples no conceden admin',()=>{
    assert.equal(canFinance(['profe','tesorero']),true);assert.equal(canManage(['profe','tesorero']),false)
  })
  it('externo solo ve alumnos y alquiler propios',()=>{
    const d=scopeDemo(initialDemo(),demoProfiles.find(p=>p.id==='externo')!)
    assert.deepEqual(d.people.map(p=>p.id),['p4']);assert.ok(d.enrollments.every(e=>e.activity_id==='patin'))
    assert.ok(d.rentals.every(r=>r.instructor_id==='externo'))
  })
  it('familia no recibe alquileres ni otras fichas',()=>{
    const d=scopeDemo(initialDemo(),demoProfiles.find(p=>p.id==='tutor')!)
    assert.deepEqual(d.people.map(p=>p.id),['p1','p2']);assert.equal(d.rentals.length,0)
  })
})
