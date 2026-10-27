import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTransport } from '../src/lib/supabase-core.ts'
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status})
describe('sesión y acceso HTTP',()=>{
  it('sin sesión no hace consultas',async()=>{
    let calls=0
    const transport=createTransport('https://example.supabase.co','public-test',async()=>{calls++;return json([])})
    await assert.rejects(transport.api('people'),/Iniciá sesión/);assert.equal(calls,0)
  })
  it('consultas concurrentes renuevan una vez y envían JWT nuevo',async()=>{
    let refreshes=0;const headers:string[]=[]
    const transport=createTransport('https://example.supabase.co','public-test',async(input,options)=>{
      const url=String(input)
      if(url.includes('grant_type=password'))return json({access_token:'old',refresh_token:'refresh',expires_in:0,user:{id:'u1'}})
      if(url.includes('refresh_token')){refreshes++;await new Promise(resolve=>setTimeout(resolve,5));return json({access_token:'new',refresh_token:'refresh2',expires_in:3600,user:{id:'u1'}})}
      headers.push(new Headers(options?.headers).get('Authorization')!);return json([])
    })
    await transport.signIn('test@example.invalid','example-password')
    await Promise.all([transport.api('people'),transport.api('activities')])
    assert.equal(refreshes,1);assert.deepEqual(headers,['Bearer new','Bearer new'])
  })
  it('salir elimina acceso incluso si falla el logout remoto',async()=>{
    const transport=createTransport('https://example.supabase.co','public-test',async input=>String(input).includes('logout')?json({},500):json({access_token:'token',refresh_token:'refresh',expires_in:3600,user:{id:'u1'}}))
    await transport.signIn('test@example.invalid','example-password');await transport.signOut()
    await assert.rejects(transport.api('people'),/Iniciá sesión/)
  })
})
