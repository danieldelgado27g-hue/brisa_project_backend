-- Migración 001: Agregar campo role a tabla users
-- Autor: DermaMatch Backend Team
-- Fecha: 07/07/2026
-- Descripción: Agrega sistema de roles para distinguir usuarios, admins, dermatólogos y premium

-- Agregar campo role a tabla users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Crear restricción CHECK para roles válidos
ALTER TABLE users ADD CONSTRAINT check_valid_role
    CHECK (role IN ('user', 'premium', 'dermatologist', 'admin'));

-- Índice para búsquedas por rol
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Actualizar usuarios existentes a 'user' por defecto
UPDATE users SET role = 'user' WHERE role IS NULL OR role = '';

-- Comentario para documentación
COMMENT ON COLUMN users.role IS 'Rol del usuario: user, premium, dermatologist, admin';
