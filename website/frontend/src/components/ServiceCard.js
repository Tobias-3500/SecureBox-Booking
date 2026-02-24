import React from 'react';
import './ServiceCard.css';

const ServiceCard = ({ service, onSelect }) => {
  return (
    <div className="service-card" onClick={() => onSelect(service)}>
      <div className="service-card-inner">
        <div className="service-icon">✨</div>
        <h3 className="service-name">{service.name}</h3>
        <p className="service-description">{service.description || 'Professional service'}</p>
        <div className="service-details">
          <span className="service-duration">⏱️ {service.duration} min</span>
          <span className="service-price">
            {parseFloat(service.price).toFixed(2)} DKK
          </span>
        </div>
        <button className="service-button">Book Now</button>
      </div>
    </div>
  );
};

export default ServiceCard;
