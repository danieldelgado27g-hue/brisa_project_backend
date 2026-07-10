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
  const path = event.path;
  const parts = path.split("/").filter(Boolean);
  const productId = parseInt(parts[parts.length - 2], 10);

  try {
    if (event.httpMethod === "GET") {
      return handleList(productId);
    }

    const auth = verifyToken(event);
    if (auth.error) {
      return json(401, { error: auth.error });
    }
    const userId = auth.user.id;

    if (event.httpMethod === "POST") {
      return handleCreate(event, userId, productId);
    }
    if (event.httpMethod === "PUT") {
      return handleUpdate(event, userId, productId);
    }
    if (event.httpMethod === "DELETE") {
      return handleDelete(userId, productId);
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Reviews error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleCreate(event, userId, productId) {
  const body = JSON.parse(event.body || "{}");
  const { stars, comment } = body;

  if (!stars || stars < 1 || stars > 5) {
    return json(400, { error: "stars debe ser entre 1 y 5" });
  }

  const userRes = await db.query("SELECT name FROM users WHERE id = $1", [
    userId,
  ]);
  const author = userRes.rows[0]?.name || "Anónimo";

  const existing = await db.query(
    "SELECT id FROM product_reviews WHERE product_id = $1 AND user_id = $2",
    [productId, userId]
  );

  if (existing.rows.length > 0) {
    return json(409, { error: "Ya has reseñado este producto" });
  }

  const result = await db.query(
    `INSERT INTO product_reviews (product_id, user_id, author, stars, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, author, stars, comment, is_verified_purchase, created_at`,
    [productId, userId, author, stars, comment || null]
  );

  return json(201, { success: true, review: result.rows[0] });
}

async function handleList(productId) {
  const result = await db.query(
    `SELECT id, author, stars, comment, is_verified_purchase, created_at
     FROM product_reviews WHERE product_id = $1
     ORDER BY created_at DESC`,
    [productId]
  );

  return json(200, { reviews: result.rows });
}

async function handleUpdate(event, userId, productId) {
  const body = JSON.parse(event.body || "{}");
  const { stars, comment } = body;

  const result = await db.query(
    `UPDATE product_reviews SET stars = COALESCE($1, stars),
     comment = COALESCE($2, comment)
     WHERE product_id = $3 AND user_id = $4
     RETURNING id, author, stars, comment, is_verified_purchase, created_at`,
    [stars || null, comment !== undefined ? comment : null, productId, userId]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Review no encontrada" });
  }

  return json(200, { success: true, review: result.rows[0] });
}

async function handleDelete(userId, productId) {
  const result = await db.query(
    "DELETE FROM product_reviews WHERE product_id = $1 AND user_id = $2 RETURNING id",
    [productId, userId]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Review no encontrada" });
  }

  return json(200, { success: true });
}
