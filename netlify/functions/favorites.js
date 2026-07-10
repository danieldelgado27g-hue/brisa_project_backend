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
  const isFavorites = last === "favorites";

  try {
    if (event.httpMethod === "POST" && isFavorites) {
      return handleCreate(event, userId);
    }
    if (event.httpMethod === "GET" && isFavorites) {
      return handleList(userId);
    }
    if (event.httpMethod === "DELETE" && hasProductId) {
      return handleDelete(userId, parseInt(last, 10));
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Favorites error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleCreate(event, userId) {
  const body = JSON.parse(event.body || "{}");
  const { product_id } = body;

  if (!product_id) {
    return json(400, { error: "product_id es requerido" });
  }

  const existing = await db.query(
    "SELECT id FROM favorites WHERE user_id = $1 AND product_id = $2",
    [userId, product_id]
  );

  if (existing.rows.length > 0) {
    return json(409, { error: "El producto ya está en favoritos" });
  }

  const result = await db.query(
    `INSERT INTO favorites (user_id, product_id) VALUES ($1, $2)
     RETURNING id, user_id, product_id, created_at`,
    [userId, product_id]
  );

  return json(201, { success: true, favorite: result.rows[0] });
}

async function handleList(userId) {
  const result = await db.query(
    `SELECT f.id, f.product_id, f.created_at,
            jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'brand', p.brand,
              'price', p.price::float,
              'image_url', p.image_url,
              'category', p.category,
              'rating', p.rating::float
            ) AS product
     FROM favorites f
     JOIN products p ON p.id = f.product_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId]
  );

  return json(200, { favorites: result.rows });
}

async function handleDelete(userId, productId) {
  const result = await db.query(
    `DELETE FROM favorites WHERE user_id = $1 AND product_id = $2
     RETURNING id`,
    [userId, productId]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Favorito no encontrado" });
  }

  return json(200, { success: true });
}
