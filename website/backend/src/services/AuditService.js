const logger = require('../config/logger');

class AuditService {
  constructor(pool) {
    this.pool = pool;
  }

  async ensureTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NULL REFERENCES customers(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255),
        old_value JSONB,
        new_value JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    `);
  }

  async logAction({
    userId = null,
    action,
    entityType,
    entityId = null,
    oldValue = null,
    newValue = null,
    ipAddress = null,
  }) {
    if (!action || !entityType) {
      throw new Error('Audit log requires action and entityType');
    }

    try {
      await this.pool.query(
        `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          action,
          entityType,
          entityId ? String(entityId) : null,
          oldValue === undefined ? null : oldValue,
          newValue === undefined ? null : newValue,
          ipAddress,
        ]
      );
    } catch (error) {
      logger.error('Failed to write audit log', {
        error,
        action,
        entityType,
        entityId,
        userId,
      });
    }
  }
}

function getRequestIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
}

module.exports = { AuditService, getRequestIp };
