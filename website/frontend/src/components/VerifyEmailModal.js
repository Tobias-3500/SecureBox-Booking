import React, { useState } from 'react';

const VerifyEmailModal = ({ apiUrl, email, onClose, onVerified }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
