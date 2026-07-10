const db = require("../db");

/**
 * Verifica que el usuario tenga uno de los roles permitidos
 * @param {Object} user - Usuario del JWT token
 * @param {string[]} allowedRoles - Roles permitidos (default: ['admin'])
 * @returns {Object} {user} o {error}
 */
function verifyRole(user, allowedRoles = ['admin']) {
  if (!user) {
    return { error: 'Usuario no proporcionado' };
  }

  if (!user.role) {
    return { error: 'Usuario sin rol definido' };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      error: `Acceso denegado. Se requiere uno de los roles: ${allowedRoles.join(', ')}`
    };
  }

  return { user };
}

/**
 * Middleware completo: Auth + Role verification
 * @param {Object} event - Event de Netlify Function
 * @param {string[]} allowedRoles - Roles permitidos (default: ['admin'])
 * @returns {Object} {user, status?, error?}
 */
function requireAuthWithRole(event, allowedRoles = ['admin']) {
  // Verificar token (requiere importación de verifyToken desde jwt.js)
  // Nota: Esta función se usa dentro de handlers que ya llamaron verifyToken
  // Para uso directo, se debe llamar verifyToken primero

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { user } = body; // User debe venir del token decodificado

    if (!user) {
      return { error: 'Usuario no autenticado', status: 401 };
    }

    const roleCheck = verifyRole(user, allowedRoles);
    if (roleCheck.error) {
      return { error: roleCheck.error, status: 403 };
    }

    return { user };
  } catch (err) {
    return { error: 'Error de autenticación', status: 401 };
  }
}

/**
 * Registra acción en audit log
 * @param {number} adminId - ID del usuario admin
 * @param {string} action - Acción realizada (create, update, delete, etc.)
 * @param {string} entityType - Tipo de entidad (user, product, order, etc.)
 * @param {number} entityId - ID de la entidad afectada
 * @param {Object} oldValues - Valores anteriores de la entidad
 * @param {Object} newValues - Nuevos valores de la entidad
 * @param {Object} event - Event de Netlify para extraer IP y user agent
 */
async function logAdminAction(adminId, action, entityType, entityId, oldValues, newValues, event) {
  try {
    const client = await db.pool.connect();
    try {
      await client.query(
        `INSERT INTO admin_audit_log
         (admin_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          adminId,
          action,
          entityType,
          entityId,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          event.headers?.['x-forwarded-for'] || event.headers?.['x-real-ip'] || null,
          event.headers?.['user-agent'] || null
        ]
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error logging admin action:', err);
    // No fallar el endpoint si falla el log
  }
}

/**
 * Obtiene métricas del dashboard
 * @returns {Object} Métricas agregadas del sistema
 */
async function getDashboardMetrics() {
  try {
    const client = await db.pool.connect();
    try {
      const result = await client.query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
          (SELECT COUNT(*) FROM products WHERE is_active = true) as active_products,
          (SELECT COUNT(*) FROM orders) as total_orders,
          (SELECT COUNT(*) FROM consultas WHERE status = 'pending') as pending_consultas,
          (SELECT COUNT(*) FROM product_reviews WHERE is_reported = true) as reported_reviews,
          (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'confirmed') as total_revenue,
          (SELECT COUNT(*) FROM users WHERE role = 'premium') as total_premium
      `);
      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error getting dashboard metrics:', err);
    throw err;
  }
}

/**
 * Helper para formatear respuesta de Netlify Function
 * @param {number} statusCode - Código HTTP
 * @param {Object} data - Datos a retornar
 * @returns {Object} Formato de respuesta Netlify
 */
function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

module.exports = {
  verifyRole,
  requireAuthWithRole,
  logAdminAction,
  getDashboardMetrics,
  json
};
