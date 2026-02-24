import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BookingForm.css';

const BookingForm = ({ service, onBack, onComplete, apiUrl }) => {
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
    if (formData.appointment_date) {
      fetchAvailability(formData.appointment_date);
    }
  }, [formData.appointment_date]);

  const fetchAvailability = async (date) => {
    try {
      const response = await axios.get(`${apiUrl}/api/availability/${date}`);
      setBookedSlots(response.data.bookedSlots || []);
    } catch (err) {
      console.error('Error fetching availability:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!consentGiven) {
      setError('You must agree to the Terms & Conditions and Privacy Policy before booking.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${apiUrl}/api/appointments`, {
        ...formData,
        service_id: service.id
      });

      if (response.status === 201) {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableSlots = () => {
    return timeSlots.filter(slot => !bookedSlots.includes(slot));
  };

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  if (success) {
    return (
      <div className="booking-success">
        <div className="success-icon">✓</div>
        <h2>Appointment Booked Successfully!</h2>
        <p>We've sent a confirmation to your email.</p>
        <p className="success-details">
          {service.name} on {new Date(formData.appointment_date).toLocaleDateString()} at {formData.time_slot}
        </p>
      </div>
    );
  }

  return (
    <div className="booking-form-container">
      <button className="back-button" onClick={onBack}>
        ← Back to Services
      </button>
      
      <div className="booking-card">
        <div className="booking-header">
          <h2>Book Your Appointment</h2>
          <div className="selected-service-info">
            <h3>{service.name}</h3>
            <p>{service.description}</p>
            <div className="service-summary">
              <span>Duration: {service.duration} min</span>
              <span>
                Price: {parseFloat(service.price).toFixed(2)} DKK
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="booking-form">
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your.email@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="form-group">
            <label htmlFor="appointment_date">Select Date *</label>
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
              <label htmlFor="time_slot">Select Time *</label>
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
                  <p className="no-slots">No available slots for this date. Please select another date.</p>
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
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  Terms &amp; Conditions
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
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
            {loading ? 'Booking...' : 'Confirm Booking'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;
