process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5433";
process.env.POSTGRES_USER = process.env.POSTGRES_USER || "brisa";
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "brisa123";
process.env.POSTGRES_DB = process.env.POSTGRES_DB || "brisa_db";
