const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb, seedProducts } = require("./helpers");

let token;
let user2token;

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

  const res2 = await request(app).post("/api/auth/register").send({
    name: "Otra Usuaria",
    email: "otra@test.com",
    password: "123456",
  });
  user2token = res2.body.token;
});

describe("POST /api/products/:productId/reviews", () => {
  it("debe crear review y devolver 201", async () => {
    const res = await request(app)
      .post("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ stars: 5, comment: "Excelente producto" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.review.stars).toBe(5);
    expect(res.body.review.comment).toBe("Excelente producto");
    expect(res.body.review.author).toBe("María García");
  });

  it("debe rechazar review duplicada (mismo user + producto)", async () => {
    await request(app)
      .post("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ stars: 4, comment: "Bueno" });

    const res = await request(app)
      .post("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ stars: 3, comment: "Regular" });

    expect(res.status).toBe(409);
  });

  it("debe rechazar stars fuera de rango", async () => {
    const res = await request(app)
      .post("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ stars: 6, comment: "Test" });

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app)
      .post("/api/products/1/reviews")
      .send({ stars: 5, comment: "Test" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/products/:productId/reviews", () => {
  it("debe listar reviews de un producto", async () => {
    await request(app)
      .post("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ stars: 5, comment: "Excelente" });

    await request(app)
      .post("/api/products/1/reviews")
      .set("Authorization", `Bearer ${user2token}`)
      .send({ stars: 4, comment: "Muy bueno" });

    const res = await request(app).get("/api/products/1/reviews");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.length).toBe(2);
    expect(res.body.reviews[0]).toHaveProperty("author");
    expect(res.body.reviews[0]).toHaveProperty("stars");
    expect(res.body.reviews[0]).toHaveProperty("comment");
  });

  it("debe devolver array vacío si no hay reviews", async () => {
    const res = await request(app).get("/api/products/1/reviews");
    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([]);
  });
});

describe("PUT /api/products/:productId/reviews", () => {
  it("debe actualizar propia review", async () => {
    await request(app)
      .post("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ stars: 3, comment: "Regular" });

    const res = await request(app)
      .put("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ stars: 5, comment: "Actualizado" });

    expect(res.status).toBe(200);
    expect(res.body.review.stars).toBe(5);
    expect(res.body.review.comment).toBe("Actualizado");
  });

  it("debe rechazar actualizar review de otro usuario", async () => {
    await request(app)
      .post("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ stars: 4, comment: "Mío" });

    const res = await request(app)
      .put("/api/products/1/reviews")
      .set("Authorization", `Bearer ${user2token}`)
      .send({ stars: 1, comment: "Hack" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/products/:productId/reviews", () => {
  it("debe eliminar propia review", async () => {
    await request(app)
      .post("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ stars: 3, comment: "Meh" });

    const res = await request(app)
      .delete("/api/products/1/reviews")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("debe devolver 404 si no existe", async () => {
    const res = await request(app)
      .delete("/api/products/999/reviews")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
