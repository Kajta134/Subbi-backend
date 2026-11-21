import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ErrorDto } from '../common/api-error';
import { validateArray } from '../common/validation';
import type { User } from '../generated/prisma/client';
import { SubscriptionDto } from './subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

const MAX_SUBSCRIPTIONS = 500;

@ApiTags('Subskrypcje')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorDto, description: 'Brak lub nieważny token' })
@UseGuards(AuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista subskrypcji użytkownika (w kolejności z aplikacji)' })
  @ApiOkResponse({ type: [SubscriptionDto] })
  list(@CurrentUser() user: User): Promise<SubscriptionDto[]> {
    return this.subscriptions.list(user.id);
  }

  @Put()
  @ApiOperation({
    summary: 'Zastąpienie całej listy subskrypcji',
    description: `Aplikacja wysyła pełną listę po każdej zmianie („ostatni zapis wygrywa”). Maksymalnie ${MAX_SUBSCRIPTIONS} pozycji.`,
  })
  @ApiBody({ type: [SubscriptionDto] })
  @ApiOkResponse({ type: [SubscriptionDto] })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'Błąd walidacji; `field` ma postać np. `2.price`' })
  replace(@CurrentUser() user: User, @Body() body: unknown): Promise<SubscriptionDto[]> {
    return this.subscriptions.replace(user.id, validateArray(SubscriptionDto, body, MAX_SUBSCRIPTIONS));
  }
}
