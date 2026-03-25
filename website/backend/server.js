const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const BACKUP_VM_HOST = process.env.BACKUP_VM_HOST || '10.0.0.1';
const BACKUP_SCRIPT_PATH = process.env.BACKUP_SCRIPT_PATH || '/root/backup.sh';
const BACKUP_LOG_PATH = process.env.BACKUP_LOG_PATH || '/var/log/backup.log';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || '';

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'salon_user',
  password: process.env.DB_PASSWORD || 'salon_password',
  database: process.env.DB_NAME || 'salon_db',
};

console.log('Database configuration:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database
});
console.log('Admin email configured:', ADMIN_EMAIL ? `${ADMIN_EMAIL.substring(0, 5)}...` : '(none – set ADMIN_EMAIL in .env)');

const pool = new Pool(dbConfig);

// Ensure customers table exists (for auth) — matcher kolonner i init.sql
async function ensureCustomersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verification_token VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  await pool.query(`
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64);
  `);
}

// Eksisterende kunder før e-mail-verifikation: ingen token => betragtes som allerede verificeret
async function migrateLegacyVerifiedCustomers() {
  await pool.query(`
    UPDATE customers
    SET is_verified = true
    WHERE verification_token IS NULL
      AND is_verified = false;
  `);
  if (ADMIN_EMAIL) {
    await pool.query(
      `UPDATE customers SET is_verified = true, verification_token = NULL
       WHERE lower(email) = lower($1)`,
      [ADMIN_EMAIL]
    );
  }
}

async function sendVerificationEmail(toEmail, code) {
  const subject = 'Bekræft din konto — Nordisk Hår';
  const html = `
    <p>Hej,</p>
    <p>Tak for din oprettelse. Bekræft din e-mail med koden:</p>
    <p style="font-size:1.35rem;letter-spacing:0.12em;font-weight:700;">${code}</p>
    <p>Indtast koden på websitet under &quot;Bekræft e-mail&quot;.</p>
    <p>Hvis du ikke har oprettet en konto, kan du se bort fra denne mail.</p>
  `;

  if (!RESEND_API_KEY || !RESEND_FROM) {
    console.warn('[email] RESEND_API_KEY eller RESEND_FROM mangler — bekræftelseskode til', toEmail, ':', code);
    return;
  }

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: toEmail,
    subject,
    html,
  });
  if (error) {
    console.error('[email] Resend fejl:', error);
    throw new Error('Kunne ikke sende bekræftelsesmail');
  }
}

// Test database connection with retry logic
async function testConnection() {
  let retries = 5;
  while (retries > 0) {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('Successfully connected to PostgreSQL database:', dbConfig.database);
      console.log('Database time:', result.rows[0].now);
      return true;
    } catch (error) {
      retries--;
      console.error(`Database connection failed. Retries left: ${retries}`, error.message);
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('Failed to connect to database after all retries');
        process.exit(1);
      }
    }
  }
}

// Handle connection errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

function signAndSetToken(res, user) {
  const isAdmin = ADMIN_EMAIL && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isVerified = !!user.is_verified;

  const payload = {
    id: user.id,
    name: user.full_name,
    email: user.email,
    isAdmin,
    isVerified,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  });

  const useSecureCookie = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.startsWith('https');
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: useSecureCookie,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// Simple middleware to read auth token if needed in future
function requireAuth(req, res, next) {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Ikke logget ind' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Ugyldigt eller udløbet login' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Kræver administratoradgang' });
  }
  next();
}

async function requireVerifiedCustomer(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT is_verified FROM customers WHERE id = $1',
      [req.user.id]
    );
    const row = result.rows[0];
    if (!row || !row.is_verified) {
      return res.status(403).json({
        error: 'Du skal bekræfte din e-mail før du kan booke.',
        code: 'NOT_VERIFIED',
      });
    }
    next();
  } catch (err) {
    console.error('requireVerifiedCustomer:', err);
    res.status(500).json({ error: 'Kunne ikke tjekke konto' });
  }
}

// All database queries use parameterized statements ($1, $2, …) to prevent SQL injection.
// No user or request data is ever interpolated into SQL strings.

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Current user from JWT cookie (for session restore / route guard)
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT full_name, email, phone, is_verified FROM customers WHERE id = $1',
      [req.user.id]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: 'Bruger ikke fundet' });
    }
    const isAdmin = ADMIN_EMAIL && row.email && row.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    res.json({
      id: req.user.id,
      name: row.full_name,
      email: row.email,
      phone: row.phone,
      isAdmin,
      isVerified: !!row.is_verified,
    });
  } catch (error) {
    console.error('Error in /api/me:', error);
    res.status(500).json({ error: 'Kunne ikke hente bruger' });
  }
});

// Auth: register new customer
app.post('/api/customers/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Alle felter skal udfyldes' });
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ugyldig e-mail' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Adgangskoden skal være mindst 8 tegn' });
    }

    await ensureCustomersTable();

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Der findes allerede en konto med denne e-mail' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const emailLc = email.trim().toLowerCase();
    const adminLc = ADMIN_EMAIL ? ADMIN_EMAIL.trim().toLowerCase() : '';
    const preVerified = adminLc && emailLc === adminLc;
    const verificationToken = preVerified ? null : crypto.randomBytes(4).toString('hex');

    const result = await pool.query(
      `INSERT INTO customers (full_name, email, phone, password_hash, is_verified, verification_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, is_verified`,
      [name, email.trim(), phone, passwordHash, preVerified, verificationToken]
    );

    const customer = result.rows[0];

    if (!preVerified) {
      try {
        await sendVerificationEmail(customer.email, verificationToken);
      } catch (mailErr) {
        console.error(mailErr);
        await pool.query('DELETE FROM customers WHERE id = $1', [customer.id]);
        return res.status(503).json({
          error: mailErr.message || 'Kunne ikke sende bekræftelsesmail. Prøv igen senere.',
        });
      }

      return res.status(201).json({
        needsVerification: true,
        email: customer.email,
        message: 'Vi har sendt en kode til din e-mail. Bekræft kontoen for at kunne logge ind.',
      });
    }

    signAndSetToken(res, { ...customer, is_verified: true });

    res.status(201).json({
      id: customer.id,
      name: customer.full_name,
      email: customer.email,
      phone,
      isAdmin: !!preVerified,
      isVerified: true,
    });
  } catch (error) {
    console.error('Error registering customer:', error);
    res.status(500).json({ error: 'Kunne ikke oprette konto' });
  }
});

// Auth: login existing customer
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail og adgangskode er påkrævet' });
    }

    await ensureCustomersTable();

    const result = await pool.query(
      'SELECT id, full_name, email, phone, password_hash, is_verified FROM customers WHERE lower(email) = lower($1)',
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Forkert e-mail eller adgangskode' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Forkert e-mail eller adgangskode' });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Bekræft din e-mail før du kan logge ind. Tjek din indbakke for koden.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    signAndSetToken(res, user);

    const isAdmin = ADMIN_EMAIL && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    res.json({
      id: user.id,
      name: user.full_name,
      email: user.email,
      phone: user.phone,
      isAdmin,
      isVerified: true,
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login mislykkedes' });
  }
});

// Bekræft e-mail med kode fra Resend-mail
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'E-mail og kode er påkrævet' });
    }

    const normalizedEmail = String(email).trim();
    const normalizedCode = String(code).trim().toLowerCase();

    if (!normalizedCode) {
      return res.status(400).json({ error: 'Ugyldig kode' });
    }

    await ensureCustomersTable();

    const result = await pool.query(
      `UPDATE customers
       SET is_verified = true, verification_token = NULL
       WHERE lower(email) = lower($1)
         AND lower(verification_token) = $2
         AND is_verified = false
       RETURNING id, full_name, email, phone, is_verified`,
      [normalizedEmail, normalizedCode]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Forkert kode eller e-mail, eller kontoen er allerede bekræftet.' });
    }

    const row = result.rows[0];
    signAndSetToken(res, row);

    const isAdmin = ADMIN_EMAIL && row.email && row.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    res.json({
      id: row.id,
      name: row.full_name,
      email: row.email,
      phone: row.phone,
      isAdmin,
      isVerified: true,
    });
  } catch (error) {
    console.error('Error in /api/auth/verify:', error);
    res.status(500).json({ error: 'Bekræftelse mislykkedes' });
  }
});

// Logout: clear auth cookie
app.post('/api/logout', (req, res) => {
  const useSecureCookie = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.startsWith('https');
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: useSecureCookie,
    sameSite: 'lax',
  });
  res.status(204).send();
});

// Get all services
app.get('/api/services', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Kunne ikke hente ydelser' });
  }
});

// Get available time slots for a date
app.get('/api/availability/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const result = await pool.query(
      `SELECT time_slot FROM appointments 
       WHERE appointment_date = $1 AND status = 'confirmed'`,
      [date]
    );
    const bookedSlots = result.rows.map(row => row.time_slot);
    res.json({ bookedSlots });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Kunne ikke hente ledige tider' });
  }
});

// Create a new appointment (kræver verificeret, logget ind kunde)
app.post('/api/appointments', requireAuth, requireVerifiedCustomer, async (req, res) => {
  try {
    const { service_id, appointment_date, time_slot } = req.body;

    if (!service_id || !appointment_date || !time_slot) {
      return res.status(400).json({ error: 'Ydelse, dato og tid skal angives' });
    }

    const cust = await pool.query(
      'SELECT full_name, email, phone FROM customers WHERE id = $1',
      [req.user.id]
    );
    if (cust.rows.length === 0) {
      return res.status(401).json({ error: 'Kunde ikke fundet' });
    }
    const { full_name: name, email, phone } = cust.rows[0];

    const existingAppointment = await pool.query(
      `SELECT id FROM appointments 
       WHERE appointment_date = $1 AND time_slot = $2 AND status = 'confirmed'`,
      [appointment_date, time_slot]
    );

    if (existingAppointment.rows.length > 0) {
      return res.status(409).json({ error: 'Denne tid er allerede booket' });
    }

    const result = await pool.query(
      `INSERT INTO appointments (name, email, phone, service_id, appointment_date, time_slot, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
       RETURNING *`,
      [name, email, phone, service_id, appointment_date, time_slot]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Kunne ikke oprette booking' });
  }
});

// Get all appointments (admin-only view)
app.get('/api/admin/appointments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, s.name as service_name, s.duration, s.price 
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       ORDER BY a.appointment_date DESC, a.time_slot DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Kunne ikke hente bookinger' });
  }
});

// Update appointment status (admin-only; e.g. set to cancelled, not deleted)
app.patch('/api/admin/appointments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Ugyldigt booking-id' });
    }
    const allowed = ['confirmed', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: 'Ugyldig status' });
    }
    const result = await pool.query(
      `UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking ikke fundet' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere booking' });
  }
});

// System status: check connectivity to backup VM (admin-only)
app.get('/api/admin/system-status', requireAuth, requireAdmin, (req, res) => {
  const host = BACKUP_VM_HOST;
  const timeout = 5000;
  const cmd = process.platform === 'win32'
    ? `ping -n 1 -w ${Math.ceil(timeout / 1000)} ${host}`
    : `ping -c 1 -W ${Math.ceil(timeout / 1000)} ${host}`;

  exec(cmd, { timeout }, (err, stdout, stderr) => {
    if (err) {
      return res.json({
        backupVm: host,
        reachable: false,
        message: err.message || 'Ping mislykkedes',
      });
    }
    res.json({
      backupVm: host,
      reachable: true,
      message: 'Forbindelse OK',
    });
  });
});

// Run manual backup (admin-only, strictly protected)
app.post('/api/admin/backup/run', requireAuth, requireAdmin, (req, res) => {
  exec(`"${BACKUP_SCRIPT_PATH}"`, { timeout: 300000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('Backup script error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Backup-script fejlede',
      });
    }
    res.json({
      success: true,
      message: 'Backup startet',
      output: (stdout || '').trim() || (stderr || '').trim(),
    });
  });
});

// Get backup log (admin-only)
app.get('/api/admin/backup/logs', requireAuth, requireAdmin, (req, res) => {
  const logPath = path.resolve(BACKUP_LOG_PATH);
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.json({ log: '', message: 'Ingen logfil endnu.' });
      }
      return res.status(500).json({ error: 'Kunne ikke læse logfil: ' + err.message });
    }
    res.json({ log: data || '' });
  });
});

// Start server after database connection is established
testConnection().then(async () => {
  await ensureCustomersTable();
  await migrateLegacyVerifiedCustomers();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
