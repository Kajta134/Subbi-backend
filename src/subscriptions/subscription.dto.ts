import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Trim } from '../common/transforms';
import type { Subscription } from '../generated/prisma/client';

export const PERIODS = ['month', 'year'] as const;
export const CATEGORIES = ['entertainment', 'tools', 'other'] as const;
/** Ten sam limit sprawdza formularz w aplikacji (`Subscription.maxPrice`). */
export const MAX_PRICE = 10_000;

/** Kształt zgodny z `Subscription` (Codable) w aplikacji iOS. */
export class SubscriptionDto {
  @ApiProperty({ format: 'uuid', example: '3F2B8C1E-7A4D-4E9B-9C2F-1D5E6A7B8C9D', description: 'Nadawany przez aplikację' })
  @IsUUID('all', { message: 'Nieprawidłowy identyfikator subskrypcji.' })
  id: string;

  @ApiProperty({ example: 'Netflix', maxLength: 100 })
  @Trim()
  @IsString({ message: 'Podaj nazwę subskrypcji.' })
  @MinLength(1, { message: 'Podaj nazwę subskrypcji.' })
  @MaxLength(100, { message: 'Nazwa subskrypcji jest za długa.' })
  name: string;

  @ApiProperty({ example: 22.99, minimum: 0, maximum: MAX_PRICE })
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Cena musi być liczbą.' })
  @Min(0, { message: 'Cena nie może być ujemna.' })
  @Max(MAX_PRICE, { message: 'Cena subskrypcji może wynosić najwyżej 10 000.' })
  price: number;

  @ApiProperty({ enum: PERIODS, example: 'month' })
  @IsIn(PERIODS, { message: 'Okres rozliczenia musi być „month” lub „year”.' })
  period: (typeof PERIODS)[number];

  @ApiProperty({ format: 'date-time', example: '2026-10-22T22:00:00.000Z', description: 'Data pierwszej płatności (ISO 8601)' })
  @IsISO8601({ strict: true }, { message: 'Nieprawidłowa data pierwszej płatności.' })
  firstPayment: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-25T18:30:00.000Z',
    description: 'Moment dezaktywacji (ISO 8601); brak pola lub null = aktywna',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Nieprawidłowa data dezaktywacji.' })
  deactivatedAt?: string | null;

  @ApiProperty({ enum: CATEGORIES, example: 'entertainment' })
  @IsIn(CATEGORIES, { message: 'Nieznana kategoria.' })
  category: (typeof CATEGORIES)[number];

  @ApiProperty({ example: 'play.rectangle.fill', description: 'Nazwa SF Symbol' })
  @IsString({ message: 'Nieprawidłowa ikona.' })
  @MinLength(1, { message: 'Nieprawidłowa ikona.' })
  @MaxLength(100, { message: 'Nieprawidłowa ikona.' })
  symbol: string;

  @ApiProperty({ example: 15010068, minimum: 0, maximum: 0xffffff, description: 'Kolor RGB jako liczba (0xRRGGBB)' })
  @IsInt({ message: 'Nieprawidłowy kolor.' })
  @Min(0, { message: 'Nieprawidłowy kolor.' })
  @Max(0xffffff, { message: 'Nieprawidłowy kolor.' })
  colorHex: number;

  static from(s: Subscription): SubscriptionDto {
    return {
      id: s.id,
      name: s.name,
      price: s.price,
      period: s.period as SubscriptionDto['period'],
      firstPayment: s.firstPayment.toISOString(),
      // Dla aktywnych pole jest pomijane – tak samo koduje je aplikacja.
      ...(s.deactivatedAt && { deactivatedAt: s.deactivatedAt.toISOString() }),
      category: s.category as SubscriptionDto['category'],
      symbol: s.symbol,
      colorHex: s.colorHex,
    };
  }
}
