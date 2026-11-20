# subbi-backend

Prosty backend dla aplikacji iOS **subbi**: konta użytkowników (rejestracja, logowanie, profil, zmiana hasła) oraz synchronizacja listy subskrypcji.

Stos: Node.js 24+ (TypeScript uruchamiany natywnie), Express 5, wbudowany `node:sqlite`, JWT, hasła haszowane `scrypt`.

## Uruchomienie

Wymagany **Node.js 24 lub nowszy** (np. `brew install node` albo instalator z nodejs.org).

```sh
npm install
npm run dev        # serwer z automatycznym restartem, http://localhost:3000
npm start          # bez restartu
npm test           # testy API (node:test)
npm run typecheck  # sprawdzenie typów (tsc)
```

Konfiguracja przez zmienne środowiskowe (zob. `.env.example`; plik `.env` można wczytać przez `node --env-file=.env src/server.ts`):

| Zmienna      | Domyślnie          | Opis |
|--------------|--------------------|------|
| `PORT`       | `3000`             | Port HTTP |
| `HOST`       | `0.0.0.0`          | Adres nasłuchu |
| `DB_PATH`    | `./data/subbi.db`  | Plik bazy SQLite (tworzony automatycznie) |
| `JWT_SECRET` | sekret deweloperski | Sekret podpisu tokenów, **wymagany** przy `NODE_ENV=production` |

### Połączenie z aplikacją

- **Symulator iOS:** adres `http://localhost:3000` działa od razu.
- **Telefon:** w aplikacji (ekran logowania → „Adres serwera”) wpisz adres IP Maca w sieci lokalnej, np. `http://192.168.1.20:3000`.

## API

Wszystkie treści to JSON. Błędy mają postać `{ "error": "komunikat po polsku", "field"?: "pole" }`.
Endpointy oznaczone 🔒 wymagają nagłówka `Authorization: Bearer <token>`.

| Metoda | Ścieżka                 | Treść żądania | Odpowiedź |
|--------|-------------------------|---------------|-----------|
| GET    | `/health`               | – | `{ status: "ok" }` |
| POST   | `/auth/register`        | `{ name, email, password }` (hasło ≥ 8 znaków) | `201 { token, user }`, `409` gdy e-mail zajęty |
| POST   | `/auth/login`           | `{ email, password }` | `{ token, user }`, `401` przy złych danych |
| POST   | `/auth/change-password` 🔒 | `{ currentPassword, newPassword }` | `{ token, user }` – stare tokeny tracą ważność |
| GET    | `/me` 🔒                | – | `user` |
| PATCH  | `/me` 🔒                | `{ name?, email? }` | `user` |
| DELETE | `/me` 🔒                | – | `204`, usuwa konto i subskrypcje |
| GET    | `/subscriptions` 🔒     | – | `Subscription[]` |
| PUT    | `/subscriptions` 🔒     | `Subscription[]` (max 500) | `Subscription[]` – zastępuje całą listę |

`user`: `{ id, email, name, createdAt }`

`Subscription` (zgodne z modelem `Subscription` w aplikacji):

```json
{
  "id": "3F2B8C1E-7A4D-4E9B-9C2F-1D5E6A7B8C9D",
  "name": "Netflix",
  "price": 22.99,
  "period": "month",
  "firstPayment": "2026-10-22T22:00:00Z",
  "category": "entertainment",
  "symbol": "play.rectangle.fill",
  "colorHex": 15010068
}
```

`period`: `month` | `year`, `category`: `entertainment` | `tools` | `other`.

Tokeny JWT są ważne 30 dni. Synchronizacja działa na zasadzie „ostatni zapis wygrywa”: aplikacja wysyła całą listę po każdej zmianie.

## Ograniczenia

To celowo prosty serwer: nie ma limitów prób logowania, resetu hasła przez e-mail ani HTTPS (do wdrożenia poza siecią lokalną postaw go za reverse proxy z TLS).
