const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");
const { verifyRole, logAdminAction, json } = require("../../utils/admin");

exports.handler = async (event) => {
  try {
    const auth = verifyToken(event);
    if (auth.error) return json(401, { error: auth.error });

    const roleCheck = verifyRole(auth.user, ["admin"]);
    if (roleCheck.error) return json(403, { error: roleCheck.error });

    const adminId = auth.user.id;
    const path = event.path;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    const hasId = /^\d+$/.test(last);
    const ruleId = hasId ? parseInt(last, 10) : null;

    if (event.httpMethod === "GET" && !hasId) {
      return handleList();
    }
    if (event.httpMethod === "POST" && !hasId) {
      return handleCreate(event, adminId);
    }
    if (event.httpMethod === "PUT" && hasId) {
      return handleUpdate(event, ruleId, adminId);
    }
    if (event.httpMethod === "DELETE" && hasId) {
      return handleDelete(event, ruleId, adminId);
    }

    return json(404, { error: "Endpoint no encontrado" });
  } catch (err) {
    console.error("admin-quiz-recommendations error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleList() {
  const result = await db.query(
    `SELECT id, label, conditions, product_ids, priority, is_active, created_at, updated_at
     FROM quiz_recommendations
     ORDER BY priority DESC, id ASC`
  );
  return json(200, { success: true, rules: result.rows });
}

async function handleCreate(event, adminId) {
  const body = JSON.parse(event.body || "{}");
  const { label, conditions, product_ids, priority } = body;

  if (!label) return json(400, { error: "El campo label es requerido" });
  if (!Array.isArray(product_ids)) return json(400, { error: "product_ids debe ser un array" });

  const result = await db.query(
    `INSERT INTO quiz_recommendations (label, conditions, product_ids, priority, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [
      label,
      JSON.stringify(conditions || {}),
      JSON.stringify(product_ids),
      priority || 0,
    ]
  );

  const rule = result.rows[0];
  await logAdminAction(adminId, "create_quiz_recommendation", "quiz_recommendation", rule.id, null, { label, conditions, product_ids, priority }, event);

  return json(201, { success: true, rule });
}

async function handleUpdate(event, ruleId, adminId) {
  const body = JSON.parse(event.body || "{}");

  const currentResult = await db.query(
    `SELECT * FROM quiz_recommendations WHERE id = $1`,
    [ruleId]
  );
  if (currentResult.rows.length === 0) return json(404, { error: "Regla no encontrada" });

  const current = currentResult.rows[0];
  const updates = [];
  const values = [];
  let idx = 1;

  const fields = ["label", "conditions", "product_ids", "priority", "is_active"];
  for (const field of fields) {
    if (body[field] !== undefined) {
      if (field === "conditions" || field === "product_ids") {
        updates.push(`${field} = $${idx}`);
        values.push(JSON.stringify(body[field]));
      } else {
        updates.push(`${field} = $${idx}`);
        values.push(body[field]);
      }
      idx++;
    }
  }

  if (updates.length === 0) return json(400, { error: "No se proporcionaron campos para actualizar" });

  updates.push(`updated_at = NOW()`);
  values.push(ruleId);

  const result = await db.query(
    `UPDATE quiz_recommendations SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  const updated = result.rows[0];
  await logAdminAction(adminId, "update_quiz_recommendation", "quiz_recommendation", ruleId, current, updated, event);

  return json(200, { success: true, rule: updated });
}

async function handleDelete(event, ruleId, adminId) {
  const currentResult = await db.query(
    `SELECT * FROM quiz_recommendations WHERE id = $1`,
    [ruleId]
  );
  if (currentResult.rows.length === 0) return json(404, { error: "Regla no encontrada" });

  await db.query(
    `UPDATE quiz_recommendations SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [ruleId]
  );

  await logAdminAction(adminId, "delete_quiz_recommendation", "quiz_recommendation", ruleId, { is_active: true }, { is_active: false }, event);

  return json(200, { success: true, message: "Regla desactivada correctamente" });
}
