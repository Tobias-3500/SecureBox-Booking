-- ============================================================================
-- init.sql — Opretter databasens struktur (datalaget).
--
-- HVAD FILEN GØR:
-- Køres AUTOMATISK af PostgreSQL-containeren første gang databasen startes (lægges i
-- /docker-entrypoint-initdb.d via docker-compose). Den opretter de fire tabeller, som
-- hele systemet bygger på, og indsætter salonens standardydelser.
--
-- TABELLER:
--   services      -> de ydelser der kan bookes (klipning, farvning osv.)
--   appointments  -> selve bookingerne
--   customers     -> brugerkonti (login) med hashet adgangskode
--   audit_logs    -> historik over vigtige handlinger
-- ============================================================================

-- Ydelser der kan bookes. Indlæses med standarddata længere nede.
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- in minutes
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookinger. Kundens kontaktinfo gemmes direkte på bookingen (ikke kun som reference),
-- så historikken bevares selv hvis en konto slettes. google_*-kolonnerne styrer
-- synkroniseringen til Google Kalender. Bookinger slettes ikke; status sættes til 'cancelled'.
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

-- Standardydelser der vises på forsiden. Pris i DKK, varighed i minutter.
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

-- Audit-log: sporbarhed over vigtige konto-, booking- og admin-handlinger.
-- old_value/new_value gemmes som JSONB (fleksibelt JSON), så før/efter kan registreres.
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

-- Indekser holder opslag i audit-loggen hurtige, efterhånden som den vokser.
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
