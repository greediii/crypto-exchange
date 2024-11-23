import React, { useState, useEffect } from 'react';
import {
  ChakraProvider,
  ColorModeScript,
  IconButton,
  useToast,
  extendTheme,
} from '@chakra-ui/react';
import { Routes, Route } from 'react-router-dom';
import { FaCrown } from 'react-icons/fa';
import axios from 'axios';
import AuthPage from './components/AuthPage';
import ProfilePage from './components/ProfilePage';
import CryptoExchange from './components/CryptoExchange';
import AdminPanel from './components/AdminPanel';
import Settings from './components/Settings';
import WebSocketErrorBoundary from './components/WebSocketErrorBoundary';

// Add theme configuration
const config = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({ 
  config,
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'white',
      },
    },
  },
});

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('token')
  );
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole'));
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [currentView, setCurrentView] = useState('exchange');
  const toast = useToast();

  const handleAuthSuccess = (role) => {
    setIsAuthenticated(true);
    if (role) {
      setUserRole(role);
      localStorage.setItem('userRole', role);
    }
  };

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedRole = localStorage.getItem('userRole');
        
        console.log('Stored role:', storedRole);
        
        if (token) {
          if (storedRole) {
            setUserRole(storedRole);
          }
          
          const response = await axios.get('http://localhost:3001/api/profile', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          console.log('Server response role:', response.data.role);
          
          if (response.data && response.data.role) {
            setUserRole(response.data.role);
            localStorage.setItem('userRole', response.data.role);
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        setIsAuthenticated(false);
        setUserRole(null);
      }
    };

    if (isAuthenticated) {
      checkUserRole();
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    setIsAuthenticated(false);
    setUserRole(null);
    setShowAdminPanel(false);
    setCurrentView('exchange');
  };

  const renderContent = () => {
    if (!isAuthenticated) {
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    }

    if (showAdminPanel && userRole === 'owner') {
      return (
        <WebSocketErrorBoundary>
          <AdminPanel onClose={() => setShowAdminPanel(false)} />
        </WebSocketErrorBoundary>
      );
    }

    if (currentView === 'profile') {
      return (
        <ProfilePage
          onExchangeClick={() => setCurrentView('exchange')}
          userRole={userRole}
          onAdminClick={() => setShowAdminPanel(true)}
          onLogout={handleLogout}
        />
      );
    }

    return (
      <CryptoExchange
        onProfileClick={() => setCurrentView('profile')}
        userRole={userRole}
        onAdminClick={() => setShowAdminPanel(true)}
        onLogout={handleLogout}
      />
    );
  };

  console.log('Current userRole:', userRole);
  console.log('showAdminPanel:', showAdminPanel);

  return (
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <Routes>
        <Route path="/" element={
          <>
            {!isAuthenticated && <AuthPage onAuthSuccess={handleAuthSuccess} />}
            {isAuthenticated && !showAdminPanel && currentView === 'profile' && (
              <ProfilePage
                onExchangeClick={() => setCurrentView('exchange')}
                userRole={userRole}
                onAdminClick={() => setShowAdminPanel(true)}
                onLogout={handleLogout}
              />
            )}
            {isAuthenticated && !showAdminPanel && currentView === 'exchange' && (
              <CryptoExchange
                onProfileClick={() => setCurrentView('profile')}
                userRole={userRole}
                onAdminClick={() => setShowAdminPanel(true)}
                onLogout={handleLogout}
              />
            )}
            {isAuthenticated && showAdminPanel && (
              <WebSocketErrorBoundary>
                <AdminPanel onClose={() => setShowAdminPanel(false)} />
              </WebSocketErrorBoundary>
            )}
          </>
        } />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ChakraProvider>
  );
};

export default App;