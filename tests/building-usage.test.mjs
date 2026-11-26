import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { app } from '../dist/infrastructure/http/app.js';
import { prisma } from '../dist/infrastructure/prisma/index.js';

test('GET /api/buildings/:buildingId/usage', async t => {
  const originalFindBuilding = prisma.building.findUnique;
  const originalFindRooms = prisma.room.findMany;
  const building = { id: 1, name: 'Campus Central', address: 'Rua A' };
  let rooms = [];
  const buildingQueries = [];
  const roomQueries = [];

  prisma.building.findUnique = async query => {
    buildingQueries.push(query);
    return query.where.id === building.id ? building : null;
  };
  prisma.room.findMany = async query => {
    roomQueries.push(query);
    return rooms;
  };

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/buildings`;
  const request = async (path, expectedStatus = 200) => {
    const response = await fetch(base + path);
    assert.equal(response.status, expectedStatus, path);
    return response.json();
  };
  const booking = (start, end) => ({
    startAt: new Date(start),
    endAt: end === null ? null : new Date(end)
  });

  try {
    await t.test('valida IDs, datas reais, formato e parâmetros repetidos', async () => {
      for (const path of [
        '/0/usage?date=2026-12-01',
        '/-1/usage?date=2026-12-01',
        '/1.5/usage?date=2026-12-01',
        '/abc/usage?date=2026-12-01',
        '/2147483648/usage?date=2026-12-01',
        '/1/usage',
        '/1/usage?date=',
        '/1/usage?date=2026-02-29',
        '/1/usage?date=2026-04-31',
        '/1/usage?date=2026-13-01',
        '/1/usage?date=2026-00-01',
        '/1/usage?date=2026-12-00',
        '/1/usage?date=2026-2-01',
        '/1/usage?date=01-12-2026',
        '/1/usage?date=2026-12-01T00:00:00Z',
        '/1/usage?date=2026-12-01&date=2026-12-02',
        '/1/usage?date[x]=2026-12-01'
      ]) {
        const body = await request(path, 400);
        assert.equal(body.error, 'VALIDATION_ERROR');
        assert.equal(typeof body.message, 'string');
      }
      assert.equal(buildingQueries.length, 0);
      assert.equal(roomQueries.length, 0);
    });

    await t.test('retorna 404 para prédio inexistente', async () => {
      const body = await request('/999/usage?date=2026-12-01', 404);
      assert.equal(body.error, 'BUILDING_NOT_FOUND');
      assert.equal(roomQueries.length, 0);
    });

    await t.test('reproduz o exemplo de uma reserva de 120 minutos', async () => {
      rooms = [{
        id: 1, name: 'Laboratório 01',
        bookings: [booking('2026-12-01T11:00:00-03:00', '2026-12-01T13:00:00-03:00')]
      }];
      assert.deepEqual(await request('/1/usage?date=2026-12-01'), {
        buildingId: 1, buildingName: 'Campus Central', date: '2026-12-01',
        totalRooms: 1, totalBookings: 1, totalAvailableMinutes: 840,
        totalBookedMinutes: 120, overallUsagePercentage: 14.29,
        rooms: [{
          roomId: 1, name: 'Laboratório 01', bookings: 1, bookedMinutes: 120,
          availableMinutes: 720, usagePercentage: 14.29
        }]
      });
    });

    await t.test('consulta apenas salas ativas e reservas no dia de Recife', async () => {
      assert.deepEqual(roomQueries.at(-1), {
        where: { buildingId: 1, active: true },
        include: { bookings: { where: { startAt: {
          gte: new Date('2026-12-01T03:00:00Z'),
          lt: new Date('2026-12-02T03:00:00Z')
        } } } }
      });
      assert.deepEqual(buildingQueries.at(-1), { where: { id: 1 } });
    });

    await t.test('soma reservas, inclui salas vazias e desempata por ID', async () => {
      rooms = [
        { id: 4, name: 'Sem reservas', bookings: [] },
        { id: 3, name: 'Sala 3', bookings: [booking('2026-12-01T11:00:00Z', '2026-12-01T13:00:00Z')] },
        { id: 2, name: 'Sala 2', bookings: [
          booking('2026-12-01T11:00:00Z', '2026-12-01T12:00:00Z'),
          booking('2026-12-01T12:00:00Z', '2026-12-01T13:00:00Z')
        ] },
        { id: 1, name: 'Sala 1', bookings: [booking('2026-12-01T11:00:00Z', '2026-12-01T11:30:00Z')] }
      ];
      const body = await request('/1/usage?date=2026-12-01');
      assert.equal(body.totalRooms, 4);
      assert.equal(body.totalBookings, 4);
      assert.equal(body.totalAvailableMinutes, 3360);
      assert.equal(body.totalBookedMinutes, 270);
      assert.equal(body.overallUsagePercentage, 8.04);
      assert.deepEqual(body.rooms.map(room => room.roomId), [2, 3, 1, 4]);
      assert.equal(body.rooms[0].bookings, 2);
      assert.deepEqual(body.rooms[3], {
        roomId: 4, name: 'Sem reservas', bookings: 0, bookedMinutes: 0,
        availableMinutes: 840, usagePercentage: 0
      });
    });

    await t.test('sem salas ativas, retorna lista vazia e totais zero', async () => {
      rooms = [];
      assert.deepEqual(await request('/1/usage?date=2026-12-01'), {
        buildingId: 1, buildingName: 'Campus Central', date: '2026-12-01',
        totalRooms: 0, totalBookings: 0, totalAvailableMinutes: 0,
        totalBookedMinutes: 0, overallUsagePercentage: 0, rooms: []
      });
    });

    await t.test('aceita ano bissexto e limita corretamente o último dia do ano', async () => {
      await request('/1/usage?date=2028-02-29');
      await request('/1/usage?date=2026-12-31');
      const range = roomQueries.at(-1).include.bookings.where.startAt;
      assert.equal(range.gte.toISOString(), '2026-12-31T03:00:00.000Z');
      assert.equal(range.lt.toISOString(), '2027-01-01T03:00:00.000Z');
    });

    await t.test('sinaliza reserva sem término em vez de produzir indicadores incorretos', async () => {
      rooms = [{ id: 1, name: 'Sala 1', bookings: [booking('2026-12-01T11:00:00Z', null)] }];
      const body = await request('/1/usage?date=2026-12-01', 500);
      assert.equal(body.error, 'INVALID_BOOKING_DATA');
    });
  } finally {
    prisma.building.findUnique = originalFindBuilding;
    prisma.room.findMany = originalFindRooms;
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
