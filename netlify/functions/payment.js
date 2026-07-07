exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { cardNumber, cardExpiry, cardCvc, cardName, plan } = JSON.parse(event.body);

    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Todos los datos de pago son requeridos" })
      };
    }

    // Simulación de procesamiento de pago
    // En producción conectarías con Stripe, MercadoPago, etc.
    const paymentId = "PAY-" + Date.now();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        paymentId,
        plan: plan || "Premium",
        message: "Pago procesado correctamente"
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al procesar pago" })
    };
  }
};
