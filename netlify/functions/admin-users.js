const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");
const { verifyRole, logAdminAction, json } = require("../../utils/admin");

exports.handler = async (event) => {
  try {
    const path = event.path;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    const hasId = last !== "users";
    const userId = hasId ? parseInt(last, 10) : null;

    // Verificar autenticación y rol
    const auth = verifyToken(event);
    if (auth.error) {
      return json(401, { error: auth.error });
    }

    const roleCheck = verifyRole(auth.user, ['admin']);
    if (roleCheck.error) {
      return json(403, { error: roleCheck.error });
    }

    const adminId = auth.user.id;

    if (event.httpMethod === "GET" && path === "/api/admin/users") {
      return handleGetUsers(event);
    }

    if (event.httpMethod === "PUT" && hasId) {
      return handleUpdateUser(event, userId, adminId);
    }

    return json(404, { error: "Endpoint no encontrado" });
  } catch (err) {
    console.error("Admin users error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleGetUsers(event) {
  const q = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let idx = 1;

  // Filtro por rol
  if (q.role) {
    params.push(q.role);
    conditions.push(`role = $${idx++}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Contar total
  const countResult = await db.query(
    `SELECT COUNT(*) FROM users ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Obtener usuarios
  params.push(limit, offset);
  const result = await db.query(
    `SELECT id, name, email, role, subscription_plan, subscription_status, created_at
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );

  return json(200, {
    success: true,
    users: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}

async function handleUpdateUser(event, userId, adminId) {
  const body = JSON.parse(event.body);

  // Prevenir que admin se modifique a sí mismo
  if (userId === adminId) {
    return json(400, { error: "No puedes modificarte a ti mismo" });
  }

  // Obtener usuario actual
  const currentResult = await db.query(
    `SELECT id, name, email, role FROM users WHERE id = $1`,
    [userId]
  );

  if (currentResult.rows.length === 0) {
    return json(404, { error: "Usuario no encontrado" });
  }

  const currentUser = currentResult.rows[0];

  // Solo permitir modificar rol
  if (body.role === undefined) {
    return json(400, { error: "Solo se permite modificar el campo 'role'" });
  }

  // Validar rol válido
  const validRoles = ['user', 'premium', 'dermatologist', 'admin'];
  if (!validRoles.includes(body.role)) {
    return json(400, { error: `Rol inválido. Roles válidos: ${validRoles.join(', ')}` });
  }

  // Actualizar
  const result = await db.query(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role`,
    [body.role, userId]
  );

  const updatedUser = result.rows[0];

  // Registrar en audit log
  await logAdminAction(
    adminId,
    'update_user',
    'user',
    userId,
    { role: currentUser.role },
    { role: updatedUser.role },
    event
  );

  return json(200, {
    success: true,
    user: updatedUser
  });
}
