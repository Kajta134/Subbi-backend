import { DynamicModule, Global, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { APP_CONFIG, type AppConfig } from './config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';

@Global()
@Module({})
class ConfigModule {
  static with(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}

@Module({})
export class AppModule {
  /** Konfiguracja przekazywana jawnie – testy podstawiają własną bazę i sekret. */
  static with(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.with(config), PrismaModule, UsersModule, AuthModule, SubscriptionsModule],
      controllers: [HealthController],
    };
  }
}
