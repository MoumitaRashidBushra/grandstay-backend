import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Unauthenticated');
    }

    let sub: string;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(token);
      if (!payload.sub) {
        throw new Error('missing subject');
      }
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException('Unauthenticated');
    }

    let userId: bigint;
    try {
      userId = BigInt(sub);
    } catch {
      throw new UnauthorizedException('Unauthenticated');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Unauthenticated');
    }

    request.user = user;
    return true;
  }
}
