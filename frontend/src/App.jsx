import { useState, useEffect } from 'react';
import Login from './pages/Login';
import MainDashboard from './pages/MainDashboard';
import authStorage from './config/storage';

function App() {
  const [token, setToken] = useState(() => authStorage.getToken());

  useEffect(() => {
    const handleStorage = () => {
      setToken(authStorage.getToken());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogout = () => {
    authStorage.clearSession();
    setToken(null);
  };

  if (!token) {
    return <Login onLoginSuccess={(newToken) => setToken(newToken)} />;
  }

  return <MainDashboard onLogout={handleLogout} />;
}

export default App;