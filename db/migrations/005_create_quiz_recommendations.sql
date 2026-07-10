-- Migración 005: Tabla de grupos de recomendación del test
-- Fecha: 2026-07-08
-- Descripción: Permite al admin configurar qué productos recomendar
--              según las respuestas del quiz de tipo de piel.
--
-- Lógica de matching:
--   conditions = {"q1":"dry","q2":"sensitive_high"}
--   Un registro coincide si TODOS los keys de conditions
--   están presentes y coinciden con los parámetros del quiz.
--   conditions = {} actúa como catch-all (regla por defecto).
--   Gana la regla con mayor priority.

CREATE TABLE IF NOT EXISTS quiz_recommendations (
  id SERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  product_ids JSONB NOT NULL DEFAULT '[]',
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_recommendations_active
  ON quiz_recommendations (is_active, priority DESC);
