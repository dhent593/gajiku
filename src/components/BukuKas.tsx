import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { parseExcelKas } from '../utils/excelParser';
import type { ParsedKasEntry } from '../utils/excelParser';
import { formatRupiah } from './SlipGaji';
import { 
  Upload, Download, Search, Plus, Edit2, Trash2, Calendar, Link, Check, AlertCircle, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface BukuKasProps {
  adminEmail: string;
}

interface KasEntry extends ParsedKasEntry {
  id: string;
  urut?: number;
  created_at?: string;
}

export const BukuKas: React.FC<BukuKasProps> = ({ adminEmail }) => {
  const [entries, setEntries] = useState<KasEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [sortBy, setSortBy] = useState('excel-asc');
  
  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KasEntry | null>(null);
  
  // Status message state
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  // Form states
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formType, setFormType] = useState<'masuk' | 'keluar'>('keluar');
  const [formJumlah, setFormJumlah] = useState('');
  const [formBuktiTransfer, setFormBuktiTransfer] = useState('');
  const [formCatatan, setFormCatatan] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    if (type !== 'error') {
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const loadEntries = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('kas_entries')
          .select('*')
          .order('tanggal', { ascending: true })
          .order('urut', { ascending: true });

        if (error) throw error;
        setEntries(data || []);
      } else {
        // Local fallback storage
        const localData = localStorage.getItem('gajiku_local_kas');
        if (localData) {
          setEntries(JSON.parse(localData));
        } else {
          setEntries([]);
        }
      }
    } catch (err: any) {
      console.error('Error loading kas entries:', err);
      showStatus('error', 'Gagal memuat data kas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  // Format date helper for displaying (DD-MM-YYYY)
  const formatDateIndo = (dateStr: string): string => {
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

    if (!window.confirm(`Apakah Anda yakin ingin mengimpor data kas dari file "${file.name}"?\nIni akan menggabungkan atau memperbarui data kas saat ini.`)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSyncing(true);
    showStatus('info', 'Membaca dan memproses file Excel Kas...');

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
      const parsedEntries = await parseExcelKas(arrayBuffer);

      if (parsedEntries.length === 0) {
        throw new Error('Tidak ada data transaksi kas yang valid ditemukan di sheet KESELURUHAN.');
      }

      showStatus('info', `Berhasil memproses ${parsedEntries.length} transaksi. Menyinkronkan ke database...`);

      if (isSupabaseConfigured) {
        // Clear all existing kas entries first (for overall sheet import)
        const { error: deleteError } = await supabase
          .from('kas_entries')
          .delete()
          .not('id', 'is', null);

        if (deleteError) throw deleteError;

        // Insert in bulk
        const { error: insertError } = await supabase
          .from('kas_entries')
          .insert(
            parsedEntries.map((item, index) => ({
              tanggal: item.tanggal,
              keterangan: item.keterangan,
              uang_masuk: item.uang_masuk,
              uang_keluar: item.uang_keluar,
              saldo_akhir: item.saldo_akhir,
              bukti_transfer: item.bukti_transfer,
              catatan: item.catatan,
              urut: index
            }))
          );

        if (insertError) throw insertError;
        showStatus('success', `Berhasil mengimpor ${parsedEntries.length} data kas ke database Supabase!`);
      } else {
        // Offline demo fallback
        const mockEntriesWithId: KasEntry[] = parsedEntries.map((item, index) => ({
          ...item,
          id: crypto.randomUUID(),
          urut: index
        }));
        localStorage.setItem('gajiku_local_kas', JSON.stringify(mockEntriesWithId));
        showStatus('success', `[Offline Demo] Berhasil mengimpor ${parsedEntries.length} data kas ke penyimpanan lokal.`);
      }

      await loadEntries();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Import Kas gagal: ' + err.message);
    } finally {
      setSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open Form for Adding New Transaction
  const handleOpenAddModal = () => {
    setEditingEntry(null);
    setFormTanggal(new Date().toISOString().split('T')[0]);
    setFormKeterangan('');
    setFormType('keluar');
    setFormJumlah('');
    setFormBuktiTransfer('');
    setFormCatatan('');
    setShowFormModal(true);
  };

  // Open Form for Editing Existing Transaction
  const handleOpenEditModal = (entry: KasEntry) => {
    setEditingEntry(entry);
    setFormTanggal(entry.tanggal);
    setFormKeterangan(entry.keterangan);
    if (entry.uang_masuk > 0) {
      setFormType('masuk');
      setFormJumlah(entry.uang_masuk.toString());
    } else {
      setFormType('keluar');
      setFormJumlah(entry.uang_keluar.toString());
    }
    setFormBuktiTransfer(entry.bukti_transfer || '');
    setFormCatatan(entry.catatan || '');
    setShowFormModal(true);
  };

  // Save (Create/Update) Transaction Form
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKeterangan.trim() || !formJumlah) {
      alert('Keterangan dan Jumlah Uang wajib diisi!');
      return;
    }

    const jumlahNum = parseFloat(formJumlah);
    if (isNaN(jumlahNum) || jumlahNum <= 0) {
      alert('Jumlah uang harus angka positif!');
      return;
    }

    setSyncing(true);
    const inVal = formType === 'masuk' ? jumlahNum : 0;
    const outVal = formType === 'keluar' ? jumlahNum : 0;

    try {
      if (isSupabaseConfigured) {
        if (editingEntry) {
          // Update
          const { error } = await supabase
            .from('kas_entries')
            .update({
              tanggal: formTanggal,
              keterangan: formKeterangan.trim(),
              uang_masuk: inVal,
              uang_keluar: outVal,
              bukti_transfer: formBuktiTransfer.trim(),
              catatan: formCatatan.trim()
            })
            .eq('id', editingEntry.id);

          if (error) throw error;
          showStatus('success', 'Berhasil memperbarui transaksi kas.');
        } else {
          // Create
          // Get next urut value for this date
          const nextUrut = entries.filter(e => e.tanggal === formTanggal).length;

          const { error } = await supabase
            .from('kas_entries')
            .insert({
              tanggal: formTanggal,
              keterangan: formKeterangan.trim(),
              uang_masuk: inVal,
              uang_keluar: outVal,
              bukti_transfer: formBuktiTransfer.trim(),
              catatan: formCatatan.trim(),
              urut: nextUrut
            });

          if (error) throw error;
          showStatus('success', 'Berhasil menambahkan transaksi kas baru.');
        }
      } else {
        // Offline local storage
        if (editingEntry) {
          const updated = entries.map(item => {
            if (item.id === editingEntry.id) {
              return {
                ...item,
                tanggal: formTanggal,
                keterangan: formKeterangan.trim(),
                uang_masuk: inVal,
                uang_keluar: outVal,
                bukti_transfer: formBuktiTransfer.trim(),
                catatan: formCatatan.trim()
              };
            }
            return item;
          });
          localStorage.setItem('gajiku_local_kas', JSON.stringify(updated));
          showStatus('success', 'Berhasil memperbarui transaksi kas (Offline).');
        } else {
          const nextUrut = entries.filter(e => e.tanggal === formTanggal).length;
          const newEntry: KasEntry = {
            id: crypto.randomUUID(),
            tanggal: formTanggal,
            keterangan: formKeterangan.trim(),
            uang_masuk: inVal,
            uang_keluar: outVal,
            saldo_akhir: 0, // dynamic running balance
            bukti_transfer: formBuktiTransfer.trim(),
            catatan: formCatatan.trim(),
            urut: nextUrut
          };
          const updated = [...entries, newEntry];
          localStorage.setItem('gajiku_local_kas', JSON.stringify(updated));
          showStatus('success', 'Berhasil menambahkan transaksi kas baru (Offline).');
        }
      }

      setShowFormModal(false);
      await loadEntries();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal menyimpan transaksi: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Delete Transaction
  const handleDeleteEntry = async (entry: KasEntry) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus transaksi "${entry.keterangan}" tanggal ${formatDateIndo(entry.tanggal)}?`)) {
      return;
    }

    setSyncing(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('kas_entries')
          .delete()
          .eq('id', entry.id);

        if (error) throw error;
        showStatus('success', 'Transaksi kas berhasil dihapus.');
      } else {
        const remaining = entries.filter(item => item.id !== entry.id);
        localStorage.setItem('gajiku_local_kas', JSON.stringify(remaining));
        showStatus('success', 'Transaksi kas berhasil dihapus (Offline).');
      }

      await loadEntries();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal menghapus transaksi: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteAllEntries = async () => {
    const confirm1 = window.confirm(
      "PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH data transaksi kas?\nTindakan ini akan mengosongkan seluruh buku kas dan tidak dapat dibatalkan."
    );
    if (!confirm1) return;

    const confirm2 = window.confirm(
      "KONFIRMASI TERAKHIR: Anda benar-benar yakin ingin menghapus semua data transaksi kas?"
    );
    if (!confirm2) return;

    setSyncing(true);
    showStatus('info', 'Sedang menghapus semua data transaksi kas...');

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('kas_entries')
          .delete()
          .not('id', 'is', null);

        if (error) throw error;
        showStatus('success', 'Berhasil menghapus seluruh data buku kas dari database Supabase.');
      } else {
        localStorage.removeItem('gajiku_local_kas');
        showStatus('success', '[Offline Demo] Berhasil mengosongkan seluruh data kas dari penyimpanan lokal.');
      }

      await loadEntries();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal mengosongkan data kas: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Excel Export handler
  const handleExportExcel = () => {
    if (filteredEntries.length === 0) {
      showStatus('error', 'Tidak ada data untuk diexport.');
      return;
    }

    try {
      // Build headers and sheet data
      const dataToExport = filteredEntries.map((item, index) => ({
        'No': index + 1,
        'Tanggal': formatDateIndo(item.tanggal),
        'Keterangan': item.keterangan,
        'Uang Masuk': item.uang_masuk > 0 ? item.uang_masuk : '',
        'Uang Keluar': item.uang_keluar > 0 ? item.uang_keluar : '',
        'Saldo Akhir': item.saldo_akhir,
        'Bukti Transfer': item.bukti_transfer,
        'Catatan': item.catatan
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'KAS KESELURUHAN');

      // Save file
      const dateTag = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Laporan_Kas_Senndyt_${dateTag}.xlsx`);
      showStatus('success', 'Laporan kas berhasil diexport ke Excel!');
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal mengexport data ke Excel: ' + err.message);
    }
  };

  // Get unique months from the date list for filters
  const getUniqueMonths = () => {
    const monthsSet = new Set<string>();
    entries.forEach(e => {
      if (e.tanggal) {
        // e.tanggal is YYYY-MM-DD
        const parts = e.tanggal.split('-');
        if (parts.length === 3) {
          const year = parts[0];
          const monthNum = parseInt(parts[1], 10);
          const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ];
          monthsSet.add(`${monthNames[monthNum - 1]} ${year}`);
        }
      }
    });
    return Array.from(monthsSet);
  };

  // Filter entry helper logic
  const monthsAvailable = getUniqueMonths();

  const filteredEntries = entries.filter(item => {
    // 1. Search term check
    const matchSearch = item.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (item.catatan && item.catatan.toLowerCase().includes(searchTerm.toLowerCase()));

    // 2. Month filter check
    if (!matchSearch) return false;
    if (selectedMonth === 'ALL') return true;

    // selectedMonth is "MonthName Year"
    const parts = item.tanggal.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthNum = parseInt(parts[1], 10);
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const entryMonthStr = `${monthNames[monthNum - 1]} ${year}`;
      return entryMonthStr === selectedMonth;
    }
    return false;
  });

  // Sort ALL entries chronologically first for running balance calculation to be mathematically correct!
  const sortedChronologically = [...entries].sort((a, b) => {
    const dateCompare = a.tanggal.localeCompare(b.tanggal);
    if (dateCompare !== 0) return dateCompare;
    const urutA = a.urut !== undefined ? a.urut : 0;
    const urutB = b.urut !== undefined ? b.urut : 0;
    return urutA - urutB;
  });

  let runningBalance = 0;

  if (sortedChronologically.length > 0) {
    const firstEntry = sortedChronologically[0];
    if (firstEntry.uang_masuk === 0 && firstEntry.uang_keluar === 0 && firstEntry.saldo_akhir !== 0) {
      runningBalance = firstEntry.saldo_akhir;
    }
  }

  const entriesWithRunningBalance = sortedChronologically.map((item, index) => {
    if (index === 0 && item.uang_masuk === 0 && item.uang_keluar === 0 && item.saldo_akhir !== 0) {
      return {
        ...item,
        saldo_akhir: runningBalance
      };
    }
    
    runningBalance = runningBalance + item.uang_masuk - item.uang_keluar;
    return {
      ...item,
      saldo_akhir: runningBalance
    };
  });

  // Re-filter the entries that now contain computed running balances
  const displayEntries = entriesWithRunningBalance.filter(item => {
    const matchSearch = item.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (item.catatan && item.catatan.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchSearch) return false;
    if (selectedMonth === 'ALL') return true;

    const parts = item.tanggal.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthNum = parseInt(parts[1], 10);
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const entryMonthStr = `${monthNames[monthNum - 1]} ${year}`;
      return entryMonthStr === selectedMonth;
    }
    return false;
  });

  // Sort display entries based on user selection
  const sortedDisplayEntries = [...displayEntries].sort((a, b) => {
    if (sortBy === 'excel-asc') {
      const urutA = a.urut !== undefined ? a.urut : 0;
      const urutB = b.urut !== undefined ? b.urut : 0;
      return urutA - urutB;
    }
    if (sortBy === 'excel-desc') {
      const urutA = a.urut !== undefined ? a.urut : 0;
      const urutB = b.urut !== undefined ? b.urut : 0;
      return urutB - urutA;
    }
    if (sortBy === 'date-desc') {
      const dateCompare = b.tanggal.localeCompare(a.tanggal);
      if (dateCompare !== 0) return dateCompare;
      const urutA = a.urut !== undefined ? a.urut : 0;
      const urutB = b.urut !== undefined ? b.urut : 0;
      return urutB - urutA;
    }
    if (sortBy === 'date-asc') {
      const dateCompare = a.tanggal.localeCompare(a.tanggal);
      if (dateCompare !== 0) return dateCompare;
      const urutA = a.urut !== undefined ? a.urut : 0;
      const urutB = b.urut !== undefined ? b.urut : 0;
      return urutA - urutB;
    }
    if (sortBy === 'masuk-desc') {
      return b.uang_masuk - a.uang_masuk;
    }
    if (sortBy === 'keluar-desc') {
      return b.uang_keluar - a.uang_keluar;
    }
    return 0;
  });

  const totalIn = displayEntries.reduce((sum, e) => sum + e.uang_masuk, 0);
  const totalOut = displayEntries.reduce((sum, e) => sum + e.uang_keluar, 0);
  // Current overall balance is the last balance of the chronological list
  const currentTotalBalance = entriesWithRunningBalance.length > 0 
    ? entriesWithRunningBalance[entriesWithRunningBalance.length - 1].saldo_akhir 
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Upload Zone & Status Card */}
      <div className="grid-two-cols" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem'
      }}>
        {/* Upload Excel Card */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '1rem' }}>
            Import Laporan Kas Baru (.xlsx / .xls)
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
              Klik untuk mengunggah file Excel Kas
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Pastikan sheet berisi tabel bernama **KAS KESELURUHAN TH 2025**
            </p>
          </div>
        </div>

        {/* Database Status & Toast */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '0.25rem' }}>
              Koneksi Buku Kas
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
                onClick={loadEntries} 
                disabled={loading || syncing} 
                style={{ padding: '0.25rem 0.5rem' }}
                title="Reload data kas"
              >
                <RefreshCw size={12} className={loading ? 'spin-effect' : ''} />
              </button>
            </div>
          </div>

          {/* Kelola Data Kas (Hapus Semua) */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9375rem', color: '#1e3a8a', marginBottom: '0.5rem', fontWeight: 600 }}>
              Kelola Data Kas
            </h4>
            {entries.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontStyle: 'italic', margin: 0 }}>
                Belum ada data kas terdaftar.
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteAllEntries}
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
                Kosongkan Seluruh Data Kas
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

      {/* Summary Stats Row */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon stat-icon-emerald">
            <Check size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Uang Masuk</span>
            <span className="stat-value" style={{ color: '#10b981' }}>{formatRupiah(totalIn)}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon stat-icon-blue" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Uang Keluar</span>
            <span className="stat-value" style={{ color: '#ef4444' }}>{formatRupiah(totalOut)}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon stat-icon-teal" style={{ color: currentTotalBalance >= 0 ? '#0d9488' : '#ef4444', backgroundColor: currentTotalBalance >= 0 ? 'rgba(13, 148, 136, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Saldo Kas Akhir (Total)</span>
            <span className="stat-value" style={{ color: currentTotalBalance >= 0 ? '#0d9488' : '#ef4444' }}>
              {formatRupiah(currentTotalBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Control Panel (Search, Filter, Manual Input, Export) */}
      <div className="glass-card filter-print-panel">
        <div className="filter-section">
          {/* Search box */}
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input 
              type="text"
              className="form-input"
              placeholder="Cari keterangan / catatan kas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Month selector */}
          <div className="filter-select-wrapper">
            <select
              className="filter-select filter-select-element"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="ALL">Semua Periode / Bulan</option>
              {monthsAvailable.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Sort selector */}
          <div className="filter-select-wrapper">
            <select
              className="filter-select filter-select-element"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="excel-asc">Urutan Excel</option>
              <option value="excel-desc">Urutan Excel (Terbalik)</option>
              <option value="date-desc">Tanggal (Terbaru)</option>
              <option value="date-asc">Tanggal (Terlama)</option>
              <option value="masuk-desc">Uang Masuk (Terbesar)</option>
              <option value="keluar-desc">Uang Keluar (Terbesar)</option>
            </select>
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
            Export Excel
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={handleOpenAddModal}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Plus size={16} />
            Tambah Transaksi
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-card" style={{ padding: '1.5rem', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', color: '#1e3a8a' }}>Log Aliran Buku Kas</h3>
          <span className="badge badge-info">{sortedDisplayEntries.length} Baris Transaksi</span>
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            Memuat data catatan kas...
          </div>
        ) : sortedDisplayEntries.length === 0 ? (
          <div className="text-center" style={{ padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            Tidak ada transaksi kas ditemukan. Silakan upload file Excel atau tambah manual.
          </div>
        ) : (
          <div className="table-container">
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
                  <th className="text-center" style={{ width: '100px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedDisplayEntries.map((item, index) => (
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
                          <a href={item.bukti_transfer} target="_blank" rel="noopener noreferrer" title="Buka Link Bukti" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center' }}>
                            <Link size={14} style={{ marginRight: '2px' }} /> Link
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.bukti_transfer}</span>
                        )
                      ) : '-'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.catatan || '-'}</td>
                    <td className="text-center">
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.375rem' }}>
                        <button 
                          className="btn btn-outline btn-sm btn-icon"
                          onClick={() => handleOpenEditModal(item)}
                          title="Edit Transaksi"
                          style={{ padding: '0.25rem' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          className="btn btn-outline btn-sm btn-icon btn-danger"
                          onClick={() => handleDeleteEntry(item)}
                          title="Hapus Transaksi"
                          style={{ padding: '0.25rem', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Input Form Modal */}
      {showFormModal && (
        <div className="modal-overlay" onClick={() => setShowFormModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: '#1e3a8a' }}>{editingEntry ? 'Edit Transaksi Kas' : 'Tambah Transaksi Kas Baru'}</h3>
              <button 
                className="btn btn-outline btn-sm btn-icon" 
                onClick={() => setShowFormModal(false)}
                style={{ borderRadius: '50%', padding: '0.25rem 0.5rem', width: '32px', height: '32px' }}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry}>
              <div className="modal-body" style={{ backgroundColor: 'white', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Tanggal Transaksi</label>
                  <input 
                    type="date"
                    className="form-input"
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Keterangan / Transaksi</label>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Beli kertas print, Kas Masuk dari bank..."
                    value={formKeterangan}
                    onChange={(e) => setFormKeterangan(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Jenis Aliran Kas</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input 
                        type="radio" 
                        name="entry_type" 
                        checked={formType === 'masuk'} 
                        onChange={() => setFormType('masuk')} 
                      />
                      Uang Masuk (Pemasukan)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input 
                        type="radio" 
                        name="entry_type" 
                        checked={formType === 'keluar'} 
                        onChange={() => setFormType('keluar')} 
                      />
                      Uang Keluar (Pengeluaran)
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Jumlah Uang (Rp)</label>
                  <input 
                    type="number"
                    className="form-input"
                    placeholder="Masukkan jumlah nominal..."
                    value={formJumlah}
                    onChange={(e) => setFormJumlah(e.target.value)}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Link Bukti Transfer / Drive (Opsional)</label>
                  <input 
                    type="url"
                    className="form-input"
                    placeholder="Contoh: https://drive.google.com/file/..."
                    value={formBuktiTransfer}
                    onChange={(e) => setFormBuktiTransfer(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Catatan Tambahan (Opsional)</label>
                  <textarea 
                    className="form-input"
                    placeholder="Tulis catatan pendukung..."
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    rows={2}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '1rem 1.5rem' }}>
                <button 
                  type="button"
                  className="btn btn-outline" 
                  onClick={() => setShowFormModal(false)}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={syncing}
                >
                  {syncing ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
