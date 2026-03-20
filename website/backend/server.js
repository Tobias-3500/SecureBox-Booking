const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const BACKUP_VM_HOST = process.env.BACKUP_VM_HOST || '10.0.0.1';
const BACKUP_SCRIPT_PATH = process.env.BACKUP_SCRIPT_PATH || '/root/backup.sh';
const BACKUP_LOG_PATH = process.env.BACKUP_LOG_PATH || '/var/log/backup.log';

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

// Ensure customers table exists (for auth)
async function ensureCustomersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
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

  const payload = {
    id: user.id,
    name: user.full_name,
    email: user.email,
    isAdmin,
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
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// All database queries use parameterized statements ($1, $2, …) to prevent SQL injection.
// No user or request data is ever interpolated into SQL strings.

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Current user from JWT cookie (for session restore / route guard)
app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    isAdmin: !!req.user.isAdmin,
  });
});

// Auth: register new customer
app.post('/api/customers/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email is invalid' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    await ensureCustomersTable();

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO customers (full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email`,
      [name, email, phone, passwordHash]
    );

    const customer = result.rows[0];
    signAndSetToken(res, customer);

    const isAdmin = ADMIN_EMAIL && customer.email && customer.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    res.status(201).json({
      id: customer.id,
      name: customer.full_name,
      email: customer.email,
      isAdmin,
    });
  } catch (error) {
    console.error('Error registering customer:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Auth: login existing customer
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    await ensureCustomersTable();

    const result = await pool.query(
      'SELECT id, full_name, email, password_hash FROM customers WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    signAndSetToken(res, user);

    const isAdmin = ADMIN_EMAIL && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    res.json({
      id: user.id,
      name: user.full_name,
      email: user.email,
      isAdmin,
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
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
    res.status(500).json({ error: 'Failed to fetch services' });
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
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Create a new appointment
app.post('/api/appointments', async (req, res) => {
  try {
    const { name, email, phone, service_id, appointment_date, time_slot } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !service_id || !appointment_date || !time_slot) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if time slot is already booked
    const existingAppointment = await pool.query(
      `SELECT id FROM appointments 
       WHERE appointment_date = $1 AND time_slot = $2 AND status = 'confirmed'`,
      [appointment_date, time_slot]
    );

    if (existingAppointment.rows.length > 0) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Create appointment
    const result = await pool.query(
      `INSERT INTO appointments (name, email, phone, service_id, appointment_date, time_slot, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
       RETURNING *`,
      [name, email, phone, service_id, appointment_date, time_slot]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
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
    res.status(500).json({ error: 'Failed to fetch appointments' });
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
      return res.status(400).json({ error: 'Status skal være "confirmed" eller "cancelled"' });
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
        message: err.message || 'Ping failed',
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
        error: err.message || 'Backup script failed',
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
testConnection().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
