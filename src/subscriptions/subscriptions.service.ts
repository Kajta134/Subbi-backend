import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionDto } from './subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<SubscriptionDto[]> {
    const rows = await this.prisma.subscription.findMany({ where: { userId }, orderBy: { position: 'asc' } });
    return rows.map(SubscriptionDto.from);
  }

  /** Zastępuje całą listę użytkownika (w jednej transakcji). */
  async replace(userId: string, list: SubscriptionDto[]): Promise<SubscriptionDto[]> {
    const ids = new Set(list.map((s) => s.id.toLowerCase()));
    if (ids.size !== list.length) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Lista zawiera powtórzone identyfikatory subskrypcji.');
    }

    await this.prisma.$transaction([
      this.prisma.subscription.deleteMany({ where: { userId } }),
      this.prisma.subscription.createMany({
        data: list.map((s, position) => ({
          userId,
          position,
          id: s.id,
          name: s.name,
          price: s.price,
          period: s.period,
          firstPayment: new Date(s.firstPayment),
          category: s.category,
          symbol: s.symbol,
          colorHex: s.colorHex,
        })),
      }),
    ]);
    return this.list(userId);
  }
}
