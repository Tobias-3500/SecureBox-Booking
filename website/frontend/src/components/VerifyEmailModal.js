/*
 * VerifyEmailModal.js — Popup til bekræftelse af e-mail.
 *
 * HVAD FILEN GØR:
 * Viser et felt, hvor brugeren indtaster den kode, de har fået på mail. Koden sendes til
 * /api/auth/verify. Lykkes det, er brugeren bekræftet og logget ind, og onVerified kaldes
 * (App.js opdaterer så brugeren). Vises når en uverificeret konto forsøger at booke/logge ind.
 */

import React, { useState } from 'react';

const VerifyEmailModal = ({ apiUrl, email, onClose, onVerified }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sender den indtastede kode til backend for at bekræfte kontoen.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Bekræftelse mislykkedes');
      }
      onVerified(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal verify-email-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Bekræft din e-mail</h2>
        <p className="verify-email-intro">
          Vi har sendt en kode til <strong>{email}</strong>. Indtast koden herunder for at aktivere din konto.
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Bekræftelseskode
            <input
              type="text"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              placeholder="Kode fra mail"
              required
            />
          </label>
          {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}
          <div className="auth-actions">
            <button type="button" className="auth-secondary" onClick={onClose}>
              Luk
            </button>
            <button type="submit" className="auth-primary" disabled={loading}>
              {loading ? 'Bekræfter…' : 'Bekræft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VerifyEmailModal;
