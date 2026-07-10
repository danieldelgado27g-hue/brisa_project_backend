const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb } = require("./helpers");

let token;
let userId;

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
  userId = res.body.user.id;
});

describe("GET /api/profiles/:id", () => {
  it("debe devolver perfil del usuario autenticado", async () => {
    const res = await request(app)
      .get(`/api/profiles/${userId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toMatchObject({
      id: userId,
      name: "María García",
      email: "maria@ejemplo.com",
    });
    expect(res.body.user).toHaveProperty("subscription_plan");
    expect(res.body.user).toHaveProperty("subscription_status");
    expect(res.body.user).toHaveProperty("created_at");
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).get(`/api/profiles/${userId}`);
    expect(res.status).toBe(401);
  });

  it("debe rechazar acceso a perfil de otro usuario", async () => {
    const otherRes = await request(app).post("/api/auth/register").send({
      name: "Otra Usuaria",
      email: "otra@test.com",
      password: "123456",
    });
    const otherId = otherRes.body.user.id;

    const res = await request(app)
      .get(`/api/profiles/${otherId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("debe rechazar con ID inválido", async () => {
    const res = await request(app)
      .get("/api/profiles/abc")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/profiles/:id", () => {
  it("debe actualizar nombre del perfil", async () => {
    const res = await request(app)
      .put(`/api/profiles/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "María Actualizada" });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("María Actualizada");
  });

  it("debe actualizar avatar_url", async () => {
    const res = await request(app)
      .put(`/api/profiles/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ avatar_url: "https://ejemplo.com/avatar.jpg" });

    expect(res.status).toBe(200);
    expect(res.body.user.avatar_url).toBe("https://ejemplo.com/avatar.jpg");
  });

  it("debe actualizar phone", async () => {
    const res = await request(app)
      .put(`/api/profiles/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "999888777" });

    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe("999888777");
  });

  it("debe actualizar email si no está en uso", async () => {
    const res = await request(app)
      .put(`/api/profiles/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "nuevo@email.com" });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("nuevo@email.com");
  });

  it("debe rechazar email duplicado", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Otra",
      email: "otra@test.com",
      password: "123456",
    });

    const res = await request(app)
      .put(`/api/profiles/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "otra@test.com" });

    expect(res.status).toBe(409);
  });

  it("debe rechazar actualización sin token", async () => {
    const res = await request(app)
      .put(`/api/profiles/${userId}`)
      .send({ name: "Sin Token" });

    expect(res.status).toBe(401);
  });

  it("debe rechazar actualización de perfil ajeno", async () => {
    const otherRes = await request(app).post("/api/auth/register").send({
      name: "Otra",
      email: "otra@test.com",
      password: "123456",
    });
    const otherId = otherRes.body.user.id;

    const res = await request(app)
      .put(`/api/profiles/${otherId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hack" });

    expect(res.status).toBe(403);
  });

  it("debe rechazar campos vacíos en actualización", async () => {
    const res = await request(app)
      .put(`/api/profiles/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("debe actualizar routine_config", async () => {
    const config = {
      budget: "medium",
      optimization: "balanced",
      brands: ["CeraVe"],
      additionalAllergies: ["paraben-free"],
    };

    const res = await request(app)
      .put(`/api/profiles/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ routine_config: config });

    expect(res.status).toBe(200);
    expect(res.body.user.routine_config).toEqual(config);
  });
});

describe("GET /api/auth/me (con perfil completo)", () => {
  it("debe devolver perfil completo incluyendo nuevos campos", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("avatar_url");
    expect(res.body.user).toHaveProperty("phone");
    expect(res.body.user).toHaveProperty("subscription_plan");
    expect(res.body.user).toHaveProperty("subscription_status");
  });
});
