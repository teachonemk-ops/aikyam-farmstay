import React, { useState } from 'react';

export default function SuggestionsBoard({ 
  currentUser, 
  suggestions, 
  onCreateSuggestion, 
  onEditSuggestion, 
  onDeleteSuggestion, 
  onVoteSuggestion 
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sort suggestions: highest net score first, then chronological
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Title and description are required.');
      return;
    }
    try {
      await onCreateSuggestion(title, description);
      setTitle('');
      setDescription('');
      setShowAddModal(false);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleEditClick = (sug) => {
    setEditingSuggestion(sug);
    setTitle(sug.title);
    setDescription(sug.description);
    setErrorMsg('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Title and description are required.');
      return;
    }
    try {
      await onEditSuggestion(editingSuggestion.id, title, description);
      setTitle('');
      setDescription('');
      setEditingSuggestion(null);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this suggestion?')) {
      await onDeleteSuggestion(id);
    }
  };

  const handleVote = async (id, value) => {
    await onVoteSuggestion(id, value);
  };

  return (
    <div className="suggestions-layout">
      <div className="suggestions-header">
        <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-color)' }}>
          Aikyam Developments
        </h2>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            setTitle('');
            setDescription('');
            setErrorMsg('');
            setShowAddModal(true);
          }}
        >
          + Suggest Idea
        </button>
      </div>

      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Have an idea for the farm (like planting fruit trees, upgrading amenities, or fixing the fence)? Share it here! Upvote ideas you support, or downvote ones you disagree with.
      </p>

      {errorMsg && (
        <div style={{ color: 'var(--danger-color)', marginBottom: '16px', fontWeight: 500 }}>
          {errorMsg}
        </div>
      )}

      <div className="suggestions-grid">
        {sortedSuggestions.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            No suggestions yet. Be the first to share an idea!
          </div>
        ) : (
          sortedSuggestions.map(sug => {
            const isMySug = sug.user_id === currentUser?.id;
            const hasUpvoted = sug.votes[currentUser?.id] === 1;
            const hasDownvoted = sug.votes[currentUser?.id] === -1;

            return (
              <div key={sug.id} className="suggestion-card">
                {/* Voting Panel */}
                <div className="suggestion-voting-panel">
                  <button 
                    className={`vote-arrow-btn ${hasUpvoted ? 'upvoted' : ''}`}
                    onClick={() => handleVote(sug.id, 1)}
                    title="Upvote"
                  >
                    ▲
                  </button>
                  <span className="vote-score-display" style={{
                    color: sug.score > 0 ? 'var(--primary-color)' : sug.score < 0 ? 'var(--danger-color)' : 'var(--text-muted)'
                  }}>
                    {sug.score}
                  </span>
                  <button 
                    className={`vote-arrow-btn ${hasDownvoted ? 'downvoted' : ''}`}
                    onClick={() => handleVote(sug.id, -1)}
                    title="Downvote"
                  >
                    ▼
                  </button>
                </div>

                {/* Content Panel */}
                <div className="suggestion-content-panel">
                  <div className="suggestion-card-header">
                    <h3 className="suggestion-title">{sug.title}</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isMySug && (
                        <button 
                          className="icon-btn" 
                          onClick={() => handleEditClick(sug)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                      )}
                      {(isMySug || currentUser?.isAdmin) && (
                        <button 
                          className="icon-btn delete" 
                          onClick={() => handleDelete(sug.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="suggestion-description">{sug.description}</p>

                  <div className="suggestion-meta">
                    <span>Suggested by <strong>{sug.user_name}</strong></span>
                    <span>•</span>
                    <span>{new Date(sug.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Suggestion Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>×</button>
            <h3 className="modal-title">Suggest Farm Improvement</h3>
            <p className="modal-subtitle">Share your idea with the other 7 friends.</p>
            
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="sug-title">Idea Title</label>
                <input 
                  id="sug-title"
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Brick Pizza Oven"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="sug-desc">Description</label>
                <textarea 
                  id="sug-desc"
                  className="form-input" 
                  style={{ minHeight: '120px', resize: 'vertical' }}
                  placeholder="Explain your idea, how much it might cost, or how you plan to get it done..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Post Idea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Suggestion Modal */}
      {editingSuggestion && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => setEditingSuggestion(null)}>×</button>
            <h3 className="modal-title">Edit Suggestion</h3>
            <p className="modal-subtitle">Modify your posted idea.</p>
            
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-sug-title">Idea Title</label>
                <input 
                  id="edit-sug-title"
                  type="text" 
                  className="form-input" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-sug-desc">Description</label>
                <textarea 
                  id="edit-sug-desc"
                  className="form-input" 
                  style={{ minHeight: '120px', resize: 'vertical' }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingSuggestion(null)}>
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
