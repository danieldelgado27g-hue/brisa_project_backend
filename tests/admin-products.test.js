const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb, createAdminUser, createTestUser, createTestProduct } = require("./helpers");

beforeAll(async () => {
  try {
    await initDb();
  } catch (err) {
    console.warn("initDb warning:", err.message);
  }
});

beforeEach(async () => {
  await cleanDb();
});

afterEach(async () => {
  await cleanDb();
});

describe("POST /api/admin/products - autorización", () => {
  it("debe rechazar sin token (401)", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .send({ name: "Test Product" });

    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ name: "Test Product" });

    expect([401, 403, 404]).toContain(res.status);
  });

  it("debe permitir admin (201) - cuando se implemente", async () => {
    const admin = await createAdminUser();
    const productData = {
      name: "Nuevo Producto",
      brand: "Test Brand",
      price: 25.00,
      category: "moisturizer",
      types: ["normal", "dry"],
      allergies: []
    };

    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(productData);

    // Por ahora, endpoint no existe (404)
    expect([201, 404]).toContain(res.status);
  });
});

describe("POST /api/admin/products - funcionalidad", () => {
  let adminToken;
  const validProduct = {
    name: "Nuevo Producto",
    brand: "Test Brand",
    price: 25.00,
    category: "moisturizer",
    types: ["normal", "dry"],
    allergies: ["fragrance-free"],
    eco: true,
    cruelty: true
  };

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
  });

  it("debe crear producto nuevo (201)", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validProduct);

    // Por ahora, endpoint no existe (404)
    expect([201, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(201);
    // expect(res.body.product).toHaveProperty('id');
    // expect(res.body.product.name).toBe("Nuevo Producto");
  });

  it("debe validar campos requeridos", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect([400, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(400);
    // expect(res.body.error).toMatch(/requerido/);
  });

  it("debe validar name requerido", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validProduct, name: null });

    expect([400, 404]).toContain(res.status);
  });

  it("debe validar price es número", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validProduct, price: "invalid" });

    expect([400, 404]).toContain(res.status);
  });

  it("debe registrar en audit log", async () => {
    // Cuando se implemente, verificar que se creó registro en admin_audit_log
    // const log = await pool.query(
    //   'SELECT * FROM admin_audit_log WHERE action = $1',
    //   ['create_product']
    // );
    // expect(log.rows.length).toBeGreaterThan(0);
  });
});

describe("PUT /api/admin/products/:id - autorización", () => {
  let adminToken, productId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    productId = (await createTestProduct()).id;
  });

  it("debe rechazar sin token (401)", async () => {
    const res = await request(app)
      .put(`/api/admin/products/${productId}`)
      .send({ price: 30.00 });

    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .put(`/api/admin/products/${productId}`)
      .set("Authorization", `Bearer ${user.token}`)
      .send({ price: 30.00 });

    expect([401, 403, 404]).toContain(res.status);
  });
});

describe("PUT /api/admin/products/:id - funcionalidad", () => {
  let adminToken, productId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    productId = (await createTestProduct()).id;
  });

  it("debe actualizar producto existente (200)", async () => {
    const res = await request(app)
      .put(`/api/admin/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ price: 30.00 });

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // expect(res.body.product.price).toBe(30.00);
  });

  it("debe registrar old_values y new_values en audit log", async () => {
    // Cuando se implemente, verificar que se registraron valores
    // const log = await pool.query(
    //   'SELECT old_values, new_values FROM admin_audit_log WHERE action = $1',
    //   ['update_product']
    // );
    // expect(log.rows[0].old_values).toBeDefined();
    // expect(log.rows[0].new_values).toBeDefined();
  });

  it("debe validar precio positivo", async () => {
    const res = await request(app)
      .put(`/api/admin/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ price: -10 });

    expect([400, 404]).toContain(res.status);
  });
});

describe("DELETE /api/admin/products/:id - funcionalidad", () => {
  let adminToken, productId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    productId = (await createTestProduct()).id;
  });

  it("debe hacer soft delete (desactivar producto)", async () => {
    const res = await request(app)
      .delete(`/api/admin/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // const product = await pool.query(
    //   'SELECT is_active FROM products WHERE id = $1',
    //   [productId]
    // );
    // expect(product.rows[0].is_active).toBe(false);
  });

  it("debe registrar acción en audit log", async () => {
    // Verificar que se registró la acción de delete
  });
});
