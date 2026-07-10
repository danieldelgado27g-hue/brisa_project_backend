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
  const last = parts[parts.length - 1];
  const hasId = /^\d+$/.test(last);
  const isList = last === "community-routines";

  try {
    if (event.httpMethod === "GET" && hasId) {
      return handleGetById(parseInt(last, 10));
    }
    if (event.httpMethod === "GET" && isList) {
      return handleList();
    }

    const auth = verifyToken(event);
    if (auth.error) {
      return json(401, { error: auth.error });
    }
    const userId = auth.user.id;

    if (event.httpMethod === "POST" && isList) {
      return handleCreate(event, userId);
    }
    if (event.httpMethod === "DELETE" && hasId) {
      return handleDelete(userId, parseInt(last, 10));
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Community error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleCreate(event, userId) {
  const body = JSON.parse(event.body || "{}");
  const { skin_type, allergies, products, avatar_emoji } = body;

  if (!skin_type) {
    return json(400, { error: "skin_type es requerido" });
  }

  const result = await db.query(
    `INSERT INTO community_routines (user_id, skin_type, allergies, products, avatar_emoji)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, skin_type, allergies, products, likes_count, avatar_emoji, created_at`,
    [
      userId,
      skin_type,
      JSON.stringify(allergies || []),
      JSON.stringify(products || []),
      avatar_emoji || null,
    ]
  );

  return json(201, { success: true, routine: result.rows[0] });
}

async function handleList() {
  const result = await db.query(
    `SELECT id, skin_type, allergies, products, likes_count, avatar_emoji, created_at
     FROM community_routines ORDER BY likes_count DESC, created_at DESC`,
    []
  );

  return json(200, { routines: result.rows });
}

async function handleGetById(id) {
  const result = await db.query(
    `SELECT id, skin_type, allergies, products, likes_count, avatar_emoji, created_at
     FROM community_routines WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Rutina no encontrada" });
  }

  return json(200, { routine: result.rows[0] });
}

async function handleDelete(userId, routineId) {
  const result = await db.query(
    "DELETE FROM community_routines WHERE id = $1 AND user_id = $2 RETURNING id",
    [routineId, userId]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Rutina no encontrada" });
  }

  return json(200, { success: true });
}
