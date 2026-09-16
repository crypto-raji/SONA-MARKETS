import React, { lazy, Suspense, Component } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import Sidebar from './components/Sidebar.jsx';
import NavDrawer from './components/NavDrawer.jsx';
import LoadingState from './components/LoadingState.jsx';
import Login from './pages/Login.jsx';

// Lazy-load all page chunks — each page downloads only when first visited,
// cutting the initial JS parse cost from ~2 MB to ~400 KB.
const Home         = lazy(() => import('./pages/Home.jsx'));
const Markets      = lazy(() => import('./pages/Markets.jsx'));
const AssetDetails = lazy(() => import('./pages/AssetDetails.jsx'));
const Portfolio    = lazy(() => import('./pages/Portfolio.jsx'));
const Swap         = lazy(() => import('./pages/Swap.jsx'));
const Buy          = lazy(() => import('./pages/Buy.jsx'));
const Sell         = lazy(() => import('./pages/Sell.jsx'));
const Send         = lazy(() => import('./pages/Send.jsx'));
const Receive      = lazy(() => import('./pages/Receive.jsx'));
const Transactions = lazy(() => import('./pages/Transactions.jsx'));
const Profile      = lazy(() => import('./pages/Profile.jsx'));
const Settings     = lazy(() => import('./pages/Settings.jsx'));
const AIAssistantPage = lazy(() => import('./pages/AIAssistant.jsx'));

function PageFallback() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <LoadingState label="Loading…" />
    </div>
  );
}

// Catches chunk-load failures (e.g. network timeout on a lazy import)
// and lets the user retry instead of showing a blank crash screen.
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
          <div style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>Page failed to load.</div>
          <button className="btn btn-primary" onClick={() => { this.setState({ failed: false }); window.location.reload(); }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoutes() {
  return (
    <div className="app-shell">
      <Sidebar />
      <RouteErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/"               element={<Home />} />
          <Route path="/markets"        element={<Markets />} />
          <Route path="/asset/:symbol"  element={<AssetDetails />} />
          <Route path="/portfolio"      element={<Portfolio />} />
          <Route path="/swap"           element={<Swap />} />
          <Route path="/buy"            element={<Buy />} />
          <Route path="/sell"           element={<Sell />} />
          <Route path="/send"           element={<Send />} />
          <Route path="/receive"        element={<Receive />} />
          <Route path="/transactions"   element={<Transactions />} />
          <Route path="/profile"        element={<Profile />} />
          <Route path="/settings"       element={<Settings />} />
          <Route path="/ai-assistant"   element={<AIAssistantPage />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </RouteErrorBoundary>
      <NavDrawer />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return <ProtectedRoutes />;
}
