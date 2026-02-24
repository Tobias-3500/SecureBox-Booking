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

-- Insert default services
INSERT INTO services (name, description, duration, price) VALUES
('Haircut', 'Professional haircut with styling', 30, 25.00),
('Haircut & Wash', 'Haircut with wash and styling', 45, 35.00),
('Beard Trim', 'Professional beard trimming and shaping', 20, 15.00),
('Haircut & Beard', 'Complete grooming package', 50, 40.00),
('Hair Color', 'Full hair coloring service', 90, 80.00),
('Hair Styling', 'Professional styling and blow-dry', 30, 30.00);
