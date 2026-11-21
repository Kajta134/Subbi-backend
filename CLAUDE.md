# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Backend for the **subbi** iOS app (the sibling repo `../subbi2`). It handles user accounts and syncs each user's subscription list. Stack: NestJS 12, Prisma 7 (SQLite through `@prisma/adapter-better-sqlite3`), `@nestjs/swagger`, `class-validator`. See `README.md` for the API table and deployment steps.

## Commands

```sh
npm install                 # also runs `prisma generate` (postinstall)
npm run dev                 # prisma migrate deploy + nest start --watch
npm test                    # Jest e2e suite (test/*.e2e-spec.ts)
npm test -- -t "zmiana hasła"   # run a single test by name
npm run typecheck           # tsc over src + test
npm run db:new-migration -- <name>   # after editing prisma/schema.prisma
```

Requires Node ≥ 24.
- Nest 12 packages are **ESM-only** while this project compiles to CommonJS. That works because Node 24 supports `require(esm)`.
- For the same reason, Jest has to run with `node --experimental-vm-modules`, which is already in the `test` script. Don't replace it with plain `jest`.
- The `allowScripts` field in `package.json` approves the native/engine install scripts: `better-sqlite3`, `prisma`, `@prisma/engines`.

## Architecture

- **Prisma**:
  - The client is generated into `src/generated/prisma` (gitignored). The generator uses `moduleFormat = "cjs"` and `importFileExtension = ""` so that `nest build` and ts-jest can compile it.
  - The DB URL comes from `prisma.config.ts` for the CLI and from `AppConfig.databaseUrl` for `PrismaService`. Both read `DATABASE_URL`.
  - `DateTime` columns are stored as ISO text by the adapter.
- **Config is passed explicitly**: `AppModule.with(config)` provides `APP_CONFIG`. `main.ts` builds the config from env (`src/config.ts`). Tests build their own config with a temporary DB in `test/utils.ts`, which runs `prisma migrate deploy` on a fresh SQLite file.
- **`src/setup-app.ts`** holds everything that `main.ts` and the tests must share: the JSON body parser, the global `ValidationPipe`, `AllExceptionsFilter` and the Swagger setup (`/docs`, `/docs-json`). The app is created with `bodyParser: false`, and the parser is mounted by hand so that malformed or oversized JSON gets the `{ error }` format.
- **Error contract**: the iOS app shows `error` to users as-is, so every message must be in Polish.
  - Every error response is `{ error: string, field?: string }`.
  - Throw `ApiError(status, message, field?)`. Validation errors are converted in `common/validation.ts`, and `AllExceptionsFilter` maps any other `HttpException` to a generic Polish message.
- **Auth**:
  - `AuthGuard` verifies the HS256 JWT and loads the user. It compares `payload.ver` with `user.tokenVersion`, so a password change, which increments the version, revokes old tokens.
  - Controllers read the user with `@CurrentUser()`.
  - The guard is used from several modules, so each such module must import `UsersModule`.
- **Subscription sync** replaces the whole list (`PUT /subscriptions`) inside a single Prisma `$transaction`, with a `position` column to keep the order.
  - The body is a JSON array. The global `ValidationPipe` skips arrays, so the controller takes `@Body() body: unknown` and validates it with `validateArray()`, which reports error fields as `"2.price"`.
  - The DTO shape must match the Swift `Subscription` Codable model in `../subbi2/subbi/Models/Models.swift`. Change both sides together.
