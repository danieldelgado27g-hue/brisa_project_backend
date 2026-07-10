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
  const isConsultas = last === "consultas";

  try {
    if (event.httpMethod === "POST" && isConsultas) {
      const auth = verifyToken(event);
      if (auth.error) return json(401, { error: auth.error });
      return handleCreate(event, auth.user.id);
    }
    if (event.httpMethod === "GET" && isConsultas) {
      const auth = verifyToken(event);
      if (!auth.error && auth.user) {
        return handleList(auth.user.id);
      }
      return json(200, { consultas: [] });
    }
    if (event.httpMethod === "GET" && hasId) {
      const auth = verifyToken(event);
      if (!auth.error && auth.user) {
        return handleGetById(auth.user.id, parseInt(last, 10));
      }
      return json(404, { error: "Consulta no encontrada" });
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Consultas error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleCreate(event, userId) {
  const body = JSON.parse(event.body || "{}");
  const { subject, message } = body;

  if (!subject) {
    return json(400, { error: "subject es requerido" });
  }

  const result = await db.query(
    `INSERT INTO consultas (user_id, subject, message)
     VALUES ($1, $2, $3)
     RETURNING id, subject, message, status, created_at`,
    [userId, subject, message || ""]
  );

  return json(201, { success: true, consulta: result.rows[0] });
}

async function handleList(userId) {
  const result = await db.query(
    `SELECT id, subject, message, status, answer, created_at
     FROM consultas WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return json(200, { consultas: result.rows });
}

async function handleGetById(userId, consultaId) {
  const result = await db.query(
    `SELECT id, user_id, subject, message, status, answer,
            answered_by, answered_at, created_at
     FROM consultas WHERE id = $1`,
    [consultaId]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Consulta no encontrada" });
  }

  if (result.rows[0].user_id !== userId) {
    return json(403, { error: "No tienes acceso a esta consulta" });
  }

  const { user_id, ...consulta } = result.rows[0];
  return json(200, { consulta });
}
