const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb, seedProducts } = require("./helpers");

let token;

beforeAll(async () => {
  try {
    await initDb();
    await seedProducts();
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

describe("POST /api/community-routines", () => {
  it("debe compartir rutina y devolver 201", async () => {
    const res = await request(app)
      .post("/api/community-routines")
      .set("Authorization", `Bearer ${token}`)
      .send({
        skin_type: "mixed",
        allergies: ["fragrance-free"],
        products: [{ id: 1, name: "Limpiador" }],
        avatar_emoji: "🌟",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.routine.skin_type).toBe("mixed");
    expect(res.body.routine).toHaveProperty("likes_count");
  });

  it("debe rechazar sin skin_type", async () => {
    const res = await request(app)
      .post("/api/community-routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ products: [] });

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app)
      .post("/api/community-routines")
      .send({ skin_type: "dry", products: [] });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/community-routines", () => {
  it("debe listar rutinas compartidas", async () => {
    await request(app)
      .post("/api/community-routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ skin_type: "oily", products: [{ id: 1 }] });

    const res = await request(app).get("/api/community-routines");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.routines)).toBe(true);
    expect(res.body.routines.length).toBe(1);
    expect(res.body.routines[0].skin_type).toBe("oily");
  });

  it("debe devolver array vacío si no hay rutinas", async () => {
    const res = await request(app).get("/api/community-routines");
    expect(res.status).toBe(200);
    expect(res.body.routines).toEqual([]);
  });
});

describe("GET /api/community-routines/:id", () => {
  it("debe devolver detalle", async () => {
    const createRes = await request(app)
      .post("/api/community-routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ skin_type: "dry", products: [{ id: 1, name: "Test" }] });

    const routineId = createRes.body.routine.id;

    const res = await request(app).get(`/api/community-routines/${routineId}`);

    expect(res.status).toBe(200);
    expect(res.body.routine.skin_type).toBe("dry");
    expect(res.body.routine.products).toEqual([{ id: 1, name: "Test" }]);
  });

  it("debe devolver 404 para ID inexistente", async () => {
    const res = await request(app).get("/api/community-routines/999999");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/community-routines/:id", () => {
  it("debe eliminar propia rutina", async () => {
    const createRes = await request(app)
      .post("/api/community-routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ skin_type: "dry", products: [] });

    const routineId = createRes.body.routine.id;

    const res = await request(app)
      .delete(`/api/community-routines/${routineId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("debe devolver 404 si no existe", async () => {
    const res = await request(app)
      .delete("/api/community-routines/999999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
