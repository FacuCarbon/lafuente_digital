// Revisión de renderizado sin navegador. No sustituye la comprobación visual.
import ts from 'typescript'
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import assert from 'node:assert/strict'

const root=process.cwd(), output=path.join(root,'test-results','render')
async function compile(directory) {
  for(const file of await readdir(directory,{withFileTypes:true})) {
    const source=path.join(directory,file.name)
    if(file.isDirectory()){await compile(source);continue}
    if(!/\.tsx?$/.test(file.name)||file.name==='main.tsx')continue
    const destination=path.join(output,path.relative(root,source).replace(/\.tsx?$/,'.js'))
    // Solo en esta copia de pruebas: sin variables ni conexión a servicios reales.
    const input=(await readFile(source,'utf8')).replace(/import\.meta\.env\.[A-Z_]+/g,'undefined')
    const compiled=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText
      .replace(/(from\s*['"])(\.[^'"]+)(['"])/g,(_,before,specifier,after)=>before+specifier.replace(/\.tsx?$/,'').replace(/(?<!\.js)$/,' .js').replace(' .js','.js')+after)
    await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,compiled)
  }
}
await compile(path.join(root,'src'))
globalThis.window={location:{hash:'#inicio'}}
globalThis.localStorage={getItem:()=>null}
const {default:App}=await import(pathToFileURL(path.join(output,'src/App.js')))
const {ActivityEditor}=await import(pathToFileURL(path.join(output,'src/components/ActivityEditor.js')))
const {initialDemo,demoProfiles}=await import(pathToFileURL(path.join(output,'src/data/demo.js')))
const {ScheduleView,ScheduleEditor}=await import(pathToFileURL(path.join(output,'src/components/Schedules.js')))
const slots=['2019 / 2020','2017 / 2018','2015 / 2016','2013 / 2014'].map((label,i)=>({id:String(i),label,days:[2,5],start:`${18+i}:00`,end:''}))
const schedule=renderToStaticMarkup(createElement(ScheduleView,{slots:[...slots].reverse()}))
assert.equal((schedule.match(/Martes y Viernes/g)??[]).length,1)
assert.ok(schedule.indexOf('18:00')<schedule.indexOf('21:00'))
for(const slot of slots)assert.ok(schedule.includes(slot.label))
const editor=renderToStaticMarkup(createElement(ScheduleEditor,{slots,onChange:()=>{},legacy:'',clearLegacy:()=>{}}))
assert.equal((editor.match(/type="checkbox"/g)??[]).length,28)
assert.equal((editor.match(/type="time"/g)??[]).length,8)
for (const management of ['club','externa']) {
  const html=renderToStaticMarkup(createElement(ActivityEditor,{ initial:{management}, data:initialDemo(), profile:demoProfiles[0], perform:async()=>true, busy:false, close:()=>{} }))
  assert.match(html,/Días y horarios/)
  assert.equal((html.match(/<form /g) ?? []).length,1)
  if(management==='club')assert.doesNotMatch(html,/Profesor \/ responsable/)
  else {assert.match(html,/Profesor \/ responsable/);assert.match(html,/Importe del alquiler/)}
}
for(const route of ['inicio','personas','actividades','grupos','partidos','tesoreria','alquileres','actividades/futbol']) {
  window.location.hash=`#${route}`
  const html=renderToStaticMarkup(createElement(App))
  assert.match(html,/<h1[ >]/,`No heading on ${route}`)
  assert.match(html,/La Fuente/,`No identity on ${route}`)
  if(route==='inicio'){assert.match(html,/\/brand\/banner\.png/);assert.match(html,/Tu club, más cerca\./)}
  if(route==='actividades/futbol') {
    assert.match(html,/Todas las actividades/)
    assert.match(html,/Mateo/)
    assert.doesNotMatch(html,/Emma/,'La actividad no debe mezclar participantes de otra disciplina')
  }
}
console.log('Render smoke passed: 7 pantallas, acceso por actividad y formulario club/externa; sin conexión externa.')
