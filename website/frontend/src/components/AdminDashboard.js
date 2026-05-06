import React, { useCallback, useEffect, useState } from 'react';
import './AdminDashboard.css';

function statusLabelDa(status) {
  if (status === 'confirmed') return 'Bekræftet';
  if (status === 'cancelled') return 'Annulleret';
  return status;
}

function googleSyncLabelDa(status) {
  if (status === 'synced') return 'Synket';
  if (status === 'pending') return 'Afventer';
  if (status === 'failed') return 'Fejlet';
  if (status === 'cancelled') return 'Annulleret';
  if (status === 'disabled') return 'Slået fra';
  return status || 'Ukendt';
}

function formatBackupStatus(summary) {
  if (!summary) {
    return {
      status: 'unknown',
      title: 'Backup-status er ikke tilgængelig endnu.',
      meta: 'De automatiske backup-logs er ikke fundet endnu.',
    };
  }

  if (summary.status === 'success') {
    const timestamp = summary.timestamp
      ? new Date(summary.timestamp).toLocaleString('da-DK')
      : 'tidspunkt ukendt';
    return {
      status: 'success',
      title: `✅ Database er sikkerhedskopieret (${timestamp})`,
      meta: 'Seneste automatiske backup blev gennemført.',
    };
  }

  return {
    status: 'failed',
    title: '⚠️ Fejl i sikkerhedskopiering - Kontakt support',
    meta: 'Seneste automatiske backup kunne ikke gennemføres.',
  };
}

function dockerContainersFromStatus(systemStatus) {
  return systemStatus?.containers || [
    { name: 'salon_backend', healthy: false, status: 'unknown' },
    { name: 'salon_db', healthy: false, status: 'unknown' },
    { name: 'salon_frontend', healthy: false, status: 'unknown' },
  ];
}

const AdminDashboard = ({ apiUrl, currentUser, onRequireAuth }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [backupSummary, setBackupSummary] = useState(null);
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

  // System status: backend returns service/container health for the admin overview.
  useEffect(() => {
    if (!currentUser || !currentUser.isAdmin) return;

    const check = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/admin/system-status`, { credentials: 'include' });
        const data = await res.json();
        setSystemStatus(data);
      } catch {
        setSystemStatus({ containers: dockerContainersFromStatus(null) });
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [apiUrl, currentUser]);

  // Backup status from automatic backup logs.
  const fetchBackupStatus = useCallback(async () => {
    if (!currentUser || !currentUser.isAdmin) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/backup/logs`, { credentials: 'include' });
      const data = await res.json();
      setBackupSummary(data.summary || null);
    } catch {
      setBackupSummary(null);
    }
  }, [apiUrl, currentUser]);

  useEffect(() => {
    if (currentUser && currentUser.isAdmin) fetchBackupStatus();
  }, [currentUser, fetchBackupStatus]);

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
      const updated = await res.json();
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? updated : a)));
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
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

  const backupStatus = formatBackupStatus(backupSummary);

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

            <h4 className="docker-status-heading">Docker-containere</h4>
            <div className="docker-status-list">
              {dockerContainersFromStatus(systemStatus).map((container) => (
                <div
                  key={container.name}
                  className={`docker-status-item ${container.healthy ? 'healthy' : 'unhealthy'}`}
                >
                  <span className="status-dot" />
                  <span className="docker-status-name">{container.name}</span>
                  <span className="docker-status-label">
                    {container.healthy ? 'Healthy' : 'Unhealthy'}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>Henter status...</p>
        )}
      </div>

      {/* Backup Management */}
      <div className="admin-widget">
        <h3>Backup-status</h3>
        <p className="admin-hint">Status vises ud fra de automatiske backups.</p>
        <div className={`backup-summary backup-summary--${backupStatus.status}`}>
          <span className="backup-summary-dot" />
          <div>
            <strong>{backupStatus.title}</strong>
            <div className="backup-summary-meta">{backupStatus.meta}</div>
          </div>
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
                  <th>Kalender</th>
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
                      <span className={`calendar-sync-badge calendar-sync-badge--${appt.google_sync_status || 'unknown'}`}>
                        {googleSyncLabelDa(appt.google_sync_status)}
                      </span>
                      {appt.google_sync_error && (
                        <div className="calendar-sync-error" title={appt.google_sync_error}>
                          {appt.google_sync_error}
                        </div>
                      )}
                    </td>
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
