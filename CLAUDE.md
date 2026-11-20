# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Backend for the **subbi** iOS app (the sibling repo `../subbi2`). It handles user accounts and syncs each user's subscription list. See `README.md` for the full API table.

## Commands

```sh
npm install
npm run dev          # node --watch src/server.ts
npm test             # node --test "test/**/*.test.ts"
npm run typecheck    # tsc (noEmit)
node --test --test-name-pattern="zmiana hasła" "test/**/*.test.ts"   # run one test
```

Requires Node ≥ 24. There is no build step: Node runs the `.ts` files directly through type stripping. Because of that:
- Relative imports must include the `.ts` extension.
- Only erasable syntax is allowed (`erasableSyntaxOnly`): no `enum`, no `namespace` with values, no constructor parameter properties.
- `tsc` is used only for type checking.

## Architecture

- `src/app.ts`: `createApp({ db, jwtSecret })` builds the Express app without listening, so tests can start it on port 0 with an in-memory database (`openDatabase(':memory:')`). `src/server.ts` is the only entry point that reads env config (`src/config.ts`).
- `src/db.ts`: the schema, which uses `CREATE TABLE IF NOT EXISTS` and has no migration tool, plus the `transaction()` and `isUniqueViolation()` helpers. It uses the built-in `node:sqlite` (`DatabaseSync`, synchronous).
- `src/http.ts`: JWT signing, the `requireAuth` middleware (puts the user row in `res.locals.user`; read it with `currentUser(res)`), and the central `errorHandler`.
  - Route handlers **throw** errors. Express 5 forwards both sync throws and async rejections to the error handler.
  - The handler turns `HttpError` into `{ error }` and `ZodError` into `400 { error, field }`.
- Tokens carry `ver` = `users.token_version`. Changing the password increments it, which invalidates all older tokens. `requireAuth` checks the version on every request.
- `src/schemas.ts`: zod v4 schemas with the Polish locale (`z.config(z.locales.pl())`). Error messages are shown directly in the app, so keep them in Polish.
- Subscription sync is whole-list replace (`PUT /subscriptions`), stored with a `position` column to keep the order. The JSON shape must match the Swift `Subscription` Codable model in `../subbi2/subbi/Models/Models.swift`, with dates in ISO 8601. Change both sides together.
