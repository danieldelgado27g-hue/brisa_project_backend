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

describe("POST /api/diary", () => {
  it("debe crear entrada diaria y devolver 201", async () => {
    const res = await request(app)
      .post("/api/diary")
      .set("Authorization", `Bearer ${token}`)
      .send({
        entry_date: "2026-07-07",
        mood: "happy",
        notes: "Piel muy bien hoy",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.entry.mood).toBe("happy");
    expect(res.body.entry.entry_date).toBe("2026-07-07");
  });

  it("debe actualizar entrada existente (upsert por fecha)", async () => {
    await request(app)
      .post("/api/diary")
      .set("Authorization", `Bearer ${token}`)
      .send({
        entry_date: "2026-07-07",
        mood: "happy",
        notes: "Primera",
      });

    const res = await request(app)
      .post("/api/diary")
      .set("Authorization", `Bearer ${token}`)
      .send({
        entry_date: "2026-07-07",
        mood: "sad",
        notes: "Actualizada",
      });

    expect(res.status).toBe(200);
    expect(res.body.entry.mood).toBe("sad");
    expect(res.body.entry.notes).toBe("Actualizada");
  });

  it("debe rechazar sin entry_date", async () => {
    const res = await request(app)
      .post("/api/diary")
      .set("Authorization", `Bearer ${token}`)
      .send({ mood: "happy" });

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app)
      .post("/api/diary")
      .send({ entry_date: "2026-07-07", mood: "happy" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/diary", () => {
  it("debe listar entradas del usuario ordenadas por fecha", async () => {
    await request(app)
      .post("/api/diary")
      .set("Authorization", `Bearer ${token}`)
      .send({ entry_date: "2026-07-05", mood: "happy" });

    await request(app)
      .post("/api/diary")
      .set("Authorization", `Bearer ${token}`)
      .send({ entry_date: "2026-07-07", mood: "sad" });

    const res = await request(app)
      .get("/api/diary")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBe(2);
    expect(res.body.entries[0].entry_date).toBe("2026-07-07");
    expect(res.body.entries[1].entry_date).toBe("2026-07-05");
  });

  it("debe devolver array vacío si no hay entradas", async () => {
    const res = await request(app)
      .get("/api/diary")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app).get("/api/diary");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/diary/:date", () => {
  it("debe devolver entrada para una fecha específica", async () => {
    await request(app)
      .post("/api/diary")
      .set("Authorization", `Bearer ${token}`)
      .send({
        entry_date: "2026-07-07",
        mood: "happy",
        notes: "Nota del día",
        photos: ["https://ejemplo.com/foto.jpg"],
      });

    const res = await request(app)
      .get("/api/diary/2026-07-07")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entry.mood).toBe("happy");
    expect(res.body.entry.notes).toBe("Nota del día");
    expect(res.body.entry.photos).toEqual(["https://ejemplo.com/foto.jpg"]);
  });

  it("debe devolver 404 si no hay entrada para esa fecha", async () => {
    const res = await request(app)
      .get("/api/diary/2026-07-07")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/diary/:date", () => {
  it("debe eliminar entrada por fecha", async () => {
    await request(app)
      .post("/api/diary")
      .set("Authorization", `Bearer ${token}`)
      .send({ entry_date: "2026-07-07", mood: "happy" });

    const res = await request(app)
      .delete("/api/diary/2026-07-07")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("debe devolver 404 si no hay entrada", async () => {
    const res = await request(app)
      .delete("/api/diary/2026-07-07")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
