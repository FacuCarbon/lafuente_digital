import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { initialDemo, scopeDemo, demoProfiles } from '../src/data/demo.ts'
import { announcement, buildJornada, registrationState, saveJornadaState, type JornadaInput } from '../src/domain/workflows.ts'

const input = { first_name: ' Ana ', last_name: ' Prueba ', birth_date: '2015-01-01', activity_id: 'futbol', start_date: '2026-10-27' }
const jornada: JornadaInput = { activity_id: 'futbol', opponent: 'River Rojo', series: 'Rojo', venue: 'local', date: '2026-10-31', location_name: 'Club La Fuente', address: 'Dr. A Melo 3951, Remedios de Escalada.', categories: [{ name: '2013 / 2014', time: '08:50' }, { name: '2015 / 2016', time: '09:40' }, { name: '2017 / 2018', time: '10:30' }, { name: '2019 / 2020', time: '11:20' }] }

describe('inscripción en una operación', () => {
  it('admin valida y activa directamente, con grupo opcional', () => {
    const state = registrationState(initialDemo(), { ...input, group_id: 'g1' }, true, 'new-person', 'new-enrollment')
    assert.equal(state.people.at(-1)?.validation_status, 'validada')
    assert.equal(state.people.at(-1)?.first_name, 'Ana')
    assert.equal(state.enrollments.at(-1)?.status, 'activa')
    assert.deepEqual(state.members.at(-1), { group_id: 'g1', enrollment_id: 'new-enrollment' })
  })
  it('externo mantiene revisión y no asigna grupos mientras está pendiente', () => {
    const state = registrationState(initialDemo(), { ...input, activity_id: 'patin' }, false)
    assert.equal(state.people.at(-1)?.validation_status, 'pendiente')
    assert.equal(state.enrollments.at(-1)?.status, 'pendiente')
    assert.throws(() => registrationState(initialDemo(), { ...input, group_id: 'g1' }, false))
  })
  it('rechaza actividad cerrada y grupos de otra actividad sin mutar el estado', () => {
    const state = initialDemo(), snapshot = structuredClone(state)
    assert.throws(() => registrationState(state, { ...input, activity_id: 'gimnasio' }, true))
    assert.throws(() => registrationState(state, { ...input, group_id: 'g2' }, true))
    assert.deepEqual(state, snapshot)
  })
})

describe('convocatoria por tira y jornada', () => {
  it('agenda cuatro categorías sin depender de grupos de entrenamiento', () => {
    const rows = buildJornada(jornada)
    assert.equal(rows.length, 4)
    assert.equal(new Set(rows.map(m => m.jornada_id)).size, 1)
    assert.equal(new Set(rows.map(m => m.id)).size, 4)
    assert.equal(rows[0].scheduled_at, '2026-10-31T11:50:00.000Z')
    assert.ok(rows.every(m => m.group_id === null && m.home_score === null && m.address === jornada.address))
  })
  it('permite locales en cancha alternativa y visitantes con dirección propia', () => {
    const rows = buildJornada({ ...jornada, location_name: 'Club San Martín', address: 'Barragán 4601, Remedios de Escalada.' })
    assert.equal(rows[0].venue, 'local')
    assert.match(announcement(rows, initialDemo()), /Club San Martín/)
    const visitor = buildJornada({ ...jornada, venue: 'visitante', address: 'Timote 3401, Remedios de Escalada.' })
    assert.match(announcement(visitor, initialDemo()), /VISITANTES/)
    assert.match(announcement(visitor, initialDemo()), /Timote 3401/)
  })
  it('rechaza jornadas incompletas, fechas imposibles y categorías duplicadas', () => {
    for (const override of [{ address: '' }, { date: '2026-02-30' }, { categories: [] }, { categories: [{ name: '2015', time: '25:00' }] }, { categories: [{ name: '2015', time: '09:00' }, { name: ' 2015 ', time: '10:00' }] }]) {
      assert.throws(() => buildJornada({ ...jornada, ...override }))
    }
  })
  it('genera una convocatoria con todos los horarios y mapa', () => {
    const text = announcement(buildJornada(jornada), initialDemo())
    for (const expected of ['Tira Rojo', 'River Rojo', '08:50', '09:40', '10:30', '11:20', jornada.address, 'maps/search']) assert.ok(text.includes(expected), expected)
  })
  it('familia y profesor ven jornadas de su actividad, externo no ve fútbol', () => {
    const state = initialDemo(); state.matches.push(...buildJornada(jornada))
    assert.equal(scopeDemo(state, demoProfiles[2]).matches.filter(m => m.jornada_id).length, 4)
    assert.equal(scopeDemo(state, demoProfiles[4]).matches.filter(m => m.jornada_id).length, 4)
    assert.equal(scopeDemo(state, demoProfiles[3]).matches.filter(m => m.jornada_id).length, 0)
  })
  it('editar dirección y horarios conserva resultados, identificadores y grupos anteriores', () => {
    const state = initialDemo(), original = state.matches.find(m => m.home_score !== null)!
    const group = state.groups.find(g => g.id === original.group_id)!
    const rows = buildJornada({ ...jornada, opponent: original.opponent, series: '', venue: original.venue, categories: [{ name: group.name, time: '10:00' }], address: 'Dirección corregida' }, original.id)
    const updated = saveJornadaState(state, rows, [original]).matches.find(m => m.id === original.id)!
    assert.equal(updated.address, 'Dirección corregida')
    assert.equal(updated.group_id, original.group_id)
    assert.equal(updated.home_score, original.home_score)
    assert.equal(updated.away_score, original.away_score)
    assert.equal(updated.result_status, original.result_status)
    assert.throws(() => saveJornadaState(state, rows.map(m => ({ ...m, venue: 'local' })), [original]))
    assert.equal(state.matches.find(m => m.id === original.id)?.address, undefined)
  })
  it('repetir la estructura crea otra jornada con resultados vacíos', () => {
    const state = initialDemo(), first = buildJornada(jornada)
    first[0] = { ...first[0], home_score: 1, away_score: 0, result_status: 'confirmado', status: 'finalizado' }
    state.matches.push(...first)
    const repeated = buildJornada({ ...jornada, date: '2026-11-07', opponent: 'Nuevo rival' })
    const updated = saveJornadaState(state, repeated)
    assert.notEqual(first[0].jornada_id, repeated[0].jornada_id)
    assert.ok(repeated.every(m => m.home_score === null && m.result_status === 'sin_cargar'))
    assert.equal(updated.matches.find(m => m.id === first[0].id)?.home_score, 1)
  })
})
