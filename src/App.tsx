import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, AppSettings } from '@/src/types';
import Login from '@/src/components/Auth/Login';
import Register from '@/src/components/Auth/Register';
import AdminDashboard from '@/src/components/Dashboard/AdminDashboard';
import SpecialistStoreDashboard from '@/src/components/Dashboard/SpecialistStoreDashboard';
import SantanderSpecialistDashboard from '@/src/components/Dashboard/SantanderSpecialistDashboard';
import LeaderDashboard from '@/src/components/Dashboard/LeaderDashboard';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // Check local storage for session (simplified for prototype)
      const savedUser = localStorage.getItem('simulador_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        // Refresh user data to get latest relations (like store info)
        const { data: freshUser } = await supabase
          .from('users')
          .select('*, store:stores(*)')
          .eq('id', parsed.id)
          .single();
        
        if (freshUser) {
          setUser(freshUser);
          localStorage.setItem('simulador_user', JSON.stringify(freshUser));
        } else {
          setUser(parsed);
        }
      }

      // Fetch settings
      const { data } = await supabase.from('settings').select('*').single();
      if (data) setSettings(data);
      
      setLoading(false);
    }
    init();
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('simulador_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('simulador_user');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key={isRegistering ? 'register' : 'login'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center p-4 min-h-screen"
          >
            {isRegistering ? (
              <Register 
                onRegister={handleLogin} 
                onBack={() => setIsRegistering(false)} 
                logoUrl={settings?.logo_url}
              />
            ) : (
              <Login 
                onLogin={handleLogin} 
                onRegisterClick={() => setIsRegistering(true)}
                logoUrl={settings?.logo_url}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-screen flex flex-col"
          >
            {user.profile === 'Administrador' && (
              <AdminDashboard user={user} onLogout={handleLogout} />
            )}
            {user.profile === 'Especialista de loja' && (
              <SpecialistStoreDashboard user={user} onLogout={handleLogout} />
            )}
            {user.profile === 'Especialista Santander' && (
              <SantanderSpecialistDashboard user={user} onLogout={handleLogout} />
            )}
            {user.profile === 'Líder' && (
              <LeaderDashboard user={user} onLogout={handleLogout} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
