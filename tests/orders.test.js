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

async function addToCart(productId, qty) {
  await request(app)
    .post("/api/cart")
    .set("Authorization", `Bearer ${token}`)
    .send({ product_id: productId, qty });
}

describe("POST /api/orders", () => {
  it("debe crear orden desde el carrito y devolver 201", async () => {
    await addToCart(1, 2);
    await addToCart(3, 1);

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ payment_method: "card", delivery_option: "delivery" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order).toHaveProperty("id");
    expect(res.body.order).toHaveProperty("items");
    expect(res.body.order.items.length).toBe(2);
    expect(res.body.order.status).toBe("pending");
  });

  it("debe calcular el total correctamente", async () => {
    const prodRes = await request(app).get("/api/products/3");
    const productPrice = prodRes.body.product.price;

    await addToCart(3, 2);

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ payment_method: "card" });

    const expectedTotal = productPrice * 2;
    expect(parseFloat(res.body.order.total)).toBe(expectedTotal);
  });

  it("debe vaciar el carrito después de crear la orden", async () => {
    await addToCart(1, 1);

    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ payment_method: "card" });

    const cartRes = await request(app)
      .get("/api/cart")
      .set("Authorization", `Bearer ${token}`);

    expect(cartRes.body.items).toEqual([]);
  });

  it("debe rechazar si el carrito está vacío", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ payment_method: "card" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("carrito");
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ payment_method: "card" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/orders", () => {
  it("debe listar órdenes del usuario", async () => {
    await addToCart(1, 1);
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ payment_method: "card" });

    await addToCart(2, 1);
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ payment_method: "card" });

    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBe(2);
    expect(res.body.orders[0]).toHaveProperty("id");
    expect(res.body.orders[0]).toHaveProperty("total");
    expect(res.body.orders[0]).toHaveProperty("status");
  });

  it("debe devolver array vacío si no hay órdenes", async () => {
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/orders/:id", () => {
  it("debe devolver detalle de orden con items", async () => {
    await addToCart(1, 2);
    await addToCart(3, 1);

    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ payment_method: "card" });

    const orderId = createRes.body.order.id;

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(orderId);
    expect(res.body.order.items.length).toBe(2);
    expect(res.body.order.items[0]).toHaveProperty("product_name");
    expect(res.body.order.items[0]).toHaveProperty("qty");
    expect(res.body.order.items[0]).toHaveProperty("subtotal");
  });

  it("debe devolver 404 para orden inexistente", async () => {
    const res = await request(app)
      .get("/api/orders/999999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("debe rechazar acceso a orden de otro usuario", async () => {
    await addToCart(1, 1);
    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ payment_method: "card" });
    const orderId = createRes.body.order.id;

    const otherRes = await request(app).post("/api/auth/register").send({
      name: "Otra",
      email: "otra@test.com",
      password: "123456",
    });

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${otherRes.body.token}`);

    expect(res.status).toBe(403);
  });
});
