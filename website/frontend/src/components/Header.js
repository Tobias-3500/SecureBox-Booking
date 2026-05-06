import React from 'react';
import './Header.css';

const Header = ({ onOmOsClick, onServicesClick, onAuthClick, onLogout, currentUser }) => {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  const handleLogoClick = () => {
    if (currentPath !== '/') {
      window.location.href = '/';
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleServicesClick = (e) => {
    e.preventDefault();
    if (currentPath !== '/') {
      window.location.href = '/#services';
      return;
    }

    if (onServicesClick) {
      onServicesClick();
    } else {
      const servicesSection = document.querySelector('.services-section');
      if (servicesSection) servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOmOsClick = (e) => {
    e.preventDefault();
    if (currentPath === '/admin') {
      window.location.href = '/#about';
      return;
    }

    if (currentPath !== '/') {
      window.location.href = '/om-os';
      return;
    }

    if (onOmOsClick) {
      onOmOsClick();
    } else {
      const section = document.querySelector('#about');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLogoClick(); } }}>
          <span className="logo-icon">✂️</span>
          <span className="logo-text">Nordisk Hår</span>
        </div>
        <nav className="nav">
          <a href={currentPath === '/' ? '#services' : '/#services'} className="nav-link" onClick={handleServicesClick}>Ydelser</a>
          <a href={currentPath === '/admin' ? '/#about' : '/om-os'} className="nav-link" onClick={handleOmOsClick}>Om os</a>
          <a href="/admin" className="nav-link">Admin</a>
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
