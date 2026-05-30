import { IsString, IsOptional, IsIn } from 'class-validator'

export class UpdateChecklistDto {
  @IsOptional() @IsString() assignedUserId?: string
  @IsOptional() @IsString() dueDate?: string
  @IsOptional() @IsString() notes?: string
  @IsOptional() @IsIn(['IN_PROGRESS', 'READY', 'FILED', 'OVERDUE']) status?: string
}
