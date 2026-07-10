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
  const isGenerate = last === "generate";
  const hasId = /^\d+$/.test(last);

  try {
    if (event.httpMethod === "POST" && isGenerate) {
      const auth = verifyToken(event);
      if (auth.error) return json(401, { error: auth.error });
      const body = JSON.parse(event.body || "{}");
      return handleGenerate(auth.user.id, body);
    }
    if (event.httpMethod === "GET" && hasId) {
      return handleGetById(parseInt(last, 10));
    }
    if (event.httpMethod === "GET" && !hasId) {
      const auth = verifyToken(event);
      if (!auth.error && auth.user) {
        return handleList(auth.user.id);
      }
      return json(200, { routines: [] });
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Routines error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

const MORNING_ORDER = ["cleanser", "toner", "serum", "moisturizer", "spf"];
const NIGHT_ORDER = ["cleanser", "toner", "treatment", "serum", "moisturizer"];

const STEP_LABELS = {
  cleanser: "Limpieza",
  toner: "Tónico",
  treatment: "Tratamiento",
  serum: "Sérum",
  moisturizer: "Hidratación",
  spf: "Protección Solar",
};

async function handleGenerate(userId, body) {
  let profileRes = await db.query(
    `SELECT type_id, concerns, allergies FROM skin_profiles
     WHERE user_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );

  // If no DB record, save from body data and retry
  console.log("[routines] profile rows:", profileRes.rows.length, "body.type_id:", body && body.type_id);
  if (profileRes.rows.length === 0 && body && body.type_id) {
    console.log("[routines] auto-creating skin_profile for userId:", userId);
    await db.query(
      `INSERT INTO skin_profiles (user_id, type_name, type_id, concerns, allergies, description, answers)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        userId,
        body.type_name || body.type_id,
        body.type_id,
        JSON.stringify(body.concerns || []),
        JSON.stringify(body.allergies || []),
        body.description || null,
        JSON.stringify(body.answers || {}),
      ]
    );
    profileRes = await db.query(
      `SELECT type_id, concerns, allergies FROM skin_profiles
       WHERE user_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
  }

  if (profileRes.rows.length === 0) {
    return json(400, { error: "Debes completar el diagnóstico de piel primero" });
  }

  const userRes = await db.query(
    "SELECT routine_config FROM users WHERE id = $1",
    [userId]
  );

  const routineConfig = userRes.rows[0]?.routine_config || {};
  const budget = routineConfig.budget || "medium";
  const typeId = profileRes.rows[0].type_id;
  const userAllergies = profileRes.rows[0].allergies || [];

  const budgetMap = { low: 15, medium: 25, premium: 50, unlimited: 999999 };
  const maxBudget = budgetMap[budget] || 25;

  const productsRes = await db.query(
    `SELECT id, name, brand, price, category, types, allergies, eco,
            cruelty, rating, image_url, ingredients, stock
     FROM products
     WHERE is_active = true
       AND types @> $1::jsonb
       AND price < $2
     ORDER BY rating DESC`,
    [JSON.stringify([typeId]), maxBudget]
  );

  const available = productsRes.rows.map((p) => ({
    ...p,
    price: parseFloat(p.price),
    rating: parseFloat(p.rating),
  }));

  const morning = [];
  const night = [];

  for (const cat of MORNING_ORDER) {
    const match = available.find((p) => p.category === cat);
    if (match) {
      morning.push({
        id: match.id,
        name: match.name,
        brand: match.brand,
        price: match.price,
        category: match.category,
        image_url: match.image_url,
        step: STEP_LABELS[cat] || cat,
        eco: match.eco,
        cruelty: match.cruelty,
      });
    }
  }

  for (const cat of NIGHT_ORDER) {
    const match = available.find((p) => p.category === cat);
    if (match) {
      night.push({
        id: match.id,
        name: match.name,
        brand: match.brand,
        price: match.price,
        category: match.category,
        image_url: match.image_url,
        step: STEP_LABELS[cat] || cat,
        eco: match.eco,
        cruelty: match.cruelty,
      });
    }
  }

  const summary = {
    skin_type: typeId,
    config_used: routineConfig,
    total_steps: morning.length + night.length,
    total_cost: [...morning, ...night].reduce((s, p) => s + p.price, 0),
  };

  const config = {
    skin_type: typeId,
    budget,
    concerns: profileRes.rows[0].concerns || [],
  };

  const result = await db.query(
    `INSERT INTO routines (user_id, config, morning, night, summary)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, config, morning, night, summary, generated_at`,
    [
      userId,
      JSON.stringify(config),
      JSON.stringify(morning),
      JSON.stringify(night),
      JSON.stringify(summary),
    ]
  );

  return json(201, { success: true, routine: result.rows[0] });
}

async function handleList(userId) {
  const result = await db.query(
    `SELECT id, config, summary, generated_at, created_at
     FROM routines WHERE user_id = $1
     ORDER BY generated_at DESC`,
    [userId]
  );

  return json(200, { routines: result.rows });
}

async function handleGetById(routineId) {
  const result = await db.query(
    `SELECT id, user_id, config, morning, night, summary, generated_at, created_at
     FROM routines WHERE id = $1`,
    [routineId]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Rutina no encontrada" });
  }

  const { user_id, ...routine } = result.rows[0];
  return json(200, { routine });
}
