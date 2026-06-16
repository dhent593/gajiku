import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Lock, Mail, AlertCircle, LogIn } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (userEmail: string, rememberMe: boolean) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Check if Supabase keys are configured
  const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Normalize email
    const cleanEmail = email.trim();

    if (!isSupabaseConfigured) {
      // Offline/Local Demo Mode Fallback
      setTimeout(() => {
        if (
          ((cleanEmail === 'admin@senndyt.com' || cleanEmail === 'admin') && (password === 'admin123' || password === 'palamana')) ||
          ((cleanEmail === 'arif.setiawan2209@gmail.com' || cleanEmail === 'arif') && password === 'palamana')
        ) {
          onLoginSuccess(cleanEmail, rememberMe);
        } else {
          setErrorMsg('Kredensial Demo salah. Periksa kembali email dan password Anda.');
        }
        setLoading(false);
      }, 800);
      return;
    }

    try {
      // Standard Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@senndyt.com`, // support logging in with just "admin" -> "admin@senndyt.com"
        password: password,
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        onLoginSuccess(data.user.email || cleanEmail, rememberMe);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal login. Periksa kembali email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative'
    }}>
      <div className="glass-card" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '2.5rem',
        zIndex: 10
      }}>
        <div className="text-center" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem', color: '#1e3a8a', marginBottom: '0.5rem' }}>S-Fin Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            PT. Senndyt Sarungtangan Kreatif
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div style={{
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.75rem',
            color: '#b45309',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Mode Demo Offline Aktif:</strong> Supabase URL/Key belum diset. Gunakan email <code>arif.setiawan2209@gmail.com</code> dan password <code>palamana</code> untuk menguji secara lokal.
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.8125rem',
            color: 'var(--error)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email / Username Admin</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                className="form-input"
                placeholder="Masukkan email atau username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.75rem' }}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.75rem' }}
                required
              />
            </div>
          </div>

          {/* Ingat Saya Checkbox */}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
              />
              Ingat Saya
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ padding: '0.875rem' }}
          >
            {loading ? (
              'Menghubungkan...'
            ) : (
              <>
                <LogIn size={18} />
                Masuk sebagai Admin
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
