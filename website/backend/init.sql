-- Create services table
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- in minutes
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    service_id INTEGER REFERENCES services(id),
    appointment_date DATE NOT NULL,
    time_slot VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmed',
    google_event_id VARCHAR(255),
    google_sync_status VARCHAR(20) DEFAULT 'pending',
    google_last_synced_at TIMESTAMP,
    google_sync_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default services (Danish names, prices in DKK; all >= 100)
INSERT INTO services (name, description, duration, price) VALUES
('Klipning', 'Professionel klipning med styling', 30, 250.00),
('Klipning og vask', 'Klipning med vask og styling', 45, 350.00),
('Skægtrimning', 'Professionel skægtrimning og formning', 20, 150.00),
('Klipning og skæg', 'Komplet grooming-pakke', 50, 400.00),
('Hårfarvning', 'Fuld farvning af hår', 90, 800.00),
('Hårstyling', 'Professionel styling og blow-dry', 30, 300.00);

-- Kundekonti / brugere (login & booking). is_verified sættes true efter e-mail-bekræftelse.
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

-- Audit logs for important account, booking and admin actions.
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
