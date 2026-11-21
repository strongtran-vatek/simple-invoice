import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opens a route to unauthenticated callers. Every route is protected by the
 * global JWT guard unless it carries this decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
