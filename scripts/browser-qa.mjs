import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const baseURL = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5173'
const executablePath = process.env.BROWSER_EXECUTABLE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const browser = await chromium.launch({ executablePath, headless: true })
await mkdir('test-results', { recursive: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, locale: 'es-AR' })
const page = await context.newPage(), errors = []
page.on('pageerror', error => errors.push(error.message))
const goto = async hash => { await page.goto(`${baseURL}/#${hash}`); await page.getByRole('heading',{ level:1 }).first().waitFor() }
async function checkReadableLayout(label) {
  const issues = await page.evaluate(() => {
    const issues = []
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('desbordamiento horizontal')
    for (const node of document.querySelectorAll('body *')) {
      if (!(node instanceof HTMLElement) || !node.getClientRects().length || getComputedStyle(node).visibility === 'hidden') continue
      const directText = [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim())
      const minimumText = innerWidth >= 1025 ? 14 : 16
      if (directText && parseFloat(getComputedStyle(node).fontSize) < minimumText) issues.push(`texto pequeño: ${node.className}`)
      if (node.matches('button,select,input:not([type=checkbox]):not([type=hidden])') && node.getBoundingClientRect().height < 44) issues.push(`control bajo: ${node.getAttribute('aria-label') || node.textContent}`)
    }
    return issues
  })
  assert.deepEqual(issues, [], label)
}
try {
  await goto('inicio')
  await page.getByRole('button',{name:'Restablecer',exact:true}).click()
  await page.screenshot({ path:'test-results/inicio-desktop.png',fullPage:true })
  await page.getByRole('link',{name:'Personas',exact:true}).click()
  await page.getByRole('button',{name:'Nueva inscripción',exact:true}).click()
  await page.getByLabel('Nombre',{exact:true}).fill('Prueba')
  await page.getByLabel('Apellido',{exact:true}).fill('Navegador')
  await page.getByLabel('Fecha de nacimiento').fill('2016-06-01')
  await page.getByLabel('Fecha de ingreso').fill('2026-10-27')
  await page.getByLabel('Grupo de entrenamiento (opcional)').selectOption('g1')
  await page.getByRole('button',{name:'Registrar inscripción'}).click()
  await page.getByRole('dialog').waitFor({ state:'hidden' })
  const row=page.getByRole('row').filter({hasText:'Prueba Navegador'})
  assert.equal(await row.getByRole('button',{name:'Validar ficha'}).count(),0)
  await row.getByText('Validada',{exact:true}).waitFor()
  await page.reload(); await row.getByText('Validada',{exact:true}).waitFor()
  await page.getByRole('link',{name:'Actividades',exact:true}).click()
  await page.getByRole('button',{name:'Gestionar actividad'}).first().click()
  await page.getByRole('button',{name:'Grupos y asistencia',exact:true}).click()
  await page.getByText('Prueba Navegador',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Marcar presente'}).first().click()
  await page.getByRole('button',{name:'Presente',exact:true}).first().waitFor()
  await goto('partidos')
  await page.getByRole('button',{name:'Agendar jornada',exact:true}).click()
  let dialog=page.getByRole('dialog')
  await dialog.getByLabel('Rival',{exact:true}).fill('River Rojo QA')
  await dialog.getByLabel('Tira / equipo (opcional)').fill('Rojo')
  await dialog.getByLabel('Fecha de la jornada').fill('2026-11-07')
  assert.equal(await dialog.getByLabel('Dirección completa').inputValue(),'Dr. A Melo 3951, Remedios de Escalada.')
  for(let i=1;i<=4;i++) {
    if(i>1)await dialog.getByRole('button',{name:'Agregar categoría'}).click()
    await dialog.getByLabel(`Categoría ${i}`,{exact:true}).fill(['2013 / 2014','2015 / 2016','2017 / 2018','2019 / 2020'][i-1])
    await dialog.getByLabel('Horario',{exact:true}).nth(i-1).fill(['08:50','09:40','10:30','11:20'][i-1])
  }
  await dialog.getByRole('button',{name:'Guardar jornada completa'}).click()
  await dialog.waitFor({state:'hidden'})
  const eventCard=page.locator('.jornada-card').filter({hasText:'River Rojo QA'})
  assert.equal(await eventCard.locator('.roster-row').count(),4)
  await eventCard.getByRole('button',{name:'Ver convocatoria'}).click()
  await page.getByRole('dialog').getByText(/Mapa:/).waitFor()
  await page.getByRole('button',{name:'Cerrar ventana'}).click()
  await eventCard.getByRole('button',{name:'Resultado',exact:true}).first().click()
  await page.getByLabel('Local · La Fuente',{exact:true}).fill('0')
  await page.getByLabel('Visitante · River Rojo QA',{exact:true}).fill('0')
  await page.getByLabel('Confirmar para el historial del club').check()
  await page.getByRole('button',{name:'Guardar resultado'}).click()
  await page.getByRole('dialog').waitFor({state:'hidden'})
  assert.equal(await page.getByText('Confirmado',{exact:true}).count(),2)
  await eventCard.getByRole('button',{name:'Repetir categorías y horarios'}).click()
  dialog=page.getByRole('dialog')
  assert.equal(await dialog.getByLabel('Rival',{exact:true}).inputValue(),'')
  assert.equal(await dialog.getByLabel('Horario',{exact:true}).count(),4)
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
  assert.equal(await page.getByRole('link',{name:'Alquileres',exact:true}).count(),0)
  await page.getByRole('link',{name:'Actividades',exact:true}).click()
  await page.getByRole('button',{name:'Configurar Fútbol formativo',exact:true}).click()
  dialog=page.getByRole('dialog')
  for(let i=0;i<4;i++) {
    await dialog.getByRole('button',{name:'Agregar categoría / horario'}).click()
    await dialog.getByLabel('Categoría / grupo',{exact:true}).nth(i).fill(['2019 / 2020','2017 / 2018','2015 / 2016','2013 / 2014'][i])
    if(i===0) {
      await dialog.getByLabel('Martes',{exact:true}).first().check()
      await dialog.getByLabel('Viernes',{exact:true}).first().check()
    }
    await dialog.getByLabel('Desde',{exact:true}).nth(i).fill(`${18+i}:00`)
  }
  await dialog.getByRole('button',{name:'Guardar actividad',exact:true}).click()
  await dialog.waitFor({state:'hidden'})
  await page.locator('.activity-card').filter({hasText:'Fútbol formativo'}).getByRole('button',{name:'Gestionar actividad'}).click()
  await page.getByRole('button',{name:'Horarios',exact:true}).click()
  assert.equal(await page.locator('.schedule-panel .schedule-line').count(),4)
  await page.getByRole('heading',{name:'Martes y Viernes',exact:true}).waitFor()
  await page.reload()
  await page.getByRole('button',{name:'Horarios',exact:true}).click()
  assert.equal(await page.locator('.schedule-panel .schedule-line').count(),4)
  await page.getByRole('link',{name:'Actividades',exact:true}).click()
  await page.getByRole('button',{name:'Nueva actividad',exact:true}).click()
  dialog=page.getByRole('dialog')
  await dialog.getByLabel('Nombre',{exact:true}).fill('Danza QA')
  assert.equal(await dialog.getByLabel('Profesor / responsable').count(),0)
  await dialog.getByLabel('Modalidad',{exact:true}).selectOption('externa')
  await dialog.getByLabel('Profesor / responsable').fill('Profesora QA')
  await dialog.getByLabel('Espacio utilizado').fill('Salón QA')
  await dialog.getByRole('button',{name:'Agregar categoría / horario'}).click()
  await dialog.getByLabel('Categoría / grupo',{exact:true}).fill('Inicial')
  await dialog.getByLabel('Lunes',{exact:true}).check()
  await dialog.getByLabel('Desde',{exact:true}).fill('18:00')
  await dialog.getByLabel('Hasta (opcional)',{exact:true}).fill('19:00')
  await dialog.getByLabel('Importe del alquiler ($, opcional)').fill('50000')
  await dialog.getByRole('button',{name:'Guardar actividad'}).click()
  await dialog.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'Configurar Danza QA',exact:true}).click()
  dialog=page.getByRole('dialog')
  await dialog.getByLabel('Importe del alquiler ($, opcional)').fill('60000')
  await dialog.getByRole('button',{name:'Guardar actividad'}).click()
  await dialog.waitFor({state:'hidden'})
  await page.locator('.activity-card').filter({hasText:'Danza QA'}).getByRole('button',{name:'Gestionar actividad'}).click()
  await page.getByRole('button',{name:'Profesor y acuerdo',exact:true}).click()
  const rentalCard=page.locator('.rental-card').filter({hasText:'Salón QA'})
  await rentalCard.getByText(/60\.000/).waitFor()
  await page.getByRole('link',{name:'Tesorería',exact:true}).click()
  await page.getByLabel('Nueva cuota mensual').fill('36000')
  await page.getByText(/51\.000/,{exact:false}).first().waitFor()
  await page.getByRole('combobox',{name:'Perfil de demostración'}).selectOption('profe')
  await page.getByRole('heading',{name:'Hola, profe',exact:false}).waitFor()
  assert.equal(await page.getByRole('link',{name:'Tesorería',exact:true}).count(),0)
  await page.goto(`${baseURL}/#tesoreria`)
  await page.getByRole('heading',{name:'Hola, profe',exact:false}).waitFor()
  assert.equal(await page.getByRole('heading',{name:'Tesorería',exact:true}).count(),0)
  await page.getByRole('combobox',{name:'Perfil de demostración'}).selectOption('externo')
  await page.getByRole('link',{name:'Personas',exact:true}).click()
  await page.getByText('Emma Muestra',{exact:true}).waitFor()
  assert.equal(await page.getByText('Mateo Ejemplo',{exact:true}).count(),0)
  await page.getByRole('combobox',{name:'Perfil de demostración'}).selectOption('tutor')
  assert.equal(await page.getByRole('button',{name:'Nueva inscripción',exact:true}).count(),0)
  await page.getByRole('combobox',{name:'Perfil de demostración'}).selectOption('admin')
  for(const width of [320,360,390,768,1440]) {
    await page.setViewportSize({width,height:900})
    for(const route of ['inicio','personas','actividades','grupos','partidos','tesoreria','alquileres']) {
      await goto(route)
      await checkReadableLayout(`${route} @ ${width}`)
      if (route === 'personas' && width <= 760) {
        assert.equal(await page.locator('.people-table tr').last().evaluate(node => getComputedStyle(node).display), 'grid')
      }
    }
    if(width===390) {
      await goto('actividades')
      await page.getByRole('button',{name:'Configurar Fútbol formativo',exact:true}).click()
      await checkReadableLayout('Formulario de cuatro horarios @ 390')
      await page.screenshot({path:'test-results/horarios-mobile.png',fullPage:true})
      await page.getByRole('button',{name:'Cerrar ventana'}).click()
      await goto('inicio');await page.getByRole('button',{name:'Abrir menú'}).click()
      await page.getByRole('link',{name:'Personas',exact:true}).click()
      await page.getByRole('heading',{name:'Personas e inscripciones'}).waitFor()
      await goto('inicio');await page.screenshot({path:'test-results/inicio-mobile.png',fullPage:true})
    }
  }
  await page.setViewportSize({width:1280,height:1000})
  for (const route of ['inicio','personas','actividades','grupos','partidos','tesoreria','alquileres']) {
    await goto(route)
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    await checkReadableLayout(`Texto al 200%: ${route}`)
    await page.evaluate(() => { document.documentElement.style.fontSize = '' })
  }
  assert.deepEqual(errors,[])
  console.log('Browser QA passed: recorridos, 35 vistas entre 320–1440 px, controles táctiles, fuentes y texto al 200%.')
} finally { await browser.close() }
