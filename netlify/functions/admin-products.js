const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");
const { verifyRole, logAdminAction, json } = require("../../utils/admin");

function normalizeProduct(row) {
  if (!row) return row;
  return {
    ...row,
    price: parseFloat(row.price),
    rating: parseFloat(row.rating || 0),
    types: row.types || [],
    allergies: row.allergies || []
  };
}

exports.handler = async (event) => {
  try {
    const path = event.path;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    const hasId = last !== "products";
    const productId = hasId ? parseInt(last, 10) : null;

    // Verificar autenticación y rol para todos los endpoints
    const auth = verifyToken(event);
    if (auth.error) {
      return json(401, { error: auth.error });
    }

    const roleCheck = verifyRole(auth.user, ['admin']);
    if (roleCheck.error) {
      return json(403, { error: roleCheck.error });
    }

    const adminId = auth.user.id;

    if (event.httpMethod === "POST" && path === "/api/admin/products") {
      return handleCreateProduct(event, adminId);
    }

    if (event.httpMethod === "PUT" && hasId) {
      return handleUpdateProduct(event, productId, adminId);
    }

    if (event.httpMethod === "DELETE" && hasId) {
      return handleDeleteProduct(event, productId, adminId);
    }

    return json(404, { error: "Endpoint no encontrado" });
  } catch (err) {
    console.error("Admin products error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleCreateProduct(event, adminId) {
  const body = JSON.parse(event.body);
  const { name, brand, price, category, types, allergies, eco, cruelty, image_url, ingredients, description, how_helps, store_links, dues, stock } = body;

  // Validaciones básicas
  if (!name || !brand || price === undefined || !category) {
    return json(400, { error: "Campos requeridos: name, brand, price, category" });
  }

  if (typeof price !== 'number' || price < 0) {
    return json(400, { error: "El precio debe ser un número positivo" });
  }

  const result = await db.query(
    `INSERT INTO products (name, brand, price, category, types, allergies, eco, cruelty, image_url, ingredients, description, how_helps, store_links, dues, stock, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      name,
      brand,
      price,
      category,
      JSON.stringify(types || []),
      JSON.stringify(allergies || []),
      eco || false,
      cruelty || false,
      image_url || null,
      ingredients || null,
      description || null,
      how_helps || null,
      store_links ? JSON.stringify(store_links) : null,
      dues || null,
      stock || 0,
      true
    ]
  );

  const product = result.rows[0];

  // Registrar en audit log
  await logAdminAction(adminId, 'create_product', 'product', product.id, null, { name, brand, price, category }, event);

  return json(201, {
    success: true,
    product: normalizeProduct(product)
  });
}

async function handleUpdateProduct(event, productId, adminId) {
  const body = JSON.parse(event.body);

  // Obtener producto actual
  const currentResult = await db.query(
    `SELECT * FROM products WHERE id = $1`,
    [productId]
  );

  if (currentResult.rows.length === 0) {
    return json(404, { error: "Producto no encontrado" });
  }

  const currentProduct = currentResult.rows[0];

  // Construir UPDATE dinámico
  const updates = [];
  const values = [];
  let idx = 1;

  const allowedFields = ['name', 'brand', 'price', 'category', 'types', 'allergies', 'eco', 'cruelty', 'image_url', 'ingredients', 'description', 'how_helps', 'store_links', 'dues', 'stock', 'is_active'];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'price' && (typeof body[field] !== 'number' || body[field] < 0)) {
        return json(400, { error: "El precio debe ser un número positivo" });
      }
      if (field === 'types' || field === 'allergies' || field === 'store_links') {
        updates.push(`${field} = $${idx}`);
        values.push(JSON.stringify(body[field]));
      } else {
        updates.push(`${field} = $${idx}`);
        values.push(body[field]);
      }
      idx++;
    }
  }

  if (updates.length === 0) {
    return json(400, { error: "No se proporcionaron campos para actualizar" });
  }

  values.push(productId);

  const result = await db.query(
    `UPDATE products SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  const updatedProduct = result.rows[0];

  // Extraer old_values y new_values solo con campos modificados
  const oldValues = {};
  const newValues = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      oldValues[field] = currentProduct[field];
      newValues[field] = updatedProduct[field];
    }
  }

  // Registrar en audit log
  await logAdminAction(adminId, 'update_product', 'product', productId, oldValues, newValues, event);

  return json(200, {
    success: true,
    product: normalizeProduct(updatedProduct)
  });
}

async function handleDeleteProduct(event, productId, adminId) {
  // Soft delete: desactivar producto
  const currentResult = await db.query(
    `SELECT * FROM products WHERE id = $1`,
    [productId]
  );

  if (currentResult.rows.length === 0) {
    return json(404, { error: "Producto no encontrado" });
  }

  const currentProduct = currentResult.rows[0];

  await db.query(
    `UPDATE products SET is_active = false WHERE id = $1`,
    [productId]
  );

  // Registrar en audit log
  await logAdminAction(adminId, 'delete_product', 'product', productId, { is_active: true }, { is_active: false }, event);

  return json(200, {
    success: true,
    message: "Producto desactivado correctamente"
  });
}
