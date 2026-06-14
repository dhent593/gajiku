import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { SlipGaji, formatRupiah } from './components/SlipGaji';
import type { SlipData } from './components/SlipGaji';
import { Landmark, ShieldAlert, Home, Calendar, Link as LinkIcon, TrendingUp, TrendingDown } from 'lucide-react';

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

// Public Kas Preview Page Component
const PublicKasPage: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const filterMonth = query.get('month') || 'ALL';

  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    const fetchKasData = async () => {
      try {
        let fetchedData: any[] = [];
        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from('kas_entries')
            .select('*')
            .order('tanggal', { ascending: true })
            .order('urut', { ascending: true });

          if (error) throw error;
          fetchedData = data || [];
        } else {
          // Local fallback
          const localData = localStorage.getItem('gajiku_local_kas');
          if (localData) {
            fetchedData = JSON.parse(localData);
          }
        }

        // Chronological balance calculations
        let runningBalance = 0;
        
        const sortedChronologically = [...fetchedData].sort((a, b) => {
          const dateCompare = a.tanggal.localeCompare(b.tanggal);
          if (dateCompare !== 0) return dateCompare;
          const urutA = a.urut !== undefined ? a.urut : 0;
          const urutB = b.urut !== undefined ? b.urut : 0;
          return urutA - urutB;
        });

        if (sortedChronologically.length > 0) {
          const firstEntry = sortedChronologically[0];
          if (firstEntry.uang_masuk === 0 && firstEntry.uang_keluar === 0 && firstEntry.saldo_akhir !== 0) {
            runningBalance = firstEntry.saldo_akhir;
          }
        }

        const entriesWithBalance = sortedChronologically.map((item, index) => {
          if (index === 0 && item.uang_masuk === 0 && item.uang_keluar === 0 && item.saldo_akhir !== 0) {
            return { ...item, saldo_akhir: runningBalance };
          }
          runningBalance = runningBalance + item.uang_masuk - item.uang_keluar;
          return { ...item, saldo_akhir: runningBalance };
        });

        setEntries(entriesWithBalance);
      } catch (err: any) {
        console.error(err);
        setError('Gagal memuat data buku kas.');
      } finally {
        setLoading(false);
      }
    };

    fetchKasData();
  }, []);

  const formatDateIndo = (dateStr: string): string => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Filter entries based on the URL parameter 'month'
  const filteredEntries = entries.filter(item => {
    if (filterMonth === 'ALL') return true;
    const parts = item.tanggal.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthNum = parseInt(parts[1], 10);
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const entryMonthStr = `${monthNames[monthNum - 1]} ${year}`;
      return entryMonthStr.toLowerCase() === filterMonth.toLowerCase();
    }
    return false;
  });

  const totalIn = filteredEntries.reduce((sum, e) => sum + e.uang_masuk, 0);
  const totalOut = filteredEntries.reduce((sum, e) => sum + e.uang_keluar, 0);
  const finalBalance = entries.length > 0 ? entries[entries.length - 1].saldo_akhir : 0;

  if (loading) {
    return (
      <div className="public-slip-layout">
        <div className="glass-card text-center" style={{ padding: '3rem 2rem', maxWidth: '400px' }}>
          <p style={{ color: 'var(--text-muted)' }}>Memuat laporan kas resmi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-slip-layout">
        <div className="glass-card text-center" style={{ padding: '3rem 2rem', maxWidth: '480px' }}>
          <ShieldAlert size={48} style={{ color: 'var(--error)', margin: '0 auto 1.5rem' }} />
          <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Gagal Memuat Laporan</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{error}</p>
          <a href="/" className="btn btn-outline btn-sm">
            <Home size={16} className="mr-2" /> Kembali ke Beranda
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="public-slip-layout" style={{ backgroundColor: '#f8fafc', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '900px' }}>
        
        {/* Header Section */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', marginBottom: '0.5rem', display: 'inline-block' }}>Laporan Arus Kas</span>
              <h2 style={{ color: '#1e3a8a', fontSize: '1.5rem', margin: 0 }}>PT. Senndyt Sarungtangan Kreatif</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Periode Laporan: <strong>{filterMonth === 'ALL' ? 'Seluruh Tahun 2025/2026' : filterMonth}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Calendar size={16} />
              <span>Diperbarui: {new Date().toLocaleDateString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="glass-card stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-icon stat-icon-emerald" style={{ width: '42px', height: '42px' }}>
              <TrendingUp size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Uang Masuk</span>
              <span className="stat-value" style={{ color: '#10b981', fontSize: '1.125rem' }}>{formatRupiah(totalIn)}</span>
            </div>
          </div>

          <div className="glass-card stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-icon" style={{ width: '42px', height: '42px', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)' }}>
              <TrendingDown size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Uang Keluar</span>
              <span className="stat-value" style={{ color: '#ef4444', fontSize: '1.125rem' }}>{formatRupiah(totalOut)}</span>
            </div>
          </div>

          <div className="glass-card stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-icon stat-icon-teal" style={{ width: '42px', height: '42px', color: finalBalance >= 0 ? '#0d9488' : '#ef4444', backgroundColor: finalBalance >= 0 ? 'rgba(13, 148, 136, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
              <Landmark size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Saldo Kas Akhir (Total)</span>
              <span className="stat-value" style={{ color: finalBalance >= 0 ? '#0d9488' : '#ef4444', fontSize: '1.125rem' }}>{formatRupiah(finalBalance)}</span>
            </div>
          </div>
        </div>

        {/* Ledger Table & Cards */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '1.25rem' }}>Rincian Aliran Buku Kas</h3>
          
          {filteredEntries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
              Tidak ada catatan transaksi kas untuk periode ini.
            </p>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-container kas-desktop-table">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>No</th>
                      <th style={{ width: '110px' }}>Tanggal</th>
                      <th>Keterangan</th>
                      <th className="text-right">Uang Masuk</th>
                      <th className="text-right">Uang Keluar</th>
                      <th className="text-right">Saldo Akhir</th>
                      <th>Bukti</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((item, index) => (
                      <tr key={item.id || index}>
                        <td style={{ fontWeight: 600 }}>{index + 1}</td>
                        <td>{formatDateIndo(item.tanggal)}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{item.keterangan}</td>
                        <td className="text-right" style={{ color: item.uang_masuk > 0 ? '#10b981' : 'inherit', fontWeight: item.uang_masuk > 0 ? 600 : 'normal' }}>
                          {item.uang_masuk > 0 ? formatRupiah(item.uang_masuk) : '-'}
                        </td>
                        <td className="text-right" style={{ color: item.uang_keluar > 0 ? '#ef4444' : 'inherit', fontWeight: item.uang_keluar > 0 ? 600 : 'normal' }}>
                          {item.uang_keluar > 0 ? formatRupiah(item.uang_keluar) : '-'}
                        </td>
                        <td className="text-right" style={{ fontWeight: 600, color: item.saldo_akhir >= 0 ? 'var(--text-main)' : '#ef4444' }}>
                          {formatRupiah(item.saldo_akhir)}
                        </td>
                        <td>
                          {item.bukti_transfer ? (
                            item.bukti_transfer.startsWith('http') ? (
                              <a href={item.bukti_transfer} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', fontSize: '0.8rem' }}>
                                <LinkIcon size={12} style={{ marginRight: '2px' }} /> Link
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.bukti_transfer}</span>
                            )
                          ) : '-'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.catatan || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card-Based List View */}
              <div className="kas-card-list">
                {filteredEntries.map((item, index) => (
                  <div key={item.id || index} className="kas-mobile-card">
                    <div className="kas-mobile-header">
                      <div className="kas-mobile-title">{item.keterangan}</div>
                      <div className="kas-mobile-date">{formatDateIndo(item.tanggal)}</div>
                    </div>
                    
                    <div className="kas-mobile-amount-row">
                      <span className={`kas-mobile-badge ${item.uang_masuk > 0 ? 'masuk' : 'keluar'}`}>
                        {item.uang_masuk > 0 ? 'Masuk' : 'Keluar'}
                      </span>
                      <span className="kas-mobile-amount" style={{ color: item.uang_masuk > 0 ? '#10b981' : '#ef4444' }}>
                        {item.uang_masuk > 0 ? `+ ${formatRupiah(item.uang_masuk)}` : `- ${formatRupiah(item.uang_keluar)}`}
                      </span>
                    </div>

                    <div className="kas-mobile-balance-row" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <span>Saldo Akhir</span>
                      <strong style={{ color: item.saldo_akhir >= 0 ? 'var(--text-main)' : '#ef4444' }}>
                        {formatRupiah(item.saldo_akhir)}
                      </strong>
                    </div>

                    {item.bukti_transfer && (
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>Bukti:</span>
                        {item.bukti_transfer.startsWith('http') ? (
                          <a href={item.bukti_transfer} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                            Buka Link Bukti
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-main)' }}>{item.bukti_transfer}</span>
                        )}
                      </div>
                    )}

                    {item.catatan && (
                      <div className="kas-mobile-notes" style={{ marginTop: '0.25rem' }}>
                        <strong>Catatan:</strong> {item.catatan}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
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

        {/* Public Kas Preview Route */}
        <Route path="/kas/preview" element={<PublicKasPage />} />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
