const db = require("../../db");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function normalize(row) {
  if (!row) return row;
  return {
    ...row,
    distance_km: parseFloat(row.distance_km),
    rating: parseFloat(row.rating),
  };
}

exports.handler = async (event) => {
  const path = event.path;
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  const hasId = /^\d+$/.test(last);

  try {
    if (event.httpMethod === "GET" && hasId) {
      return handleGetById(parseInt(last, 10));
    }
    if (event.httpMethod === "GET") {
      return handleList();
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Dermatologists error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleList() {
  const result = await db.query(
    `SELECT id, name, specialty, clinic, distance_km, rating,
            phone, email, photo_url, available_slots
     FROM dermatologists WHERE is_active = true
     ORDER BY rating DESC`,
    []
  );

  return json(200, { dermatologists: result.rows.map(normalize) });
}

async function handleGetById(id) {
  const result = await db.query(
    `SELECT id, name, specialty, clinic, distance_km, rating,
            phone, email, photo_url, available_slots
     FROM dermatologists WHERE id = $1 AND is_active = true`,
    [id]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Dermatólogo no encontrado" });
  }

  return json(200, { dermatologist: normalize(result.rows[0]) });
}
