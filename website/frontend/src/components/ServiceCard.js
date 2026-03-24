import React from 'react';
import './ServiceCard.css';

function formatDkk(value) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(Number(value));
}

const ServiceCard = ({ service, onSelect }) => {
  return (
    <div className="service-card" onClick={() => onSelect(service)}>
      <div className="service-card-inner">
        <div className="service-icon">✨</div>
        <h3 className="service-name">{service.name}</h3>
        <p className="service-description">{service.description || 'Professionel ydelse'}</p>
        <div className="service-details">
          <span className="service-duration">⏱️ {service.duration} min.</span>
          <span className="service-price">
            {formatDkk(service.price)}
          </span>
        </div>
        <button className="service-button" type="button">Book nu</button>
      </div>
    </div>
  );
};

export default ServiceCard;
