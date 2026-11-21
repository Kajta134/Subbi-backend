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

- **Symulator iOS:** działa zarówno `http://localhost:3000`, jak i adres IP Maca.
- **Telefon:** ustaw w Xcode (target *subbi* → Build Settings → `API_BASE_URL`) adres IP Maca w sieci lokalnej, np. `http://192.168.1.20:3000`.

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

## Wdrożenie na serwer

1. **Uruchom backend** na dowolnym hostingu z Node 24+ lub Dockerem (VPS, Fly.io, Render, Railway…):
   ```sh
   docker build -t subbi-backend .
   docker run -d --name subbi -p 3000:3000 -v subbi-data:/data \
     -e JWT_SECRET="$(openssl rand -hex 32)" subbi-backend
   ```
   Bez Dockera: `npm ci --omit=dev`, a potem `NODE_ENV=production JWT_SECRET=… DB_PATH=/sciezka/subbi.db node src/server.ts`.
   - `JWT_SECRET` ustaw raz i nie zmieniaj, bo jego zmiana wyloguje wszystkich użytkowników. W trybie produkcyjnym serwer bez niego nie wystartuje.
   - Baza SQLite musi leżeć na trwałym dysku (wolumen `/data`). Na platformach z ulotnym systemem plików podłącz „volume”/„disk”.
2. **HTTPS jest wymagane.** iOS (App Transport Security) blokuje zwykłe `http://` do serwerów w internecie. Większość platform daje HTTPS od razu. Na VPS-ie postaw przed serwerem reverse proxy z certyfikatem, np. Caddy: `api.twojadomena.pl { reverse_proxy localhost:3000 }`.
3. **Sprawdź:** `curl https://api.twojadomena.pl/health` → `{"status":"ok"}`.
4. **Wpisz adres w aplikacji:** Xcode → target *subbi* → Build Settings → `API_BASE_URL` (konfiguracja **Release**), np. `https://api.twojadomena.pl`, bez `/` na końcu. Do testów w domowej sieci ustaw w **Debug** adres Maca, np. `http://192.168.1.20:3000`. W aplikacji nie ma pola do wpisywania adresu.

## Ograniczenia

To celowo prosty serwer: nie ma limitów prób logowania, resetu hasła przez e-mail ani własnego HTTPS (zob. „Wdrożenie na serwer”).
