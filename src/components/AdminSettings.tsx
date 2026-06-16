import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { Plus, Trash2, Shield, User, Key, RefreshCw, Lock } from 'lucide-react';

interface AdminSettingsProps {
  currentAdminEmail: string;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at?: string;
  password?: string;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ currentAdminEmail }) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const loadAdmins = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('allowed_admins')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) throw error;
        setAdmins(data || []);
      } else {
        // Local fallback
        const localAdmins = localStorage.getItem('sfin_local_admins');
        if (localAdmins) {
          setAdmins(JSON.parse(localAdmins));
        } else {
          // Initialize default offline admins
          const defaults: AdminUser[] = [
            { id: '1', email: 'admin@senndyt.com', role: 'superadmin' },
            { id: '2', email: 'arif.setiawan2209@gmail.com', role: 'superadmin' }
          ];
          localStorage.setItem('sfin_local_admins', JSON.stringify(defaults));
          setAdmins(defaults);
        }
      }
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal memuat daftar admin: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanPassword = newPassword.trim();
    if (!cleanEmail || !cleanPassword) return;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      showStatus('error', 'Format email tidak valid.');
      return;
    }

    if (cleanPassword.length < 6) {
      showStatus('error', 'Password minimal harus 6 karakter.');
      return;
    }

    // Check duplicate
    if (admins.some(admin => admin.email === cleanEmail)) {
      showStatus('error', 'Email ini sudah terdaftar sebagai admin.');
      return;
    }

    setAdding(true);
    try {
      if (isSupabaseConfigured) {
        // 1. Sign up the user in Supabase Auth using isolated temp client
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        const { error: authError } = await tempClient.auth.signUp({
          email: cleanEmail,
          password: cleanPassword
        });

        if (authError) throw authError;

        // 2. Insert email and role into allowed_admins
        const { error } = await supabase
          .from('allowed_admins')
          .insert({ email: cleanEmail, role: newRole });

        if (error) throw error;
        showStatus('success', `Berhasil mendaftarkan ${cleanEmail} ke Supabase Auth dan whitelist.`);
      } else {
        // Local storage write
        const newAdmin: AdminUser = {
          id: crypto.randomUUID(),
          email: cleanEmail,
          role: newRole,
          password: cleanPassword
        };
        const updated = [...admins, newAdmin];
        localStorage.setItem('sfin_local_admins', JSON.stringify(updated));
        showStatus('success', `[Offline] Berhasil mendaftarkan ${cleanEmail} dengan password.`);
      }

      setNewEmail('');
      setNewPassword('');
      await loadAdmins();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal menambahkan admin: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteAdmin = async (admin: AdminUser) => {
    if (admin.email === currentAdminEmail) {
      alert('Anda tidak bisa menghapus email Anda sendiri yang sedang aktif!');
      return;
    }

    const defaultSupers = ['admin@senndyt.com', 'arif.setiawan2209@gmail.com'];
    if (defaultSupers.includes(admin.email) && admin.role === 'superadmin') {
      if (!window.confirm(`PERINGATAN: ${admin.email} adalah superadmin bawaan. Anda yakin ingin menghapusnya?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Apakah Anda yakin ingin menghapus akses admin untuk ${admin.email}?`)) {
        return;
      }
    }

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('allowed_admins')
          .delete()
          .eq('id', admin.id);

        if (error) throw error;
        showStatus('success', `Berhasil menghapus akses admin untuk ${admin.email}.`);
      } else {
        const updated = admins.filter(item => item.id !== admin.id);
        localStorage.setItem('sfin_local_admins', JSON.stringify(updated));
        showStatus('success', `[Offline] Akses admin untuk ${admin.email} dihapus.`);
      }

      await loadAdmins();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal menghapus admin: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Add Admin Form & Overview info */}
      <div className="grid-two-cols" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem'
      }}>
        {/* Form Card */}
        <div className="glass-card" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} />
            Tambah User Admin Baru
          </h3>
          
          <form onSubmit={handleAddAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Email Admin</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  type="email"
                  className="form-input"
                  placeholder="Contoh: hrd@senndyt.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password Admin Baru</label>
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
                  placeholder="Min. 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Level Akses (Role)</label>
              <div style={{ position: 'relative' }}>
                <Key size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <select
                  className="form-input"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{ paddingLeft: '2.75rem', width: '100%', appearance: 'none', backgroundColor: 'white' }}
                >
                  <option value="admin">Administrator biasa</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={adding || !newEmail.trim()}
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              <Plus size={18} className="mr-1" />
              {adding ? 'Menyimpan...' : 'Daftarkan Admin'}
            </button>
          </form>
        </div>

        {/* Security Summary Box */}
        <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '0.75rem' }}>
              Keamanan Akun & Sesi
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
              Sistem whitelist menyaring email pengguna sebelum masuk. Hanya pengguna dengan email yang terdaftar di daftar di samping yang dapat mengelola data keuangan (Gaji, Kas, & Invoice).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <span className={`badge ${isSupabaseConfigured ? 'badge-success' : 'badge-warning'}`}>
                {isSupabaseConfigured ? 'Keamanan Online Supabase' : 'Keamanan Lokal Browser'}
              </span>
              <button 
                className="btn btn-outline btn-sm" 
                onClick={loadAdmins} 
                disabled={loading} 
                style={{ padding: '0.25rem 0.5rem' }}
                title="Reload whitelist admin"
              >
                <RefreshCw size={12} className={loading ? 'spin-effect' : ''} />
              </button>
            </div>
          </div>

          {statusMessage && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              backgroundColor: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: statusMessage.type === 'error' ? 'var(--error)' : 'var(--success)',
              border: `1px solid ${statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
              marginTop: 'auto'
            }}>
              {statusMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Admin List Table */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '1.25rem' }}>
          Daftar Putih (Whitelist) Admin Aktif
        </h3>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
            Memuat daftar admin...
          </p>
        ) : admins.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
            Tidak ada admin terdaftar.
          </p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>No</th>
                  <th>Alamat Email</th>
                  <th>Level Akses (Role)</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Status Sesi Anda</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin, idx) => {
                  const isCurrent = admin.email.toLowerCase() === currentAdminEmail.toLowerCase();
                  return (
                    <tr key={admin.id || idx}>
                      <td style={{ fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{admin.email}</td>
                      <td>
                        <span className={`badge ${admin.role === 'superadmin' ? 'badge-success' : 'badge-info'}`}>
                          {admin.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isCurrent ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                            Sedang Digunakan
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => handleDeleteAdmin(admin)}
                          disabled={isCurrent}
                          title={isCurrent ? 'Tidak bisa menghapus akun Anda sendiri' : 'Hapus akses admin ini'}
                          style={{
                            padding: '0.25rem',
                            borderRadius: '4px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isCurrent ? 0.4 : 1,
                            cursor: isCurrent ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
