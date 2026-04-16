import React, { useState, useEffect } from 'react';
import './App.css';
import ServiceCard from './components/ServiceCard';
import BookingForm from './components/BookingForm';
import Header from './components/Header';
import AdminDashboard from './components/AdminDashboard';
import VerifyEmailModal from './components/VerifyEmailModal';

const API_URL = process.env.REACT_APP_API_URL || '';

function mapMeResponse(data) {
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    isAdmin: !!data.isAdmin,
    isVerified: !!data.isVerified,
  };
}

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
  const [authChecked, setAuthChecked] = useState(false);
  const [showVerifyEmail, setShowVerifyEmail] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');

  useEffect(() => {
    fetchServices();
  }, []);

  // Restore session from JWT cookie (for route guard and /admin)
  useEffect(() => {
    fetch(`${API_URL}/api/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCurrentUser(mapMeResponse(data));
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, [API_URL]);

  const fetchServices = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/api/services`);
      if (!response.ok) throw new Error('Kunne ikke hente ydelser');
      const data = await response.json();
      setServices(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleServiceSelect = (service) => {
    if (!currentUser) {
      openAuth('login');
      return;
    }
    if (!currentUser.isVerified) {
      setPendingVerificationEmail(currentUser.email);
      setShowVerifyEmail(true);
      return;
    }
    setSelectedService(service);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookingComplete = () => {
    setSelectedService(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOmOsClick = () => {
    const section = document.querySelector('.om-os-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
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
    fetch(`${API_URL}/api/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
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
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setPendingVerificationEmail(data.email || authForm.email);
          setShowVerifyEmail(true);
          closeAuth();
          return;
        }
        throw new Error(data.error || 'Login mislykkedes');
      }

      if (isSignup && data.needsVerification) {
        setPendingVerificationEmail(data.email || authForm.email);
        setShowVerifyEmail(true);
        closeAuth();
        return;
      }

      setCurrentUser(mapMeResponse(data));
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
        <p>Henter ydelser...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Fejl: {error}</p>
        <button onClick={fetchServices}>Prøv igen</button>
      </div>
    );
  }

  return (
    <div className="App">
      <Header
        onOmOsClick={handleOmOsClick}
        onServicesClick={handleServicesClick}
        onAuthClick={() => openAuth('login')}
        onLogout={handleLogout}
        currentUser={currentUser}
      />
      <main className="main-content">
        {isAdminRoute ? (
          !authChecked ? (
            <div className="loading-container">
              <div className="spinner" />
              <p>Henter session...</p>
            </div>
          ) : currentUser && currentUser.isAdmin ? (
            <AdminDashboard apiUrl={API_URL} currentUser={currentUser} onRequireAuth={() => openAuth('login')} />
          ) : currentUser ? (
            <div className="admin-gate">
              <h2 className="section-title">Ingen adgang</h2>
              <p>
                Denne side er kun for salonens administrator. Du er logget ind som en almindelig konto.
              </p>
              <a href="/" className="nav-link admin-gate-home">
                Tilbage til forsiden
              </a>
            </div>
          ) : (
            <div className="admin-gate">
              <h2 className="section-title">Administration</h2>
              <p>
                Log ind med administrator-kontoen (den e-mail der er sat som admin på serveren) for at se bookinger og systemstatus.
              </p>
              <button type="button" className="nav-button" onClick={() => openAuth('login')}>
                Log ind
              </button>
            </div>
          )
        ) : (
          <>
            <section className="hero-section">
              <div className="hero-content">
                <h1 className="hero-title">
                  Velkommen til <span className="highlight">Nordisk Hår</span>
                </h1>
                <p className="hero-subtitle">
                  Dit perfekte look venter. Book en tid hos vores eksperter.
                </p>
              </div>
            </section>

            {selectedService ? (
              <BookingForm
                service={selectedService}
                onBack={() => setSelectedService(null)}
                onComplete={handleBookingComplete}
                apiUrl={API_URL}
                currentUser={currentUser}
                onRequireVerify={() => {
                  if (currentUser?.email) {
                    setPendingVerificationEmail(currentUser.email);
                    setShowVerifyEmail(true);
                  }
                }}
              />
            ) : (
              <section className="services-section" id="services">
                <h2 className="section-title">Vores ydelser</h2>
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

            <section className="om-os-section" id="om-os">
              <h2 className="section-title">Om os</h2>
              <div className="om-os-content">
                <p>
                  Nordisk Hår er din lokale frisør med fokus på kvalitet og afslapning. Vi tilbyder klipning, farvning og styling for alle. Kom forbi eller book en tid online.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
      <footer className="footer">
        <p>&copy; 2024 Nordisk Hår. Alle rettigheder forbeholdes.</p>
      </footer>

      {showVerifyEmail && pendingVerificationEmail && (
        <VerifyEmailModal
          apiUrl={API_URL}
          email={pendingVerificationEmail}
          onClose={() => {
            setShowVerifyEmail(false);
          }}
          onVerified={(data) => {
            setCurrentUser(mapMeResponse(data));
            setShowVerifyEmail(false);
            setPendingVerificationEmail('');
          }}
        />
      )}

      {showAuth && (
        <div className="auth-modal-backdrop" onClick={closeAuth}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-toggle">
              <button
                type="button"
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
              >
                Log ind
              </button>
              <button
                type="button"
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => setAuthMode('signup')}
              >
                Opret konto
              </button>
            </div>

            <h2>{authMode === 'login' ? 'Log ind' : 'Opret konto'}</h2>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <>
                  <label>
                    Navn
                    <input
                      type="text"
                      name="name"
                      value={authForm.name}
                      onChange={handleAuthChange}
                      required
                    />
                  </label>
                  <label>
                    Telefon
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
                E-mail
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleAuthChange}
                  required
                />
              </label>

              <label>
                Adgangskode
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
                  Annuller
                </button>
                <button type="submit" className="auth-primary">
                  {authMode === 'login' ? 'Log ind' : 'Opret konto'}
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
