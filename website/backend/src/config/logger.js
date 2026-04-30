const fs = require('fs');
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const isProduction = process.env.NODE_ENV === 'production';
const logDirectory = isProduction ? '/app/logs' : path.join(process.cwd(), 'logs');

fs.mkdirSync(logDirectory, { recursive: true });

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const transports = [
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

if (!isProduction) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${stack || message}${metaText}`;
        })
      ),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false,
});

module.exports = logger;
