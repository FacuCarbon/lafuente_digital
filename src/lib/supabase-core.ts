interface Session { access_token: string; refresh_token: string; expires_at: number }
export function createTransport(rawUrl: string | undefined, key: string | undefined, request: typeof fetch = fetch) {
  const url = rawUrl?.replace(/\/$/, '')
  let session: Session | null = null
  let refreshing: Promise<void> | null = null
  async function authRequest(path: string, body?: unknown, token?: string) {
    if (!url || !key) throw new Error('Supabase no está configurado.')
    const response = await request(`${url}/auth/v1/${path}`, {
      method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) throw new Error(response.status === 400 ? 'No pudimos iniciar sesión. Revisá tus datos o contactá a administración.' : 'No pudimos conectar con el servicio de acceso.')
    return result
  }
  async function signIn(email: string, password: string): Promise<string> {
    const result = await authRequest('token?grant_type=password', { email, password })
    session = { ...result, expires_at: Date.now() + result.expires_in * 1000 }
    return result.user.id
  }
  async function signOut() {
    const old = session; session = null
    if (old) await authRequest('logout?scope=local', undefined, old.access_token).catch(() => {})
  }
  async function token() {
    if (!session) throw new Error('Iniciá sesión para continuar.')
    if (session.expires_at < Date.now() + 30000) {
      if (!refreshing) {
        const old = session
        refreshing = authRequest('token?grant_type=refresh_token', { refresh_token: old.refresh_token })
          .then(result => { if (session === old) session = { ...result, expires_at: Date.now() + result.expires_in * 1000 } })
          .finally(() => { refreshing = null })
      }
      await refreshing
    }
    if (!session) throw new Error('La sesión finalizó. Volvé a ingresar.')
    return session.access_token
  }
  async function api<T>(table: string, options: { method?: string; body?: unknown; query?: string; upsert?: boolean } = {}): Promise<T> {
    const bearer = await token()
    const response = await request(`${url}/rest/v1/${table}${options.query ? `?${options.query}` : ''}`, {
      method: options.method ?? 'GET', headers: {
        apikey: key!, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json',
        Prefer: options.upsert ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
      }, body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      if (response.status === 401) throw new Error('La sesión venció. Salí y volvé a ingresar.')
      if (response.status === 403) throw new Error('Tu cuenta no tiene permiso para esta operación.')
      throw new Error(result?.message ?? 'No se pudo guardar. Intentá nuevamente.')
    }
    return result as T
  }
  return { signIn, signOut, api }
}
