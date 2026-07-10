const { verifyToken } = require("../../utils/jwt");
const { verifyRole, getDashboardMetrics, json } = require("../../utils/admin");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET" && event.path === "/api/admin/dashboard") {
      return handleGetDashboard(event);
    }
    return json(404, { error: "Endpoint no encontrado" });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleGetDashboard(event) {
  // Verificar autenticación
  const auth = verifyToken(event);
  if (auth.error) {
    return json(401, { error: auth.error });
  }

  // Verificar rol admin
  const roleCheck = verifyRole(auth.user, ['admin']);
  if (roleCheck.error) {
    return json(403, { error: roleCheck.error });
  }

  // Obtener métricas
  const metrics = await getDashboardMetrics();

  return json(200, {
    success: true,
    dashboard: {
      total_users: parseInt(metrics.total_users) || 0,
      active_products: parseInt(metrics.active_products) || 0,
      total_orders: parseInt(metrics.total_orders) || 0,
      pending_consultas: parseInt(metrics.pending_consultas) || 0,
      reported_reviews: parseInt(metrics.reported_reviews) || 0,
      total_revenue: parseFloat(metrics.total_revenue) || 0,
      total_premium: parseInt(metrics.total_premium) || 0
    }
  });
}
