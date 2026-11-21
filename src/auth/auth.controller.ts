import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorDto } from '../common/api-error';
import type { User } from '../generated/prisma/client';
import { ChangePasswordDto, LoginDto, RegisterDto, SessionDto } from './auth.dto';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';

@ApiTags('Logowanie')
@ApiBadRequestResponse({ type: ErrorDto, description: 'Błąd walidacji' })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Rejestracja nowego konta' })
  @ApiCreatedResponse({ type: SessionDto })
  @ApiConflictResponse({ type: ErrorDto, description: 'E-mail zajęty' })
  register(@Body() body: RegisterDto): Promise<SessionDto> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logowanie e-mailem i hasłem' })
  @ApiOkResponse({ type: SessionDto })
  @ApiUnauthorizedResponse({ type: ErrorDto, description: 'Zły e-mail lub hasło' })
  login(@Body() body: LoginDto): Promise<SessionDto> {
    return this.auth.login(body);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Zmiana hasła',
    description: 'Zwraca nowy token; wszystkie wcześniejsze tokeny (także na innych urządzeniach) tracą ważność.',
  })
  @ApiOkResponse({ type: SessionDto })
  @ApiUnauthorizedResponse({ type: ErrorDto })
  changePassword(@CurrentUser() user: User, @Body() body: ChangePasswordDto): Promise<SessionDto> {
    return this.auth.changePassword(user, body);
  }
}
