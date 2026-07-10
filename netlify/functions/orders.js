const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

exports.handler = async (event) => {
  const auth = verifyToken(event);
  if (auth.error) {
    return json(401, { error: auth.error });
  }
  const userId = auth.user.id;

  const path = event.path;
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  const hasId = /^\d+$/.test(last);
  const isOrders = last === "orders";

  try {
    if (event.httpMethod === "POST" && isOrders) {
      return handleCreate(event, userId);
    }
    if (event.httpMethod === "GET" && isOrders) {
      return handleList(userId);
    }
    if (event.httpMethod === "GET" && hasId) {
      return handleGetById(userId, parseInt(last, 10));
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Orders error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleCreate(event, userId) {
  const body = JSON.parse(event.body || "{}");

  const cartRes = await db.query(
    `SELECT c.product_id, c.qty, c.price_at_add, p.name, p.price
     FROM cart_items c
     JOIN products p ON p.id = c.product_id
     WHERE c.user_id = $1`,
    [userId]
  );

  if (cartRes.rows.length === 0) {
    return json(400, { error: "El carrito está vacío" });
  }

  const items = cartRes.rows.map((row) => ({
    product_id: row.product_id,
    product_name: row.name,
    product_price: parseFloat(row.price_at_add || row.price),
    qty: row.qty,
    subtotal: parseFloat(row.price_at_add || row.price) * row.qty,
  }));

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  const orderRes = await db.query(
    `INSERT INTO orders (user_id, status, total, payment_method, delivery_option, notes)
     VALUES ($1, 'pending', $2, $3, $4, $5)
     RETURNING id, status, total, payment_method, delivery_option, created_at`,
    [
      userId,
      total.toFixed(2),
      body.payment_method || null,
      body.delivery_option || "delivery",
      body.notes || null,
    ]
  );

  const orderId = orderRes.rows[0].id;

  for (const item of items) {
    await db.query(
      `INSERT INTO order_items (order_id, product_id, product_name, product_price, qty, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        orderId,
        item.product_id,
        item.product_name,
        item.product_price.toFixed(2),
        item.qty,
        item.subtotal.toFixed(2),
      ]
    );
  }

  await db.query("DELETE FROM cart_items WHERE user_id = $1", [userId]);

  const orderWithItems = {
    ...orderRes.rows[0],
    total: parseFloat(orderRes.rows[0].total),
    items,
  };

  return json(201, { success: true, order: orderWithItems });
}

async function handleList(userId) {
  const result = await db.query(
    `SELECT id, status, total, payment_method, delivery_option, created_at
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  const orders = result.rows.map((o) => ({
    ...o,
    total: parseFloat(o.total),
  }));

  return json(200, { orders });
}

async function handleGetById(userId, orderId) {
  const orderRes = await db.query(
    `SELECT id, user_id, status, total, payment_method, delivery_option,
            delivery_address, delivery_phone, notes, created_at
     FROM orders WHERE id = $1`,
    [orderId]
  );

  if (orderRes.rows.length === 0) {
    return json(404, { error: "Orden no encontrada" });
  }

  if (orderRes.rows[0].user_id !== userId) {
    return json(403, { error: "No tienes acceso a esta orden" });
  }

  const itemsRes = await db.query(
    `SELECT product_name, product_price, qty, subtotal
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );

  const items = itemsRes.rows.map((i) => ({
    ...i,
    product_price: parseFloat(i.product_price),
    subtotal: parseFloat(i.subtotal),
  }));

  const { user_id, ...order } = orderRes.rows[0];
  order.total = parseFloat(order.total);
  order.items = items;

  return json(200, { order });
}
