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

describe("POST /api/cart", () => {
  it("debe agregar item al carrito y devolver 201", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 1, qty: 2 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.item.product_id).toBe(1);
    expect(res.body.item.qty).toBe(2);
  });

  it("debe incrementar qty si el producto ya está en el carrito", async () => {
    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 1, qty: 1 });

    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 1, qty: 2 });

    expect(res.status).toBe(200);
    expect(res.body.item.qty).toBe(3);
  });

  it("debe rechazar sin product_id", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ qty: 1 });

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app)
      .post("/api/cart")
      .send({ product_id: 1, qty: 1 });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/cart", () => {
  it("debe listar items del carrito con datos del producto", async () => {
    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 1, qty: 1 });

    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 2, qty: 3 });

    const res = await request(app)
      .get("/api/cart")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items[0]).toHaveProperty("product");
    expect(res.body.items[0].product).toHaveProperty("name");
    expect(res.body.items[0].product).toHaveProperty("price");
  });

  it("debe devolver array vacío si el carrito está vacío", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/cart/:productId", () => {
  it("debe actualizar cantidad", async () => {
    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 1, qty: 1 });

    const res = await request(app)
      .put("/api/cart/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ qty: 5 });

    expect(res.status).toBe(200);
    expect(res.body.item.qty).toBe(5);
  });

  it("debe rechazar sin qty", async () => {
    const res = await request(app)
      .put("/api/cart/1")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/cart/:productId", () => {
  it("debe eliminar item del carrito", async () => {
    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: 1, qty: 1 });

    const res = await request(app)
      .delete("/api/cart/1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("debe devolver 404 si el item no existe", async () => {
    const res = await request(app)
      .delete("/api/cart/999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
