const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");
const { verifyRole, logAdminAction, json } = require("../../utils/admin");

exports.handler = async (event) => {
  try {
    const path = event.path;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    const hasId = last !== "consultas";
    const consultaId = hasId ? parseInt(last, 10) : null;

    // Verificar autenticación
    const auth = verifyToken(event);
    if (auth.error) {
      return json(401, { error: auth.error });
    }

    // Admin y dermatologist pueden acceder
    const roleCheck = verifyRole(auth.user, ['admin', 'dermatologist']);
    if (roleCheck.error) {
      return json(403, { error: roleCheck.error });
    }

    const adminId = auth.user.id;

    if (event.httpMethod === "GET" && event.path === "/api/admin/consultas") {
      return handleGetConsultas(event);
    }

    if (event.httpMethod === "PUT" && hasId) {
      return handleUpdateConsulta(event, consultaId, adminId);
    }

    return json(404, { error: "Endpoint no encontrado" });
  } catch (err) {
    console.error("Admin consultas error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleGetConsultas(event) {
  const q = event.queryStringParameters || {};

  const conditions = [];
  const params = [];
  let idx = 1;

  // Filtro por status
  if (q.status) {
    params.push(q.status);
    conditions.push(`c.status = $${idx++}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.query(
    `SELECT c.id, c.subject, c.message, c.status, c.created_at, c.answered_at, c.answered_by,
            u.id as user_id, u.name as user_name, u.email as user_email
     FROM consultas c
     LEFT JOIN users u ON c.user_id = u.id
     ${where}
     ORDER BY c.created_at DESC`,
    params
  );

  return json(200, {
    success: true,
    consultas: result.rows.map(row => ({
      id: row.id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      created_at: row.created_at,
      answered_at: row.answered_at,
      answered_by: row.answered_by,
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email
      }
    }))
  });
}

async function handleUpdateConsulta(event, consultaId, adminId) {
  const body = JSON.parse(event.body);

  // Validar answer requerido
  if (!body.answer) {
    return json(400, { error: "El campo 'answer' es requerido" });
  }

  // Obtener consulta actual
  const currentResult = await db.query(
    `SELECT * FROM consultas WHERE id = $1`,
    [consultaId]
  );

  if (currentResult.rows.length === 0) {
    return json(404, { error: "Consulta no encontrada" });
  }

  const currentConsulta = currentResult.rows[0];

  // Actualizar consulta
  const result = await db.query(
    `UPDATE consultas
     SET answer = $1, answered_by = $2, answered_at = NOW(), status = 'answered'
     WHERE id = $3
     RETURNING *`,
    [body.answer, body.answered_by || adminId, consultaId]
  );

  const updatedConsulta = result.rows[0];

  // Registrar en audit log
  await logAdminAction(
    adminId,
    'answer_consulta',
    'consulta',
    consultaId,
    { status: currentConsulta.status },
    { status: updatedConsulta.status, answer: updatedConsulta.answer },
    event
  );

  return json(200, {
    success: true,
    consulta: {
      id: updatedConsulta.id,
      subject: updatedConsulta.subject,
      message: updatedConsulta.message,
      answer: updatedConsulta.answer,
      status: updatedConsulta.status,
      answered_by: updatedConsulta.answered_by,
      answered_at: updatedConsulta.answered_at
    }
  });
}
