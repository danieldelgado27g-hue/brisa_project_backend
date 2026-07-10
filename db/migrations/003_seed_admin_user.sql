-- Migración 003: Seed usuario admin inicial
-- Autor: DermaMatch Backend Team
-- Fecha: 07/07/2026
-- Descripción: Crea usuario administrador inicial para desarrollo/producción

-- NOTA: En producción, cambiar la contraseña después del primer login
-- Hash de "Admin123!" usando bcrypt (10 rounds)
-- Para generar nuevo hash: require('bcryptjs').hash('tu-password', 10)

INSERT INTO users (name, email, password, role, subscription_plan, subscription_status)
VALUES (
  'Admin DermaMatch',
  'admin@dermamatch.com',
  '$2a$10$rXGMjZhiFMvMYwPpYhXquM5El.1lqWPEZ4WL6/j5NWQm5v0l5xIXm', -- Admin123!
  'admin',
  'premium',
  'active'
)
ON CONFLICT (email) DO NOTHING;

-- NOTA PARA DESARROLLO:
-- Credentials para testing:
-- Email: admin@dermamatch.com
-- Password: Admin123!

-- En producción, CAMBIAR ESTA CONTRASEÑA INMEDIATAMENTE
