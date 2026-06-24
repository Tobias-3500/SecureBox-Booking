/*
 * BookingForm.js — Bookingformularen.
 *
 * HVAD FILEN GØR:
 * Lader en logget-ind og verificeret kunde vælge dato og tidspunkt og bekræfte en booking.
 * Henter optagede tider fra /api/availability og sender den færdige booking til
 * /api/appointments. Viser også fejl, fx hvis tiden lige er blevet taget (409).
 *
 * Kaldes fra App.js, når en kunde har valgt en ydelse.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';   // HTTP-klient til at kalde backend
import './BookingForm.css';

// Formaterer et tal som dansk valuta, fx 250 -> "250,00 kr.".
function formatDkk(value) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(Number(value));
}

const BookingForm = ({ service, onBack, onComplete, apiUrl, currentUser, onRequireVerify }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    appointment_date: '',
    time_slot: ''
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ];

  useEffect(() => {
    if (currentUser) {
      setFormData((prev) => ({
        ...prev,
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
      }));
    }
  }, [currentUser]);

  // Hver gang kunden vælger en ny dato, hentes de allerede optagede tider for den dag.
  useEffect(() => {
    if (formData.appointment_date) {
      fetchAvailability(formData.appointment_date);
    }
  }, [formData.appointment_date]);

  // Henter listen af optagede tidsslots for en dato fra backend.
  const fetchAvailability = async (date) => {
    try {
      const response = await axios.get(`${apiUrl}/api/availability/${date}`);
      setBookedSlots(response.data.bookedSlots || []);
    } catch (err) {
      console.error('Kunne ikke hente ledige tider:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  // Sender bookingen til backend. Kræver samtykke afkrydset. Håndterer de typiske fejl:
  // manglende verifikation (NOT_VERIFIED) og at tiden lige er blevet booket af en anden (409).
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!consentGiven) {
      setError('Du skal acceptere vilkår og betingelser samt privatlivspolitik for at booke.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // withCredentials: true sender JWT-cookien med, så backend ved hvem der booker.
      const response = await axios.post(
        `${apiUrl}/api/appointments`,
        {
          service_id: service.id,
          appointment_date: formData.appointment_date,
          time_slot: formData.time_slot,
        },
        { withCredentials: true }
      );

      if (response.status === 201) {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 3000);
      }
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'NOT_VERIFIED' && onRequireVerify) {
        onRequireVerify();
        setError('Bekræft din e-mail før du kan booke.');
        return;
      }
      if (err.response?.status === 409) {
        await fetchAvailability(formData.appointment_date);
        setFormData(prev => ({ ...prev, time_slot: '' }));
        setError('Den valgte tid er desværre ikke længere ledig. Vælg venligst en anden tid.');
        return;
      }
      setError(err.response?.data?.error || 'Kunne ikke booke. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  // Beregner hvilke tider der kan vælges: fjerner optagede slots, og hvis datoen er i dag,
  // fjernes også tidspunkter der allerede er passeret.
  const getAvailableSlots = () => {
    const isToday = formData.appointment_date === today;
    return timeSlots.filter(slot => {
      if (bookedSlots.includes(slot)) return false;
      if (isToday) {
        const now = new Date();
        const [hours, minutes] = slot.split(':').map(Number);
        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);
        if (slotTime <= now) return false;
      }
      return true;
    });
  };

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  if (!currentUser) {
    return (
      <div className="booking-form-container">
        <button className="back-button" onClick={onBack}>
          ← Tilbage til ydelser
        </button>
        <div className="booking-card">
          <h2>Log ind for at booke</h2>
          <p>Du skal være logget ind med en bekræftet konto for at vælge tid.</p>
        </div>
      </div>
    );
  }

  if (!currentUser.isVerified) {
    return (
      <div className="booking-form-container">
        <button className="back-button" onClick={onBack}>
          ← Tilbage til ydelser
        </button>
        <div className="booking-card">
          <h2>Bekræft din e-mail</h2>
          <p>Indtast koden fra din bekræftelsesmail for at kunne færdiggøre en booking.</p>
          {onRequireVerify && (
            <button type="button" className="submit-button" onClick={onRequireVerify}>
              Åbn bekræftelse
            </button>
          )}
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="booking-success">
        <div className="success-icon">✓</div>
        <h2>Tiden er booket!</h2>
        <p>Vi har sendt en bekræftelse til din e-mail.</p>
        <p className="success-details">
          {service.name} den {new Date(formData.appointment_date).toLocaleDateString('da-DK')} kl. {formData.time_slot}
        </p>
      </div>
    );
  }

  return (
    <div className="booking-form-container">
      <button className="back-button" onClick={onBack}>
        ← Tilbage til ydelser
      </button>
      
      <div className="booking-card">
        <div className="booking-header">
          <h2>Book din tid</h2>
          <div className="selected-service-info">
            <h3>{service.name}</h3>
            <p>{service.description}</p>
            <div className="service-summary">
              <span>Varighed: {service.duration} min</span>
              <span>
                Pris: {formatDkk(service.price)}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="booking-form">
          <div className="form-group">
            <label htmlFor="name">Fulde navn</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              readOnly
              className="input-readonly"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              readOnly
              className="input-readonly"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telefonnummer</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              readOnly
              className="input-readonly"
            />
          </div>

          <div className="form-group">
            <label htmlFor="appointment_date">Vælg dato *</label>
            <input
              type="date"
              id="appointment_date"
              name="appointment_date"
              value={formData.appointment_date}
              onChange={handleChange}
              min={today}
              max={maxDateStr}
              required
            />
          </div>

          {formData.appointment_date && (
            <div className="form-group">
              <label htmlFor="time_slot">Vælg tid *</label>
              <div className="time-slots">
                {getAvailableSlots().map(slot => (
                  <button
                    key={slot}
                    type="button"
                    className={`time-slot ${formData.time_slot === slot ? 'selected' : ''}`}
                    onClick={() => {
                      setFormData({ ...formData, time_slot: slot });
                      setError(null);
                    }}
                  >
                    {slot}
                  </button>
                ))}
                {getAvailableSlots().length === 0 && (
                  <p className="no-slots">Ingen ledige tider denne dag. Vælg en anden dato.</p>
                )}
              </div>
            </div>
          )}

          <div className="form-group consent-group">
            <label className="consent-label">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => {
                  setConsentGiven(e.target.checked);
                  if (e.target.checked && error) {
                    setError(null);
                  }
                }}
                required
              />
              <span>
                Jeg accepterer{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  vilkår og betingelser
                </a>{' '}
                og{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  privatlivspolitik
                </a>
                .
              </span>
            </label>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="submit-button"
            disabled={loading || !formData.time_slot}
          >
            {loading ? 'Booker …' : 'Bekræft booking'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;
