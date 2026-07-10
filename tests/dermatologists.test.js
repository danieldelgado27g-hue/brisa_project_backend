const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb, pool } = require("./helpers");

let token;

beforeAll(async () => {
  try {
    await initDb();
    await pool.query("DELETE FROM dermatologists");
    await pool.query(`
      INSERT INTO dermatologists (name, specialty, clinic, distance_km, rating, phone, email, photo_url, available_slots)
      VALUES
      ('Dra. Laura Martínez', 'Dermatología General', 'Clínica DermaCare', 3.5, 4.8, '555-0101', 'laura@derma.com', NULL, '["2026-07-08T10:00","2026-07-08T11:00"]'),
      ('Dr. Carlos Ruiz', 'Dermatología Cosmética', 'SkinHealth Center', 8.2, 4.6, '555-0102', 'carlos@skin.com', NULL, '["2026-07-09T09:00","2026-07-09T10:00"]')
    `);
  } catch (err) {
    console.warn("initDb/seed warning:", err.message);
  }
});

beforeEach(async () => {
  await cleanDb().catch(() => {});
  const res = await request(app).post("/api/auth/register").send({
    name: "María García",
    email: "maria@ejemplo.com",
    password: "miClave123",
  });
  token = res.body.token;
});

describe("GET /api/dermatologists", () => {
  it("debe listar dermatólogos activos", async () => {
    const res = await request(app).get("/api/dermatologists");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.dermatologists)).toBe(true);
    expect(res.body.dermatologists.length).toBe(2);
    expect(res.body.dermatologists[0]).toHaveProperty("name");
    expect(res.body.dermatologists[0]).toHaveProperty("specialty");
    expect(res.body.dermatologists[0]).toHaveProperty("clinic");
  });

  it("cada dermatólogo debe tener campos esperados", async () => {
    const res = await request(app).get("/api/dermatologists");

    const d = res.body.dermatologists[0];
    expect(d).toHaveProperty("distance_km");
    expect(d).toHaveProperty("rating");
    expect(d).toHaveProperty("phone");
    expect(d).toHaveProperty("available_slots");
  });
});

describe("GET /api/dermatologists/:id", () => {
  it("debe devolver detalle de dermatólogo", async () => {
    const listRes = await request(app).get("/api/dermatologists");
    const dermId = listRes.body.dermatologists[0].id;

    const res = await request(app).get(`/api/dermatologists/${dermId}`);

    expect(res.status).toBe(200);
    expect(res.body.dermatologist.name).toBe("Dra. Laura Martínez");
    expect(res.body.dermatologist).toHaveProperty("available_slots");
  });

  it("debe devolver 404 para ID inexistente", async () => {
    const res = await request(app).get("/api/dermatologists/999999");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/consultas", () => {
  it("debe crear consulta y devolver 201", async () => {
    const res = await request(app)
      .post("/api/consultas")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Consulta sobre producto", message: "¿Es este producto adecuado para mí?" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.consulta.subject).toBe("Consulta sobre producto");
    expect(res.body.consulta.status).toBe("pending");
  });

  it("debe rechazar sin subject", async () => {
    const res = await request(app)
      .post("/api/consultas")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Solo mensaje" });

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app)
      .post("/api/consultas")
      .send({ subject: "Test", message: "Test" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/consultas", () => {
  it("debe listar consultas del usuario", async () => {
    await request(app)
      .post("/api/consultas")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Primera", message: "Msg 1" });

    await request(app)
      .post("/api/consultas")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Segunda", message: "Msg 2" });

    const res = await request(app)
      .get("/api/consultas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.consultas.length).toBe(2);
    expect(res.body.consultas[0]).toHaveProperty("subject");
    expect(res.body.consultas[0]).toHaveProperty("status");
  });

  it("debe devolver array vacío si no hay consultas", async () => {
    const res = await request(app)
      .get("/api/consultas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.consultas).toEqual([]);
  });
});

describe("GET /api/consultas/:id", () => {
  it("debe devolver detalle de consulta", async () => {
    const createRes = await request(app)
      .post("/api/consultas")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Mi consulta", message: "Detalle" });

    const consultaId = createRes.body.consulta.id;

    const res = await request(app)
      .get(`/api/consultas/${consultaId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.consulta.subject).toBe("Mi consulta");
    expect(res.body.consulta.message).toBe("Detalle");
  });

  it("debe devolver 404 para ID inexistente", async () => {
    const res = await request(app)
      .get("/api/consultas/999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("debe rechazar acceso a consulta de otro usuario", async () => {
    const createRes = await request(app)
      .post("/api/consultas")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Privada", message: "Solo yo" });

    const consultaId = createRes.body.consulta.id;

    const otherRes = await request(app).post("/api/auth/register").send({
      name: "Otra",
      email: "otra@test.com",
      password: "123456",
    });

    const res = await request(app)
      .get(`/api/consultas/${consultaId}`)
      .set("Authorization", `Bearer ${otherRes.body.token}`);

    expect(res.status).toBe(403);
  });
});
