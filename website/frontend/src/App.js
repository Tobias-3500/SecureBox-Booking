/*
 * App.js — Rodkomponenten for hele frontend.
 *
 * HVAD FILEN GØR:
 * Styrer hele brugerfladen og dens tilstand (state): hvilke ydelser der vises, om en
 * bruger er logget ind, login/opret-vinduet, e-mailbekræftelse og hvilken "side" der vises
 * (forside, om-os eller /admin).
 *
 * DATAFLOW: Alle data hentes fra backend-API'et med fetch/axios mod stier under /api.
 * App henter ydelser, gendanner login via /api/me og sender login/registrering afsted.
 * Selve bookingen og admin-oversigten er lagt ud i underkomponenter (BookingForm, AdminDashboard).
 */

import React, { useState, useEffect } from 'react';
import './App.css';
import ServiceCard from './components/ServiceCard';        // Kort for én ydelse
import BookingForm from './components/BookingForm';         // Selve bookingformularen
import Header from './components/Header';                   // Topmenu/navigation
import AdminDashboard from './components/AdminDashboard';   // Admin-oversigt (kun admin)
import VerifyEmailModal from './components/VerifyEmailModal'; // Popup til e-mailbekræftelse

// Base-URL til API'et. Tom streng betyder "samme domæne" (nginx sender /api videre til backend).
const API_URL = process.env.REACT_APP_API_URL || '';

// Oversætter et svar fra /api/me eller login til det brugerobjekt, appen bruger internt.
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

// "Om os"-siden (vises på ruten /om-os). Ren visning uden data fra backend.
function AboutPage() {
  const openingHours = [
    { day: 'Mandag - Fredag', hours: '09:00 - 18:00' },
    { day: 'Lørdag', hours: '10:00 - 14:00' },
    { day: 'Søndag', hours: 'Lukket' },
  ];

  return (
    <section className="about-page">
      <div className="about-page-hero">
        <p className="eyebrow">Om Nordisk Hår</p>
        <h1>Rolig salonstemning, personlig rådgivning og godt håndværk.</h1>
        <p>
          Nordisk Hår er din lokale frisør med fokus på kvalitet og afslapning.
          Vi tilbyder klipning, farvning og styling for alle, og vi tager os tid
          til at finde det look, der passer til dig.
        </p>
      </div>

      <div className="about-page-grid">
        <div className="about-card">
          <h2>Velkommen indenfor</h2>
          <p>
            Kom forbi salonen eller book en tid online. Vi lægger vægt på en
            behagelig oplevelse fra første hej til sidste styling.
          </p>
        </div>

        <div className="opening-hours-card">
          <h2>Åbningstider</h2>
          <div className="opening-hours-list">
            {openingHours.map((item) => (
              <div className="opening-hours-row" key={item.day}>
                <span>{item.day}</span>
                <strong>{item.hours}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function App() {
  // --- Tilstand (state): React gentegner UI'et automatisk, når disse ændres ---
  const [services, setServices] = useState([]);              // Liste af ydelser fra API'et
  const [selectedService, setSelectedService] = useState(null); // Den ydelse der bookes lige nu
  const [loading, setLoading] = useState(true);              // Viser spinner mens ydelser hentes
  const [error, setError] = useState(null);                  // Fejl ved hentning af ydelser
  const [showAuth, setShowAuth] = useState(false);           // Er login/opret-vinduet åbent?
  const [authMode, setAuthMode] = useState('login');         // 'login' eller 'signup'
  const [authForm, setAuthForm] = useState({                 // Felterne i login/opret-formularen
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [currentUser, setCurrentUser] = useState(null);      // Den indloggede bruger (null = gæst)
  const [authError, setAuthError] = useState(null);          // Fejlbesked i login/opret
  const [authChecked, setAuthChecked] = useState(false);     // Er sessionstjek (/api/me) færdigt?
  const [showVerifyEmail, setShowVerifyEmail] = useState(false); // Er e-mail-bekræftelses-popup åben?
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(''); // E-mail der afventer bekræftelse

  // Hent ydelser én gang, når appen indlæses.
  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (loading || typeof window === 'undefined') return;

    const targetId = window.location.hash === '#services' ? 'services' : null;

    if (!targetId) return;

    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [loading, selectedService]);

  // Gendan login ved sideindlæsning: spørg /api/me. Hvis JWT-cookien er gyldig, får vi
  // brugeren tilbage og er stadig logget ind (selv efter genindlæsning eller lukket browser).
  useEffect(() => {
    fetch(`${API_URL}/api/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCurrentUser(mapMeResponse(data));
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  // Henter listen af ydelser fra backend og gemmer den i state.
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

  // Når en kunde vælger en ydelse: kræv login, kræv bekræftet e-mail, og åbn så bookingformularen.
  const handleServiceSelect = (service) => {
    if (!currentUser) {
      openAuth('login');                 // Ikke logget ind -> åbn login
      return;
    }
    if (!currentUser.isVerified) {
      setPendingVerificationEmail(currentUser.email);
      setShowVerifyEmail(true);          // Logget ind, men ikke bekræftet -> bed om kode
      return;
    }
    setSelectedService(service);         // Klar til at booke -> vis formularen
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookingComplete = () => {
    setSelectedService(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleServicesClick = () => {
    // Scroll to services section
    const servicesSection = document.querySelector('.services-section');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Log ud: nulstil brugeren lokalt og bed backend om at slette auth-cookien.
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

  // Sender login- eller opret-formularen til backend afhængig af authMode.
  // Håndterer de tre udfald: skal bekræfte e-mail, fejl, eller logget ind.
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

  // Simpel routing ud fra URL'ens sti: /admin viser admin-siden, /om-os viser om-os, resten er forsiden.
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isAdminRoute = currentPath === '/admin';
  const isAboutRoute = currentPath === '/om-os';

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
        ) : isAboutRoute ? (
          <AboutPage />
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
        <div className="auth-modal-backdrop">
          <div className="auth-modal" role="dialog" aria-modal="true">
            <button
              type="button"
              className="auth-close-button"
              onClick={closeAuth}
              aria-label="Luk login-vindue"
            >
              ×
            </button>
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
