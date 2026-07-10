const request = require("supertest");
const app = require("../server");
const { initDb, cleanDb, closeDb, seedProducts } = require("./helpers");

beforeAll(async () => {
  try {
    await initDb();
    await seedProducts();
  } catch (err) {
    console.warn("products setup warning:", err.message);
  }
});

afterAll(async () => {
  await cleanDb().catch(() => {});
});

describe("GET /api/products", () => {
  it("debe listar productos con paginación", async () => {
    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThan(0);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: expect.any(Number),
    });
  });

  it("cada producto debe tener los campos esperados", async () => {
    const res = await request(app).get("/api/products");
    const product = res.body.products[0];

    expect(product).toHaveProperty("id");
    expect(product).toHaveProperty("name");
    expect(product).toHaveProperty("brand");
    expect(product).toHaveProperty("price");
    expect(product).toHaveProperty("category");
    expect(product).toHaveProperty("types");
    expect(product).toHaveProperty("rating");
  });

  it("debe filtrar por tipo de piel (type=oily)", async () => {
    const res = await request(app).get("/api/products?type=oily");

    expect(res.status).toBe(200);
    res.body.products.forEach((p) => {
      expect(p.types).toContain("oily");
    });
  });

  it("debe filtrar por categoría", async () => {
    const res = await request(app).get("/api/products?category=cleanser");

    expect(res.status).toBe(200);
    res.body.products.forEach((p) => {
      expect(p.category).toBe("cleanser");
    });
  });

  it("debe buscar por nombre (search=cera)", async () => {
    const res = await request(app).get("/api/products?search=cera");

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    res.body.products.forEach((p) => {
      const match =
        p.name.toLowerCase().includes("cera") ||
        p.brand.toLowerCase().includes("cera");
      expect(match).toBe(true);
    });
  });

  it("debe filtrar por presupuesto low (< 15)", async () => {
    const res = await request(app).get("/api/products?budget=low");

    expect(res.status).toBe(200);
    res.body.products.forEach((p) => {
      expect(p.price).toBeLessThan(15);
    });
  });

  it("debe filtrar por presupuesto medium (< 25)", async () => {
    const res = await request(app).get("/api/products?budget=medium");

    expect(res.status).toBe(200);
    res.body.products.forEach((p) => {
      expect(p.price).toBeLessThan(25);
    });
  });

  it("debe filtrar solo eco-friendly", async () => {
    const res = await request(app).get("/api/products?eco=true");

    expect(res.status).toBe(200);
    res.body.products.forEach((p) => {
      expect(p.eco).toBe(true);
    });
  });

  it("debe filtrar solo cruelty-free", async () => {
    const res = await request(app).get("/api/products?cruelty=true");

    expect(res.status).toBe(200);
    res.body.products.forEach((p) => {
      expect(p.cruelty).toBe(true);
    });
  });

  it("debe ordenar por rating descendente", async () => {
    const res = await request(app).get("/api/products?sortBy=rating&order=desc");

    expect(res.status).toBe(200);
    for (let i = 1; i < res.body.products.length; i++) {
      expect(res.body.products[i].rating).toBeLessThanOrEqual(
        res.body.products[i - 1].rating
      );
    }
  });

  it("debe ordenar por precio ascendente", async () => {
    const res = await request(app).get("/api/products?sortBy=price&order=asc");

    expect(res.status).toBe(200);
    for (let i = 1; i < res.body.products.length; i++) {
      expect(res.body.products[i].price).toBeGreaterThanOrEqual(
        res.body.products[i - 1].price
      );
    }
  });

  it("debe aplicar paginación", async () => {
    const res = await request(app).get("/api/products?page=1&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
  });

  it("debe devolver página 2 si existe", async () => {
    const res = await request(app).get("/api/products?page=2&limit=2");

    expect(res.status).toBe(200);
    if (res.body.products.length > 0) {
      expect(res.body.pagination.page).toBe(2);
    }
  });

  it("debe combinar múltiples filtros", async () => {
    const res = await request(app).get(
      "/api/products?type=normal&category=moisturizer&budget=medium"
    );

    expect(res.status).toBe(200);
    res.body.products.forEach((p) => {
      expect(p.types).toContain("normal");
      expect(p.category).toBe("moisturizer");
      expect(p.price).toBeLessThan(25);
    });
  });

  it("debe devolver array vacío si no hay resultados", async () => {
    const res = await request(app).get("/api/products?search=xyznotfound");

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });
});

describe("GET /api/products/:id", () => {
  it("debe devolver detalle de producto existente", async () => {
    const res = await request(app).get("/api/products/1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product).toHaveProperty("id", 1);
    expect(res.body.product).toHaveProperty("name");
    expect(res.body.product).toHaveProperty("brand");
    expect(res.body.product).toHaveProperty("price");
    expect(res.body.product).toHaveProperty("category");
    expect(res.body.product).toHaveProperty("types");
    expect(res.body.product).toHaveProperty("ingredients");
    expect(res.body.product).toHaveProperty("description");
    expect(res.body.product).toHaveProperty("store_links");
  });

  it("debe devolver 404 para producto inexistente", async () => {
    const res = await request(app).get("/api/products/9999");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Producto no encontrado");
  });

  it("debe devolver 404 para ID inválido", async () => {
    const res = await request(app).get("/api/products/abc");

    expect(res.status).toBe(404);
  });
});
