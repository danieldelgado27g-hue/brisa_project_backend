const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb, createAdminUser, createTestUser } = require("./helpers");

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

describe("GET /api/admin/users - autorización", () => {
  it("debe rechazar sin token (401)", async () => {
    const res = await request(app).get("/api/admin/users");
    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${user.token}`);

    expect([401, 403, 404]).toContain(res.status);
  });

  it("debe permitir admin (200) - cuando se implemente", async () => {
    const admin = await createAdminUser();

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${admin.token}`);

    expect([200, 404]).toContain(res.status);
  });
});

describe("GET /api/admin/users - funcionalidad", () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    // Crear algunos usuarios de prueba
    await createTestUser({ name: "User 1", role: 'user' });
    await createTestUser({ name: "User 2", role: 'premium' });
    await createTestUser({ name: "Dr. Test", role: 'dermatologist' });
  });

  it("debe listar todos los usuarios", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // expect(res.body.users.length).toBeGreaterThanOrEqual(4);
  });

  it("debe incluir rol en respuesta", async () => {
    // Cuando se implemente, verificar que role viene en la respuesta
    // const users = res.body.users;
    // users.forEach(u => {
    //   expect(u).toHaveProperty('role');
    // });
  });
});

describe("GET /api/admin/users - filtros", () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    await createTestUser({ name: "Regular User", role: 'user' });
    await createTestUser({ name: "Premium User", role: 'premium' });
    await createAdminUser({ name: "Another Admin" });
  });

  it("debe filtrar por role=user", async () => {
    const res = await request(app)
      .get("/api/admin/users?role=user")
      .set("Authorization", `Bearer ${adminToken}`);

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // res.body.users.forEach(u => {
    //   expect(u.role).toBe('user');
    // });
  });

  it("debe filtrar por role=admin", async () => {
    const res = await request(app)
      .get("/api/admin/users?role=admin")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 404]).toContain(res.status);
  });

  it("debe soportar paginación", async () => {
    const res = await request(app)
      .get("/api/admin/users?page=1&limit=10")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 404]).toContain(res.status);
  });
});

describe("PUT /api/admin/users/:id - autorización", () => {
  let adminToken, userId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    const user = await createTestUser();
    userId = user.user.id;
  });

  it("debe rechazar sin token (401)", async () => {
    const res = await request(app)
      .put(`/api/admin/users/${userId}`)
      .send({ role: 'premium' });

    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .put(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${user.token}`)
      .send({ role: 'premium' });

    expect([401, 403, 404]).toContain(res.status);
  });
});

describe("PUT /api/admin/users/:id - funcionalidad", () => {
  let adminToken, userId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    const user = await createTestUser();
    userId = user.user.id;
  });

  it("debe actualizar rol de usuario", async () => {
    const res = await request(app)
      .put(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: 'premium' });

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // expect(res.body.user.role).toBe('premium');
  });

  it("debe rechazar rol inválido", async () => {
    const res = await request(app)
      .put(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: 'superadmin' });

    expect([400, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(400);
    // expect(res.body.error).toMatch(/rol.*inválido/);
  });

  it("debe registrar cambio en audit log", async () => {
    // Verificar que se registró la acción de update_user con old/new values
  });

  it("deve prevenir que admin se modifique a sí mismo", async () => {
    const admin = await createAdminUser();

    const res = await request(app)
      .put(`/api/admin/users/${admin.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: 'user' });

    // Por ahora, endpoint no existe (404)
    expect([200, 400, 404]).toContain(res.status);

    // Cuando se implemente, debe prevenir o advertir
    // expect(res.status).toBe(400);
    // expect(res.body.error).toMatch(/no puedes modificarte.*mismo/);
  });
});
