import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

/**
 * Verifies Supabase-issued JWTs (Stage 3 §4, layer 1).
 * Supports both project types: legacy HS256 (SUPABASE_JWT_SECRET) and
 * asymmetric keys via JWKS (SUPABASE_JWT_JWKS_URL, or derived from SUPABASE_URL).
 */
@Injectable()
export class JwtVerifierService {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  private hsSecret?: Uint8Array;

  constructor(config: ConfigService) {
    const secret = config.get<string>('SUPABASE_JWT_SECRET');
    if (secret) {
      this.hsSecret = new TextEncoder().encode(secret);
      return;
    }
    const jwksUrl =
      config.get<string>('SUPABASE_JWT_JWKS_URL') ||
      `${config.get<string>('SUPABASE_URL')}/auth/v1/.well-known/jwks.json`;
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async verify(token: string): Promise<JWTPayload> {
    try {
      const { payload } = this.hsSecret
        ? await jwtVerify(token, this.hsSecret)
        : await jwtVerify(token, this.jwks!);
      return payload;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Invalid or expired token' });
    }
  }
}
