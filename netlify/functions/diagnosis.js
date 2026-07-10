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
  try {
    if (event.httpMethod === "POST") {
      return handlePost(event);
    }
    if (event.httpMethod === "GET") {
      return handleGet(event);
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Diagnosis error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handlePost(event) {
  const body = JSON.parse(event.body || "{}");
  const { type_name, type_id, concerns, allergies, description, answers } = body;

  if (!type_id) {
    return json(400, { error: "type_id es requerido" });
  }

  const auth = verifyToken(event);
  console.log("[diagnosis POST] auth result:", JSON.stringify(auth));
  if (auth.error) {
    return json(401, { error: auth.error });
  }

  const userId = auth.user.id;
  console.log("[diagnosis POST] saving for userId:", userId, "type_id:", type_id);

  const existing = await db.query(
    "SELECT id FROM skin_profiles WHERE user_id = $1 AND is_active = true",
    [userId]
  );

  if (existing.rows.length > 0) {
    const result = await db.query(
      `UPDATE skin_profiles SET type_name = $1, type_id = $2,
       concerns = $3, allergies = $4, description = $5,
       answers = $6, updated_at = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING id, type_name, type_id, concerns, allergies, description, answers, is_active`,
      [
        type_name || "",
        type_id,
        JSON.stringify(concerns || []),
        JSON.stringify(allergies || []),
        description || null,
        JSON.stringify(answers || {}),
        existing.rows[0].id,
        userId,
      ]
    );
    console.log("[diagnosis POST] updated profile id:", result.rows[0]?.id);
    return json(200, { success: true, profile: result.rows[0] });
  }

  const result = await db.query(
    `INSERT INTO skin_profiles (user_id, type_name, type_id, concerns, allergies, description, answers)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, type_name, type_id, concerns, allergies, description, answers, is_active`,
    [
      userId,
      type_name || "",
      type_id,
      JSON.stringify(concerns || []),
      JSON.stringify(allergies || []),
      description || null,
      JSON.stringify(answers || {}),
    ]
  );
  console.log("[diagnosis POST] inserted profile id:", result.rows[0]?.id);
  return json(201, { success: true, profile: result.rows[0] });
}

async function handleGet(event) {
  const auth = verifyToken(event);
  if (!auth.error && auth.user) {
    const userId = auth.user.id;
    const result = await db.query(
      `SELECT id, type_name, type_id, concerns, allergies, description, answers, is_active, created_at, updated_at
       FROM skin_profiles WHERE user_id = $1 AND is_active = true
       ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0) {
      return json(200, { profile: result.rows[0] });
    }
  }

  return json(404, { error: "No hay perfil de piel registrado" });
}
