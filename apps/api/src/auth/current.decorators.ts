import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The authenticated User row (layer 1). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});

/** The acting ClinicMember (layer 2) — only on clinic-portal routes. */
export const CurrentMember = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().member;
});
