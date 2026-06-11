import React, { useState } from 'react';
import { formatDisplayDate } from '../utils/dateHelpers';

export default function RequestCenter({ 
  currentUser, 
  requests, 
  bookings, 
  onRespondToRequest 
}) {
  const [subTab, setSubTab] = useState('received'); // 'received' or 'sent'

  // Filter requests
  // Received: requests where booking_owner_id is current user, and request status is pending
  const receivedRequests = requests.filter(r => 
    r.booking_owner_id === currentUser?.id
  ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Sent: requests where requester_id is current user
  const sentRequests = requests.filter(r => 
    r.requester_id === currentUser?.id
  ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const handleAccept = async (id) => {
    if (window.confirm('Are you sure you want to accept this request? This will CANCEL your booking and automatically book it for them.')) {
      await onRespondToRequest(id, 'accepted');
    }
  };

  const handleDecline = async (id) => {
    if (window.confirm('Are you sure you want to decline this request?')) {
      await onRespondToRequest(id, 'declined');
    }
  };

  return (
    <div className="section-card">
      <div className="section-title">
        <span>Requests Center</span>
      </div>

      <div className="requests-tab-container">
        <button 
          className={`subtab-btn ${subTab === 'received' ? 'active' : ''}`}
          onClick={() => setSubTab('received')}
        >
          Received ({receivedRequests.filter(r => r.status === 'pending').length})
        </button>
        <button 
          className={`subtab-btn ${subTab === 'sent' ? 'active' : ''}`}
          onClick={() => setSubTab('sent')}
        >
          Sent ({sentRequests.length})
        </button>
      </div>

      {subTab === 'received' ? (
        <div className="requests-list">
          {receivedRequests.length === 0 ? (
            <div className="empty-state">No requests received.</div>
          ) : (
            receivedRequests.map(req => {
              const matchingBooking = bookings.find(b => b.id === req.booking_id);
              return (
                <div key={req.id} className="request-card">
                  <div className="request-header">
                    <div className="request-meta">
                      <span className="request-title">{req.requester_name} requested your slot</span>
                      <span className="request-date">
                        {formatDisplayDate(req.check_in)} to {formatDisplayDate(req.check_out)}
                      </span>
                    </div>
                    <span className={`request-status-badge ${req.status}`}>
                      {req.status}
                    </span>
                  </div>
                  
                  <div className="request-reason">
                    "{req.reason}"
                  </div>

                  {req.status === 'pending' && (
                    <div className="request-actions">
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleDecline(req.id)}
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        Decline
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleAccept(req.id)}
                        style={{ padding: '8px 16px', fontSize: '0.85rem', backgroundColor: 'var(--accent-color)' }}
                      >
                        Accept & Transfer
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="requests-list">
          {sentRequests.length === 0 ? (
            <div className="empty-state">No requests sent.</div>
          ) : (
            sentRequests.map(req => (
              <div key={req.id} className="request-card">
                <div className="request-header">
                  <div className="request-meta">
                    <span className="request-title">Request for Friend's Booking</span>
                    <span className="request-date">
                      {formatDisplayDate(req.check_in)} to {formatDisplayDate(req.check_out)}
                    </span>
                  </div>
                  <span className={`request-status-badge ${req.status}`}>
                    {req.status}
                  </span>
                </div>
                
                <div className="request-reason">
                  "{req.reason}"
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  Submitted {new Date(req.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
