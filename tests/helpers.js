const { pool } = require("../db");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const request = require("supertest");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-dermamatch";

async function initDb() {
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "db", "init.sql"),
    "utf8"
  );
  await pool.query(sql);

  // Crear tabla admin_audit_log para tests
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INTEGER,
      old_values JSONB,
      new_values JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Crear columna role en users si no existe
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`);
    await pool.query(`ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_valid_role CHECK (role IN ('user', 'premium', 'dermatologist', 'admin'))`);
  } catch (e) {
    // Columna o constraint ya existe
  }
}

async function cleanDb() {
  await pool.query("DELETE FROM admin_audit_log");
  await pool.query("DELETE FROM consultas");  // Primero por FK a dermatologists
  // dermatologists es tabla de referencia, no se limpia automáticamente
  // Usar cleanDermatologists() si es necesario
  await pool.query("DELETE FROM users");
  await pool.query("DELETE FROM contacts");
  await pool.query("DELETE FROM payments");
}

async function cleanDermatologists() {
  await pool.query("DELETE FROM consultas");  // Primero por FK
  await pool.query("DELETE FROM dermatologists");
}

async function seedProducts() {
  await pool.query("TRUNCATE products RESTART IDENTITY CASCADE");
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "db", "seed.sql"),
    "utf8"
  );
  await pool.query(sql);
}

async function closeDb() {
  await pool.end();
}

/**
 * Crea un usuario con rol específico
 * @param {Object} overrides - Campos a sobrescribir
 * @returns {Object} {user, token}
 */
async function createTestUser(overrides = {}) {
  const userData = {
    name: "Test User",
    email: `test-${Date.now()}@example.com`,
    password: "test123",
    role: 'user',
    ...overrides
  };

  const hashedPassword = await bcrypt.hash(userData.password, 10);
  const result = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [userData.name, userData.email, hashedPassword, userData.role]
  );

  const user = result.rows[0];
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { user, token };
}

/**
 * Crea un usuario admin para testing
 * @param {Object} overrides - Campos a sobrescribir
 * @returns {Object} {user, token}
 */
async function createAdminUser(overrides = {}) {
  return createTestUser({
    name: "Admin User",
    email: `admin-${Date.now()}@example.com`,
    role: 'admin',
    ...overrides
  });
}

/**
 * Crea un usuario dermatologist para testing
 * @param {Object} overrides - Campos a sobrescribir
 * @returns {Object} {user, token}
 */
async function createDermatologist(overrides = {}) {
  const userData = {
    name: "Dr. Test",
    email: `dr-${Date.now()}@example.com`,
    role: 'dermatologist',
    ...overrides
  };

  const userResult = await createTestUser(userData);

  // También crear registro en tabla dermatologists
  const dermResult = await pool.query(
    `INSERT INTO dermatologists (name, specialty, clinic, email)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userData.name, 'Dermatología General', 'Clínica Test', userData.email]
  );

  return {
    user: userResult.user,
    token: userResult.token,
    dermatologistId: dermResult.rows[0].id
  };
}

/**
 * Crea un usuario premium para testing
 * @param {Object} overrides - Campos a sobrescribir
 * @returns {Object} {user, token}
 */
async function createPremiumUser(overrides = {}) {
  return createTestUser({
    name: "Premium User",
    email: `premium-${Date.now()}@example.com`,
    role: 'premium',
    subscription_plan: 'premium',
    ...overrides
  });
}

/**
 * Crea un producto de prueba
 * @param {Object} overrides - Campos a sobrescribir
 * @returns {Object} Producto creado
 */
async function createTestProduct(overrides = {}) {
  const productData = {
    name: "Test Product",
    brand: "Test Brand",
    price: 25.00,
    category: "moisturizer",
    types: ["normal", "dry"],
    allergies: [],
    eco: false,
    cruelty: true,
    rating: 4.5,
    stock: 50,
    is_active: true,
    ...overrides
  };

  const result = await pool.query(
    `INSERT INTO products
      (name, brand, price, category, types, allergies, eco, cruelty, rating, stock, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      productData.name,
      productData.brand,
      productData.price,
      productData.category,
      JSON.stringify(productData.types),
      JSON.stringify(productData.allergies),
      productData.eco,
      productData.cruelty,
      productData.rating,
      productData.stock,
      productData.is_active
    ]
  );

  return result.rows[0];
}

/**
 * Crea una consulta de prueba
 * @param {number} userId - ID del usuario
 * @param {Object} overrides - Campos a sobrescribir
 * @returns {Object} Consulta creada
 */
async function createConsulta(userId, overrides = {}) {
  const consultaData = {
    subject: "Test Subject",
    message: "Test message",
    status: "pending",
    ...overrides
  };

  const result = await pool.query(
    `INSERT INTO consultas (user_id, subject, message, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, consultaData.subject, consultaData.message, consultaData.status]
  );

  return result.rows[0];
}

/**
 * Crea una orden de prueba
 * @param {number} userId - ID del usuario
 * @param {Object} overrides - Campos a sobrescribir
 * @returns {Object} Orden creada
 */
async function createTestOrder(userId, overrides = {}) {
  const orderData = {
    status: "pending",
    total: 100.00,
    payment_method: "card",
    delivery_option: "delivery",
    ...overrides
  };

  const result = await pool.query(
    `INSERT INTO orders (user_id, status, total, payment_method, delivery_option)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, orderData.status, orderData.total, orderData.payment_method, orderData.delivery_option]
  );

  return result.rows[0];
}

module.exports = {
  initDb,
  cleanDb,
  cleanDermatologists,
  seedProducts,
  closeDb,
  pool,
  createTestUser,
  createAdminUser,
  createDermatologist,
  createPremiumUser,
  createTestProduct,
  createConsulta,
  createTestOrder
};
