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
