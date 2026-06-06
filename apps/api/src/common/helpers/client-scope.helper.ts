import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '@opsc/types'

/**
 * Returns a Prisma `where` fragment that scopes client queries by ownership.
 *
 * - ADMIN / OPERATIONS_MANAGER: no restriction (sees all firm clients)
 * - STAFF: only clients where ownerId = their userId
 *   Clients with ownerId = null are NOT visible to staff (they belong to no one yet).
 */
export async function getClientScope(
  user: AuthenticatedUser,
  _prisma: PrismaService,
): Promise<{ companyId: string; ownerId?: string }> {
  if (user.role === 'STAFF') {
    return { companyId: user.companyId, ownerId: user.userId }
  }
  return { companyId: user.companyId }
}

/**
 * Returns a list of clientIds visible to the user.
 * Used when querying non-Client models (invoices, documents, etc.) by client ownership.
 */
export async function getOwnedClientIds(
  user: AuthenticatedUser,
  prisma: PrismaService,
): Promise<string[] | null> {
  // ADMIN / OPS_MANAGER see everything — return null to signal "no filter"
  if (user.role !== 'STAFF') return null

  const clients = await prisma.client.findMany({
    where: { companyId: user.companyId, ownerId: user.userId },
    select: { id: true },
  })
  return clients.map((c) => c.id)
}
