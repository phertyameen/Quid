import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateUser(publicKey: string) {
    return this.prisma.user.findUnique({ where: { email: publicKey } });
  }
}
