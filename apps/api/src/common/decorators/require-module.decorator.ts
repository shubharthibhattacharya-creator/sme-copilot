import { SetMetadata } from '@nestjs/common'
import type { AppModule } from '../permissions/role-defaults'

export const REQUIRE_MODULE_KEY = 'requiredModule'
export const RequireModuleAccess = (module: AppModule) => SetMetadata(REQUIRE_MODULE_KEY, module)
