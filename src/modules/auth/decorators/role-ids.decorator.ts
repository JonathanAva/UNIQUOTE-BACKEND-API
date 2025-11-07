import { SetMetadata } from '@nestjs/common';
export const RoleIds = (...roleIds: number[]) => SetMetadata('roleIds', roleIds);
