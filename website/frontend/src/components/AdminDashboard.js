import React, { useEffect, useState } from 'react';
import './AdminDashboard.css';

function statusLabelDa(status) {
  if (status === 'confirmed') return 'Bekræftet';
  if (status === 'cancelled') return 'Annulleret';
  return status;
}

const AdminDashboard = ({ apiUrl, currentUser, onRequireAuth }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [backupLog, setBackupLog] = useState('');
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupMessage, setBackupMessage] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  // Redirect to home if logged in but not admin (auth guard)
  useEffect(() => {
    if (currentUser && !currentUser.isAdmin) {
      window.location.href = '/';
      return;
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !currentUser.isAdmin) {
      setLoading(false);
      return;
    }

    const fetchAppointments = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiUrl}/api/admin/appointments`, {
          credentials: 'include',
        });

        if (response.status === 401 || response.status === 403) {
          setError('Du har ikke adgang til denne side.');
          setAppointments([]);
          return;
        }

        if (!response.ok) {
          throw new Error('Kunne ikke hente bookinger');
        }

        const data = await response.json();
        setAppointments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [apiUrl, currentUser]);

  // System status: ping backup VM
  useEffect(() => {
    if (!currentUser || !currentUser.isAdmin) return;

    const check = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/admin/system-status`, { credentials: 'include' });
        const data = await res.json();
        setSystemStatus(data);
      } catch {
        setSystemStatus({ backupVm: '10.0.0.1', reachable: false, message: 'Fejl ved tjek' });
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [apiUrl, currentUser]);

  // Backup logs
  const fetchBackupLogs = async () => {
    if (!currentUser || !currentUser.isAdmin) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/backup/logs`, { credentials: 'include' });
      const data = await res.json();
      setBackupLog(data.log != null ? data.log : data.message || '');
    } catch {
      setBackupLog('Kunne ikke hente log.');
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.isAdmin) fetchBackupLogs();
  }, [currentUser]);

  const setAppointmentStatus = async (appointmentId, status) => {
    if (!currentUser || !currentUser.isAdmin) return;
    setCancellingId(appointmentId);
    try {
      const res = await fetch(`${apiUrl}/api/admin/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Kunne ikke opdatere');
      }
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const runManualBackup = async () => {
    if (!currentUser || !currentUser.isAdmin) return;
    setBackupRunning(true);
    setBackupMessage(null);
    try {
      const res = await fetch(`${apiUrl}/api/admin/backup/run`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setBackupMessage({ type: 'success', text: data.message || 'Backup startet' });
        setTimeout(fetchBackupLogs, 2000);
      } else {
        setBackupMessage({ type: 'error', text: data.error || 'Backup fejlede' });
      }
    } catch (err) {
      setBackupMessage({ type: 'error', text: err.message || 'Backup fejlede' });
    } finally {
      setBackupRunning(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="admin-dashboard">
        <h2>Admin-login påkrævet</h2>
        <p>Log ind med din admin-konto for at se oversigten.</p>
        <button className="admin-button" type="button" onClick={onRequireAuth}>
          Log ind som admin
        </button>
      </div>
    );
  }

  if (!currentUser.isAdmin) {
    return null;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <div>
          <h2>Admin-oversigt</h2>
          <p className="admin-subtitle">Bookinger, systemstatus og backup.</p>
        </div>
        <a href="/" className="admin-back-home">
          Tilbage til forside
        </a>
      </div>

      {/* System Status widget */}
      <div className="admin-widget">
        <h3>Systemstatus</h3>
        {systemStatus ? (
          <>
            <div
              className={`backup-link-visual ${systemStatus.reachable ? 'backup-link-visual--ok' : 'backup-link-visual--error'}`}
              aria-hidden
            >
              <div className="backup-link-endpoint" title="Website / backend">
                <span className="backup-link-endpoint-icon backup-link-endpoint-icon--web" />
                <span className="backup-link-endpoint-label">Website</span>
              </div>
              <div className="backup-link-pipeline">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="backup-link-dot" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <div className="backup-link-endpoint" title="Backup-VM">
                <span className="backup-link-endpoint-icon backup-link-endpoint-icon--vm" />
                <span className="backup-link-endpoint-label">Backup-VM</span>
              </div>
            </div>
            <div className={`system-status system-status-row ${systemStatus.reachable ? 'ok' : 'error'}`}>
              <span className="status-dot" />
              <span>
                {systemStatus.backupVm}: {systemStatus.reachable ? 'Forbindelse OK' : systemStatus.message}
              </span>
            </div>
          </>
        ) : (
          <p>Henter status...</p>
        )}
      </div>

      {/* Backup Management */}
      <div className="admin-widget">
        <h3>Backup-håndtering</h3>
        <p className="admin-hint">Manuel backup kører scriptet på serveren. Kun administratorer kan udløse backup.</p>
        <button
          type="button"
          className="admin-button admin-button-danger"
          onClick={runManualBackup}
          disabled={backupRunning}
        >
          {backupRunning ? 'Kører backup...' : 'Kør manuel backup'}
        </button>
        {backupMessage && (
          <p className={backupMessage.type === 'success' ? 'admin-success' : 'admin-error'}>{backupMessage.text}</p>
        )}
        <div className="backup-log-section">
          <button type="button" className="admin-button admin-button-secondary" onClick={fetchBackupLogs}>
            Opdater log
          </button>
          <pre className="backup-log">{backupLog || 'Ingen logindhold.'}</pre>
        </div>
      </div>

      {/* Appointments */}
      <div className="admin-widget">
        <h3>Bookinger</h3>
        {loading && <p>Henter bookinger...</p>}
        {error && <p className="admin-error">{error}</p>}

        {!loading && !error && appointments.length === 0 && (
          <p>Der er endnu ingen bookinger.</p>
        )}

        {!loading && !error && appointments.length > 0 && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Tid</th>
                  <th>Ydelse</th>
                  <th>Kunde</th>
                  <th>Kontakt</th>
                  <th>Status</th>
                  <th>Handling</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id}>
                    <td>{new Date(appt.appointment_date).toLocaleDateString('da-DK')}</td>
                    <td>{appt.time_slot}</td>
                    <td>{appt.service_name}</td>
                    <td>{appt.name}</td>
                    <td>
                      <div>{appt.email}</div>
                      <div>{appt.phone}</div>
                    </td>
                    <td>{statusLabelDa(appt.status)}</td>
                    <td>
                      {appt.status === 'confirmed' ? (
                        <button
                          type="button"
                          className="admin-button admin-button-cancel"
                          onClick={() => setAppointmentStatus(appt.id, 'cancelled')}
                          disabled={cancellingId === appt.id}
                        >
                          {cancellingId === appt.id ? '…' : 'Annuller'}
                        </button>
                      ) : (
                        <span className="status-badge">{statusLabelDa(appt.status)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
