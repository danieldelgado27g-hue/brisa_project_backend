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
  return { ...row, price: parseFloat(row.price), rating: parseFloat(row.rating || 0) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    const answers = event.queryStringParameters || {};

    // Load all active rules, highest priority first
    const rulesResult = await db.query(
      `SELECT id, label, conditions, product_ids, priority
       FROM quiz_recommendations
       WHERE is_active = true
       ORDER BY priority DESC`
    );

    const rules = rulesResult.rows;
    let matchedRule = null;

    for (const rule of rules) {
      const cond = rule.conditions || {};
      const keys = Object.keys(cond);

      // Empty conditions = catch-all (only use as last resort)
      if (keys.length === 0) {
        if (!matchedRule) matchedRule = rule;
        continue;
      }

      // All condition keys must match answers
      const allMatch = keys.every((k) => answers[k] && answers[k] === cond[k]);
      if (allMatch) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule && matchedRule.product_ids && matchedRule.product_ids.length > 0) {
      const ids = matchedRule.product_ids;

      // Fetch products in the order specified by product_ids
      const productsResult = await db.query(
        `SELECT id, name, brand, price, category, types, eco, cruelty, rating, image_url
         FROM products
         WHERE id = ANY($1) AND is_active = true`,
        [ids]
      );

      // Preserve configured order
      const productMap = {};
      productsResult.rows.forEach((p) => { productMap[p.id] = normalize(p); });
      const products = ids.map((id) => productMap[id]).filter(Boolean);

      return json(200, {
        matched: true,
        rule_id: matchedRule.id,
        rule_label: matchedRule.label,
        products,
      });
    }

    // Fallback: derive skin type from q1 answer and query products by type
    const skinTypeMap = {
      dry: "dry",
      normal: "normal",
      oily: "oily",
      mixed: "mixed",
    };
    const fallbackType = skinTypeMap[answers.q1] || null;

    const fallbackConditions = ["is_active = true"];
    const fallbackParams = [];
    let idx = 1;

    if (fallbackType) {
      fallbackParams.push(JSON.stringify([fallbackType]));
      fallbackConditions.push(`types @> $${idx++}::jsonb`);
    }

    const where = `WHERE ${fallbackConditions.join(" AND ")}`;
    const fallbackResult = await db.query(
      `SELECT id, name, brand, price, category, types, eco, cruelty, rating, image_url
       FROM products ${where} ORDER BY rating DESC LIMIT 10`,
      fallbackParams
    );

    return json(200, {
      matched: false,
      products: fallbackResult.rows.map(normalize),
    });
  } catch (err) {
    console.error("quiz-recommendations error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};
