const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");
const { verifyRole, logAdminAction, json } = require("../../utils/admin");

exports.handler = async (event) => {
  try {
    const path = event.path;
    const parts = path.split("/").filter(Boolean);

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

    // PUT /api/admin/reviews/:id - Moderar reseña
    if (event.httpMethod === "PUT" && parts[3] === "reviews" && parts[4]) {
      const reviewId = parseInt(parts[4], 10);
      return handleUpdateReview(event, reviewId, adminId);
    }

    // GET /api/admin/reviews/reported - Listar reseñas reportadas
    if (event.httpMethod === "GET" && parts[4] === "reported") {
      return handleGetReportedReviews(event);
    }

    return json(404, { error: "Endpoint no encontrado" });
  } catch (err) {
    console.error("Admin reviews error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleUpdateReview(event, reviewId, adminId) {
  const body = JSON.parse(event.body);

  // Obtener reseña actual
  const currentResult = await db.query(
    `SELECT pr.*, p.name as product_name, u.name as user_name
     FROM product_reviews pr
     LEFT JOIN products p ON pr.product_id = p.id
     LEFT JOIN users u ON pr.user_id = u.id
     WHERE pr.id = $1`,
    [reviewId]
  );

  if (currentResult.rows.length === 0) {
    return json(404, { error: "Reseña no encontrada" });
  }

  const currentReview = currentResult.rows[0];

  // Campos que se pueden modificar
  const updates = [];
  const values = [];
  let idx = 1;

  if (body.is_reported !== undefined) {
    updates.push(`is_reported = $${idx}`);
    values.push(body.is_reported);
    idx++;
  }

  if (body.deleted !== undefined) {
    updates.push(`deleted = $${idx}`);
    values.push(body.deleted);
    idx++;
  }

  if (updates.length === 0) {
    return json(400, { error: "No se proporcionaron campos para actualizar" });
  }

  values.push(reviewId);

  const result = await db.query(
    `UPDATE product_reviews SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  const updatedReview = result.rows[0];

  // Construir old_values y new_values
  const oldValues = {};
  const newValues = {};

  if (body.is_reported !== undefined) {
    oldValues.is_reported = currentReview.is_reported;
    newValues.is_reported = updatedReview.is_reported;
  }

  if (body.deleted !== undefined) {
    oldValues.deleted = currentReview.deleted;
    newValues.deleted = updatedReview.deleted;
  }

  // Registrar en audit log
  await logAdminAction(
    adminId,
    'moderate_review',
    'review',
    reviewId,
    oldValues,
    newValues,
    event
  );

  return json(200, {
    success: true,
    review: {
      id: updatedReview.id,
      product_id: updatedReview.product_id,
      user_id: updatedReview.user_id,
      is_reported: updatedReview.is_reported,
      deleted: updatedReview.deleted
    }
  });
}

async function handleGetReportedReviews(event) {
  const result = await db.query(
    `SELECT pr.id, pr.stars, pr.comment, pr.is_reported, pr.created_at,
            p.id as product_id, p.name as product_name,
            u.id as user_id, u.name as user_name
     FROM product_reviews pr
     LEFT JOIN products p ON pr.product_id = p.id
     LEFT JOIN users u ON pr.user_id = u.id
     WHERE pr.is_reported = true
     ORDER BY pr.created_at DESC`
  );

  return json(200, {
    success: true,
    reviews: result.rows.map(row => ({
      id: row.id,
      stars: row.stars,
      comment: row.comment,
      is_reported: row.is_reported,
      created_at: row.created_at,
      product: {
        id: row.product_id,
        name: row.product_name
      },
      user: {
        id: row.user_id,
        name: row.user_name
      }
    }))
  });
}
