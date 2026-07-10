const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    `postgresql://${process.env.POSTGRES_USER || "brisa"}:${process.env.POSTGRES_PASSWORD || "brisa123"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || process.env.POSTGRES_HOST_PORT || 5432}/${process.env.POSTGRES_DB || "brisa_db"}`,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
