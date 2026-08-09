import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@dental-passport/db';
import { PrismaService } from '../prisma/prisma.service';
import { JwtVerifierService } from './jwt-verifier.service';
import { IS_PUBLIC_KEY } from './public.decorator';

export interface AuthenticatedRequest {
  user: User;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Layer 1 — authentication. Global guard; @Public() opts out.
 * Verifies the Supabase JWT and upserts our User row on first sight,
 * so user provisioning never depends on a separate signup webhook.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifierService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers['authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException({ code: 'MISSING_TOKEN', message: 'Missing bearer token' });
    }

    const payload = await this.jwtVerifier.verify(token);
    const userId = payload.sub;
    const email = (payload as { email?: string }).email;
    if (!userId || !email) {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Token missing subject/email' });
    }

    const metadata = (payload as { user_metadata?: { full_name?: string } }).user_metadata;
    request.user = await this.prisma.user.upsert({
      where: { id: userId },
      update: { email },
      create: { id: userId, email, fullName: metadata?.full_name ?? email },
    });

    return true;
  }
}
