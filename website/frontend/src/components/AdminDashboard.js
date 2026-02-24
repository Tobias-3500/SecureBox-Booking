import React, { useEffect, useState } from 'react';
import './AdminDashboard.css';

const AdminDashboard = ({ apiUrl, currentUser, onRequireAuth }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          setError('You do not have permission to view this page.');
          setAppointments([]);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load appointments');
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

  if (!currentUser) {
    return (
      <div className="admin-dashboard">
        <h2>Admin Login Required</h2>
        <p>Please log in with your admin account to view the schedule.</p>
        <button className="admin-button" type="button" onClick={onRequireAuth}>
          Login as Admin
        </button>
      </div>
    );
  }

  if (!currentUser.isAdmin) {
    return (
      <div className="admin-dashboard">
        <h2>Access Denied</h2>
        <p>This page is restricted to salon administrators.</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <h2>Salon Schedule</h2>
      <p className="admin-subtitle">View all upcoming appointments.</p>

      {loading && <p>Loading appointments...</p>}
      {error && <p className="admin-error">{error}</p>}

      {!loading && !error && appointments.length === 0 && (
        <p>No appointments have been booked yet.</p>
      )}

      {!loading && !error && appointments.length > 0 && (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Service</th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr key={appt.id}>
                  <td>{new Date(appt.appointment_date).toLocaleDateString()}</td>
                  <td>{appt.time_slot}</td>
                  <td>{appt.service_name}</td>
                  <td>{appt.name}</td>
                  <td>
                    <div>{appt.email}</div>
                    <div>{appt.phone}</div>
                  </td>
                  <td>{appt.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

