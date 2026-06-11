import React, { useState, useEffect } from 'react';
import { 
  generateCalendarMonth, 
  formatDisplayDate, 
  isWithinRolling90Days, 
  calculateNights,
  getTodayDateString,
  isWeekend
} from '../utils/dateHelpers';

export default function BookingCalendar({ 
  currentUser, 
  bookings, 
  requests, 
  onCreateBooking, 
  onCreateRequest,
  activeTab
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [hoveredDate, setHoveredDate] = useState(null);
  
  // Modal states
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [targetBookingForRequest, setTargetBookingForRequest] = useState(null);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Reset selection when changing tabs
  useEffect(() => {
    resetSelection();
  }, [activeTab]);

  const resetSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setHoveredDate(null);
    setErrorMsg('');
    setRequestSuccess(false);
  };

  // Navigate months (limit within 90 days)
  const handlePrevMonth = () => {
    const today = new Date();
    // Only allow navigating back to current month
    if (currentYear > today.getFullYear() || currentMonth > today.getMonth()) {
      setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
      resetSelection();
    }
  };

  const handleNextMonth = () => {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + 90);
    
    // Check if the next month is within 90 days from today
    const nextMonthFirstDay = new Date(currentYear, currentMonth + 1, 1);
    if (nextMonthFirstDay <= limitDate) {
      setCurrentDate(nextMonthFirstDay);
      resetSelection();
    }
  };

  // Determine date state (returns helper info)
  // Booking from checkIn to checkOut blocks nights: checkIn <= night < checkOut
  const getDateInfo = (dateStr) => {
    const dateObj = new Date(dateStr);
    const todayStr = getTodayDateString();
    
    // Past dates cannot be booked
    if (dateStr < todayStr) {
      return { isBookable: false, isPast: true };
    }

    // Limit to 90 days rolling window
    if (!isWithinRolling90Days(dateStr)) {
      return { isBookable: false, isOutOfWindow: true };
    }

    // Check if this date night is booked
    const activeBooking = bookings.find(b => {
      return dateStr >= b.check_in && dateStr < b.check_out;
    });

    if (activeBooking) {
      const isMine = activeBooking.user_id === currentUser?.id;
      // Check if user has requested this booking
      const myRequest = requests.find(r => 
        r.booking_id === activeBooking.id && 
        r.requester_id === currentUser?.id && 
        r.status === 'pending'
      );

      return {
        isBookable: false,
        isBlocked: true,
        isMine,
        booking: activeBooking,
        hasMyRequest: !!myRequest,
        myRequest
      };
    }

    return { isBookable: true };
  };

  const handleDayClick = (dateStr, dateInfo) => {
    if (dateStr < getTodayDateString() || !isWithinRolling90Days(dateStr)) {
      return; // Do nothing for past or out-of-window dates
    }

    // If clicking a blocked date
    if (dateInfo.isBlocked) {
      if (dateInfo.isMine) {
        // User clicked their own booking, reset and let them see details or edit
        resetSelection();
        return;
      }
      
      // If someone else's booking, and we haven't started a range selection
      if (!selectionStart) {
        // Prepare to send special occasion request
        setTargetBookingForRequest(dateInfo.booking);
        setSelectionStart(dateInfo.booking.check_in);
        setSelectionEnd(dateInfo.booking.check_out);
        setReason('');
        setShowRequestModal(true);
        return;
      }
    }

    // If starting selection
    if (!selectionStart || (selectionStart && selectionEnd)) {
      if (dateInfo.isBlocked) return;
      setSelectionStart(dateStr);
      setSelectionEnd(null);
      setHoveredDate(null);
      setErrorMsg('');
    } else {
      // Completing selection
      if (dateStr < selectionStart) {
        // If clicked date is before start, make it the new start
        if (dateInfo.isBlocked) return;
        setSelectionStart(dateStr);
        return;
      }

      // Check if range exceeds 3 nights
      const nights = calculateNights(selectionStart, dateStr);
      if (nights > 3) {
        setErrorMsg('Maximum stay is 3 nights. Please select a shorter range.');
        return;
      }
      if (nights === 0) {
        resetSelection();
        return;
      }

      // Check if there are any blocked dates inside the selected range
      // Airbnb check: Rohan is June 5-8, Priya wants June 8-10.
      // Range June 8-10 blocks nights June 8, 9.
      // Rohan blocks nights June 5, 6, 7.
      // So June 8 night is free! No overlap!
      // We check if any date night in [selectionStart, dateStr) is blocked.
      let hasBlockedNight = false;
      let blockedByBooking = null;

      const checkDate = new Date(selectionStart);
      const endDate = new Date(dateStr);
      
      while (checkDate < endDate) {
        const checkStr = checkDate.toISOString().split('T')[0];
        const info = getDateInfo(checkStr);
        if (info.isBlocked) {
          hasBlockedNight = true;
          blockedByBooking = info.booking;
          break;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }

      if (hasBlockedNight) {
        // If blocked, we check if we can request a special occasion overlap
        // A special request must match the exact dates of the existing booking, or be inside it.
        // For simplicity, if they clicked a range that overlaps with exactly one other booking, 
        // we can prompt them to request that booking.
        if (blockedByBooking && blockedByBooking.user_id !== currentUser?.id) {
          setTargetBookingForRequest(blockedByBooking);
          // Set selection to match the target booking dates for the request
          setSelectionStart(blockedByBooking.check_in);
          setSelectionEnd(blockedByBooking.check_out);
          setReason('');
          setShowRequestModal(true);
        } else {
          setErrorMsg('These dates overlap with another booking.');
        }
        return;
      }

      // Valid range selected!
      setSelectionEnd(dateStr);
      setErrorMsg('');
      setShowBookingModal(true);
    }
  };

  const handleDayMouseEnter = (dateStr) => {
    if (selectionStart && !selectionEnd) {
      setHoveredDate(dateStr);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    try {
      await onCreateBooking(selectionStart, selectionEnd);
      setShowBookingModal(false);
      resetSelection();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('A reason is required for special occasion requests.');
      return;
    }
    try {
      await onCreateRequest(targetBookingForRequest.id, selectionStart, selectionEnd, reason);
      setRequestSuccess(true);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleWhatsAppRequestShare = () => {
    const msg = `Hey ${targetBookingForRequest.user_name}, I just requested your stays on the Aikyam portal for ${formatDisplayDate(selectionStart)} to ${formatDisplayDate(selectionEnd)}. Reason: "${reason}". Please check!`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Generate calendar days
  const calendarDays = generateCalendarMonth(currentYear, currentMonth);
  const monthName = currentDate.toLocaleString('en-US', { month: 'long' });

  // Range styling helper
  const isInRange = (dateStr) => {
    if (!selectionStart) return false;
    if (selectionEnd) {
      return dateStr >= selectionStart && dateStr <= selectionEnd;
    }
    if (hoveredDate) {
      // Only highlight up to 3 nights on hover
      const nights = calculateNights(selectionStart, hoveredDate);
      if (nights <= 3 && hoveredDate >= selectionStart) {
        return dateStr >= selectionStart && dateStr <= hoveredDate;
      }
    }
    return dateStr === selectionStart;
  };

  return (
    <div className="section-card">
      <div className="section-title">
        <span>Aikyam Calendar</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Max 3 nights • 90-day window
        </span>
      </div>

      {errorMsg && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#fdebeb', 
          color: 'var(--danger-color)', 
          borderRadius: '8px', 
          fontSize: '0.9rem',
          fontWeight: 500,
          marginBottom: '16px' 
        }}>
          {errorMsg}
        </div>
      )}

      {/* Month Selector Controls */}
      <div className="calendar-header-controls">
        <button className="nav-arrow-btn" onClick={handlePrevMonth} title="Previous Month">
          ←
        </button>
        <div className="month-display">
          {monthName} {currentYear}
        </div>
        <button className="nav-arrow-btn" onClick={handleNextMonth} title="Next Month">
          →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Weekday headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="weekday-header">{d}</div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((cell, idx) => {
          const dateInfo = getDateInfo(cell.dateString);
          const isCellWeekend = isWeekend(cell.dateString);
          
          let cellClasses = 'calendar-day-cell';
          if (!cell.isCurrentMonth) cellClasses += ' other-month';
          if (isCellWeekend) cellClasses += ' weekend';
          
          const todayStr = getTodayDateString();
          const isPast = cell.dateString < todayStr;
          const isOutOfWindow = !isWithinRolling90Days(cell.dateString) && !isPast;
          
          if (isPast || isOutOfWindow) {
            cellClasses += ' disabled';
          } else if (dateInfo.isBlocked) {
            if (dateInfo.isMine) {
              cellClasses += ' my-booking';
            } else {
              cellClasses += ' others-booking';
            }
            if (dateInfo.hasMyRequest) {
              cellClasses += ' pending-request';
            }
          }

          // Check for selection highlights
          const isSelectedStart = selectionStart === cell.dateString;
          const isSelectedEnd = selectionEnd === cell.dateString;
          const isRange = isInRange(cell.dateString) && !isSelectedStart && !isSelectedEnd;

          if (isSelectedStart) cellClasses += ' selected-start';
          if (isSelectedEnd) cellClasses += ' selected-end';
          if (isRange) cellClasses += ' selected-range';

          return (
            <div 
              key={idx} 
              className={cellClasses}
              onClick={() => handleDayClick(cell.dateString, dateInfo)}
              onMouseEnter={() => handleDayMouseEnter(cell.dateString)}
            >
              <span className="day-number">{cell.day}</span>
              
              {/* Inside day label */}
              {dateInfo.isBlocked && cell.isCurrentMonth && (
                <span style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: 700, 
                  textAlign: 'right',
                  opacity: 0.9,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {dateInfo.hasMyRequest ? 'Requested' : dateInfo.booking.user_name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color mine"></div>
          <span>My Booking</span>
        </div>
        <div className="legend-item">
          <div className="legend-color others"></div>
          <span>Blocked by Friend</span>
        </div>
        <div className="legend-item">
          <div className="legend-color pending"></div>
          <span>My Overlap Request</span>
        </div>
        <div className="legend-item">
          <div className="legend-color selected"></div>
          <span>Selected</span>
        </div>
      </div>

      {/* Selection Help Note */}
      {selectionStart && !selectionEnd && (
        <div style={{ 
          marginTop: '16px', 
          fontSize: '0.85rem', 
          color: 'var(--primary-color)',
          backgroundColor: 'var(--primary-subtle)',
          padding: '10px',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Select your check-out date (up to 3 nights).</span>
          <button style={{ 
            background: 'none', 
            border: 'none', 
            textDecoration: 'underline', 
            cursor: 'pointer',
            fontWeight: 600,
            color: 'inherit'
          }} onClick={resetSelection}>Cancel</button>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => { setShowBookingModal(false); resetSelection(); }}>×</button>
            <h3 className="modal-title">Confirm Booking</h3>
            <p className="modal-subtitle">Reserve your stay at Aikyam Farmstay.</p>
            
            <form onSubmit={handleBookingSubmit}>
              <div className="form-group">
                <span className="form-label">Check-In</span>
                <p style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--primary-color)' }}>
                  {formatDisplayDate(selectionStart)} (12:00 PM)
                </p>
              </div>

              <div className="form-group">
                <span className="form-label">Check-Out</span>
                <p style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--primary-color)' }}>
                  {formatDisplayDate(selectionEnd)} (12:00 PM)
                </p>
              </div>

              <div className="form-group">
                <span className="form-label">Stay Duration</span>
                <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                  {calculateNights(selectionStart, selectionEnd)} Nights
                </p>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowBookingModal(false); resetSelection(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Book Farmstay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Special Occasion Request Modal */}
      {showRequestModal && targetBookingForRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => { setShowRequestModal(false); resetSelection(); }}>×</button>
            
            {requestSuccess ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <span style={{ fontSize: '3.0rem' }}>✉️</span>
                <h3 className="modal-title" style={{ marginTop: '16px' }}>Request Submitted!</h3>
                <p className="modal-subtitle" style={{ marginBottom: '24px' }}>
                  Your request has been logged in the portal.
                </p>
                
                <div style={{ 
                  backgroundColor: 'var(--primary-subtle)', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  fontSize: '0.9rem', 
                  color: 'var(--primary-color)',
                  fontWeight: 500,
                  marginBottom: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  alignItems: 'center'
                }}>
                  <span>Let {targetBookingForRequest.user_name} know on WhatsApp:</span>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleWhatsAppRequestShare}
                    style={{ backgroundColor: '#25D366', color: 'white', border: 'none', width: '100%', marginTop: '6px' }}
                  >
                    💬 Notify on WhatsApp
                  </button>
                </div>
                
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '100%' }}
                  onClick={() => { setShowRequestModal(false); resetSelection(); }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="modal-title">Request Special Occasion</h3>
                <p className="modal-subtitle" style={{ color: 'var(--accent-color)' }}>
                  These dates are blocked by <strong>{targetBookingForRequest.user_name}</strong>.
                </p>
                
                <form onSubmit={handleRequestSubmit}>
                  <div className="form-group">
                    <span className="form-label">Requested Range</span>
                    <p style={{ fontWeight: 600, fontSize: '1rem' }}>
                      {formatDisplayDate(targetBookingForRequest.check_in)} to {formatDisplayDate(targetBookingForRequest.check_out)}
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="reason-input">Reason for Special Occasion *</label>
                    <textarea
                      id="reason-input"
                      className="form-input"
                      style={{ minHeight: '100px', resize: 'vertical' }}
                      placeholder="Explain why you need these dates (e.g. My daughter's birthday dinner, family reunion...)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Note: This request will only be visible to {targetBookingForRequest.user_name}. If they accept, their booking will cancel and transfer to you automatically.
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowRequestModal(false); resetSelection(); }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--accent-color)' }}>
                      Submit Request
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
