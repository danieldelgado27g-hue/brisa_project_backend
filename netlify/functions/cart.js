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
  const hasProductId = /^\d+$/.test(last);
  const isCart = last === "cart";

  try {
    if (event.httpMethod === "POST" && isCart) {
      return handleCreate(event, userId);
    }
    if (event.httpMethod === "GET" && isCart) {
      return handleList(userId);
    }
    if (event.httpMethod === "PUT" && hasProductId) {
      return handleUpdate(event, userId, parseInt(last, 10));
    }
    if (event.httpMethod === "DELETE" && hasProductId) {
      return handleDelete(userId, parseInt(last, 10));
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Cart error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleCreate(event, userId) {
  const body = JSON.parse(event.body || "{}");
  const { product_id, qty } = body;

  if (!product_id) {
    return json(400, { error: "product_id es requerido" });
  }

  const existing = await db.query(
    "SELECT id, qty FROM cart_items WHERE user_id = $1 AND product_id = $2",
    [userId, product_id]
  );

  if (existing.rows.length > 0) {
    const newQty = existing.rows[0].qty + (qty || 1);
    const result = await db.query(
      `UPDATE cart_items SET qty = $1 WHERE id = $2
       RETURNING id, product_id, qty, created_at`,
      [newQty, existing.rows[0].id]
    );
    return json(200, { success: true, item: result.rows[0] });
  }

  const result = await db.query(
    `INSERT INTO cart_items (user_id, product_id, qty, price_at_add)
     VALUES ($1, $2, $3, (SELECT price FROM products WHERE id = $2))
     RETURNING id, product_id, qty, created_at`,
    [userId, product_id, qty || 1]
  );

  return json(201, { success: true, item: result.rows[0] });
}

async function handleList(userId) {
  const result = await db.query(
    `SELECT c.id, c.product_id, c.qty, c.price_at_add,
            jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'brand', p.brand,
              'price', p.price::float,
              'image_url', p.image_url,
              'category', p.category,
              'stock', p.stock
            ) AS product
     FROM cart_items c
     JOIN products p ON p.id = c.product_id
     WHERE c.user_id = $1
     ORDER BY c.created_at`,
    [userId]
  );

  return json(200, { items: result.rows });
}

async function handleUpdate(event, userId, productId) {
  const body = JSON.parse(event.body || "{}");
  const { qty } = body;

  if (qty === undefined || qty === null) {
    return json(400, { error: "qty es requerido" });
  }

  const result = await db.query(
    `UPDATE cart_items SET qty = $1
     WHERE user_id = $2 AND product_id = $3
     RETURNING id, product_id, qty`,
    [qty, userId, productId]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Item no encontrado en el carrito" });
  }

  return json(200, { success: true, item: result.rows[0] });
}

async function handleDelete(userId, productId) {
  const result = await db.query(
    "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2 RETURNING id",
    [userId, productId]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Item no encontrado en el carrito" });
  }

  return json(200, { success: true });
}
