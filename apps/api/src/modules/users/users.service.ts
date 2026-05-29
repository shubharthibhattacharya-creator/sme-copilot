import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { UserRole } from '@opsc/database'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCompany(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  async updateRole(companyId: string, targetUserId: string, role: UserRole) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, companyId },
    })
    if (!target) throw new NotFoundException('User not found in your company')
    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      throw new ForbiddenException('Cannot demote the last admin')
    }
    return this.prisma.user.update({ where: { id: targetUserId }, data: { role } })
  }
}
