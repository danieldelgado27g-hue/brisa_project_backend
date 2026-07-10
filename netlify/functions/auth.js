const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../db");
const { verifyToken } = require("../../utils/jwt");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-dermamatch";
const JWT_EXPIRES_IN = "7d";

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

exports.handler = async (event) => {
  const path = event.path;
  const parts = path.split("/");
  const action = parts[parts.length - 1];

  try {
    switch (action) {
      case "register":
        return handleRegister(event);
      case "login":
        return handleLogin(event);
      case "me":
        return handleMe(event);
      case "logout":
        return handleLogout(event);
      case "recover":
        return handleRecover(event);
      default:
        return json(404, { error: "Not found" });
    }
  } catch (err) {
    console.error("Auth error:", err);
    return json(500, { error: "Error interno del servidor" });
  }
};

async function handleRegister(event) {
  if (event.httpMethod !== "POST")
    return json(405, { error: "Method Not Allowed" });

  const { name, email, password } = JSON.parse(event.body || "{}");
  const missing = [];
  if (!name) missing.push("name");
  if (!email) missing.push("email");
  if (!password) missing.push("password");

  if (missing.length > 0)
    return json(400, { error: `Campos requeridos: ${missing.join(", ")}` });

  const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0)
    return json(409, { error: "El email ya está registrado" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await db.query(
    "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at",
    [name, email, hashedPassword, 'user']
  );

  const user = result.rows[0];
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return json(201, {
    success: true,
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
}

async function handleLogin(event) {
  if (event.httpMethod !== "POST")
    return json(405, { error: "Method Not Allowed" });

  const { email, password } = JSON.parse(event.body || "{}");

  if (!email || !password)
    return json(400, { error: "Email y contraseña son requeridos" });

  const result = await db.query(
    "SELECT id, name, email, password, role FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0)
    return json(401, { error: "Credenciales inválidas" });

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password);

  if (!valid)
    return json(401, { error: "Credenciales inválidas" });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return json(200, {
    success: true,
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
}

async function handleMe(event) {
  if (event.httpMethod !== "GET")
    return json(405, { error: "Method Not Allowed" });

  const auth = verifyToken(event);
  if (auth.error) return json(401, { error: auth.error });

  const result = await db.query(
    "SELECT id, name, email, avatar_url, phone, subscription_plan, subscription_status, role, created_at FROM users WHERE id = $1",
    [auth.user.id]
  );

  if (result.rows.length === 0)
    return json(404, { error: "Usuario no encontrado" });

  return json(200, { success: true, user: result.rows[0] });
}

async function handleLogout(event) {
  if (event.httpMethod !== "POST")
    return json(405, { error: "Method Not Allowed" });

  const auth = verifyToken(event);
  if (auth.error) return json(401, { error: auth.error });

  return json(200, { success: true, message: "Sesión cerrada" });
}

async function handleRecover(event) {
  if (event.httpMethod !== "POST")
    return json(405, { error: "Method Not Allowed" });

  const { email } = JSON.parse(event.body || "{}");
  if (!email)
    return json(400, { error: "Email es requerido" });

  return json(200, { success: true, message: "Si el email existe, recibirás instrucciones" });
}
