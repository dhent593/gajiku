import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { parseExcelInvoice } from '../utils/excelParser';
import type { ParsedInvoiceEntry } from '../utils/excelParser';
import { formatRupiah } from './SlipGaji';
import { 
  Upload, Download, Search, Trash2, FileText, Check, AlertCircle, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface InvoiceManagerProps {
  adminEmail: string;
}

interface InvoiceEntry extends ParsedInvoiceEntry {
  id: string;
  created_at?: string;
}

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({ adminEmail }) => {
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    if (type !== 'error') {
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const loadInvoices = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('invoice_entries')
          .select('*')
          .order('no', { ascending: true });

        if (error) throw error;
        
        // Convert DB format to local UI structure
        const mapped: InvoiceEntry[] = (data || []).map(item => ({
          ...item,
          keterangan: Array.isArray(item.keterangan) ? item.keterangan : [String(item.keterangan)]
        }));
        
        setInvoices(mapped);
      } else {
        // Local fallback storage
        const localData = localStorage.getItem('sfin_local_invoices');
        if (localData) {
          setInvoices(JSON.parse(localData));
        } else {
          setInvoices([]);
        }
      }
    } catch (err: any) {
      console.error('Error loading invoices:', err);
      showStatus('error', 'Gagal memuat data invoice: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const formatDateIndo = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Excel Import handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showStatus('error', 'Format file salah. Mohon upload file Excel (.xlsx atau .xls)');
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin mengimpor rekap invoice dari file "${file.name}"?\nTindakan ini akan menimpa data invoice saat ini.`)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSyncing(true);
    showStatus('info', 'Membaca dan memproses file Excel Invoice...');

    try {
      const reader = new FileReader();
      const filePromise = new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = (event) => {
          if (event.target?.result instanceof ArrayBuffer) resolve(event.target.result);
          else reject(new Error('Gagal membaca data file.'));
        };
        reader.readAsArrayBuffer(file);
      });

      const arrayBuffer = await filePromise;
      const parsedEntries = await parseExcelInvoice(arrayBuffer);

      if (parsedEntries.length === 0) {
        throw new Error('Tidak ada data invoice valid yang ditemukan di sheet penjualan.');
      }

      showStatus('info', `Berhasil memproses ${parsedEntries.length} invoice. Menyinkronkan...`);

      if (isSupabaseConfigured) {
        // Clear all existing invoice entries first (full overwrite)
        const { error: deleteError } = await supabase
          .from('invoice_entries')
          .delete()
          .not('id', 'is', null);

        if (deleteError) throw deleteError;

        // Insert in bulk
        const { error: insertError } = await supabase
          .from('invoice_entries')
          .insert(
            parsedEntries.map((item) => ({
              no: item.no,
              keterangan: item.keterangan,
              no_inv: item.no_inv,
              tanggal: item.tanggal,
              dpp_amount: item.dpp_amount,
              no_bukti_potong: item.no_bukti_potong,
              tanggal_bukti: item.tanggal_bukti,
              pph_amount: item.pph_amount,
              net_received: item.net_received,
              potongan_reject: item.potongan_reject
            }))
          );

        if (insertError) throw insertError;
        showStatus('success', `Berhasil mengimpor ${parsedEntries.length} data invoice ke database Supabase!`);
      } else {
        // Offline demo fallback
        const mockInvoicesWithId: InvoiceEntry[] = parsedEntries.map((item) => ({
          ...item,
          id: crypto.randomUUID()
        }));
        localStorage.setItem('sfin_local_invoices', JSON.stringify(mockInvoicesWithId));
        showStatus('success', `[Offline Demo] Berhasil mengimpor ${parsedEntries.length} data invoice ke penyimpanan lokal.`);
      }

      await loadInvoices();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Import Invoice gagal: ' + err.message);
    } finally {
      setSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete individual invoice
  const handleDeleteInvoice = async (invoice: InvoiceEntry) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus invoice No ${invoice.no_inv} untuk detail "${invoice.keterangan[0]}..."?`)) {
      return;
    }

    setSyncing(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('invoice_entries')
          .delete()
          .eq('id', invoice.id);

        if (error) throw error;
        showStatus('success', 'Invoice berhasil dihapus.');
      } else {
        const remaining = invoices.filter(item => item.id !== invoice.id);
        localStorage.setItem('sfin_local_invoices', JSON.stringify(remaining));
        showStatus('success', 'Invoice berhasil dihapus (Offline).');
      }

      await loadInvoices();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal menghapus invoice: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Delete all invoices
  const handleDeleteAllInvoices = async () => {
    const confirm1 = window.confirm(
      "PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH data invoice?\nTindakan ini akan mengosongkan seluruh rekapitulasi invoice penjualan dan tidak dapat dibatalkan."
    );
    if (!confirm1) return;

    setSyncing(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('invoice_entries')
          .delete()
          .not('id', 'is', null);

        if (error) throw error;
        showStatus('success', 'Berhasil mengosongkan data invoice dari database.');
      } else {
        localStorage.removeItem('sfin_local_invoices');
        localStorage.removeItem('gajiku_local_invoices'); // old key cleanup if any
        showStatus('success', '[Offline Demo] Berhasil mengosongkan data invoice dari penyimpanan lokal.');
      }

      await loadInvoices();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal mengosongkan data invoice: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (invoices.length === 0) {
      showStatus('error', 'Tidak ada data untuk diexport.');
      return;
    }

    try {
      const dataToExport = invoices.map((item) => ({
        'No': item.no,
        'Keterangan': item.keterangan.join(', '),
        'No Invoice': item.no_inv,
        'Tanggal': item.tanggal || '-',
        'DPP': item.dpp_amount,
        'No Bukti Potong PPh': item.no_bukti_potong || '-',
        'Tanggal Bukti Potong': item.tanggal_bukti || '-',
        'PPh 2%': item.pph_amount,
        'Net Diterima': item.net_received,
        'Potongan Reject': item.potongan_reject
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'REKAP INVOICE');

      const dateTag = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Rekapitulasi_Invoice_S-Fin_${dateTag}.xlsx`);
      showStatus('success', 'Data invoice berhasil diexport ke Excel!');
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal mengexport ke Excel: ' + err.message);
    }
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter(item => {
    const ketStr = item.keterangan.join(' ').toLowerCase();
    const invStr = item.no_inv.toLowerCase();
    const search = searchTerm.toLowerCase();
    return ketStr.includes(search) || invStr.includes(search);
  });

  // Calculate statistics
  const totalDPP = filteredInvoices.reduce((sum, item) => sum + item.dpp_amount, 0);
  const totalPPh = filteredInvoices.reduce((sum, item) => sum + item.pph_amount, 0);
  const totalNet = filteredInvoices.reduce((sum, item) => sum + item.net_received, 0);
  const totalReject = filteredInvoices.reduce((sum, item) => sum + item.potongan_reject, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Upload Zone & Connection Status */}
      <div className="grid-two-cols" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem'
      }}>
        {/* Upload Excel Invoice Card */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '1rem' }}>
            Import Laporan Invoice Baru (.xlsx / .xls)
          </h3>
          <div 
            className="upload-zone"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
              accept=".xlsx, .xls"
            />
            <Upload size={32} className="upload-icon" style={{ margin: '0 auto 1rem' }} />
            <p style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
              Klik untuk mengunggah berkas Excel Invoice
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Format data harus memiliki sheet **Inv Penjualan** dengan baris tabel mulai dari kolom B
            </p>
          </div>
        </div>

        {/* Database Status & Control Box */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '0.25rem' }}>
              Koneksi Invoice Penjualan
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Operator: {adminEmail}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <span className={`badge ${isSupabaseConfigured ? 'badge-success' : 'badge-warning'}`}>
                {isSupabaseConfigured ? 'Supabase Terkoneksi' : 'Penyimpanan Lokal (Offline)'}
              </span>
              <button 
                className="btn btn-outline btn-sm" 
                onClick={loadInvoices} 
                disabled={loading || syncing} 
                style={{ padding: '0.25rem 0.5rem' }}
                title="Reload data invoice"
              >
                <RefreshCw size={12} className={loading ? 'spin-effect' : ''} />
              </button>
            </div>
          </div>

          {/* Kelola Data (Kosongkan) */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9375rem', color: '#1e3a8a', marginBottom: '0.5rem', fontWeight: 600 }}>
              Kelola Data Invoice
            </h4>
            {invoices.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontStyle: 'italic', margin: 0 }}>
                Belum ada data invoice terdaftar.
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteAllInvoices}
                disabled={syncing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  backgroundColor: 'var(--error)',
                  color: 'white',
                  width: '100%',
                  justifyContent: 'center',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={14} />
                Kosongkan Seluruh Data Invoice
              </button>
            )}
          </div>

          {statusMessage && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              backgroundColor: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.1)',
              color: statusMessage.type === 'error' ? 'var(--error)' : statusMessage.type === 'success' ? 'var(--success)' : 'var(--primary)',
              border: `1px solid ${statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(37, 99, 235, 0.2)'}`,
              marginTop: 'auto'
            }}>
              {statusMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon stat-icon-blue">
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Nilai DPP</span>
            <span className="stat-value">{formatRupiah(totalDPP)}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)' }}>
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total PPh 2%</span>
            <span className="stat-value" style={{ color: '#d97706' }}>{formatRupiah(totalPPh)}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon stat-icon-emerald">
            <Check size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Jumlah Bersih Diterima</span>
            <span className="stat-value" style={{ color: '#10b981' }}>{formatRupiah(totalNet)}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)' }}>
            <Trash2 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Potongan Reject</span>
            <span className="stat-value" style={{ color: '#ef4444' }}>{formatRupiah(totalReject)}</span>
          </div>
        </div>
      </div>

      {/* Control Panel (Search & Export) */}
      <div className="glass-card filter-print-panel">
        <div className="filter-section">
          {/* Search box */}
          <div className="search-input-wrapper" style={{ flex: '1' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text"
              className="form-input"
              placeholder="Cari nomor invoice / keterangan penjualan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="actions-section">
          <button 
            className="btn btn-outline"
            onClick={handleExportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Download size={16} />
            Export ke Excel
          </button>
        </div>
      </div>

      {/* Invoice Table View */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', margin: 0 }}>Daftar Invoice Penjualan</h3>
          <span className="badge badge-info">{filteredInvoices.length} Invoice</span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
            Memuat data invoice...
          </p>
        ) : filteredInvoices.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
            Tidak ada transaksi invoice untuk pencarian ini. Silakan import berkas Excel.
          </p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>No</th>
                  <th style={{ width: '100px' }}>Tanggal</th>
                  <th style={{ width: '220px' }}>No Invoice</th>
                  <th>Keterangan Penjualan</th>
                  <th className="text-right">DPP (Gross)</th>
                  <th>Bukti Potong PPh 2%</th>
                  <th className="text-right">Potongan Reject</th>
                  <th className="text-right">Net Diterima</th>
                  <th style={{ width: '50px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((item) => (
                  <tr key={item.id || item.no}>
                    <td style={{ fontWeight: 600 }}>{item.no}</td>
                    <td>{formatDateIndo(item.tanggal)}</td>
                    <td style={{ fontWeight: 600, color: '#1e3a8a' }}>{item.no_inv}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {item.keterangan.map((line, idx) => (
                          <div key={idx} style={{ fontSize: '0.875rem', color: idx === 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                            {line}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="text-right" style={{ fontWeight: 500 }}>
                      {formatRupiah(item.dpp_amount)}
                    </td>
                    <td>
                      {item.pph_amount > 0 ? (
                        <div style={{ fontSize: '0.8125rem' }}>
                          <div style={{ fontWeight: 600, color: '#b45309' }}>
                            {formatRupiah(item.pph_amount)} (2%)
                          </div>
                          {item.no_bukti_potong && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                              No: {item.no_bukti_potong}
                            </div>
                          )}
                          {item.tanggal_bukti && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              Tgl: {formatDateIndo(item.tanggal_bukti)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>-</span>
                      )}
                    </td>
                    <td className="text-right" style={{ color: item.potongan_reject > 0 ? 'var(--error)' : 'inherit' }}>
                      {item.potongan_reject > 0 ? formatRupiah(item.potongan_reject) : '-'}
                    </td>
                    <td className="text-right" style={{ fontWeight: 600, color: 'var(--success)' }}>
                      {formatRupiah(item.net_received)}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => handleDeleteInvoice(item)}
                        disabled={syncing}
                        title="Hapus invoice ini"
                        style={{ padding: '0.25rem', borderRadius: '4px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
