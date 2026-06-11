import React, { useState } from 'react';
import { formatDisplayDate, calculateNights, getTodayDateString } from '../utils/dateHelpers';

export default function Dashboard({ 
  currentUser, 
  bookings, 
  onCancelBooking, 
  onEditBooking 
}) {
  const [editingBooking, setEditingBooking] = useState(null);
  const [newCheckIn, setNewCheckIn] = useState('');
  const [newCheckOut, setNewCheckOut] = useState('');
  const [editError, setEditError] = useState('');
  const [cancelledBookingInfo, setCancelledBookingInfo] = useState(null);

  // Get upcoming bookings in chronological order
  const todayStr = getTodayDateString();
  const upcomingBookings = bookings
    .filter(b => b.check_out >= todayStr)
    .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));

  const handleCancelClick = async (id, checkIn, checkOut) => {
    if (window.confirm(`Are you sure you want to cancel your booking for ${formatDisplayDate(checkIn)} to ${formatDisplayDate(checkOut)}?`)) {
      await onCancelBooking(id);
      setCancelledBookingInfo({ checkIn, checkOut });
    }
  };

  const handleEditClick = (booking) => {
    setEditingBooking(booking);
    setNewCheckIn(booking.check_in);
    setNewCheckOut(booking.check_out);
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (newCheckOut <= newCheckIn) {
      setEditError('Check-out must be after check-in.');
      return;
    }
    const nights = calculateNights(newCheckIn, newCheckOut);
    if (nights > 3) {
      setEditError('Maximum stay is 3 nights.');
      return;
    }
    
    try {
      await onEditBooking(editingBooking.id, newCheckIn, newCheckOut);
      setEditingBooking(null);
    } catch (err) {
      setEditError(err.message);
    }
  };

  return (
    <div className="section-card">
      <div className="section-title">
        <span>Upcoming Stays</span>
      </div>

      {cancelledBookingInfo && (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--accent-subtle)',
          border: '1px solid var(--accent-color)',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'center'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--accent-color)', fontSize: '0.95rem' }}>
            🏡 Stay Cancelled ({formatDisplayDate(cancelledBookingInfo.checkIn)} - {formatDisplayDate(cancelledBookingInfo.checkOut)})
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Share this opening with your friends on WhatsApp:
          </span>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              className="btn btn-primary"
              style={{ backgroundColor: '#25D366', color: 'white', border: 'none', flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
              onClick={() => {
                const msg = `Hey everyone! I just cancelled my stay for ${formatDisplayDate(cancelledBookingInfo.checkIn)} to ${formatDisplayDate(cancelledBookingInfo.checkOut)} at Aikyam Farmstay. The dates are now free to book on the portal!`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                setCancelledBookingInfo(null);
              }}
            >
              💬 Share on WhatsApp
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              onClick={() => setCancelledBookingInfo(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="bookings-list">
        {upcomingBookings.length === 0 ? (
          <div className="empty-state">No upcoming bookings. Click dates on the calendar to book!</div>
        ) : (
          upcomingBookings.map(b => {
            const isMine = b.user_id === currentUser?.id;
            return (
              <div 
                key={b.id} 
                className={`booking-item-card ${isMine ? 'mine' : 'others'}`}
              >
                <div className="booking-user-info">
                  <span className="booking-user-name">
                    {b.user_name} {isMine && '(You)'}
                  </span>
                  <span className="booking-dates">
                    {formatDisplayDate(b.check_in)} – {formatDisplayDate(b.check_out)}
                  </span>
                  <span className="booking-nights-badge">
                    {calculateNights(b.check_in, b.check_out)} Nights
                  </span>
                </div>

                <div className="booking-actions">
                  {isMine && (
                    <>
                      <button 
                        className="icon-btn" 
                        onClick={() => handleEditClick(b)}
                        title="Edit Dates"
                      >
                        ✏️
                      </button>
                      <button 
                        className="icon-btn delete" 
                        onClick={() => handleCancelClick(b.id, b.check_in, b.check_out)}
                        title="Cancel Booking"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => setEditingBooking(null)}>×</button>
            <h3 className="modal-title">Edit Booking Dates</h3>
            <p className="modal-subtitle">Adjust your reservation dates.</p>
            
            {editError && (
              <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 500 }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-checkin">Check-In</label>
                <input 
                  id="edit-checkin"
                  type="date" 
                  className="form-input"
                  min={getTodayDateString()}
                  value={newCheckIn}
                  onChange={(e) => setNewCheckIn(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-checkout">Check-Out</label>
                <input 
                  id="edit-checkout"
                  type="date" 
                  className="form-input"
                  min={newCheckIn || getTodayDateString()}
                  value={newCheckOut}
                  onChange={(e) => setNewCheckOut(e.target.value)}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingBooking(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
