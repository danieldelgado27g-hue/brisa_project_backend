const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const auth = verifyToken(event);
  if (auth.error) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: auth.error }),
    };
  }

  try {
    const { cardNumber, cardExpiry, cardCvc, cardName, plan } = JSON.parse(
      event.body
    );

    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Todos los datos de pago son requeridos",
        }),
      };
    }

    const paymentId = "PAY-" + Date.now();
    const maskedCard = cardNumber.slice(-4);

    await db.query(
      `INSERT INTO payments (payment_id, card_name, plan, amount, status)
       VALUES ($1, $2, $3, $4, 'completed')`,
      [paymentId, cardName, plan || "Premium", 0]
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        paymentId,
        plan: plan || "Premium",
        message: "Pago procesado correctamente",
        lastFour: maskedCard,
      }),
    };
  } catch (err) {
    console.error("Payment error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Error al procesar pago" }),
    };
  }
};
