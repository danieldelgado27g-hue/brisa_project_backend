const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb, seedProducts } = require("./helpers");

let token;
let productId;

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
  productId = 1;
});

describe("POST /api/favorites", () => {
  it("debe agregar favorito y devolver 201", async () => {
    const res = await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.favorite.product_id).toBe(productId);
  });

  it("debe rechazar producto duplicado con 409", async () => {
    await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId });

    const res = await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId });

    expect(res.status).toBe(409);
  });

  it("debe rechazar sin product_id", async () => {
    const res = await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app)
      .post("/api/favorites")
      .send({ product_id: productId });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/favorites", () => {
  it("debe listar favoritos del usuario", async () => {
    await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 1 });

    await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 2 });

    const res = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.favorites)).toBe(true);
    expect(res.body.favorites.length).toBe(2);
  });

  it("cada favorito debe incluir datos del producto", async () => {
    await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 1 });

    const res = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.favorites[0]).toHaveProperty("product");
    expect(res.body.favorites[0].product).toHaveProperty("name");
    expect(res.body.favorites[0].product).toHaveProperty("brand");
    expect(res.body.favorites[0].product).toHaveProperty("price");
    expect(res.body.favorites[0].product).toHaveProperty("image_url");
  });

  it("debe devolver array vacío si no hay favoritos", async () => {
    const res = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.favorites).toEqual([]);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).get("/api/favorites");
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/favorites/:productId", () => {
  it("debe eliminar favorito y devolver 200", async () => {
    await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 1 });

    const res = await request(app)
      .delete("/api/favorites/1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("debe devolver 404 si el favorito no existe", async () => {
    const res = await request(app)
      .delete("/api/favorites/999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).delete("/api/favorites/1");
    expect(res.status).toBe(401);
  });
});
