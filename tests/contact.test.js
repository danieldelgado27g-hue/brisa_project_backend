const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb } = require("./helpers");

beforeAll(async () => {
  try {
    await initDb();
  } catch (err) {
    console.warn("initDb warning:", err.message);
  }
});

beforeEach(async () => {
  await cleanDb().catch(() => {});
});

describe("POST /api/contact", () => {
  it("debe guardar y devolver 200", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ name: "Juan", email: "juan@test.com", message: "Consulta de prueba" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("Juan");
  });

  it("debe rechazar sin name", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ email: "juan@test.com", message: "Mensaje" });

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin email", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ name: "Juan", message: "Mensaje" });

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin message", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ name: "Juan", email: "juan@test.com" });

    expect(res.status).toBe(400);
  });
});
