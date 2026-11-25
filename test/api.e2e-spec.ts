import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, type TestApp } from './utils';

let t: TestApp;
let server: App;

beforeAll(async () => {
  t = await createTestApp();
  server = t.app.getHttpServer();
});
afterAll(() => t.close());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let counter = 0;
async function registerUser(password = 'tajnehaslo1') {
  const email = `user${++counter}@example.com`;
  const res = await request(server).post('/auth/register').send({ name: 'Jan Kowalski', email, password });
  expect(res.status).toBe(201);
  return { email, password, token: res.body.token as string };
}

// Kształt jak z JSONEncoder (.iso8601) w aplikacji – UUID wielkimi literami.
const sub = (overrides: Record<string, unknown> = {}) => ({
  id: randomUUID().toUpperCase(),
  name: 'Netflix',
  price: 22.99,
  period: 'month',
  firstPayment: '2026-10-22T22:00:00.000Z',
  category: 'entertainment',
  symbol: 'play.rectangle.fill',
  colorHex: 0xe50914,
  ...overrides,
});

describe('auth', () => {
  it('rejestracja zwraca token i dane użytkownika bez hasła', async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ name: '  Anna Nowak ', email: ' Anna@Example.COM ', password: 'tajnehaslo1' });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: 'anna@example.com',
      name: 'Anna Nowak',
      createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
    });
  });

  it('ten sam e-mail nie może zostać zarejestrowany dwa razy', async () => {
    const { email } = await registerUser();
    const res = await request(server)
      .post('/auth/register')
      .send({ name: 'X', email: email.toUpperCase(), password: 'tajnehaslo1' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Konto z tym adresem e-mail już istnieje.' });
  });

  it('walidacja zwraca polskie komunikaty i nazwę pola', async () => {
    const short = await request(server)
      .post('/auth/register')
      .send({ name: 'X', email: 'x@example.com', password: 'krotkie' });
    expect(short.status).toBe(400);
    expect(short.body).toEqual({ error: 'Hasło musi mieć co najmniej 8 znaków.', field: 'password' });

    const badEmail = await request(server)
      .post('/auth/register')
      .send({ name: 'X', email: 'nie-email', password: 'tajnehaslo1' });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body).toEqual({ error: 'Podaj poprawny adres e-mail.', field: 'email' });

    const empty = await request(server).post('/auth/register').send({});
    expect(empty.status).toBe(400);
    expect(typeof empty.body.error).toBe('string');
  });

  it('logowanie działa niezależnie od wielkości liter w e-mailu', async () => {
    const { email, password } = await registerUser();
    const res = await request(server).post('/auth/login').send({ email: email.toUpperCase(), password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('złe hasło i nieznany e-mail dają ten sam błąd 401', async () => {
    const { email } = await registerUser();
    const wrong = await request(server).post('/auth/login').send({ email, password: 'zlehaslo123' });
    const unknown = await request(server).post('/auth/login').send({ email: 'brak@example.com', password: 'zlehaslo123' });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({ error: 'Nieprawidłowy e-mail lub hasło.' });
    expect(unknown.body).toEqual(wrong.body);
  });

  it('nieprawidłowy JSON i brak treści dają 400 w formacie { error }', async () => {
    const bad = await request(server).post('/auth/login').set('Content-Type', 'application/json').send('{nie json');
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: 'Nieprawidłowy format JSON.' });

    const none = await request(server).post('/auth/login');
    expect(none.status).toBe(400);
    expect(typeof none.body.error).toBe('string');

    const huge = await request(server)
      .post('/auth/login')
      .send({ email: 'x@example.com', password: 'x'.repeat(1_100_000) });
    expect(huge.status).toBe(413);
    expect(huge.body).toEqual({ error: 'Zbyt duże żądanie.' });
  });
});

describe('chronione endpointy', () => {
  it('bez tokenu lub z błędnym tokenem: 401', async () => {
    const none = await request(server).get('/me');
    expect(none.status).toBe(401);
    expect(none.body).toEqual({ error: 'Wymagane logowanie.' });
    const bad = await request(server).get('/subscriptions').set(auth('zly.token'));
    expect(bad.status).toBe(401);
    expect(bad.body).toEqual({ error: 'Sesja wygasła. Zaloguj się ponownie.' });
  });

  it('GET i PATCH /me', async () => {
    const { token } = await registerUser();
    const me = await request(server).get('/me').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.name).toBe('Jan Kowalski');

    const patched = await request(server).patch('/me').set(auth(token)).send({ name: 'Jan Nowak' });
    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe('Jan Nowak');

    const empty = await request(server).patch('/me').set(auth(token)).send({});
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: 'Brak danych do zmiany.' });
  });

  it('PATCH /me nie pozwala przejąć cudzego e-maila', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const res = await request(server).patch('/me').set(auth(b.token)).send({ email: a.email.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Konto z tym adresem e-mail już istnieje.' });
  });

  it('zmiana hasła unieważnia stare tokeny', async () => {
    const { email, token } = await registerUser('starehaslo1');

    const wrong = await request(server)
      .post('/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'xxxxxxxx', newPassword: 'nowehaslo1' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe('Obecne hasło jest nieprawidłowe.');

    const ok = await request(server)
      .post('/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'starehaslo1', newPassword: 'nowehaslo1' });
    expect(ok.status).toBe(200);

    expect((await request(server).get('/me').set(auth(token))).status).toBe(401);
    expect((await request(server).get('/me').set(auth(ok.body.token))).status).toBe(200);
    expect((await request(server).post('/auth/login').send({ email, password: 'starehaslo1' })).status).toBe(401);
    expect((await request(server).post('/auth/login').send({ email, password: 'nowehaslo1' })).status).toBe(200);
  });

  it('DELETE /me usuwa konto i jego subskrypcje', async () => {
    const { email, password, token } = await registerUser();
    await request(server).put('/subscriptions').set(auth(token)).send([sub()]);
    const userId = (await request(server).get('/me').set(auth(token))).body.id;

    expect((await request(server).delete('/me').set(auth(token))).status).toBe(204);
    expect((await request(server).get('/me').set(auth(token))).status).toBe(401);
    expect((await request(server).post('/auth/login').send({ email, password })).status).toBe(401);
    expect(await t.app.get(PrismaService).subscription.count({ where: { userId } })).toBe(0);
  });
});

describe('subskrypcje', () => {
  it('nowe konto ma pustą listę', async () => {
    const { token } = await registerUser();
    const res = await request(server).get('/subscriptions').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('PUT zastępuje listę i zachowuje kolejność oraz pola', async () => {
    const { token } = await registerUser();
    const first = [sub({ name: 'A' }), sub({ name: 'B', period: 'year', price: 120 }), sub({ name: 'C' })];
    const put = await request(server).put('/subscriptions').set(auth(token)).send(first);
    expect(put.status).toBe(200);
    expect(put.body).toEqual(first);
    expect((await request(server).get('/subscriptions').set(auth(token))).body).toEqual(first);

    const second = [first[2], sub({ name: 'D', category: 'tools' })];
    await request(server).put('/subscriptions').set(auth(token)).send(second);
    expect((await request(server).get('/subscriptions').set(auth(token))).body).toEqual(second);
  });

  it('daty z przesunięciem strefy i bez milisekund są normalizowane do UTC', async () => {
    const { token } = await registerUser();
    const res = await request(server)
      .put('/subscriptions')
      .set(auth(token))
      .send([sub({ firstPayment: '2026-10-23T00:00:00+02:00' })]);
    expect(res.status).toBe(200);
    expect(res.body[0].firstPayment).toBe('2026-10-22T22:00:00.000Z');
  });

  it('cena może wynosić najwyżej 10 000', async () => {
    const { token } = await registerUser();
    const put = (price: number) => request(server).put('/subscriptions').set(auth(token)).send([sub({ price })]);
    expect((await put(10_000)).status).toBe(200);
    const tooHigh = await put(10_000.01);
    expect(tooHigh.status).toBe(400);
    expect(tooHigh.body).toEqual({ error: 'Cena subskrypcji może wynosić najwyżej 10 000.', field: '0.price' });
  });

  it('data dezaktywacji jest zapisywana, a dla aktywnych pomijana', async () => {
    const { token } = await registerUser();
    const active = sub({ name: 'Aktywna' });
    const inactive = sub({ name: 'Nieaktywna', deactivatedAt: '2026-11-25T18:30:00Z' });
    const expected = [active, { ...inactive, deactivatedAt: '2026-11-25T18:30:00.000Z' }];
    const put = await request(server)
      .put('/subscriptions')
      .set(auth(token))
      .send([{ ...active, deactivatedAt: null }, inactive]);
    expect(put.status).toBe(200);
    expect(put.body).toEqual(expected);
    expect(put.body[0]).not.toHaveProperty('deactivatedAt');
    expect((await request(server).get('/subscriptions').set(auth(token))).body).toEqual(expected);
  });

  it('użytkownicy nie widzą swoich subskrypcji nawzajem', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const shared = sub();
    await request(server).put('/subscriptions').set(auth(a.token)).send([shared]);
    // Ten sam identyfikator u innego użytkownika nie koliduje.
    expect((await request(server).put('/subscriptions').set(auth(b.token)).send([shared])).status).toBe(200);
    await request(server).put('/subscriptions').set(auth(b.token)).send([]);
    expect((await request(server).get('/subscriptions').set(auth(a.token))).body).toEqual([shared]);
    expect((await request(server).get('/subscriptions').set(auth(b.token))).body).toEqual([]);
  });

  it('nieprawidłowe dane są odrzucane bez zmiany zapisanej listy', async () => {
    const { token } = await registerUser();
    const saved = [sub()];
    await request(server).put('/subscriptions').set(auth(token)).send(saved);

    const dup = sub();
    const cases: [unknown, string | undefined][] = [
      [[sub({ period: 'week' })], '0.period'],
      [[sub(), sub({ price: -1 })], '1.price'],
      [[sub({ price: 10_000.01 })], '0.price'],
      [[sub({ firstPayment: 'wczoraj' })], '0.firstPayment'],
      [[sub({ deactivatedAt: 'wczoraj' })], '0.deactivatedAt'],
      [[sub({ deactivatedAt: '' })], '0.deactivatedAt'],
      [[sub({ id: 'abc' })], '0.id'],
      [[sub({ colorHex: 0x1000000 })], '0.colorHex'],
      [[sub({ name: '   ' })], '0.name'],
      [[dup, { ...dup }], undefined],
      [{ not: 'array' }, undefined],
      [[42], '0'],
    ];
    for (const [body, field] of cases) {
      const res = await request(server).put('/subscriptions').set(auth(token)).send(body as object);
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
      expect(typeof res.body.error).toBe('string');
      expect(res.body.field).toBe(field);
    }
    expect((await request(server).get('/subscriptions').set(auth(token))).body).toEqual(saved);
  });

  it('nieznane pola są pomijane', async () => {
    const { token } = await registerUser();
    const res = await request(server).put('/subscriptions').set(auth(token)).send([{ ...sub(), extra: 1 }]);
    expect(res.status).toBe(200);
    expect(res.body[0].extra).toBeUndefined();
  });
});

describe('system', () => {
  it('GET /health i nieznana ścieżka', async () => {
    expect((await request(server).get('/health')).body).toEqual({ status: 'ok' });
    const missing = await request(server).get('/nic');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Nie znaleziono.' });
  });

  it('Swagger publikuje specyfikację OpenAPI wszystkich endpointów', async () => {
    const res = await request(server).get('/docs-json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths).sort()).toEqual(
      ['/auth/change-password', '/auth/login', '/auth/register', '/health', '/me', '/subscriptions'].sort(),
    );
    expect(res.body.components.schemas.SubscriptionDto.required).toEqual(
      expect.arrayContaining(['id', 'name', 'price', 'period', 'firstPayment', 'category', 'symbol', 'colorHex']),
    );
    expect((await request(server).get('/docs')).status).toBe(200);
  });
});
