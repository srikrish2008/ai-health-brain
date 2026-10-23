import React, { useState, useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { auth } from './firebase';
import { useHealthProfile } from './hooks/useHealthProfile';
import HomeTab from './components/HomeTab';
import ProfileTab from './components/ProfileTab';
import SymptomsTab from './components/SymptomsTab';
import VisitsTab from './components/VisitsTab';
import VaultTab from './components/VaultTab';
import AnalyzerTab from './components/AnalyzerTab';
import ChatTab from './components/ChatTab';
import MedicationsTab from './components/MedicationsTab';
import VitalsTab from './components/VitalsTab';
import EmergencyTab from './components/EmergencyTab';
import {
  Heart, FileText, MessageSquare, Settings as SettingsIcon,
  LogOut, AlertTriangle, Download, Shield, Activity, Bot, TrendingUp, Stethoscope, Folder, Sparkles, Pill
} from 'lucide-react';

function App() {
  // ── Auth State ────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('home');

  // ── UI State ──────────────────────────────────────────────────────────────
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // ── PWA Install ───────────────────────────────────────────────────────────
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // ── Health Profile & Vault Data (Firestore) ──────────────────────────────
  const {
    profile, symptoms, visits, vaultFiles, vitals,
    loading: profileLoading, saving,
    saveProfile, logSymptom, deleteSymptom, logVisit, deleteVisit,
    addVaultFile, deleteVaultFile, logVital, deleteVital
  } = useHealthProfile(user);

  // ── PWA prompt ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallBanner(true); };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) setShowInstallBanner(false);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── App Tour (Driver.js) ──────────────────────────────────────────────────
  const startAppTour = (force = false) => {
    if (!force && localStorage.getItem('hasSeenAppTour')) return;
    
    const driverObj = driver({
      showProgress: true,
      animate: true,
      steps: [
        { 
          element: '[data-tour="header-logo"]', 
          popover: { title: 'Welcome!', description: "Welcome to AI Health Brain! Let's take a quick tour of all the tabs and features." } 
        },
        { 
          element: '[data-tour="tab-navigation"]', 
          popover: { title: 'Navigation', description: 'You can easily switch between your workspace tabs here.' } 
        },
        { 
          element: '[data-tour="upload-tab"]', 
          popover: { title: 'Health Vault', description: 'Upload lab reports or prescriptions for instant AI extraction.' },
          onHighlightStarted: () => { setActiveTab('vault'); }
        },
        { 
          element: '[data-tour="chat-tab"]', 
          popover: { title: 'AI Assistant', description: 'Ask questions about your health, lab results, or medical advice here.' },
          onHighlightStarted: () => { setActiveTab('chat'); }
        },
        { 
          element: '[data-tour="history-tab"]', 
          popover: { title: 'History & Analytics', description: 'Track your health metrics and saved reports over time.' },
          onHighlightStarted: () => { setActiveTab('vitals'); }
        },
        { 
          element: '[data-tour="settings-tab"]', 
          popover: { title: 'Settings & Replay', description: "Manage your account or click 'Replay Tour' anytime to see this walkthrough again." },
          onHighlightStarted: () => { setActiveTab('settings'); }
        }
      ],
      onDestroyStarted: () => {
        localStorage.setItem('hasSeenAppTour', 'true');
        driverObj.destroy();
        setActiveTab('home');
      }
    });

    setActiveTab('home');
    setTimeout(() => {
      driverObj.drive();
    }, 300);
  };

  useEffect(() => {
    if (user && !profileLoading && !localStorage.getItem('hasSeenAppTour')) {
      const timer = setTimeout(() => startAppTour(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [user, profileLoading]);

  // ── Auth Listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setIsVerifying(true);
      if (currentUser) {
        try {
          setUser(currentUser);
        } catch (err) {
          console.error('Error during client-side authentication:', err);
          setAuthError('Error setting user session.');
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsVerifying(false);
    });
    return () => unsub();
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Auth Error:', err);
      let msg = err.message;
      if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in window was closed. Please try again or use email.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'Google Sign-In is not enabled for this domain yet. Please register or sign in with your Email & Password below!';
      } else if (err.code === 'auth/popup-blocked') {
        msg = 'Sign-in pop-up was blocked by your browser. Please allow popups or use email.';
      }
      setAuthError(msg);
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      let msg = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password. If you are new, please click "Register" above to create an account!';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please switch to "Sign In".';
      } else if (err.code === 'auth/invalid-credential') {
        msg = 'Incorrect credentials. If you haven\'t created an account yet, click "Register" above to sign up!';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection failed. Please check your internet connection.';
      }
      setAuthError(msg);
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => { try { await signOut(auth); } catch (e) { console.error(e); } };

  const handleSaveProfile = async (data) => {
    await saveProfile(data);
    setShowEditProfile(false);
  };

  // ── Loading Screen ────────────────────────────────────────────────────────
  if (isVerifying) {
    return (
      <div className="auth-container">
        <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="spinner" />
          <p style={{ color: 'var(--text-secondary)' }}>Verifying credentials...</p>
        </div>
      </div>
    );
  }

  // ── Login / Register Screen (Public Access) ────────────────────────────────
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/icon-192.png" alt="AI Health Brain" onError={(e) => { e.target.style.display = 'none'; }} />
            <h1>AI Health Brain</h1>
            <p>Your Personal AI Health Assistant — Free & Open to All</p>
          </div>

          <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: 'var(--bg-sidebar)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
            {['Sign In', 'Register'].map((label, i) => (
              <button
                key={label}
                type="button"
                className="btn btn-ghost"
                style={{
                  flex: 1,
                  minHeight: '38px',
                  padding: '8px',
                  backgroundColor: (i === 0) === !isSignUp ? 'var(--bg-card)' : 'transparent',
                  color: (i === 0) === !isSignUp ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: (i === 0) === !isSignUp ? 'var(--shadow-sm)' : 'none',
                  borderRadius: '8px',
                  fontWeight: 700
                }}
                onClick={() => { setIsSignUp(i === 1); setAuthError(''); }}
              >
                {label}
              </button>
            ))}
          </div>

          {authError && (
            <div className="alert alert-danger"><AlertTriangle size={16} /><span>{authError}</span></div>
          )}

          {/* Quick Google Sign In */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            style={{
              width: '100%',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.36 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27a7.2 7.2 0 0 1 0-4.54V6.58H1.24a11.98 11.98 0 0 0 0 10.84l4.04-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.93 6.72-4.93z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
            <span>OR WITH EMAIL</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          </div>

          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="password">
                Password {isSignUp && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(min. 6 characters)</span>}
              </label>
              <input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={authLoading}>
              {authLoading ? 'Please wait...' : isSignUp ? 'Create Free Account' : 'Sign In'}
            </button>
          </form>

          {/* Quick toggle switch */}
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            {isSignUp ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(false); setAuthError(''); }}
                  style={{ background: 'none', border: 'none', padding: 0, minHeight: 'unset', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                New to AI Health Brain?{' '}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setAuthError(''); }}
                  style={{ background: 'none', border: 'none', padding: 0, minHeight: 'unset', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Create free account
                </button>
              </p>
            )}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Shield size={14} style={{ color: 'var(--success)' }} /> <span>Free Public Access · Anyone Can Register & Use</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Main App ──────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      {/* Profile Edit Modal */}
      {showEditProfile && profile && (
        <ProfileTab
          profile={profile}
          saving={saving}
          onSave={handleSaveProfile}
          onClose={() => setShowEditProfile(false)}
        />
      )}

      {/* Header */}
      <header className="top-bar">
        <div className="top-bar-content">
          <div className="top-bar-brand" data-tour="header-logo" onClick={() => { setActiveTab('home'); setShowMobileMenu(false); }} style={{ cursor: 'pointer' }}>
            <img src="/icon-192.png" alt="AI Health Brain" style={{ width: '34px', height: '34px', borderRadius: '8px' }} onError={e => e.target.style.display = 'none'} />
            <h2>AI Health Brain</h2>
          </div>
          
          <button className="mobile-menu-btn" onClick={() => setShowMobileMenu(!showMobileMenu)} aria-label="Toggle Menu">
            ☰
          </button>
          
          <div className="desktop-actions">
            <button
              onClick={() => startAppTour(true)}
              className="btn btn-ghost"
              style={{ padding: '6px 10px', minHeight: '34px', fontSize: '0.78rem', fontWeight: 700 }}
              title="Replay App Tour"
            >
              <span>🧭</span> <span>Tour</span>
            </button>
            <button
              onClick={() => {
                if (deferredPrompt) {
                  handleInstallApp();
                } else {
                  setShowInstallModal(true);
                }
              }}
              className="btn btn-primary"
              style={{
                padding: '6px 10px',
                minHeight: '34px',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: '8px',
                backgroundColor: '#0284c7',
                borderColor: '#0369a1',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(2, 132, 199, 0.2)'
              }}
              title="Install Mobile PWA App onto Home Screen"
              aria-label="Install App"
            >
              <span>📲</span> <span>Install App</span>
            </button>
            <button
              onClick={() => setActiveTab('emergency')}
              style={{
                padding: '6px 12px',
                minHeight: '34px',
                fontSize: '0.8rem',
                fontWeight: 800,
                borderRadius: '8px',
                border: '2px solid #ef4444',
                backgroundColor: activeTab === 'emergency' ? '#dc2626' : '#fff5f5',
                color: activeTab === 'emergency' ? '#ffffff' : '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                transition: 'all 0.2s ease'
              }}
              title="Emergency Medical ID & Doctor Export Report"
            >
              <span>🆘</span> <span style={{ fontWeight: 800 }}>Emergency ID</span>
            </button>
            <button onClick={() => setActiveTab('settings')} className="btn btn-ghost" style={{ padding: '8px', minHeight: '40px', color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-secondary)' }} title="Settings" aria-label="Settings">
              <SettingsIcon size={20} />
            </button>
            <button onClick={handleLogout} className="btn btn-ghost" style={{ padding: '8px', minHeight: '40px' }} aria-label="Sign Out" title="Sign Out">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        <div className={`mobile-drawer ${showMobileMenu ? 'open' : ''}`}>
           <button onClick={() => { startAppTour(true); setShowMobileMenu(false); }} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>🧭 Replay Tour</button>
           <button onClick={() => { 
             if (deferredPrompt) handleInstallApp(); else setShowInstallModal(true);
             setShowMobileMenu(false); 
           }} className="btn btn-primary" style={{ width: '100%', justifyContent: 'flex-start' }}>📲 Install App</button>
           <button onClick={() => { setActiveTab('emergency'); setShowMobileMenu(false); }} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger)' }}>🆘 Emergency ID</button>
           <button onClick={() => { setActiveTab('settings'); setShowMobileMenu(false); }} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-primary)' }}><SettingsIcon size={18} /> Settings</button>
           <button onClick={() => { handleLogout(); setShowMobileMenu(false); }} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger)' }}><LogOut size={18} /> Sign Out</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* PWA Install Banner */}
        {showInstallBanner && (
          <div className="install-banner">
            <div className="install-text">
              <h3>Install App</h3>
              <p>Add to home screen for quick access.</p>
            </div>
            <button className="btn btn-primary" style={{ padding: '10px 14px', minHeight: '40px', fontSize: '0.85rem' }} onClick={handleInstallApp}>
              <Download size={15} /> Install
            </button>
          </div>
        )}

        {/* PWA Installation Guide Modal */}
        {showInstallModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div className="card" style={{ maxWidth: '460px', width: '100%', backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
              <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📲 Install AI Health Brain
                </h3>
                <button type="button" onClick={() => setShowInstallModal(false)} className="btn btn-ghost" style={{ fontSize: '1.2rem', padding: '4px 8px', fontWeight: 800 }}>✕</button>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                AI Health Brain is a production-ready Progressive Web App (PWA) with Service Worker offline caching! Follow instructions below to pin to your device home screen:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginBottom: '4px' }}>🍎 iOS (iPhone & iPad Safari)</strong>
                  <span style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>1. Tap the <strong>Share</strong> icon at the bottom of Safari.<br/>2. Scroll down and tap <strong>"Add to Home Screen ➕"</strong>.</span>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginBottom: '4px' }}>🤖 Android (Chrome / Edge / Samsung Internet)</strong>
                  <span style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>1. Tap the <strong>Three Dots Menu (⋮)</strong> at top right.<br/>2. Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</span>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginBottom: '4px' }}>💻 Desktop (Chrome, Edge & Brave)</strong>
                  <span style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>Click the small <strong>Install Monitor Icon 🖥️</strong> on the far right of your URL Address Bar at the top of your browser!</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <button type="button" onClick={() => setShowInstallModal(false)} className="btn btn-primary" style={{ padding: '10px 20px', fontWeight: 700, width: '100%' }}>
                  Got It, Thanks!
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Profile Loading */}
        {profileLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <div className="spinner" />
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <div data-tour="dashboard-view">
                <HomeTab
                  profile={profile}
                  symptoms={symptoms}
                  visits={visits}
                  vitals={vitals}
                  onEditProfile={() => setShowEditProfile(true)}
                  onAddSymptom={() => { setActiveTab('symptoms'); }}
                  onAddVisit={() => { setActiveTab('visits'); }}
                  onOpenMedications={() => { setActiveTab('medications'); }}
                  onOpenVitals={() => { setActiveTab('vitals'); }}
                  onOpenEmergency={() => { setActiveTab('emergency'); }}
                />
              </div>
            )}
            {activeTab === 'vault' && (
              <div data-tour="upload-tab">
                <VaultTab
                vaultFiles={vaultFiles}
                onAddVaultFile={addVaultFile}
                onDeleteVaultFile={deleteVaultFile}
              />
              </div>
            )}
            {activeTab === 'symptoms' && (
              <SymptomsTab
                symptoms={symptoms}
                onLogSymptom={logSymptom}
                onDeleteSymptom={deleteSymptom}
              />
            )}
            {activeTab === 'visits' && (
              <VisitsTab
                visits={visits}
                onLogVisit={logVisit}
                onDeleteVisit={deleteVisit}
              />
            )}
            {activeTab === 'analyzer' && (
              <AnalyzerTab
                vaultFiles={vaultFiles}
                profile={profile}
                saveProfile={saveProfile}
                onAddVaultFile={addVaultFile}
              />
            )}
            {activeTab === 'chat' && (
              <div data-tour="chat-tab">
                <ChatTab
                profile={profile}
                symptoms={symptoms}
                visits={visits}
                vaultFiles={vaultFiles}
                vitals={vitals}
                  onLogSymptom={logSymptom}
                />
              </div>
            )}
            {activeTab === 'medications' && (
              <MedicationsTab
                profile={profile}
                saveProfile={saveProfile}
              />
            )}
            {activeTab === 'vitals' && (
              <div data-tour="history-tab">
                <VitalsTab
                profile={profile}
                vitals={vitals}
                symptoms={symptoms}
                onLogVital={logVital}
                onDeleteVital={deleteVital}
                  onLogSymptom={logSymptom}
                />
              </div>
            )}
            {activeTab === 'emergency' && (
              <EmergencyTab
                profile={profile}
                symptoms={symptoms}
                visits={visits}
                vaultFiles={vaultFiles}
                vitals={vitals}
                saveProfile={saveProfile}
              />
            )}
            {activeTab === 'settings' && (
              <div data-tour="settings-tab">
                <div className="card">
                  <h2 className="section-title"><SettingsIcon style={{ color: 'var(--primary)' }} />Settings</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="list-item-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>Signed in as</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                      </div>
                      <span className="badge badge-success">Active</span>
                    </div>
                    <div className="list-item-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>Health Profile</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {profile?.name || 'Not set up yet'}
                        </div>
                      </div>
                      <button className="btn btn-secondary" style={{ padding: '8px 14px', minHeight: '36px', fontSize: '0.85rem' }} onClick={() => setShowEditProfile(true)}>
                        Edit
                      </button>
                    </div>
                    <div className="list-item-row" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--danger)' }}>Sign Out</div>
                      <button className="btn btn-danger" style={{ padding: '8px 14px', minHeight: '36px', fontSize: '0.85rem' }} onClick={handleLogout}>
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                    <div className="list-item-row" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <div style={{ fontWeight: 600 }}>App Feedback</div>
                      <a href="mailto:support@aihealthbrain.com?subject=App Feedback" className="btn btn-ghost" style={{ padding: '8px 14px', minHeight: '36px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        💬 Send Feedback
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav" data-tour="tab-navigation">
        {[
          { id: 'home', icon: Heart, label: 'Home' },
          { id: 'vitals', icon: Activity, label: 'Vitals' },
          { id: 'medications', icon: Pill, label: 'Meds' },
          { id: 'chat', icon: Bot, label: 'Assistant' },
          { id: 'analyzer', icon: Sparkles, label: 'Lab AI' },
          { id: 'vault', icon: Folder, label: 'Vault' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`nav-item ${activeTab === id ? 'nav-item-active' : ''}`}
            onClick={() => setActiveTab(id)}
            aria-label={label}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
