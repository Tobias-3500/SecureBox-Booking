-- MariaDB schema for the booking system
-- Charset/collation chosen for good Unicode support.

CREATE DATABASE IF NOT EXISTS booking_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE booking_system;

-- Customers: can be "guest" records created from bookings.
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_email (email)
) ENGINE=InnoDB;

-- Services offered by the salon.
CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  duration_minutes INT UNSIGNED NOT NULL,
  price_dkk DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_services_active (is_active)
) ENGINE=InnoDB;

-- Appointments booked by customers for a service.
CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  appointment_date DATE NOT NULL,
  time_slot TIME NOT NULL,
  status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appt_customer (customer_id),
  KEY idx_appt_service (service_id),
  KEY idx_appt_date (appointment_date),
  KEY idx_appt_date_time (appointment_date, time_slot),
  CONSTRAINT fk_appointments_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appointments_service
    FOREIGN KEY (service_id) REFERENCES services(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Prevent double-booking of the exact same slot (regardless of status).
-- If you need multiple statuses per slot, remove this and enforce uniqueness in application logic.
CREATE UNIQUE INDEX uq_appointments_slot ON appointments (appointment_date, time_slot);

-- Optional starter data
INSERT INTO services (name, description, duration_minutes, price_dkk) VALUES
('Haircut', 'Professional haircut with styling', 30, 250.00),
('Haircut & Wash', 'Haircut with wash and styling', 45, 350.00),
('Beard Trim', 'Professional beard trimming and shaping', 20, 150.00),
('Haircut & Beard', 'Complete grooming package', 50, 400.00),
('Hair Color', 'Full hair coloring service', 90, 800.00),
('Hair Styling', 'Professional styling and blow-dry', 30, 300.00)
ON DUPLICATE KEY UPDATE
  name = VALUES(name);

