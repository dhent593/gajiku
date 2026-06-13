import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { SlipGaji } from './components/SlipGaji';
import type { SlipData } from './components/SlipGaji';
import { Landmark, ShieldAlert, Home } from 'lucide-react';

// Public Slip View Page Component
const PublicSlipPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [slip, setSlip] = useState<SlipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    const fetchSlip = async () => {
      if (!id) {
        setError('ID slip tidak valid.');
        setLoading(false);
        return;
      }

      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from('slips')
            .select('*')
            .eq('id', id)
            .single();

          if (error) {
            throw new Error('Slip gaji tidak ditemukan atau database error.');
          }
          
          setSlip(data);
        } else {
          // Local offline fallback
          const localData = localStorage.getItem('gajiku_local_slips');
          if (localData) {
            const list = JSON.parse(localData) as SlipData[];
            const found = list.find(s => s.id === id || `demo-${s.nik}` === id);
            if (found) {
              setSlip(found);
            } else {
              throw new Error('Slip gaji tidak ditemukan di penyimpanan lokal.');
            }
          } else {
            throw new Error('Penyimpanan lokal kosong.');
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Gagal memuat slip gaji.');
      } finally {
        setLoading(false);
      }
    };

    fetchSlip();
  }, [id]);

  if (loading) {
    return (
      <div className="public-slip-layout">
        <div className="glass-card text-center" style={{ padding: '3rem 2rem', maxWidth: '400px' }}>
          <p style={{ color: 'var(--text-muted)' }}>Memuat data slip gaji resmi...</p>
        </div>
      </div>
    );
  }

  if (error || !slip) {
    return (
      <div className="public-slip-layout">
        <div className="glass-card text-center" style={{ padding: '3rem 2rem', maxWidth: '480px' }}>
          <ShieldAlert size={48} style={{ color: 'var(--error)', margin: '0 auto 1.5rem' }} />
          <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Akses Ditolak / Tidak Ditemukan</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {error || 'Detail slip gaji ini tidak valid atau telah dihapus oleh administrator.'}
          </p>
          <a href="/" className="btn btn-outline btn-sm">
            <Home size={16} className="mr-2" />
            Kembali ke Beranda Portal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="public-slip-layout" style={{ backgroundColor: '#f1f5f9' }}>
      <div style={{ width: '100%', maxWidth: '800px' }}>
        {/* Simple Top Banner */}
        <div className="no-print" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-md)'
        }}>
          <Landmark size={20} style={{ color: '#2563eb', flexShrink: 0 }} />
          <div style={{ fontSize: '0.75rem', color: '#1e3a8a' }}>
            Dokumen ini adalah slip gaji resmi **PT. Senndyt Sarungtangan Kreatif** bulan **{slip.bulan}** yang diproses secara elektronik.
          </div>
        </div>

        <SlipGaji data={slip} isPublicView={true} />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    const checkUser = async () => {
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        setAdminUser(session?.user?.email || null);
        
        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setAdminUser(session?.user?.email || null);
        });

        setLoading(false);
        return () => subscription.unsubscribe();
      } else {
        // Fallback local session - check localStorage first, then sessionStorage
        const localUser = localStorage.getItem('gajiku_local_session') || sessionStorage.getItem('gajiku_local_session');
        setAdminUser(localUser);
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const handleLoginSuccess = (email: string, rememberMe: boolean) => {
    setAdminUser(email);
    if (!isSupabaseConfigured) {
      if (rememberMe) {
        localStorage.setItem('gajiku_local_session', email);
      } else {
        sessionStorage.setItem('gajiku_local_session', email);
      }
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      sessionStorage.removeItem('gajiku_local_session');
      localStorage.removeItem('gajiku_local_session');
    }
    setAdminUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Memuat aplikasi...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Login Route */}
        <Route 
          path="/" 
          element={
            adminUser ? <Navigate to="/admin" replace /> : <Login onLoginSuccess={handleLoginSuccess} />
          } 
        />
        
        {/* Admin Dashboard Route */}
        <Route 
          path="/admin" 
          element={
            adminUser ? (
              <Dashboard adminEmail={adminUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        
        {/* Public Employee Slip Route */}
        <Route path="/slip/:id" element={<PublicSlipPage />} />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
