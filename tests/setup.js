const { pool } = require("../db");
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.POSTGRES_DB = process.env.POSTGRES_DB || "brisa_db";

beforeAll(async () => {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, "..", "db", "init.sql"),
      "utf8"
    );
    await pool.query(sql);
  } catch (err) {
    console.warn("Could not initialize test DB:", err.message);
  }
});

afterEach(async () => {
  try {
    await pool.query("DELETE FROM users");
    await pool.query("DELETE FROM contacts");
    await pool.query("DELETE FROM payments");
  } catch (err) {
    // ignore if table doesn't exist
  }
});

afterAll(async () => {
  await pool.end();
});
