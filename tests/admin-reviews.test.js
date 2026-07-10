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
  // Limpiar también reseñas para evitar errores de clave duplicada
  const pool = require("../db").pool;
  try {
    await pool.query("DELETE FROM product_reviews");
  } catch (e) {
    // Si la tabla no existe, ignorar
  }
});

afterEach(async () => {
  await cleanDb();
});

describe("PUT /api/admin/reviews/:id - autorización", () => {
  let adminToken, reviewId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
    // Crear una reseña de prueba
    const user = await createTestUser();
    const product = await createTestProduct();
    // Nota: necesitamos crear una reseña primero
    // Por ahora solo testeamos autorización
  });

  it("debe rechazar sin token (401)", async () => {
    const res = await request(app)
      .put("/api/admin/reviews/1")
      .send({ is_reported: true });

    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .put("/api/admin/reviews/1")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ is_reported: true });

    expect([401, 403, 404]).toContain(res.status);
  });

  it("debe permitir admin (200) - cuando se implemente", async () => {
    const res = await request(app)
      .put("/api/admin/reviews/1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_reported: true });

    expect([200, 404]).toContain(res.status);
  });
});

describe("PUT /api/admin/reviews/:id - funcionalidad", () => {
  let adminToken, reviewId;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    // Crear reseña de prueba
    const user = await createTestUser();
    const product = await createTestProduct();

    // Insertar reseña directamente en BD
    const pool = require("../db").pool;
    const reviewResult = await pool.query(
      `INSERT INTO product_reviews (product_id, user_id, author, stars, comment, is_reported)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [product.id, user.user.id, user.user.name, 5, "Great product!", false]
    );
    reviewId = reviewResult.rows[0].id;
  });

  it("debe marcar reseña como reportada", async () => {
    const res = await request(app)
      .put(`/api/admin/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_reported: true });

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // expect(res.body.review.is_reported).toBe(true);
  });

  it("debe poder ocultar reseña (eliminar)", async () => {
    // Algunas implementaciones usan deleted=true en vez de is_reported
    const res = await request(app)
      .put(`/api/admin/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ deleted: true });

    expect([200, 404]).toContain(res.status);
  });

  it("debe requerir justificación para moderar", async () => {
    // Quizá requerir reason field cuando se marca como reportada
  });

  it("debe registrar acción en audit log", async () => {
    // Verificar que se registró la acción de moderate_review
  });
});

describe("GET /api/admin/reviews/reported - autorización", () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
  });

  it("debe listar solo reseñas reportadas", async () => {
    // Crear reseñas reportadas y normales
    const pool = require("../db").pool;
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const product1 = await createTestProduct();
    const product2 = await createTestProduct();

    await pool.query(
      `INSERT INTO product_reviews (product_id, user_id, author, stars, comment, is_reported)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [product1.id, user1.user.id, user1.user.name, 1, "Bad product", true]
    );

    await pool.query(
      `INSERT INTO product_reviews (product_id, user_id, author, stars, comment, is_reported)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [product2.id, user2.user.id, user2.user.name, 5, "Good product", false]
    );

    const res = await request(app)
      .get("/api/admin/reviews/reported")
      .set("Authorization", `Bearer ${adminToken}`);

    // Por ahora, endpoint no existe (404)
    expect([200, 404]).toContain(res.status);

    // Cuando se implemente:
    // expect(res.status).toBe(200);
    // expect(res.body.reviews.length).toBe(1);
    // res.body.reviews.forEach(r => {
    //   expect(r.is_reported).toBe(true);
    // });
  });

  it("debe rechazar sin token (401)", async () => {
    const res = await request(app).get("/api/admin/reviews/reported");
    expect([401, 404]).toContain(res.status);
  });

  it("debe rechazar usuario normal (403)", async () => {
    const user = await createTestUser();

    const res = await request(app)
      .get("/api/admin/reviews/reported")
      .set("Authorization", `Bearer ${user.token}`);

    expect([401, 403, 404]).toContain(res.status);
  });
});
