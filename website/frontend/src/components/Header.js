import React from 'react';
import './Header.css';

const Header = ({ onBookNow, onServicesClick, onAuthClick, onLogout, currentUser }) => {
  const handleBookNow = (e) => {
    e.preventDefault();
    if (onBookNow) {
      onBookNow();
    } else {
      // Fallback: scroll to services section
      const servicesSection = document.querySelector('.services-section');
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleServicesClick = (e) => {
    e.preventDefault();
    if (onServicesClick) {
      onServicesClick();
    } else {
      // Fallback: scroll to services section
      const servicesSection = document.querySelector('.services-section');
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">✂️</span>
          <span className="logo-text">Serenity Salon</span>
        </div>
        <nav className="nav">
          <a href="#services" className="nav-link" onClick={handleServicesClick}>Services</a>
          <a href="#book" className="nav-link" onClick={handleBookNow}>Book Now</a>
          {currentUser ? (
            <>
              <span className="nav-user">Hi, {currentUser.name}</span>
              <button className="nav-button" type="button" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <button className="nav-button" type="button" onClick={onAuthClick}>
              Login / Sign up
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
