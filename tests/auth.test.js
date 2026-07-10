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

afterEach(async () => {
  await cleanDb().catch(() => {});
});



describe("POST /api/auth/register", () => {
  const validUser = {
    name: "María García",
    email: "maria@ejemplo.com",
    password: "miClave123",
  };

  it("debe registrar y devolver 201 con token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toMatchObject({
      name: "María García",
      email: "maria@ejemplo.com",
    });
    expect(res.body.user).toHaveProperty("id");
    expect(res.body).toHaveProperty("token");
  });

  it("debe rechazar registro sin name", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "t@t.com", password: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("name");
  });

  it("debe rechazar registro sin email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "T", password: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("email");
  });

  it("debe rechazar registro sin password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "T", email: "t@t.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("password");
  });

  it("debe rechazar email duplicado con 409", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app)
      .post("/api/auth/register")
      .send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("El email ya está registrado");
  });
});

describe("POST /api/auth/login", () => {
  const email = "maria@ejemplo.com";
  const password = "miClave123";

  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      name: "María García",
      email,
      password,
    });
  });

  it("debe loguear y devolver 200 con token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toMatchObject({
      name: "María García",
      email: "maria@ejemplo.com",
    });
    expect(res.body).toHaveProperty("token");
  });

  it("debe rechazar contraseña incorrecta", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales inválidas");
  });

  it("debe rechazar email inexistente", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "no@existe.com", password: "x" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales inválidas");
  });

  it("debe rechazar sin email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "123456" });

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "t@t.com" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "María García",
      email: "maria@ejemplo.com",
      password: "miClave123",
    });
    token = res.body.token;
  });

  it("debe devolver perfil con token válido", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: "María García",
      email: "maria@ejemplo.com",
    });
    expect(res.body.user).toHaveProperty("id");
  });

  it("debe rechazar sin token (401)", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("debe rechazar token inválido (401)", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer token-falso");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token inválido o expirado");
  });
});

describe("POST /api/auth/logout", () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "María García",
      email: "maria@ejemplo.com",
      password: "miClave123",
    });
    token = res.body.token;
  });

  it("debe cerrar sesión y devolver 200", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Sesión cerrada");
  });

  it("debe rechazar sin token (401)", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/recover", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      name: "María García",
      email: "maria@ejemplo.com",
      password: "miClave123",
    });
  });

  it("debe devolver 200 si el email existe", async () => {
    const res = await request(app)
      .post("/api/auth/recover")
      .send({ email: "maria@ejemplo.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("email existe");
  });

  it("debe devolver 200 incluso si el email NO existe (seguridad)", async () => {
    const res = await request(app)
      .post("/api/auth/recover")
      .send({ email: "no-existe@test.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("debe rechazar sin email (400)", async () => {
    const res = await request(app).post("/api/auth/recover").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);  // case-insensitive
  });
});
