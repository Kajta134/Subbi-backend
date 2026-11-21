import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApiError, ErrorDto } from '../common/api-error';
import type { User } from '../generated/prisma/client';
import { UpdateProfileDto, UserDto } from './user.dto';
import { UsersService } from './users.service';

@ApiTags('Konto')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorDto, description: 'Brak lub nieważny token' })
@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Dane zalogowanego użytkownika' })
  @ApiOkResponse({ type: UserDto })
  me(@CurrentUser() user: User): UserDto {
    return UserDto.from(user);
  }

  @Patch()
  @ApiOperation({ summary: 'Zmiana imienia i/lub adresu e-mail' })
  @ApiOkResponse({ type: UserDto })
  @ApiBadRequestResponse({ type: ErrorDto })
  @ApiConflictResponse({ type: ErrorDto, description: 'E-mail zajęty' })
  async update(@CurrentUser() user: User, @Body() body: UpdateProfileDto): Promise<UserDto> {
    if (body.name === undefined && body.email === undefined) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Brak danych do zmiany.');
    }
    return UserDto.from(await this.users.update(user.id, { name: body.name, email: body.email }));
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Usunięcie konta razem z subskrypcjami' })
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: User): Promise<void> {
    await this.users.delete(user.id);
  }
}
