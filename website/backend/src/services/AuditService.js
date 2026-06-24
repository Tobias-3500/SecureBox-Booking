/*
 * AuditService.js — Audit-logning til databasen.
 *
 * HVAD FILEN GØR:
 * Skriver en "hvem gjorde hvad og hvornår"-historik til tabellen audit_logs. Hver vigtig
 * handling (oprettelse, login, booking, statusændring, kalender-sync) gemmes som en række
 * med bruger-id, handling, før/efter-værdier og klientens IP-adresse.
 *
 * HVORFOR: Det giver sporbarhed til fejlfinding og er en del af OWASP A09
 * (Security Logging & Monitoring). server.js opretter én AuditService og kalder
 * logAction() de relevante steder.
 */

const logger = require('../config/logger');

class AuditService {
  // Modtager den fælles databasepulje fra server.js, så loggen skrives til samme database.
  constructor(pool) {
    this.pool = pool;
  }

  // Opretter audit_logs-tabellen og dens indekser, hvis de ikke findes (køres ved opstart).
  // Indekserne holder opslag hurtige, efterhånden som tabellen vokser.
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

  // Skriver én audit-hændelse til databasen.
  //   action     = hvad der skete, fx 'LOGIN_SUCCESS' eller 'APPOINTMENT_CREATED'
  //   entityType = hvilken slags ting det handler om, fx 'customer' eller 'appointment'
  //   oldValue/newValue = før/efter-tilstand (gemmes som JSONB), så ændringer kan rekonstrueres
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

    // Parameteriseret INSERT ($1..$7) — sikkert mod SQL injection.
    // En fejl her må aldrig vælte selve handlingen, så den fanges og logges blot.
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

// Finder klientens rigtige IP. Da alle forespørgsler kommer via nginx, bruges
// X-Forwarded-For-headeren (sat af nginx) frem for den interne socket-adresse.
function getRequestIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
}

module.exports = { AuditService, getRequestIp };
