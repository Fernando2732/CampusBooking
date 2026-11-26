import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { app } from '../dist/infrastructure/http/app.js';
import { prisma } from '../dist/infrastructure/prisma/index.js';

test('POST /api/bookings', async t => {
  const originals = {
    user: prisma.user.findUnique,
    room: prisma.room.findUnique,
    conflict: prisma.booking.findFirst,
    create: prisma.booking.create,
    now: Date.now
  };
  Date.now = () => Date.parse('2099-06-01T12:00:00Z');
  let existing = [];
  let conflictQueries = [];
  let saved = [];
  let createError;
  let lookups = 0;
  prisma.user.findUnique = async ({ where }) => {
    lookups++;
    return where.id === 999 ? null : { id: where.id, role: 'STUDENT' };
  };
  prisma.room.findUnique = async ({ where }) => {
    lookups++;
    return where.id === 999 ? null : { id: where.id, active: where.id !== 4 };
  };
  prisma.booking.findFirst = async ({ where }) => {
    conflictQueries.push(where);
    return existing.find(booking =>
      (where.roomId === undefined || booking.roomId === where.roomId) &&
      (where.userId === undefined || booking.userId === where.userId) &&
      booking.startAt < where.startAt.lt && booking.endAt > where.endAt.gt
    ) ?? null;
  };
  prisma.booking.create = async ({ data }) => {
    if (createError) throw createError;
    saved.push(data);
    const booking = { id: saved.length, ...data, createdAt: new Date(Date.now()) };
    existing.push(booking);
    return booking;
  };

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/bookings`;
  const base = {
    userId: 1, roomId: 1,
    startAt: '2099-06-02T10:00:00-03:00',
    endAt: '2099-06-02T11:00:00-03:00',
    purpose: '  Trabalho em grupo  '
  };
  const request = async (body, status, code) => {
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    if (code) assert.equal(result.error, code);
    return result;
  };
  const reset = () => { existing = []; conflictQueries = []; saved = []; createError = undefined; lookups = 0; };
  const at = time => `2099-06-02T${time}:00-03:00`;
  const seedBooking = (overrides = {}) => {
    existing = [{
      id: 50, userId: 2, roomId: 1,
      startAt: new Date(at('10:00')), endAt: new Date(at('11:00')),
      ...overrides
    }];
  };

  try {
    await t.test('valida body estrito, IDs, finalidade e datas com precisão de minutos', async () => {
      reset();
      const invalid = [null, [], {}, { ...base, extra: true }];
      for (const key of Object.keys(base)) {
        const missing = { ...base };
        delete missing[key];
        invalid.push(missing);
      }
      for (const key of ['userId', 'roomId']) {
        for (const value of [0, -1, 1.5, '1', null, true, 2147483648]) {
          invalid.push({ ...base, [key]: value });
        }
      }
      for (const purpose of ['', '   ', 'x'.repeat(201), null, 12]) {
        invalid.push({ ...base, purpose });
      }
      for (const key of ['startAt', 'endAt']) {
        for (const value of [
          '', null, 123, '2099-06-02T10:00:00', '2099-02-29T10:00:00Z',
          '2099-06-02T10:00:01-03:00', '2099-06-02T10:00:00.001-03:00',
          '2099-06-02T10:00:00.0001-03:00', '2099-06-02T10:00:00+99:99'
        ]) invalid.push({ ...base, [key]: value });
      }
      for (const body of invalid) await request(body, 400, 'VALIDATION_ERROR');
      assert.equal(lookups, 0);
      assert.equal(saved.length, 0);
    });

    await t.test('rejeita intervalo invertido, início passado ou presente e duração excessiva', async () => {
      reset();
      await request({ ...base, endAt: base.startAt }, 400, 'INVALID_BOOKING_INTERVAL');
      await request({ ...base, endAt: at('09:00') }, 400, 'INVALID_BOOKING_INTERVAL');
      await request({ ...base, startAt: '2099-06-01T08:00:00-03:00', endAt: '2099-06-01T09:00:00-03:00' }, 400, 'BOOKING_START_NOT_FUTURE');
      await request({ ...base, startAt: '2099-06-01T09:00:00-03:00', endAt: '2099-06-01T10:00:00-03:00' }, 400, 'BOOKING_START_NOT_FUTURE');
      await request({ ...base, endAt: at('12:01') }, 400, 'BOOKING_TOO_LONG');
      assert.equal(saved.length, 0);
    });

    await t.test('valida funcionamento e mudança de dia em Recife', async () => {
      reset();
      await request({ ...base, startAt: at('07:59'), endAt: at('08:59') }, 400, 'OUTSIDE_OPENING_HOURS');
      await request({ ...base, startAt: at('21:01'), endAt: at('22:01') }, 400, 'OUTSIDE_OPENING_HOURS');
      await request({ ...base, startAt: at('23:00'), endAt: '2099-06-03T00:00:00-03:00' }, 400, 'BOOKING_CROSSES_DAYS');
      await request({ ...base, startAt: '2099-06-02T08:00:00Z', endAt: '2099-06-02T09:00:00Z' }, 400, 'OUTSIDE_OPENING_HOURS');
    });

    await t.test('retorna 404 para usuário ou sala inexistente e 409 para sala inativa', async () => {
      reset();
      await request({ ...base, userId: 999 }, 404, 'USER_NOT_FOUND');
      await request({ ...base, roomId: 999 }, 404, 'ROOM_NOT_FOUND');
      await request({ ...base, roomId: 4 }, 409, 'ROOM_INACTIVE');
      assert.equal(saved.length, 0);
    });

    await t.test('detecta sobreposições parciais, totais e mesmo instante inicial na sala', async () => {
      reset();
      seedBooking();
      for (const [start, end] of [
        ['09:30', '10:30'], ['10:30', '11:30'], ['09:30', '11:30'],
        ['10:15', '10:45'], ['10:00', '11:00'], ['10:00', '10:30']
      ]) await request({ ...base, startAt: at(start), endAt: at(end) }, 409, 'ROOM_BOOKING_CONFLICT');
      assert.deepEqual(conflictQueries[0], {
        roomId: 1, startAt: { lt: new Date(at('10:30')) },
        endAt: { gt: new Date(at('09:30')) }, id: undefined
      });
      assert.equal(saved.length, 0);
    });

    await t.test('impede conflito do usuário em outra sala', async () => {
      reset();
      seedBooking({ userId: 1, roomId: 2 });
      await request(base, 409, 'USER_BOOKING_CONFLICT');
      assert.deepEqual(conflictQueries[1], {
        userId: 1, startAt: { lt: new Date(base.endAt) },
        endAt: { gt: new Date(base.startAt) }, id: undefined
      });
      assert.equal(saved.length, 0);
    });

    await t.test('permite intervalos adjacentes para sala e usuário', async () => {
      for (const [start, end] of [['09:00', '10:00'], ['11:00', '12:00']]) {
        reset();
        seedBooking({ userId: 1 });
        await request({ ...base, startAt: at(start), endAt: at(end) }, 201);
      }
    });

    await t.test('cria com 201, finalidade aparada e todos os campos do registro', async () => {
      reset();
      const result = await request(base, 201);
      assert.deepEqual(result, {
        id: 1, userId: 1, roomId: 1, purpose: 'Trabalho em grupo',
        startAt: '2099-06-02T13:00:00.000Z', endAt: '2099-06-02T14:00:00.000Z',
        createdAt: '2099-06-01T12:00:00.000Z'
      });
      assert.ok(saved[0].startAt instanceof Date);
      assert.ok(saved[0].endAt instanceof Date);
    });

    await t.test('aceita duração de duas horas, abertura às 08h e término às 22h', async () => {
      for (const [start, end] of [['08:00', '10:00'], ['20:00', '22:00']]) {
        reset();
        await request({ ...base, startAt: at(start), endAt: at(end) }, 201);
      }
    });

    await t.test('aceita UTC, outros offsets, milissegundos zero e limites de finalidade e IDs', async () => {
      for (const [startAt, endAt] of [
        ['2099-06-02T11:00:00Z', '2099-06-02T13:00:00Z'],
        ['2099-06-02T12:00:00+01:00', '2099-06-02T14:00:00+01:00'],
        ['2099-06-02T08:00:00.000-03:00', '2099-06-02T10:00:00.000-03:00']
      ]) {
        reset();
        const result = await request({ ...base, startAt, endAt }, 201);
        assert.equal(result.startAt, '2099-06-02T11:00:00.000Z');
        assert.equal(result.endAt, '2099-06-02T13:00:00.000Z');
      }
      for (const purpose of ['x', 'x'.repeat(200)]) {
        reset();
        await request({ ...base, userId: 2147483647, roomId: 2147483647, purpose }, 201);
      }
    });

    await t.test('converte violação da unicidade do banco em 409', async () => {
      reset();
      createError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002', clientVersion: '5.22.0', meta: { target: ['roomId', 'startAt'] }
      });
      await request(base, 409, 'ROOM_BOOKING_CONFLICT');
    });
  } finally {
    prisma.user.findUnique = originals.user;
    prisma.room.findUnique = originals.room;
    prisma.booking.findFirst = originals.conflict;
    prisma.booking.create = originals.create;
    Date.now = originals.now;
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
