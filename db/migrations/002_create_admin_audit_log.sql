-- Migración 002: Crear tabla de auditoría para acciones administrativas
-- Autor: DermaMatch Backend Team
-- Fecha: 07/07/2026
-- Descripción: Registra todas las acciones administrativas para auditoría y seguridad

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
);

-- Índices para consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit_log(created_at DESC);

-- Comentario para documentación
COMMENT ON TABLE admin_audit_log IS 'Registro de acciones administrativas para auditoría y seguridad. Registra:create,update,delete actions admin.';
COMMENT ON COLUMN admin_audit_log.action IS 'Tipo de acción: create, update, delete, etc.';
COMMENT ON COLUMN admin_audit_log.entity_type IS 'Tipo de entidad afectada: user, product, order, etc.';
COMMENT ON COLUMN admin_audit_log.old_values IS 'Valores anteriores de la entidad (antes del cambio)';
COMMENT ON COLUMN admin_audit_log.new_values IS 'Nuevos valores de la entidad (después del cambio)';
