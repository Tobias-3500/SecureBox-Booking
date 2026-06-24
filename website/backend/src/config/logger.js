/*
 * logger.js — Central logning for backend (Winston).
 *
 * HVAD FILEN GØR:
 * Opretter én fælles logger, som hele backend bruger (logger.info, logger.error osv.).
 * Logs skrives både til konsollen (læsbart) og til filer i JSON-format, så de er nemme
 * at søge og filtrere i. Filerne roteres dagligt og gemmes i 14 dage.
 *
 * Disse logs er en del af OWASP A09 (Security Logging & Monitoring) og bruges også af
 * admin-dashboardet til at vise fejl og backup-status.
 */

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');  // Laver en ny logfil pr. dag

// I produktion ligger logs i container-mappen /app/logs; lokalt i en ./logs-mappe.
const isProduction = process.env.NODE_ENV === 'production';
const logDirectory = isProduction ? '/app/logs' : path.join(process.cwd(), 'logs');

fs.mkdirSync(logDirectory, { recursive: true });  // Opret log-mappen hvis den ikke findes

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// "Transports" = hvor logs sendes hen. Her: konsol + to roterende filer (fejl og alt).
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${stack || message}${metaText}`;
      })
    ),
  }),
  new DailyRotateFile({
    filename: path.join(logDirectory, 'error-%DATE%.log'),
    level: 'error',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    zippedArchive: true,
    createSymlink: true,
    symlinkName: 'error.log',
  }),
  new DailyRotateFile({
    filename: path.join(logDirectory, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    zippedArchive: true,
    createSymlink: true,
    symlinkName: 'combined.log',
  }),
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false,
});

module.exports = logger;
