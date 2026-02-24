import React, { useState, useEffect } from 'react';
import './App.css';
import ServiceCard from './components/ServiceCard';
import BookingForm from './components/BookingForm';
import Header from './components/Header';
import AdminDashboard from './components/AdminDashboard';

const API_URL = process.env.REACT_APP_API_URL || '';

function App() {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch(`${API_URL}/api/services`);
      if (!response.ok) throw new Error('Failed to fetch services');
      const data = await response.json();
      setServices(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookingComplete = () => {
    setSelectedService(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookNowClick = () => {
    // Scroll to services section so user can select a service
    const servicesSection = document.querySelector('.services-section');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      // If services section doesn't exist yet, wait a bit and try again
      setTimeout(() => {
        const section = document.querySelector('.services-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const handleServicesClick = () => {
    // Scroll to services section
    const servicesSection = document.querySelector('.services-section');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    // Optional: could also clear any saved tokens here in the future
  };

  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuth(true);
    setAuthError(null);
  };

  const closeAuth = () => {
    setShowAuth(false);
    setAuthForm({
      name: '',
      email: '',
      phone: '',
      password: '',
    });
    setAuthError(null);
  };

  const handleAuthChange = (e) => {
    setAuthForm({
      ...authForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);

    try {
      const isSignup = authMode === 'signup';
      const url = isSignup ? `${API_URL}/api/customers/register` : `${API_URL}/api/login`;

      const body = {
        email: authForm.email,
        password: authForm.password,
      };

      if (isSignup) {
        body.name = authForm.name;
        body.phone = authForm.phone;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setCurrentUser({
        id: data.id,
        name: data.name,
        email: data.email,
        isAdmin: !!data.isAdmin,
      });
      closeAuth();
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname === '/admin';

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading services...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error: {error}</p>
        <button onClick={fetchServices}>Retry</button>
      </div>
    );
  }

  return (
    <div className="App">
      <Header
        onBookNow={handleBookNowClick}
        onServicesClick={handleServicesClick}
        onAuthClick={() => openAuth('login')}
        onLogout={handleLogout}
        currentUser={currentUser}
      />
      <main className="main-content">
        {isAdminRoute ? (
          <AdminDashboard apiUrl={API_URL} currentUser={currentUser} onRequireAuth={() => openAuth('login')} />
        ) : (
          <>
            <section className="hero-section">
              <div className="hero-content">
                <h1 className="hero-title">
                  Welcome to <span className="highlight">Serenity Salon</span>
                </h1>
                <p className="hero-subtitle">
                  Your perfect look awaits. Book an appointment with our expert stylists.
                </p>
              </div>
            </section>

            {selectedService ? (
              <BookingForm
                service={selectedService}
                onBack={() => setSelectedService(null)}
                onComplete={handleBookingComplete}
                apiUrl={API_URL}
              />
            ) : (
              <section className="services-section" id="services">
                <h2 className="section-title">Our Services</h2>
                <div className="services-grid">
                  {services.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      onSelect={handleServiceSelect}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <p>&copy; 2024 Serenity Salon. All rights reserved.</p>
      </footer>

      {showAuth && (
        <div className="auth-modal-backdrop" onClick={closeAuth}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-toggle">
              <button
                type="button"
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => setAuthMode('signup')}
              >
                Sign up
              </button>
            </div>

            <h2>{authMode === 'login' ? 'Login' : 'Create account'}</h2>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <>
                  <label>
                    Name
                    <input
                      type="text"
                      name="name"
                      value={authForm.name}
                      onChange={handleAuthChange}
                      required
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      type="tel"
                      name="phone"
                      value={authForm.phone}
                      onChange={handleAuthChange}
                      required
                    />
                  </label>
                </>
              )}

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleAuthChange}
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={handleAuthChange}
                  required
                />
              </label>

              {authError && <p style={{ color: 'red', marginTop: '0.5rem' }}>{authError}</p>}

              <div className="auth-actions">
                <button type="button" className="auth-secondary" onClick={closeAuth}>
                  Cancel
                </button>
                <button type="submit" className="auth-primary">
                  {authMode === 'login' ? 'Login' : 'Sign up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
