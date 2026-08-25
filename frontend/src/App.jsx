import { useState, useEffect } from 'react';
import Login from './pages/Login';
import MainDashboard from './pages/MainDashboard';

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    const handleStorage = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    setToken(null);
  };

  if (!token) {
    return <Login onLoginSuccess={(newToken) => setToken(newToken)} />;
  }

  return <MainDashboard onLogout={handleLogout} />;
}

export default App;