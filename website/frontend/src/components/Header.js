import React from 'react';
import './Header.css';

const Header = ({ onOmOsClick, onServicesClick, onAuthClick, onLogout, currentUser }) => {
  const handleServicesClick = (e) => {
    e.preventDefault();
    if (onServicesClick) {
      onServicesClick();
    } else {
      const servicesSection = document.querySelector('.services-section');
      if (servicesSection) servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOmOsClick = (e) => {
    e.preventDefault();
    if (onOmOsClick) {
      onOmOsClick();
    } else {
      const section = document.querySelector('.om-os-section');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">✂️</span>
          <span className="logo-text">Nordisk Hår</span>
        </div>
        <nav className="nav">
          <a href="#services" className="nav-link" onClick={handleServicesClick}>Ydelser</a>
          <a href="#om-os" className="nav-link" onClick={handleOmOsClick}>Om os</a>
          {currentUser && currentUser.isAdmin && (
            <a href="/admin" className="nav-link">Admin</a>
          )}
          {currentUser ? (
            <>
              <span className="nav-user">Hej, {currentUser.name}</span>
              <button className="nav-button" type="button" onClick={onLogout}>
                Log ud
              </button>
            </>
          ) : (
            <button className="nav-button" type="button" onClick={onAuthClick}>
              Log ind / Opret konto
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
