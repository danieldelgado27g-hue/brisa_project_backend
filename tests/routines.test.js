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

  await request(app)
    .post("/api/diagnosis")
    .set("Authorization", `Bearer ${token}`)
    .send({
      type_name: "Piel Mixta",
      type_id: "mixed",
      concerns: ["poros dilatados", "brillo excesivo"],
    });

  await request(app)
    .put(`/api/profiles/${res.body.user.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      routine_config: { budget: "medium", optimization: "balanced", brands: [] },
    });
});

describe("POST /api/routines/generate", () => {
  it("debe generar rutina y devolver 201", async () => {
    const res = await request(app)
      .post("/api/routines/generate")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.routine).toHaveProperty("morning");
    expect(res.body.routine).toHaveProperty("night");
    expect(res.body.routine).toHaveProperty("summary");
    expect(Array.isArray(res.body.routine.morning)).toBe(true);
    expect(Array.isArray(res.body.routine.night)).toBe(true);
  });

  it("debe incluir productos en la rutina", async () => {
    const res = await request(app)
      .post("/api/routines/generate")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.routine.morning.length).toBeGreaterThan(0);
    expect(res.body.routine.night.length).toBeGreaterThan(0);
    expect(res.body.routine.morning[0]).toHaveProperty("id");
    expect(res.body.routine.morning[0]).toHaveProperty("name");
    expect(res.body.routine.morning[0]).toHaveProperty("step");
  });

  it("debe rechazar sin diagnóstico", async () => {
    await cleanDb();
    const reg = await request(app).post("/api/auth/register").send({
      name: "Sin Perfil",
      email: "sin@test.com",
      password: "123456",
    });

    const res = await request(app)
      .post("/api/routines/generate")
      .set("Authorization", `Bearer ${reg.body.token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("diagnóstico");
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).post("/api/routines/generate");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/routines", () => {
  it("debe listar rutinas del usuario", async () => {
    await request(app)
      .post("/api/routines/generate")
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .get("/api/routines")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.routines)).toBe(true);
    expect(res.body.routines.length).toBe(1);
    expect(res.body.routines[0]).toHaveProperty("id");
  });

  it("debe devolver array vacío si no hay rutinas", async () => {
    const res = await request(app)
      .get("/api/routines")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.routines).toEqual([]);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).get("/api/routines");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/routines/:id", () => {
  it("debe devolver detalle de rutina", async () => {
    const gen = await request(app)
      .post("/api/routines/generate")
      .set("Authorization", `Bearer ${token}`);
    const routineId = gen.body.routine.id;

    const res = await request(app)
      .get(`/api/routines/${routineId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.routine.id).toBe(routineId);
    expect(res.body.routine).toHaveProperty("morning");
    expect(res.body.routine).toHaveProperty("night");
  });

  it("debe devolver 404 para rutina inexistente", async () => {
    const res = await request(app)
      .get("/api/routines/999999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("debe rechazar acceso a rutina de otro usuario", async () => {
    const gen = await request(app)
      .post("/api/routines/generate")
      .set("Authorization", `Bearer ${token}`);
    const routineId = gen.body.routine.id;

    const otherRes = await request(app).post("/api/auth/register").send({
      name: "Otra Usuaria",
      email: "otra@test.com",
      password: "123456",
    });

    const res = await request(app)
      .get(`/api/routines/${routineId}`)
      .set("Authorization", `Bearer ${otherRes.body.token}`);

    expect(res.status).toBe(403);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).get("/api/routines/1");
    expect(res.status).toBe(401);
  });
});
