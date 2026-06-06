import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getOwnedClientIds } from '../../common/helpers/client-scope.helper'
import type { AuthenticatedUser } from '@opsc/types'

export interface WorkItem {
  id: string
  type: 'DOCUMENT' | 'INVOICE' | 'COMPLIANCE'
  module: string
  clientId: string
  clientName: string
  title: string
  dueDate: string | null
  urgency: 'TODAY' | 'THIS_WEEK' | 'NONE'
  meta: Record<string, unknown>
}

export interface WorkloadEntry {
  userId: string
  name: string
  email: string
  role: string
  clientCount: number
  openDocuments: number
  overdueInvoices: number
  pendingChecklists: number
  totalOpen: number
}

function urgency(dueDate: Date | string | null): 'TODAY' | 'THIS_WEEK' | 'NONE' {
  if (!dueDate) return 'NONE'
  const due = new Date(dueDate)
  const now = new Date()
  const diffDays = Math.floor((due.getTime() - now.setHours(0, 0, 0, 0)) / 86_400_000)
  if (diffDays <= 0) return 'TODAY'
  if (diffDays <= 7) return 'THIS_WEEK'
  return 'NONE'
}

@Injectable()
export class WorkQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyWork(user: AuthenticatedUser): Promise<WorkItem[]> {
    const clientIds = await getOwnedClientIds(user, this.prisma)

    // null means ADMIN/OPS_MANAGER — scoped to full firm
    const invoiceClientFilter = clientIds !== null ? { clientId: { in: clientIds } } : {}
    const docClientFilter = clientIds !== null ? { clientId: { in: clientIds } } : {}
    const checklistClientFilter =
      clientIds !== null
        ? { companyId: user.companyId, clientId: { in: clientIds } }
        : { companyId: user.companyId }

    const [documents, invoices, checklists] = await Promise.all([
      // Documents needing review
      this.prisma.document.findMany({
        where: {
          companyId: user.companyId,
          ...docClientFilter,
          status: 'NEEDS_REVIEW',
        },
        select: {
          id: true,
          documentType: true,
          originalName: true,
          clientId: true,
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),

      // Overdue invoices
      this.prisma.invoice.findMany({
        where: {
          companyId: user.companyId,
          ...invoiceClientFilter,
          status: 'OVERDUE',
        },
        select: {
          id: true,
          amount: true,
          dueDate: true,
          agingDays: true,
          invoiceNumber: true,
          clientId: true,
          client: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 50,
      }),

      // Unfiled compliance checklists
      this.prisma.complianceChecklist.findMany({
        where: {
          ...checklistClientFilter,
          status: { not: 'FILED' },
        },
        select: {
          id: true,
          filingType: true,
          filingPeriod: true,
          dueDate: true,
          status: true,
          readinessScore: true,
          clientId: true,
          client: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 50,
      }),
    ])

    const items: WorkItem[] = []

    for (const doc of documents) {
      if (!doc.client) continue
      items.push({
        id: doc.id,
        type: 'DOCUMENT',
        module: 'Documents',
        clientId: doc.client.id,
        clientName: doc.client.name,
        title: `Verify ${doc.documentType.replace(/_/g, ' ').toLowerCase()} — ${doc.client.name}`,
        dueDate: null,
        urgency: 'NONE',
        meta: { documentType: doc.documentType, originalName: doc.originalName },
      })
    }

    for (const inv of invoices) {
      if (!inv.client) continue
      items.push({
        id: inv.id,
        type: 'INVOICE',
        module: 'Collections',
        clientId: inv.client.id,
        clientName: inv.client.name,
        title: `Chase ${inv.client.name} — ₹${Number(inv.amount).toLocaleString('en-IN')} overdue`,
        dueDate: inv.dueDate?.toISOString() ?? null,
        urgency: urgency(inv.dueDate),
        meta: { amount: Number(inv.amount), agingDays: inv.agingDays, invoiceNumber: inv.invoiceNumber },
      })
    }

    for (const cl of checklists) {
      if (!cl.client) continue
      items.push({
        id: cl.id,
        type: 'COMPLIANCE',
        module: 'Compliance',
        clientId: cl.client.id,
        clientName: cl.client.name,
        title: `${cl.filingType} filing — ${cl.client.name} (${cl.readinessScore ?? 0}% ready)`,
        dueDate: cl.dueDate?.toISOString() ?? null,
        urgency: urgency(cl.dueDate),
        meta: { filingType: cl.filingType, filingPeriod: cl.filingPeriod, status: cl.status, readinessScore: cl.readinessScore },
      })
    }

    // Sort: TODAY first, then THIS_WEEK, then NONE; within each group by dueDate asc
    const order = { TODAY: 0, THIS_WEEK: 1, NONE: 2 }
    items.sort((a, b) => {
      const urgDiff = order[a.urgency] - order[b.urgency]
      if (urgDiff !== 0) return urgDiff
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      return 0
    })

    return items
  }

  async getWorkload(companyId: string): Promise<WorkloadEntry[]> {
    const users = await this.prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })

    const entries = await Promise.all(
      users.map(async (u) => {
        const clientIds = await this.prisma.client
          .findMany({
            where: { companyId, ownerId: u.id },
            select: { id: true },
          })
          .then((cs) => cs.map((c) => c.id))

        const [openDocuments, overdueInvoices, pendingChecklists] = await Promise.all([
          this.prisma.document.count({
            where: { companyId, clientId: { in: clientIds }, status: 'NEEDS_REVIEW' },
          }),
          this.prisma.invoice.count({
            where: { companyId, clientId: { in: clientIds }, status: 'OVERDUE' },
          }),
          this.prisma.complianceChecklist.count({
            where: { companyId, clientId: { in: clientIds }, status: { not: 'FILED' } },
          }),
        ])

        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          role: u.role as string,
          clientCount: clientIds.length,
          openDocuments,
          overdueInvoices,
          pendingChecklists,
          totalOpen: openDocuments + overdueInvoices + pendingChecklists,
        }
      }),
    )

    return entries
  }
}
