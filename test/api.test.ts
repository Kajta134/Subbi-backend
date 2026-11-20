import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { openDatabase } from '../src/db.ts';

const db = openDatabase(':memory:');
const server = createApp({ db, jwtSecret: 'test-secret' }).listen(0);
let base = '';

before(() => {
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.close();
  db.close();
});

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

let counter = 0;
async function registerUser(password = 'tajnehaslo1') {
  const email = `user${++counter}@example.com`;
  const res = await api('POST', '/auth/register', { name: 'Jan Kowalski', email, password });
  assert.equal(res.status, 201);
  return { email, password, token: res.body.token as string };
}

// Kształt jak z JSONEncoder (.iso8601) w aplikacji – UUID wielkimi literami.
const sub = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID().toUpperCase(),
  name: 'Netflix',
  price: 22.99,
  period: 'month',
  firstPayment: '2026-10-22T22:00:00Z',
  category: 'entertainment',
  symbol: 'play.rectangle.fill',
  colorHex: 0xe50914,
  ...overrides,
});

describe('auth', () => {
  test('rejestracja zwraca token i dane użytkownika bez hasła', async () => {
    const res = await api('POST', '/auth/register', {
      name: '  Anna Nowak ',
      email: ' Anna@Example.COM ',
      password: 'tajnehaslo1',
    });
    assert.equal(res.status, 201);
    assert.equal(typeof res.body.token, 'string');
    assert.equal(res.body.user.email, 'anna@example.com');
    assert.equal(res.body.user.name, 'Anna Nowak');
    assert.equal(res.body.user.password_hash, undefined);
  });

  test('ten sam e-mail nie może zostać zarejestrowany dwa razy', async () => {
    const { email } = await registerUser();
    const res = await api('POST', '/auth/register', { name: 'X', email: email.toUpperCase(), password: 'tajnehaslo1' });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /już istnieje/);
  });

  test('walidacja rejestracji zwraca polskie komunikaty', async () => {
    const short = await api('POST', '/auth/register', { name: 'X', email: 'x@example.com', password: 'krotkie' });
    assert.equal(short.status, 400);
    assert.equal(short.body.error, 'Hasło musi mieć co najmniej 8 znaków.');
    assert.equal(short.body.field, 'password');

    const badEmail = await api('POST', '/auth/register', { name: 'X', email: 'nie-email', password: 'tajnehaslo1' });
    assert.equal(badEmail.status, 400);
    assert.equal(badEmail.body.error, 'Podaj poprawny adres e-mail.');
  });

  test('logowanie działa niezależnie od wielkości liter w e-mailu', async () => {
    const { email, password } = await registerUser();
    const res = await api('POST', '/auth/login', { email: email.toUpperCase(), password });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, email);
  });

  test('złe hasło i nieznany e-mail dają ten sam błąd 401', async () => {
    const { email } = await registerUser();
    const wrong = await api('POST', '/auth/login', { email, password: 'zlehaslo123' });
    const unknown = await api('POST', '/auth/login', { email: 'brak@example.com', password: 'zlehaslo123' });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  test('nieprawidłowy JSON daje 400', async () => {
    const res = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{nie json',
    });
    assert.equal(res.status, 400);
  });
});

describe('chronione endpointy', () => {
  test('bez tokenu lub z błędnym tokenem: 401', async () => {
    assert.equal((await api('GET', '/me')).status, 401);
    assert.equal((await api('GET', '/subscriptions', undefined, 'zly.token')).status, 401);
  });

  test('GET i PATCH /me', async () => {
    const { token } = await registerUser();
    const me = await api('GET', '/me', undefined, token);
    assert.equal(me.status, 200);
    assert.equal(me.body.name, 'Jan Kowalski');

    const patched = await api('PATCH', '/me', { name: 'Jan Nowak' }, token);
    assert.equal(patched.status, 200);
    assert.equal(patched.body.name, 'Jan Nowak');

    assert.equal((await api('PATCH', '/me', {}, token)).status, 400);
  });

  test('PATCH /me nie pozwala przejąć cudzego e-maila', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const res = await api('PATCH', '/me', { email: a.email }, b.token);
    assert.equal(res.status, 409);
  });

  test('zmiana hasła unieważnia stare tokeny', async () => {
    const { email, token } = await registerUser('starehaslo1');

    const wrong = await api('POST', '/auth/change-password', { currentPassword: 'xxxxxxxx', newPassword: 'nowehaslo1' }, token);
    assert.equal(wrong.status, 400);

    const ok = await api('POST', '/auth/change-password', { currentPassword: 'starehaslo1', newPassword: 'nowehaslo1' }, token);
    assert.equal(ok.status, 200);

    assert.equal((await api('GET', '/me', undefined, token)).status, 401);
    assert.equal((await api('GET', '/me', undefined, ok.body.token)).status, 200);
    assert.equal((await api('POST', '/auth/login', { email, password: 'starehaslo1' })).status, 401);
    assert.equal((await api('POST', '/auth/login', { email, password: 'nowehaslo1' })).status, 200);
  });

  test('DELETE /me usuwa konto i jego subskrypcje', async () => {
    const { email, password, token } = await registerUser();
    await api('PUT', '/subscriptions', [sub()], token);
    assert.equal((await api('DELETE', '/me', undefined, token)).status, 204);
    assert.equal((await api('GET', '/me', undefined, token)).status, 401);
    assert.equal((await api('POST', '/auth/login', { email, password })).status, 401);
    const left = db.prepare('SELECT COUNT(*) AS n FROM subscriptions').get() as { n: number };
    assert.equal(left.n, 0);
  });
});

describe('subskrypcje', () => {
  test('nowe konto ma pustą listę', async () => {
    const { token } = await registerUser();
    const res = await api('GET', '/subscriptions', undefined, token);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('PUT zastępuje listę i zachowuje kolejność oraz pola', async () => {
    const { token } = await registerUser();
    const first = [sub({ name: 'A' }), sub({ name: 'B', period: 'year', price: 120 }), sub({ name: 'C' })];
    assert.equal((await api('PUT', '/subscriptions', first, token)).status, 200);
    assert.deepEqual((await api('GET', '/subscriptions', undefined, token)).body, first);

    const second = [first[2], sub({ name: 'D', category: 'tools' })];
    await api('PUT', '/subscriptions', second, token);
    assert.deepEqual((await api('GET', '/subscriptions', undefined, token)).body, second);
  });

  test('użytkownicy nie widzą swoich subskrypcji nawzajem', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const shared = sub();
    await api('PUT', '/subscriptions', [shared], a.token);
    // Ten sam identyfikator u innego użytkownika nie koliduje.
    assert.equal((await api('PUT', '/subscriptions', [shared], b.token)).status, 200);
    await api('PUT', '/subscriptions', [], b.token);
    assert.deepEqual((await api('GET', '/subscriptions', undefined, a.token)).body, [shared]);
    assert.deepEqual((await api('GET', '/subscriptions', undefined, b.token)).body, []);
  });

  test('nieprawidłowe dane są odrzucane bez zmiany zapisanej listy', async () => {
    const { token } = await registerUser();
    const saved = [sub()];
    await api('PUT', '/subscriptions', saved, token);

    const bad = [
      [sub({ period: 'week' })],
      [sub({ price: -1 })],
      [sub({ firstPayment: 'wczoraj' })],
      [sub({ id: 'abc' })],
      (() => { const s = sub(); return [s, { ...s }]; })(),
      { not: 'array' },
    ];
    for (const body of bad) {
      assert.equal((await api('PUT', '/subscriptions', body, token)).status, 400, JSON.stringify(body));
    }
    assert.deepEqual((await api('GET', '/subscriptions', undefined, token)).body, saved);
  });
});

test('GET /health i nieznana ścieżka', async () => {
  assert.deepEqual((await api('GET', '/health')).body, { status: 'ok' });
  assert.equal((await api('GET', '/nic')).status, 404);
});
