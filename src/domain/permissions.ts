import type { Page, Role } from './types.ts'

export const hasRole = (roles: Role[], ...allowed: Role[]) => roles.some(role => allowed.includes(role))
export const canManage = (roles: Role[]) => hasRole(roles, 'admin')
export const canTeach = (roles: Role[]) => hasRole(roles, 'admin', 'profe')
export const canFinance = (roles: Role[]) => hasRole(roles, 'admin', 'tesorero', 'cobranza')
export function canViewPage(roles: Role[], page: Page) {
  if (page === 'tesoreria') return canFinance(roles)
  if (page === 'alquileres') return hasRole(roles, 'admin', 'tesorero', 'profe')
  if (page === 'grupos' || page === 'partidos') return hasRole(roles, 'admin', 'profe', 'tutor')
  return roles.length > 0
}
