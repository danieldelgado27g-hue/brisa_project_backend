const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb } = require("./helpers");

let token;

beforeAll(async () => {
  try {
    await initDb();
  } catch (err) {
    console.warn("initDb warning:", err.message);
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

describe("POST /api/diagnosis", () => {
  const validPayload = {
    type_name: "Piel Mixta",
    type_id: "mixed",
    concerns: ["poros dilatados", "brillo excesivo"],
    allergies: ["fragancias"],
    answers: { q1: "si", q2: "no" },
  };

  it("debe crear perfil de piel y devolver 201", async () => {
    const res = await request(app)
      .post("/api/diagnosis")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.profile).toMatchObject({
      type_name: "Piel Mixta",
      type_id: "mixed",
    });
    expect(res.body.profile).toHaveProperty("id");
    expect(res.body.profile.concerns).toEqual(["poros dilatados", "brillo excesivo"]);
  });

  it("debe actualizar perfil existente (upsert)", async () => {
    await request(app)
      .post("/api/diagnosis")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload);

    const res = await request(app)
      .post("/api/diagnosis")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validPayload, type_name: "Piel Grasa" });

    expect(res.status).toBe(200);
    expect(res.body.profile.type_name).toBe("Piel Grasa");
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app)
      .post("/api/diagnosis")
      .send(validPayload);

    expect(res.status).toBe(401);
  });

  it("debe rechazar sin type_id", async () => {
    const res = await request(app)
      .post("/api/diagnosis")
      .set("Authorization", `Bearer ${token}`)
      .send({ concerns: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("type_id");
  });
});

describe("GET /api/diagnosis", () => {
  it("debe devolver el perfil activo del usuario", async () => {
    await request(app)
      .post("/api/diagnosis")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type_name: "Piel Seca",
        type_id: "dry",
        concerns: ["descamación"],
      });

    const res = await request(app)
      .get("/api/diagnosis")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.type_name).toBe("Piel Seca");
    expect(res.body.profile.type_id).toBe("dry");
  });

  it("debe devolver 404 si no hay perfil", async () => {
    const res = await request(app)
      .get("/api/diagnosis")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).get("/api/diagnosis");
    expect(res.status).toBe(401);
  });
});
