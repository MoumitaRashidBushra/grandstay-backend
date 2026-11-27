import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_PASSWORD_RESET_KEY = 'allowDuringPasswordReset';

export const AllowDuringPasswordReset = () =>
  SetMetadata(ALLOW_DURING_PASSWORD_RESET_KEY, true);
