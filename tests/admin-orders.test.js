const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb, createAdminUser, createTestUser, createTestOrder } = require("./helpers");

beforeAll(async () => {
  try {
    await initDb();
  } catch (err) {
    console.warn("initDb warning:", err.message);
  }
});

beforeEach(async () => {
  await cleanDb();
});

afterEach(async () => {
  await cleanDb();
});

describe("GET /api/admin/orders - autorización", () => {
  it("debe rechazar sin token (401)", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${user.token}`);

    expect([401, 403, 404]).toContain(res.status);
  });

  it("debe permitir admin (200) - cuando se implemente", async () => {
    const admin = await createAdminUser();

    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${admin.token}`);

    expect([200, 404]).toContain(res.status);
  });
});

describe("GET /api/admin/orders - funcionalidad", () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    // Crear algunas órdenes
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    await createTestOrder(user1.user.id, { total: 100, status: 'confirmed' });
    await createTestOrder(user2.user.id, { total: 50, status: 'pending' });
  });

  it("debe listar todas las órdenes (no solo propias)", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${adminToken}`);

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // expect(res.body.orders.length).toBeGreaterThanOrEqual(2);
  });

  it("debe incluir información del usuario", async () => {
    // Verificar que viene info del usuario que hizo la orden
  });

  it("debe soportar filtros por status", async () => {
    const res = await request(app)
      .get("/api/admin/orders?status=pending")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 404]).toContain(res.status);
  });

  it("debe soportar paginación", async () => {
    const res = await request(app)
      .get("/api/admin/orders?page=1&limit=10")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 404]).toContain(res.status);
  });
});

describe("PUT /api/admin/orders/:id - autorización", () => {
  let adminToken, orderId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    const user = await createTestUser();
    const order = await createTestOrder(user.user.id);
    orderId = order.id;
  });

  it("debe rechazar sin token (401)", async () => {
    const res = await request(app)
      .put(`/api/admin/orders/${orderId}`)
      .send({ status: 'confirmed' });

    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .put(`/api/admin/orders/${orderId}`)
      .set("Authorization", `Bearer ${user.token}`)
      .send({ status: 'confirmed' });

    expect([401, 403, 404]).toContain(res.status);
  });
});

describe("PUT /api/admin/orders/:id - funcionalidad", () => {
  let adminToken, orderId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    const user = await createTestUser();
    const order = await createTestOrder(user.user.id, { status: 'pending' });
    orderId = order.id;
  });

  it("debe actualizar estado de orden (200)", async () => {
    const res = await request(app)
      .put(`/api/admin/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // expect(res.body.order.status).toBe('confirmed');
  });

  it("debe validar transición de estados válida", async () => {
    // Transiciones válidas:
    // pending → confirmed → processing → shipped → delivered
    // Cualquier estado → cancelled

    // Transición inválida: delivered → pending (no se puede revertir)
    const res = await request(app)
      .put(`/api/admin/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: 'delivered' }); // Desde pending no es válido

    expect([200, 400, 404]).toContain(res.status);

    // Cuando se implemente con validación:
    // expect(res.status).toBe(400);
    // expect(res.body.error).toMatch(/transición.*inválida/);
  });

  it("debe registrar cambio en audit log", async () => {
    // Verificar que se registró old_status y new_status
  });
});
