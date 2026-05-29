import { IsIn } from 'class-validator'

export class UpdateUserRoleDto {
  @IsIn(['ADMIN', 'OPERATIONS_MANAGER', 'STAFF'])
  role!: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF'
}
