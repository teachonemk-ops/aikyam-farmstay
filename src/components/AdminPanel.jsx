import React, { useState } from 'react';
import { dbService } from '../utils/dbService';

export default function AdminPanel({ 
  currentUser, 
  whitelist, 
  onAddToWhitelist, 
  onRemoveFromWhitelist, 
  onToggleAdmin
}) {
  const [newEmail, setNewEmail] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    try {
      await onAddToWhitelist(newEmail, newIsAdmin);
      setNewEmail('');
      setNewIsAdmin(false);
      setErrorMsg('');
      setSuccessMsg('Successfully added email to whitelist.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleRemove = async (email) => {
    if (window.confirm(`Are you sure you want to remove ${email} from the whitelist? This will prevent them from logging in.`)) {
      try {
        await onRemoveFromWhitelist(email);
        setErrorMsg('');
        setSuccessMsg('Successfully removed user.');
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        setErrorMsg(err.message);
      }
    }
  };

  const handleToggleAdmin = async (userId, checked) => {
    try {
      await onToggleAdmin(userId, checked);
      setSuccessMsg('Admin status updated.');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('Preparing report...');
      
      const bookingsData = await dbService.exportBookingsToCSV();
      
      if (!bookingsData || bookingsData.length === 0) {
        setErrorMsg('No bookings found to export.');
        setSuccessMsg('');
        return;
      }
      
      // Header row
      const headers = ['Booking ID', 'Guest Name', 'Guest Email', 'Check-in Date', 'Check-out Date', 'Nights', 'Created At'];
      
      // Data rows
      const rows = bookingsData.map(b => {
        const checkIn = new Date(b.check_in);
        const checkOut = new Date(b.check_out);
        const diffTime = Math.abs(checkOut - checkIn);
        const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const email = b.profiles?.email || 'N/A';
        const createdAtStr = new Date(b.created_at).toLocaleString();
        
        return [
          b.id,
          b.user_name,
          email,
          b.check_in,
          b.check_out,
          nights,
          createdAtStr
        ];
      });
      
      // Build CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => {
          const valStr = String(val).replace(/"/g, '""');
          return `"${valStr}"`;
        }).join(','))
      ].join('\n');
      
      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `aikyam_farmstay_bookings_${new Date().getFullYear()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccessMsg('Booking report downloaded successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message);
      setSuccessMsg('');
    }
  };

  return (
    <div className="admin-layout">
      {errorMsg && (
        <div style={{ padding: '12px', backgroundColor: '#fdebeb', color: 'var(--danger-color)', borderRadius: '8px', fontWeight: 500, fontSize: '0.9rem' }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '12px', backgroundColor: 'var(--primary-subtle)', color: 'var(--primary-color)', borderRadius: '8px', fontWeight: 500, fontSize: '0.9rem' }}>
          {successMsg}
        </div>
      )}

      <div className="section-card">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span>Whitelist Onboarding Dashboard</span>
          <button 
            onClick={handleDownloadExcel} 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px', fontSize: '0.85rem', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            📊 Export Bookings
          </button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Only friends added to this list can sign up and log in. You can also grant them Admin status to invite others.
        </p>

        {/* Inline Add User Form */}
        <form onSubmit={handleAddSubmit} className="whitelist-inline-form">
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label" htmlFor="new-member-email">Add Friend's Email</label>
            <input 
              id="new-member-email"
              type="email" 
              className="form-input" 
              placeholder="e.g. friend@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
            <input 
              id="new-member-admin"
              type="checkbox" 
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
            />
            <label className="form-label" htmlFor="new-member-admin" style={{ marginBottom: 0, cursor: 'pointer' }}>Make Admin</label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: '45px' }}>
            Invite
          </button>
        </form>

        {/* Whitelist status table */}
        <div className="whitelist-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Status</th>
                <th>Admin role</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {whitelist.map((user) => {
                const simulatedUserId = `u-${(user.name || '').toLowerCase()}`;
                const isSelf = user.email.toLowerCase() === currentUser?.email.toLowerCase();

                return (
                  <tr key={user.email}>
                    <td data-label="Email" style={{ fontWeight: 500 }}>{user.email}</td>
                    <td data-label="Name">{user.name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending signup</span>}</td>
                    <td data-label="Status">
                      <span className={`status-badge ${user.registered ? 'registered' : 'pending'}`}>
                        {user.registered ? 'Registered' : 'Invited'}
                      </span>
                    </td>
                    <td data-label="Admin role">
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={user.isAdmin} 
                          disabled={isSelf || !user.registered} // Can't toggle self, or someone not registered yet
                          onChange={(e) => handleToggleAdmin(user.email, e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td data-label="Actions" style={{ textAlign: 'right' }}>
                      <button 
                        className="icon-btn delete" 
                        disabled={isSelf && whitelist.filter(u => u.isAdmin && u.registered).length === 1} // Can't delete self if last admin
                        onClick={() => handleRemove(user.email)}
                        title="Remove User"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
