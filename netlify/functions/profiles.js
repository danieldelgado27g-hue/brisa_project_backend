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
  const profileId = parts[parts.length - 1];

  const auth = verifyToken(event);
  if (auth.error) return json(401, { error: auth.error });

  const numericId = parseInt(profileId, 10);
  if (isNaN(numericId))
    return json(400, { error: "ID de perfil inválido" });

  if (auth.user.id !== numericId)
    return json(403, { error: "No tienes permiso para acceder a este perfil" });

  try {
    switch (event.httpMethod) {
      case "GET":
        return handleGetProfile(numericId);
      case "PUT":
        return handleUpdateProfile(numericId, event);
      default:
        return json(405, { error: "Method Not Allowed" });
    }
  } catch (err) {
    console.error("Profile error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleGetProfile(userId) {
  const result = await db.query(
    `SELECT id, name, email, avatar_url, phone, subscription_plan,
            subscription_status, routine_config, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0)
    return json(404, { error: "Perfil no encontrado" });

  return json(200, { success: true, user: result.rows[0] });
}

async function handleUpdateProfile(userId, event) {
  const body = JSON.parse(event.body || "{}");

  const updates = [];
  const values = [];
  let idx = 1;

  const allowedFields = [
    "name",
    "avatar_url",
    "phone",
    "routine_config",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${idx++}`);
      values.push(body[field]);
    }
  }

  if (body.email !== undefined) {
    if (!body.email) return json(400, { error: "Email no puede estar vacío" });

    const existing = await db.query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [body.email, userId]
    );
    if (existing.rows.length > 0)
      return json(409, { error: "El email ya está en uso" });

    updates.push(`email = $${idx++}`);
    values.push(body.email);
  }

  if (updates.length === 0)
    return json(400, { error: "No hay campos válidos para actualizar" });

  updates.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await db.query(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}
     RETURNING id, name, email, avatar_url, phone, subscription_plan,
               subscription_status, routine_config, created_at, updated_at`,
    values
  );

  return json(200, { success: true, user: result.rows[0] });
}
