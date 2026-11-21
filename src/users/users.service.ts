import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import type { User } from '../generated/prisma/client';
import { isUniqueViolation, PrismaService } from '../prisma/prisma.service';

export const EMAIL_TAKEN = 'Konto z tym adresem e-mail już istnieje.';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: { email: string; name: string; passwordHash: string }): Promise<User> {
    return this.mapUnique(() => this.prisma.user.create({ data }));
  }

  async update(id: string, data: { email?: string; name?: string }): Promise<User> {
    return this.mapUnique(() => this.prisma.user.update({ where: { id }, data }));
  }

  /** Ustawia nowe hasło i unieważnia wszystkie dotychczasowe tokeny. */
  setPassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
  }

  /** Usuwa konto razem z subskrypcjami (ON DELETE CASCADE). */
  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  private async mapUnique<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ApiError(HttpStatus.CONFLICT, EMAIL_TAKEN);
      throw err;
    }
  }
}
