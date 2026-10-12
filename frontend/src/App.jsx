import { useState, useEffect } from 'react';
import Login from './pages/Login';
import MainDashboard from './pages/MainDashboard';
import SsoCallback, { SSO_CALLBACK_PATH } from './pages/SsoCallback';
import authStorage from './config/storage';
import signalRService from './services/signalrService';

import api from './config/api';

function App() {
  const [currentUser, setCurrentUser] = useState(() => authStorage.getUser());

  useEffect(() => {
    const handleStorage = () => {
      setCurrentUser(authStorage.getUser());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    authStorage.clearSession();
    signalRService.disconnect();
    setCurrentUser(null);
  };

  if (window.location.pathname === SSO_CALLBACK_PATH) {
    return <SsoCallback />;
  }

  if (!currentUser) {
    return <Login onLoginSuccess={() => setCurrentUser(authStorage.getUser())} />;
  }

  return <MainDashboard onLogout={handleLogout} />;
}

export default App;