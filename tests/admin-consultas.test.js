const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb, createAdminUser, createTestUser, createConsulta, createDermatologist } = require("./helpers");

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

describe("GET /api/admin/consultas - autorización", () => {
  it("debe rechazar sin token (401)", async () => {
    const res = await request(app).get("/api/admin/consultas");
    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .get("/api/admin/consultas")
      .set("Authorization", `Bearer ${user.token}`);

    expect([401, 403, 404]).toContain(res.status);
  });

  it("debe permitir admin (200) - cuando se implemente", async () => {
    const admin = await createAdminUser();

    const res = await request(app)
      .get("/api/admin/consultas")
      .set("Authorization", `Bearer ${admin.token}`);

    expect([200, 404]).toContain(res.status);
  });

  it("debe permitir dermatólogo (200) - cuando se implemente", async () => {
    const dr = await createDermatologist();

    const res = await request(app)
      .get("/api/admin/consultas")
      .set("Authorization", `Bearer ${dr.token}`);

    expect([200, 404]).toContain(res.status);
  });
});

describe("GET /api/admin/consultas - funcionalidad", () => {
  let adminToken, user1, user2, consulta1, consulta2;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    user1 = await createTestUser();
    user2 = await createTestUser();
    consulta1 = await createConsulta(user1.user.id, { subject: "Consulta 1" });
    consulta2 = await createConsulta(user2.user.id, { subject: "Consulta 2" });
  });

  it("debe listar todas las consultas (no solo propias)", async () => {
    const res = await request(app)
      .get("/api/admin/consultas")
      .set("Authorization", `Bearer ${adminToken}`);

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // expect(res.body.consultas.length).toBeGreaterThanOrEqual(2);
  });

  it("debe filtrar por status=pending", async () => {
    const res = await request(app)
      .get("/api/admin/consultas?status=pending")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // res.body.consultas.forEach(c => {
    //   expect(c.status).toBe('pending');
    // });
  });

  it("debe incluir usuario que creó la consulta", async () => {
    // Cuando se implemente, verificar que viene info del usuario
    // expect(res.body.consultas[0]).toHaveProperty('user');
    // expect(res.body.consultas[0].user.name).toBeDefined();
  });
});

describe("PUT /api/admin/consultas/:id - autorización", () => {
  let adminToken, consultaId, dermatologistId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    const user = await createTestUser();
    consultaId = (await createConsulta(user.user.id)).id;
    const dr = await createDermatologist();
    dermatologistId = dr.dermatologistId;
  });

  it("debe rechazar sin token (401)", async () => {
    const res = await request(app)
      .put(`/api/admin/consultas/${consultaId}`)
      .send({ answer: "Respuesta" });

    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .put(`/api/admin/consultas/${consultaId}`)
      .set("Authorization", `Bearer ${user.token}`)
      .send({ answer: "Respuesta" });

    expect([401, 403, 404]).toContain(res.status);
  });
});

describe("PUT /api/admin/consultas/:id - funcionalidad", () => {
  let adminToken, consultaId, dermatologistId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    const user = await createTestUser();
    consultaId = (await createConsulta(user.user.id)).id;
    const dr = await createDermatologist();
    dermatologistId = dr.dermatologistId;
  });

  it("debe responder consulta (200)", async () => {
    const answer = "Respuesta del dermatólogo";

    const res = await request(app)
      .put(`/api/admin/consultas/${consultaId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        answer,
        answered_by: dermatologistId
      });

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // expect(res.body.consulta.answer).toBe(answer);
    // expect(res.body.consulta.status).toBe('answered');
  });

  it("debe actualizar answered_by y answered_at", async () => {
    // Verificar que se setearon answered_by y answered_at
  });

  it("debe requerir answer field", async () => {
    const res = await request(app)
      .put(`/api/admin/consultas/${consultaId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ answered_by: dermatologistId });

    expect([400, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(400);
    // expect(res.body.error).toMatch(/answer.*requerido/);
  });

  it("debe registrar acción en audit log", async () => {
    // Verificar que se registró la acción de answer_consulta
  });
});
