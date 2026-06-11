import React, { useState, useEffect } from 'react';
import { dbService } from './utils/dbService';
import BookingCalendar from './components/BookingCalendar';
import Dashboard from './components/Dashboard';
import RequestCenter from './components/RequestCenter';
import SuggestionsBoard from './components/SuggestionsBoard';
import AdminPanel from './components/AdminPanel';
import NotificationCenter from './components/NotificationCenter';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [settings, setSettings] = useState({ resend_api_key: '', resend_from_email: '' });
  const [notifications, setNotifications] = useState([]);
  
  // UI states
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar', 'suggestions', 'admin'
  const [theme, setTheme] = useState('light');
  const [authView, setAuthView] = useState('login'); // 'login', 'signup'
  const [showPassword, setShowPassword] = useState(false);
  
  // Auth Form inputs
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);

  // Initialize and load data
  useEffect(() => {
    const initApp = async () => {
      try {
        const user = await dbService.getCurrentUser();
        setCurrentUser(user);
        
        // Load global databases
        await refreshAllData();
        
        // Theme initialization
        const savedTheme = localStorage.getItem('aikyam_theme') || 'light';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const refreshAllData = async () => {
    const [b, r, s, w, setts, notifs] = await Promise.all([
      dbService.getBookings(),
      dbService.getRequests(),
      dbService.getSuggestions(),
      dbService.getWhitelist(),
      dbService.getSettings(),
      dbService.getNotifications()
    ]);
    setBookings(b);
    setRequests(r);
    setSuggestions(s);
    setWhitelist(w);
    setSettings(setts);
    setNotifications(notifs);
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('aikyam_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // --- AUTH ACTIONS ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const user = await dbService.login(authEmail, authPassword);
      setCurrentUser(user);
      await refreshAllData();
      // Reset fields
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const user = await dbService.signup(authEmail, authPassword, authName);
      setCurrentUser(user);
      await refreshAllData();
      // Reset fields
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    await dbService.logout();
    setCurrentUser(null);
    setActiveTab('calendar');
  };

  // --- BOOKING ACTIONS ---
  const handleCreateBooking = async (checkIn, checkOut) => {
    await dbService.createBooking(checkIn, checkOut);
    await refreshAllData();
  };

  const handleEditBooking = async (id, checkIn, checkOut) => {
    await dbService.editBooking(id, checkIn, checkOut);
    await refreshAllData();
  };

  const handleCancelBooking = async (id) => {
    await dbService.cancelBooking(id);
    await refreshAllData();
  };

  // --- REQUEST ACTIONS ---
  const handleCreateRequest = async (bookingId, checkIn, checkOut, reason) => {
    await dbService.createRequest(bookingId, checkIn, checkOut, reason);
    await refreshAllData();
  };

  const handleRespondToRequest = async (requestId, status) => {
    await dbService.respondToRequest(requestId, status);
    await refreshAllData();
  };

  // --- SUGGESTION ACTIONS ---
  const handleCreateSuggestion = async (title, description) => {
    await dbService.createSuggestion(title, description);
    await refreshAllData();
  };

  const handleEditSuggestion = async (id, title, description) => {
    await dbService.editSuggestion(id, title, description);
    await refreshAllData();
  };

  const handleDeleteSuggestion = async (id) => {
    await dbService.deleteSuggestion(id);
    await refreshAllData();
  };

  const handleVoteSuggestion = async (id, value) => {
    await dbService.voteSuggestion(id, value);
    await refreshAllData();
  };

  // --- ADMIN ACTIONS ---
  const handleAddToWhitelist = async (email, isAdmin) => {
    await dbService.addToWhitelist(email, isAdmin);
    await refreshAllData();
  };

  const handleRemoveFromWhitelist = async (email) => {
    await dbService.removeFromWhitelist(email);
    await refreshAllData();
  };

  const handleToggleAdmin = async (userId, isAdmin) => {
    await dbService.toggleAdmin(userId, isAdmin);
    await refreshAllData();
  };

  const handleSaveSettings = async (newSettings) => {
    await dbService.saveSettings(newSettings);
    await refreshAllData();
  };

  const handleMarkNotificationsRead = async () => {
    await dbService.markNotificationsRead();
    const notifs = await dbService.getNotifications();
    setNotifications(notifs);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--primary-color)' }}>
        <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 600 }}>Loading Aikyam Farmstay...</div>
      </div>
    );
  }

  // --- UNAUTHENTICATED VIEWS (LOGIN/SIGNUP) ---
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px', backgroundColor: 'var(--bg-primary)' }}>
        <div className="section-card" style={{ width: '100%', maxWidth: '420px', padding: '36px', boxShadow: 'var(--shadow-lg)' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span style={{ fontSize: '2.5rem' }}>🏡</span>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', color: 'var(--primary-color)', margin: '10px 0 4px 0' }}>
              Aikyam farmstay
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>
              Friend Group Booking Portal
            </p>
          </div>

          {authError && (
            <div style={{ padding: '10px', backgroundColor: '#fdebeb', color: 'var(--danger-color)', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '16px', textAlign: 'center' }}>
              {authError}
            </div>
          )}

          {authView === 'login' ? (
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email Address</label>
                <input 
                  id="login-email"
                  type="email" 
                  className="form-input" 
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <div className="password-input-wrapper">
                  <input 
                    id="login-password"
                    type={showPassword ? 'text' : 'password'} 
                    className="form-input" 
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required 
                  />
                  <button 
                    type="button" 
                    className="password-toggle-btn" 
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                Log In
              </button>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                First time?{' '}
                <button type="button" className="logout-btn" onClick={() => { setAuthView('signup'); setAuthError(''); }} style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                  Register here
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-name">Display Name</label>
                <input 
                  id="signup-name"
                  type="text" 
                  className="form-input" 
                  placeholder="Rohan"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-email">Email Address</label>
                <input 
                  id="signup-email"
                  type="email" 
                  className="form-input" 
                  placeholder="email@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required 
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Note: Email must be whitelisted by the Admin to register.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-password">Choose Password</label>
                <div className="password-input-wrapper">
                  <input 
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'} 
                    className="form-input" 
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required 
                  />
                  <button 
                    type="button" 
                    className="password-toggle-btn" 
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                Create Account
              </button>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Already registered?{' '}
                <button type="button" className="logout-btn" onClick={() => { setAuthView('login'); setAuthError(''); }} style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                  Log In
                </button>
              </div>
            </form>
          )}

          {/* Production Portal */}
        </div>
      </div>
    );
  }

  // --- LOGGED IN APPLICATION VIEW ---
  return (
    <div className="app-container">
      
      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          <span className="brand-logo">🏡</span>
          <div>
            <h1 className="brand-title">Aikyam farmstay</h1>
            <span className="brand-subtitle">8 Friends Sharing Portal</span>
          </div>
        </div>

        <div className="user-controls">
          {/* Notifications Center */}
          <NotificationCenter 
            notifications={notifications}
            onMarkRead={handleMarkNotificationsRead}
          />

          {/* Theme Toggle */}
          <button className="theme-toggle-btn" onClick={handleToggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* User Profile Badge */}
          <div className="user-badge">
            <div className="user-avatar-dot"></div>
            <span>{currentUser.name} {currentUser.isAdmin && '👑'}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <nav className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          📅 Calendar & Stays
        </button>
        <button 
          className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          💡 Suggestions board
        </button>
        {currentUser.isAdmin && (
          <button 
            className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            ⚙️ Admin Panel
          </button>
        )}
      </nav>

      {/* Tab Panels */}
      <main>
        {activeTab === 'calendar' && (
          <div className="dashboard-grid animate-fade">
            <div>
              <BookingCalendar 
                currentUser={currentUser}
                bookings={bookings}
                requests={requests}
                onCreateBooking={handleCreateBooking}
                onCreateRequest={handleCreateRequest}
                activeTab={activeTab}
              />
              
              <RequestCenter 
                currentUser={currentUser}
                requests={requests}
                bookings={bookings}
                onRespondToRequest={handleRespondToRequest}
              />
            </div>

            <div>
              <Dashboard 
                currentUser={currentUser}
                bookings={bookings}
                onCancelBooking={handleCancelBooking}
                onEditBooking={handleEditBooking}
              />
            </div>
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="animate-fade">
            <SuggestionsBoard 
              currentUser={currentUser}
              suggestions={suggestions}
              onCreateSuggestion={handleCreateSuggestion}
              onEditSuggestion={handleEditSuggestion}
              onDeleteSuggestion={handleDeleteSuggestion}
              onVoteSuggestion={handleVoteSuggestion}
            />
          </div>
        )}

        {activeTab === 'admin' && currentUser.isAdmin && (
          <div className="animate-fade">
            <AdminPanel 
              currentUser={currentUser}
              whitelist={whitelist}
              settings={settings}
              onAddToWhitelist={handleAddToWhitelist}
              onRemoveFromWhitelist={handleRemoveFromWhitelist}
              onToggleAdmin={handleToggleAdmin}
              onSaveSettings={handleSaveSettings}
            />
          </div>
        )}
      </main>

      {/* Ready for Production */}
    </div>
  );
}
