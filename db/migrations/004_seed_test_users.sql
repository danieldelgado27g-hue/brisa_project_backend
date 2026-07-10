-- Migración 004: Seed usuarios de prueba
-- Fecha: 2026-07-08
-- Descripción: Crea usuarios de prueba para desarrollo y testing
--
-- Credentials:
--   user@dermamatch.com    / Test123!
--   premium@dermamatch.com / Test123!
--
-- Hash de "Test123!" usando bcrypt (10 rounds)

INSERT INTO users (name, email, password, role, subscription_plan, subscription_status)
VALUES
  ('Usuario Test', 'user@dermamatch.com', '$2b$10$M8nAeASCgPnDQPK0TXGJpeANYSwfXHTQ4HqM9A55iWr0COf49w69S', 'user', 'basic', 'active'),
  ('Premium Test', 'premium@dermamatch.com', '$2b$10$M8nAeASCgPnDQPK0TXGJpeANYSwfXHTQ4HqM9A55iWr0COf49w69S', 'premium', 'pro', 'active')
ON CONFLICT (email) DO NOTHING;
