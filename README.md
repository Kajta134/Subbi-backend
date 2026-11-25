# subbi-backend

Backend dla aplikacji iOS **subbi**: konta użytkowników (rejestracja, logowanie, profil, zmiana hasła) oraz synchronizacja listy subskrypcji.

Stos: **NestJS 12**, **Prisma 7** (SQLite przez `better-sqlite3`), **Swagger / OpenAPI**, JWT, walidacja `class-validator`, hasła haszowane `scrypt`.

## Uruchomienie

Wymagany **Node.js 24 lub nowszy** (np. `brew install node` albo instalator z nodejs.org).

```sh
npm install        # instaluje zależności i generuje klienta Prismy
npm run dev        # stosuje migracje i uruchamia serwer z automatycznym restartem
npm test           # testy e2e (Jest + supertest, każda seria na świeżej bazie)
npm run typecheck  # sprawdzenie typów
npm run build && npm run start:prod   # wersja produkcyjna
```

Po starcie:
- API: `http://localhost:3000`
- **Swagger UI: `http://localhost:3000/docs`**. Przycisk *Authorize* przyjmuje token z `/auth/login`.
- Specyfikacja OpenAPI (JSON): `http://localhost:3000/docs-json`

Konfiguracja przez zmienne środowiskowe albo plik `.env` (wczytywany automatycznie; wzór w `.env.example`):

| Zmienna        | Domyślnie              | Opis |
|----------------|------------------------|------|
| `PORT`         | `3000`                 | Port HTTP |
| `HOST`         | `0.0.0.0`              | Adres nasłuchu |
| `DATABASE_URL` | `file:./data/subbi.db` | Plik bazy SQLite (ścieżka względem katalogu uruchomienia) |
| `JWT_SECRET`   | sekret deweloperski    | Sekret podpisu tokenów, **wymagany** przy `NODE_ENV=production` |

### Baza danych (Prisma)

- Schemat: `prisma/schema.prisma`, migracje: `prisma/migrations/`.
- Zmiana schematu: edytuj `schema.prisma`, potem `npm run db:new-migration -- nazwa_zmiany`. To tworzy migrację i regeneruje klienta.
- Podgląd danych: `npx prisma studio`.

### Połączenie z aplikacją

Adres serwera ustawia się w Xcode: target *subbi* → Build Settings → `API_BASE_URL`, osobno dla Debug i Release. Do testów na telefonie w domowej sieci wpisz adres IP Maca, np. `http://192.168.1.20:3000`.

## API

Pełna, interaktywna dokumentacja jest w Swaggerze (`/docs`). Skrót:

Wszystkie treści to JSON. Błędy mają postać `{ "error": "komunikat po polsku", "field"?: "pole" }`.
Endpointy oznaczone 🔒 wymagają nagłówka `Authorization: Bearer <token>`.

| Metoda | Ścieżka                    | Treść żądania | Odpowiedź |
|--------|----------------------------|---------------|-----------|
| GET    | `/health`                  | – | `{ status: "ok" }` |
| POST   | `/auth/register`           | `{ name, email, password }` (hasło ≥ 8 znaków) | `201 { token, user }`, `409` gdy e-mail zajęty |
| POST   | `/auth/login`              | `{ email, password }` | `{ token, user }`, `401` przy złych danych |
| POST   | `/auth/change-password` 🔒 | `{ currentPassword, newPassword }` | `{ token, user }`, stare tokeny tracą ważność |
| GET    | `/me` 🔒                   | – | `user` |
| PATCH  | `/me` 🔒                   | `{ name?, email? }` | `user` |
| DELETE | `/me` 🔒                   | – | `204`, usuwa konto i subskrypcje |
| GET    | `/subscriptions` 🔒        | – | `Subscription[]` |
| PUT    | `/subscriptions` 🔒        | `Subscription[]` (max 500) | `Subscription[]`, zastępuje całą listę |

`user`: `{ id, email, name, createdAt }`

`Subscription` (zgodne z modelem `Subscription` w aplikacji):

```json
{
  "id": "3F2B8C1E-7A4D-4E9B-9C2F-1D5E6A7B8C9D",
  "name": "Netflix",
  "price": 22.99,
  "period": "month",
  "firstPayment": "2026-10-22T22:00:00.000Z",
  "category": "entertainment",
  "symbol": "play.rectangle.fill",
  "colorHex": 15010068
}
```

- `period`: `month` | `year`
- `deactivatedAt` (opcjonalne): moment dezaktywacji. Aktywne subskrypcje nie mają tego pola.
- `category`: `entertainment` | `tools` | `other`
- `price`: od 0 do 10 000
- `colorHex`: kolor `0xRRGGBB`
- Daty w ISO 8601. Serwer zwraca je w UTC z milisekundami.

Tokeny JWT są ważne 30 dni. Synchronizacja działa na zasadzie „ostatni zapis wygrywa”: aplikacja wysyła całą listę po każdej zmianie.

## Wdrożenie na serwer

1. **Uruchom backend** na dowolnym hostingu z Dockerem lub Node 24+ (VPS, Fly.io, Render, Railway…):
   ```sh
   docker build -t subbi-backend .
   docker run -d --name subbi -p 3000:3000 -v subbi-data:/data \
     -e JWT_SECRET="$(openssl rand -hex 32)" subbi-backend
   ```
   Kontener przy starcie sam stosuje migracje (`prisma migrate deploy`).
   Bez Dockera: `npm ci && npm run build`, potem `NODE_ENV=production JWT_SECRET=… DATABASE_URL=file:/sciezka/subbi.db npm run start:prod`.
   - `JWT_SECRET` ustaw raz i nie zmieniaj, bo jego zmiana wyloguje wszystkich użytkowników. W trybie produkcyjnym serwer bez niego nie wystartuje.
   - Baza SQLite musi leżeć na trwałym dysku (wolumen `/data`). Na platformach z ulotnym systemem plików podłącz „volume”/„disk”.
2. **HTTPS jest wymagane.** iOS (App Transport Security) blokuje zwykłe `http://` do serwerów w internecie. Większość platform daje HTTPS od razu. Na VPS-ie postaw przed serwerem reverse proxy z certyfikatem, np. Caddy: `api.twojadomena.pl { reverse_proxy localhost:3000 }`.
3. **Sprawdź:** `curl https://api.twojadomena.pl/health` → `{"status":"ok"}`. Dokumentacja będzie pod `https://api.twojadomena.pl/docs`.
4. **Wpisz adres w aplikacji:** Xcode → target *subbi* → Build Settings → `API_BASE_URL` (konfiguracja **Release**), np. `https://api.twojadomena.pl`, bez `/` na końcu.

## Ograniczenia

To celowo prosty serwer: nie ma limitów prób logowania, resetu hasła przez e-mail ani własnego HTTPS (zob. „Wdrożenie na serwer”). Swagger (`/docs`) jest publiczny. Nie zawiera danych, tylko opis API.
