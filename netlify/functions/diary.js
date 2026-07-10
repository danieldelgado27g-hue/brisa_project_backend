const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function fromDb(row) {
  if (!row) return row;
  return {
    ...row,
    entry_date:
      typeof row.entry_date === "object"
        ? row.entry_date.toISOString().slice(0, 10)
        : String(row.entry_date).slice(0, 10),
  };
}

exports.handler = async (event) => {
  const auth = verifyToken(event);
  if (auth.error) {
    return json(401, { error: auth.error });
  }
  const userId = auth.user.id;

  const path = event.path;
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(last);
  const isDiary = last === "diary";

  try {
    if (event.httpMethod === "POST" && isDiary) {
      return handleCreate(event, userId);
    }
    if (event.httpMethod === "GET" && isDiary) {
      return handleList(userId);
    }
    if (event.httpMethod === "GET" && hasDate) {
      return handleGetByDate(userId, last);
    }
    if (event.httpMethod === "DELETE" && hasDate) {
      return handleDelete(userId, last);
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Diary error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleCreate(event, userId) {
  const body = JSON.parse(event.body || "{}");
  const { entry_date, mood, notes, photos } = body;

  if (!entry_date) {
    return json(400, { error: "entry_date es requerido (YYYY-MM-DD)" });
  }

  const existing = await db.query(
    "SELECT id FROM diary_entries WHERE user_id = $1 AND entry_date = $2",
    [userId, entry_date]
  );

  if (existing.rows.length > 0) {
    const result = await db.query(
      `UPDATE diary_entries SET mood = $1, notes = $2, photos = $3
       WHERE user_id = $4 AND entry_date = $5
       RETURNING id, mood, notes, photos, entry_date, created_at`,
      [
        mood || "neutral",
        notes || null,
        JSON.stringify(photos || []),
        userId,
        entry_date,
      ]
    );
    return json(200, { success: true, entry: fromDb(result.rows[0]) });
  }

  const result = await db.query(
    `INSERT INTO diary_entries (user_id, mood, notes, photos, entry_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, mood, notes, photos, entry_date, created_at`,
    [
      userId,
      mood || "neutral",
      notes || null,
      JSON.stringify(photos || []),
      entry_date,
    ]
  );

  return json(201, { success: true, entry: fromDb(result.rows[0]) });
}

async function handleList(userId) {
  const result = await db.query(
    `SELECT id, mood, notes, photos, entry_date, created_at
     FROM diary_entries WHERE user_id = $1
     ORDER BY entry_date DESC`,
    [userId]
  );

  return json(200, { entries: result.rows.map(fromDb) });
}

async function handleGetByDate(userId, date) {
  const result = await db.query(
    `SELECT id, mood, notes, photos, entry_date, created_at
     FROM diary_entries WHERE user_id = $1 AND entry_date = $2`,
    [userId, date]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "No hay entrada para esta fecha" });
  }

  return json(200, { entry: fromDb(result.rows[0]) });
}

async function handleDelete(userId, date) {
  const result = await db.query(
    "DELETE FROM diary_entries WHERE user_id = $1 AND entry_date = $2 RETURNING id",
    [userId, date]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Entrada no encontrada" });
  }

  return json(200, { success: true });
}
