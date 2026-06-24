/*
 * ServiceCard.js — Et kort der viser én ydelse på forsiden.
 *
 * HVAD FILEN GØR:
 * Viser navn, beskrivelse, varighed og pris for en ydelse samt en "Book nu"-knap.
 * Klik kalder onSelect (sendt fra App.js), som starter bookingflowet for netop denne ydelse.
 */

import React from 'react';
import './ServiceCard.css';

// Formaterer prisen som dansk valuta.
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
