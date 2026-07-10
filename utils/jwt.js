const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-dermamatch";

function verifyToken(event) {
  const authHeader =
    event.headers?.authorization || event.headers?.Authorization;

  if (!authHeader) {
    return { error: "Token no proporcionado" };
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { user: decoded };
  } catch {
    return { error: "Token inválido o expirado" };
  }
}

module.exports = { verifyToken };
