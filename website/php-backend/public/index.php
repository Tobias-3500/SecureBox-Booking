<?php
declare(strict_types=1);

// Minimal JSON API for MariaDB-backed booking system.
// Endpoints:
// - GET  /api/health
// - GET  /api/services
// - GET  /api/availability/{YYYY-MM-DD}
// - POST /api/appointments
// - POST /api/customers/register
// - POST /api/login

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET,POST,OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

function jsonResponse(int $code, array $payload): void {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function getPath(): string {
  $uri = $_SERVER['REQUEST_URI'] ?? '/';
  $path = parse_url($uri, PHP_URL_PATH);
  return is_string($path) ? rtrim($path, '/') : '';
}

function pdo(): PDO {
  $host = getenv('DB_HOST') ?: '127.0.0.1';
  $port = getenv('DB_PORT') ?: '3306';
  $db   = getenv('DB_NAME') ?: 'booking_system';
  $user = getenv('DB_USER') ?: 'root';
  $pass = getenv('DB_PASSWORD') ?: '';

  $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);
  return $pdo;
}

function readJsonBody(): array {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw ?: '', true);
  if (!is_array($data)) {
    jsonResponse(400, ['error' => 'Invalid JSON body']);
  }
  return $data;
}

function requireString(array $data, string $key, int $maxLen = 255): string {
  $v = $data[$key] ?? null;
  if (!is_string($v)) jsonResponse(400, ['error' => "{$key} is required"]);
  $v = trim($v);
  if ($v === '' || mb_strlen($v) > $maxLen) jsonResponse(400, ['error' => "{$key} is invalid"]);
  return $v;
}

function requireInt(array $data, string $key): int {
  $v = $data[$key] ?? null;
  if (!is_int($v) && !(is_string($v) && ctype_digit($v))) jsonResponse(400, ['error' => "{$key} is required"]);
  $i = (int)$v;
  if ($i <= 0) jsonResponse(400, ['error' => "{$key} is invalid"]);
  return $i;
}

function isValidDate(string $date): bool {
  return (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $date);
}

function normalizeTimeSlot(string $time): string {
  $time = trim($time);
  // Accept "HH:MM" or "HH:MM:SS"
  if (preg_match('/^\d{2}:\d{2}$/', $time)) return $time . ':00';
  if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $time)) return $time;
  jsonResponse(400, ['error' => 'time_slot is invalid']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = getPath();

try {
  if ($method === 'GET' && $path === '/api/health') {
    jsonResponse(200, ['status' => 'ok']);
  }

  // --- Account creation (customer registration) ---
  if ($method === 'POST' && $path === '/api/customers/register') {
    $data = readJsonBody();

    $name = requireString($data, 'name', 255);
    $email = requireString($data, 'email', 255);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
      jsonResponse(400, ['error' => 'email is invalid']);
    }
    $phone = requireString($data, 'phone', 50);
    $password = requireString($data, 'password', 255);
    if (mb_strlen($password) < 8) {
      jsonResponse(400, ['error' => 'password must be at least 8 characters']);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $db = pdo();

    // Check if email already exists
    $stmt = $db->prepare('SELECT id FROM customers WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
      jsonResponse(409, ['error' => 'An account with this email already exists']);
    }

    // Insert new customer with prepared statement
    $ins = $db->prepare('INSERT INTO customers (full_name, email, phone, password_hash) VALUES (?,?,?,?)');
    $ins->execute([$name, $email, $phone, $passwordHash]);

    $customerId = (int)$db->lastInsertId();
    jsonResponse(201, [
      'id' => $customerId,
      'name' => $name,
      'email' => $email,
      'phone' => $phone,
    ]);
  }

  // --- Login (email + password) ---
  if ($method === 'POST' && $path === '/api/login') {
    $data = readJsonBody();

    $email = requireString($data, 'email', 255);
    $password = requireString($data, 'password', 255);

    $db = pdo();
    $stmt = $db->prepare('SELECT id, full_name, email, password_hash FROM customers WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !$user['password_hash'] || !password_verify($password, $user['password_hash'])) {
      jsonResponse(401, ['error' => 'Invalid email or password']);
    }

    jsonResponse(200, [
      'id' => (int)$user['id'],
      'name' => $user['full_name'],
      'email' => $user['email'],
    ]);
  }

  if ($method === 'GET' && $path === '/api/services') {
    $db = pdo();
    $stmt = $db->query('SELECT id, name, description, duration_minutes AS duration, price_dkk AS price FROM services WHERE is_active = 1 ORDER BY id');
    jsonResponse(200, $stmt->fetchAll());
  }

  if ($method === 'GET' && preg_match('#^/api/availability/(\d{4}-\d{2}-\d{2})$#', $path, $m)) {
    $date = $m[1];
    if (!isValidDate($date)) jsonResponse(400, ['error' => 'Invalid date format']);

    $db = pdo();
    $stmt = $db->prepare("SELECT TIME_FORMAT(time_slot, '%H:%i') AS time_slot FROM appointments WHERE appointment_date = ? AND status = 'confirmed'");
    $stmt->execute([$date]);
    $booked = array_map(fn($r) => $r['time_slot'], $stmt->fetchAll());
    jsonResponse(200, ['bookedSlots' => $booked]);
  }

  if ($method === 'POST' && $path === '/api/appointments') {
    $data = readJsonBody();

    $name = requireString($data, 'name', 255);
    $email = requireString($data, 'email', 255);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(400, ['error' => 'email is invalid']);
    $phone = requireString($data, 'phone', 50);
    $serviceId = requireInt($data, 'service_id');
    $appointmentDate = requireString($data, 'appointment_date', 10);
    if (!isValidDate($appointmentDate)) jsonResponse(400, ['error' => 'appointment_date is invalid']);
    $timeSlot = normalizeTimeSlot(requireString($data, 'time_slot', 8));

    // Optional: if you later add account signup, accept "password" and hash it.
    $passwordHash = null;
    if (isset($data['password']) && is_string($data['password']) && trim($data['password']) !== '') {
      $pw = $data['password'];
      if (mb_strlen($pw) < 8) jsonResponse(400, ['error' => 'password must be at least 8 characters']);
      $passwordHash = password_hash($pw, PASSWORD_DEFAULT);
    }

    $db = pdo();
    $db->beginTransaction();

    // Ensure service exists
    $svc = $db->prepare('SELECT id FROM services WHERE id = ? AND is_active = 1');
    $svc->execute([$serviceId]);
    if (!$svc->fetch()) {
      $db->rollBack();
      jsonResponse(400, ['error' => 'service_id is invalid']);
    }

    // Upsert customer by email
    $getCustomer = $db->prepare('SELECT id FROM customers WHERE email = ?');
    $getCustomer->execute([$email]);
    $row = $getCustomer->fetch();

    if ($row) {
      $customerId = (int)$row['id'];
      $upd = $db->prepare('UPDATE customers SET full_name = ?, phone = ? WHERE id = ?');
      $upd->execute([$name, $phone, $customerId]);
      if ($passwordHash !== null) {
        $updPw = $db->prepare('UPDATE customers SET password_hash = ? WHERE id = ?');
        $updPw->execute([$passwordHash, $customerId]);
      }
    } else {
      $ins = $db->prepare('INSERT INTO customers (full_name, email, phone, password_hash) VALUES (?,?,?,?)');
      $ins->execute([$name, $email, $phone, $passwordHash]);
      $customerId = (int)$db->lastInsertId();
    }

    // Prevent double booking (also enforced by UNIQUE index)
    $check = $db->prepare("SELECT id FROM appointments WHERE appointment_date = ? AND time_slot = ? AND status = 'confirmed' LIMIT 1");
    $check->execute([$appointmentDate, $timeSlot]);
    if ($check->fetch()) {
      $db->rollBack();
      jsonResponse(409, ['error' => 'This time slot is already booked']);
    }

    try {
      $insAppt = $db->prepare("INSERT INTO appointments (customer_id, service_id, appointment_date, time_slot, status) VALUES (?,?,?,?, 'confirmed')");
      $insAppt->execute([$customerId, $serviceId, $appointmentDate, $timeSlot]);
      $appointmentId = (int)$db->lastInsertId();
      $db->commit();
    } catch (PDOException $e) {
      $db->rollBack();
      // Duplicate key on uq_appointments_slot
      if ($e->getCode() === '23000') {
        jsonResponse(409, ['error' => 'This time slot is already booked']);
      }
      throw $e;
    }

    jsonResponse(201, [
      'id' => $appointmentId,
      'customer_id' => $customerId,
      'service_id' => $serviceId,
      'appointment_date' => $appointmentDate,
      'time_slot' => substr($timeSlot, 0, 5),
      'status' => 'confirmed',
    ]);
  }

  jsonResponse(404, ['error' => 'Not found']);
} catch (PDOException $e) {
  jsonResponse(500, ['error' => 'Database error', 'detail' => $e->getMessage()]);
} catch (Throwable $e) {
  jsonResponse(500, ['error' => 'Server error', 'detail' => $e->getMessage()]);
}

