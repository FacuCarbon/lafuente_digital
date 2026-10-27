import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { planFees, type FeePlan } from '../src/domain/fees.ts'
const base: FeePlan = { year:2026,billableMonths:[3,4,5,6,7,8,9,10,11,12],decemberSplit:[6,8],rates:[{month:1,amountCents:3000000}],joinedMonth:3,siblingDiscountPercent:0,scholarshipPercent:0 }
const total = (plan:FeePlan,month:number) => planFees(plan).filter(c=>c.month===month).reduce((s,c)=>s+c.amountCents,0)
describe('liquidación de fútbol formativo',()=>{
  it('diez meses cobrables, sin duplicar diciembre',()=>{
    assert.equal(total(base,1),0);assert.equal(total(base,2),0)
    assert.equal(total(base,6),4500000);assert.equal(total(base,8),4500000)
    assert.equal(total(base,12),0)
    assert.equal(planFees(base).reduce((s,c)=>s+c.amountCents,0),30000000)
  })
  it('vacaciones de invierno conservan cuota completa',()=>assert.equal(total(base,7),3000000))
  it('aumento en julio no altera diciembre fijado',()=>{
    const p={...base,rates:[...base.rates,{month:7,amountCents:3600000}]}
    assert.equal(total(p,8),5100000)
    assert.equal(planFees(p).filter(c=>c.kind==='diciembre').reduce((s,c)=>s+c.amountCents,0),3000000)
  })
  it('aumento previo al reparto sí fija nueva referencia',()=>assert.equal(total({...base,rates:[...base.rates,{month:5,amountCents:3600000}]},6),5400000))
  for(const joinedMonth of [7,9])it(`alta mes ${joinedMonth} paga normal hasta diciembre`,()=>{
    const p={...base,joinedMonth};assert.equal(total(p,12),3000000)
    assert.ok(planFees(p).every(c=>c.kind!=='diciembre'&&c.month>=joinedMonth))
  })
  it('baja antes de agosto no genera segunda parte',()=>{
    const charges=planFees({...base,leftMonth:7})
    assert.equal(charges.filter(c=>c.kind==='diciembre').length,1)
    assert.ok(charges.every(c=>c.month<=7))
  })
  it('beneficio más favorable también en diciembre',()=>{
    const p={...base,siblingDiscountPercent:20,scholarshipPercent:50}
    assert.equal(total(p,4),1500000);assert.equal(total(p,6),2250000)
  })
  it('beca total deja monto cero',()=>assert.ok(planFees({...base,scholarshipPercent:100}).every(c=>c.amountCents===0)))
  it('reparto compensa centavos',()=>assert.deepEqual(planFees({...base,rates:[{month:1,amountCents:3000001}]}).filter(c=>c.kind==='diciembre').map(c=>c.amountCents),[1500000,1500001]))
  it('mes reducido es importe final y requiere motivo',()=>{
    const p={...base,firstMonthOverrideCents:1000000,firstMonthReason:'Ingreso día 20',siblingDiscountPercent:20}
    assert.equal(total(p,3),1000000);assert.throws(()=>planFees({...p,firstMonthReason:''}))
  })
  it('rechaza calendario, tarifas y beneficios inválidos',()=>{
    assert.throws(()=>planFees({...base,decemberSplit:[1,8]}));assert.throws(()=>planFees({...base,decemberSplit:[8,8]}))
    assert.throws(()=>planFees({...base,joinedMonth:9,leftMonth:5}));assert.throws(()=>planFees({...base,scholarshipPercent:101}))
    assert.throws(()=>planFees({...base,rates:[{month:1,amountCents:-1}]}))
  })
})
