const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");
const { verifyRole, logAdminAction, json } = require("../../utils/admin");

// Estados válidos y sus transiciones permitidas
const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: []
};

exports.handler = async (event) => {
  try {
    const path = event.path;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    const hasId = last !== "orders";
    const orderId = hasId ? parseInt(last, 10) : null;

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

    if (event.httpMethod === "GET" && event.path === "/api/admin/orders") {
      return handleGetOrders(event);
    }

    if (event.httpMethod === "PUT" && hasId) {
      return handleUpdateOrder(event, orderId, adminId);
    }

    return json(404, { error: "Endpoint no encontrado" });
  } catch (err) {
    console.error("Admin orders error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleGetOrders(event) {
  const q = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let idx = 1;

  // Filtro por status
  if (q.status) {
    params.push(q.status);
    conditions.push(`o.status = $${idx++}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Contar total
  const countResult = await db.query(
    `SELECT COUNT(*) FROM orders o ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Obtener órdenes con información de usuario
  params.push(limit, offset);
  const result = await db.query(
    `SELECT o.id, o.user_id, o.total, o.status, o.created_at, o.updated_at,
            u.name as user_name, u.email as user_email
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );

  return json(200, {
    success: true,
    orders: result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      total: parseFloat(row.total),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        name: row.user_name,
        email: row.user_email
      }
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}

async function handleUpdateOrder(event, orderId, adminId) {
  const body = JSON.parse(event.body);

  if (!body.status) {
    return json(400, { error: "El campo 'status' es requerido" });
  }

  // Obtener orden actual
  const currentResult = await db.query(
    `SELECT * FROM orders WHERE id = $1`,
    [orderId]
  );

  if (currentResult.rows.length === 0) {
    return json(404, { error: "Orden no encontrada" });
  }

  const currentOrder = currentResult.rows[0];
  const oldStatus = currentOrder.status;
  const newStatus = body.status;

  // Validar transición de estado
  const allowedNextStates = VALID_TRANSITIONS[oldStatus] || [];
  if (!allowedNextStates.includes(newStatus) && oldStatus !== newStatus) {
    return json(400, {
      error: `Transición de estado inválida. Desde '${oldStatus}' solo puedes ir a: ${allowedNextStates.join(', ') || 'ninguno'}`
    });
  }

  // Actualizar orden
  const result = await db.query(
    `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [newStatus, orderId]
  );

  const updatedOrder = result.rows[0];

  // Registrar en audit log
  await logAdminAction(
    adminId,
    'update_order_status',
    'order',
    orderId,
    { status: oldStatus },
    { status: newStatus },
    event
  );

  return json(200, {
    success: true,
    order: {
      id: updatedOrder.id,
      user_id: updatedOrder.user_id,
      total: parseFloat(updatedOrder.total),
      status: updatedOrder.status,
      updated_at: updatedOrder.updated_at
    }
  });
}
