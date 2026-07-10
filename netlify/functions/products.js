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
    price: parseFloat(row.price),
    rating: parseFloat(row.rating),
  };
}

exports.handler = async (event) => {
  const path = event.path;
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  const hasId = last !== "products";
  const productId = hasId ? parseInt(last, 10) : null;

  try {
    if (event.httpMethod === "GET" && hasId) {
      if (/^\d+$/.test(last)) {
        return handleGetProduct(productId);
      }
      return json(404, { error: "Producto no encontrado" });
    }
    if (event.httpMethod === "GET") {
      return handleListProducts(event);
    }
    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Products error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleGetProduct(id) {
  const result = await db.query(
    `SELECT id, name, brand, price, category, types, allergies, eco,
            cruelty, rating, image_url, ingredients, description, how_helps,
            store_links, dues, stock, is_active
     FROM products WHERE id = $1 AND is_active = true`,
    [id]
  );

  if (result.rows.length === 0) {
    return json(404, { error: "Producto no encontrado" });
  }

  return json(200, { success: true, product: normalize(result.rows[0]) });
}

async function handleListProducts(event) {
  const q = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 100));
  const offset = (page - 1) * limit;

  const conditions = ["is_active = true"];
  const params = [];
  let idx = 1;

  if (q.type) {
    params.push(JSON.stringify([q.type]));
    conditions.push(`types @> $${idx++}::jsonb`);
  }

  if (q.category) {
    params.push(q.category);
    conditions.push(`category = $${idx++}`);
  }

  if (q.search) {
    params.push(`%${q.search.toLowerCase()}%`);
    conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(brand) LIKE $${idx})`);
    idx++;
  }

  if (q.budget) {
    const budgetMap = { low: 15, medium: 25, premium: 50, unlimited: 999999 };
    const maxPrice = budgetMap[q.budget];
    if (maxPrice) {
      params.push(maxPrice);
      conditions.push(`price < $${idx++}`);
    }
  }

  if (q.eco === "true") {
    conditions.push("eco = true");
  }

  if (q.cruelty === "true") {
    conditions.push("cruelty = true");
  }

  if (q.minPrice) {
    params.push(parseFloat(q.minPrice));
    conditions.push(`price >= $${idx++}`);
  }

  if (q.maxPrice) {
    params.push(parseFloat(q.maxPrice));
    conditions.push(`price <= $${idx++}`);
  }

  if (q.brand) {
    params.push(`%${q.brand.toLowerCase()}%`);
    conditions.push(`LOWER(brand) LIKE $${idx++}`);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const allowedSorts = { rating: "rating", price: "price", name: "name" };
  const sortBy = allowedSorts[q.sortBy] || "rating";
  const order = q.order === "asc" ? "ASC" : "DESC";

  const countResult = await db.query(
    `SELECT COUNT(*) FROM products ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const selectFields =
    "id, name, brand, price, category, types, allergies, eco, cruelty, rating, image_url, ingredients, stock";

  const dataResult = await db.query(
    `SELECT ${selectFields} FROM products ${where} ORDER BY ${sortBy} ${order} LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return json(200, {
    products: dataResult.rows.map(normalize),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
