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

describe("POST /api/payment", () => {
  const validCard = {
    cardNumber: "4111111111111111",
    cardExpiry: "12/28",
    cardCvc: "123",
    cardName: "María García",
    plan: "Premium",
  };

  it("debe procesar pago y devolver 200", async () => {
    const res = await request(app)
      .post("/api/payment")
      .set("Authorization", `Bearer ${token}`)
      .send(validCard);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("paymentId");
    expect(res.body.plan).toBe("Premium");
  });

  it("debe rechazar sin datos de tarjeta", async () => {
    const res = await request(app)
      .post("/api/payment")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "Premium" });

    expect(res.status).toBe(400);
  });

  it("debe rechazar sin token", async () => {
    const res = await request(app)
      .post("/api/payment")
      .send(validCard);

    expect(res.status).toBe(401);
  });
});
