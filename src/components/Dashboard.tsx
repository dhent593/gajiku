import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { parseExcelPayroll } from '../utils/excelParser';
import { EmployeeTable } from './EmployeeTable';
import { SlipGaji, formatRupiah } from './SlipGaji';
import type { SlipData } from './SlipGaji';
import { generateWhatsAppMessage, getWhatsAppWebLink } from '../utils/waHelper';
import { 
  Upload, LogOut, Users, Banknote, Landmark, RefreshCw, Printer, Calendar, Trash2
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface DashboardProps {
  adminEmail: string;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ adminEmail, onLogout }) => {
  const [slips, setSlips] = useState<SlipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedBulan, setSelectedBulan] = useState<string>('ALL');
  const [isPrintingAll, setIsPrintingAll] = useState<boolean>(false);
  
  // Modal State for Slip Preview
  const [previewSlip, setPreviewSlip] = useState<SlipData | null>(null);

  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMonthName, setImportMonthName] = useState<string>('');
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Hidden rendering state for background WA image generation
  const [renderingSlip, setRenderingSlip] = useState<SlipData | null>(null);
  const [generatingWAId, setGeneratingWAId] = useState<string | null>(null);

  // Status logs/messages
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Load data from Supabase or LocalStorage
  const loadSlips = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('slips')
          .select('*')
          .order('urut', { ascending: true });

        if (error) throw error;
        setSlips(data || []);
      } else {
        // Fallback local storage
        const localData = localStorage.getItem('gajiku_local_slips');
        if (localData) {
          setSlips(JSON.parse(localData));
        } else {
          setSlips([]);
        }
      }
    } catch (err: any) {
      console.error('Error loading slips:', err);
      showStatus('error', 'Gagal memuat data dari database: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlips();
  }, []);

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    // Auto clear info/success messages after 6 seconds
    if (type !== 'error') {
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showStatus('error', 'Format file salah. Mohon upload file Excel (.xlsx atau .xls)');
      return;
    }
    setImportFile(file);
    setSyncing(true);
    showStatus('info', 'Membaca file untuk mendeteksi periode...');

    try {
      const reader = new FileReader();
      const filePromise = new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = (e) => {
          if (e.target?.result instanceof ArrayBuffer) resolve(e.target.result);
          else reject(new Error('Gagal membaca data file.'));
        };
        reader.readAsArrayBuffer(file);
      });
      const arrayBuffer = await filePromise;
      const parsed = await parseExcelPayroll(arrayBuffer);
      if (parsed.length > 0) {
        setImportMonthName(parsed[0].bulan);
      } else {
        setImportMonthName('Juni 2026');
      }
      setShowImportModal(true);
    } catch (err: any) {
      console.error(err);
      setImportMonthName('Juni 2026');
      setShowImportModal(true);
    } finally {
      setSyncing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileSelected(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Process and import the Excel file with custom period name
  const processFile = async (file: File, customMonth: string) => {
    setSyncing(true);
    showStatus('info', `Mengimpor data gaji periode "${customMonth}"...`);

    try {
      const reader = new FileReader();
      
      const filePromise = new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = (e) => {
          if (e.target?.result instanceof ArrayBuffer) {
            resolve(e.target.result);
          } else {
            reject(new Error('Gagal membaca data file.'));
          }
        };
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
        reader.readAsArrayBuffer(file);
      });

      const arrayBuffer = await filePromise;
      const parsedSlips = await parseExcelPayroll(arrayBuffer, customMonth);

      if (parsedSlips.length === 0) {
        throw new Error('Tidak ada data karyawan yang valid ditemukan di file Excel.');
      }

      const importedMonth = customMonth;
      showStatus('info', `Berhasil memproses ${parsedSlips.length} data karyawan untuk periode ${importedMonth}. Menyinkronkan ke database...`);

      if (isSupabaseConfigured) {
        // 1. Delete existing records for this month to avoid duplicates
        const { error: deleteError } = await supabase
          .from('slips')
          .delete()
          .eq('bulan', importedMonth);

        if (deleteError) throw deleteError;

        // 2. Insert new records
        const { data: insertedData, error: insertError } = await supabase
          .from('slips')
          .insert(
            parsedSlips.map((s, index) => ({
              nik: s.nik,
              nama: s.nama,
              jabatan: s.jabatan,
              bulan: s.bulan,
              gaji_bersih: s.gaji_bersih,
              no_wa: s.no_wa,
              no_rek: s.no_rek,
              details: s.details,
              urut: index
            }))
          )
          .select();

        if (insertError) throw insertError;
        
        showStatus('success', `Berhasil mengimpor ${insertedData?.length || parsedSlips.length} data penggajian karyawan untuk periode ${importedMonth}!`);
      } else {
        // Local fallback storage
        const mockSlipsWithId: SlipData[] = parsedSlips.map((s, index) => ({
          ...s,
          id: crypto.randomUUID(),
          urut: index
        }));

        // Filter out old records for the same month
        const remainingLocal = slips.filter(s => s.bulan !== importedMonth);
        const newLocal = [...remainingLocal, ...mockSlipsWithId];
        
        localStorage.setItem('gajiku_local_slips', JSON.stringify(newLocal));
        showStatus('success', `[Offline Demo] Berhasil mengimpor ${mockSlipsWithId.length} data karyawan periode ${importedMonth} ke penyimpanan lokal.`);
      }

      // Reload dataset
      await loadSlips();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Proses import gagal: ' + err.message);
    } finally {
      setSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Perform background rendering and trigger WhatsApp chat link
  const handleSendWA = async (slip: SlipData) => {
    if (!slip.no_wa) {
      showStatus('error', `Gagal mengirim WA: Karyawan ${slip.nama} tidak memiliki nomor WhatsApp.`);
      return;
    }

    setGeneratingWAId(slip.id || slip.nik);
    setRenderingSlip(slip);

    // Wait a brief period for the hidden element to render in DOM
    await new Promise(resolve => setTimeout(resolve, 400));

    try {
      const captureEl = document.getElementById('hidden-slip-capture');
      if (!captureEl) throw new Error('Render element not found');

      // Generate Image
      const options = {
        scale: 2.2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      };
      
      const canvas = await html2canvas(captureEl, options);
      const imgData = canvas.toDataURL('image/png');

      // Download Image automatically
      const downloadLink = document.createElement('a');
      downloadLink.download = `Slip_${slip.nama.replace(/\s+/g, '_')}_${slip.bulan.replace(/\s+/g, '_')}.png`;
      downloadLink.href = imgData;
      downloadLink.click();

      // Attempt to copy image to clipboard
      try {
        canvas.toBlob(async (blob) => {
          if (blob) {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
          }
        });
      } catch (e) {
        console.warn('Image copy to clipboard unsupported or blocked');
      }

      // Format WhatsApp link with unique public online URL
      const publicUrl = slip.id 
        ? `${window.location.origin}/slip/${slip.id}`
        : `${window.location.origin}/slip/demo-${slip.nik}`;
      
      const waMsg = generateWhatsAppMessage(slip.nama, slip.bulan, publicUrl);
      const waLink = getWhatsAppWebLink(slip.no_wa, waMsg);

      // Open WA Web in a new tab
      window.open(waLink, '_blank');
      showStatus('success', `Gambar slip untuk ${slip.nama} telah terunduh. Dialihkan ke WhatsApp Web...`);
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal memproses pengiriman WhatsApp: ' + err.message);
    } finally {
      setRenderingSlip(null);
      setGeneratingWAId(null);
    }
  };

  const handlePrintAll = () => {
    setIsPrintingAll(true);
    setTimeout(() => {
      window.print();
      setIsPrintingAll(false);
    }, 500);
  };

  const handleDeleteMonth = async (month: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus semua data gaji untuk bulan "${month}"?\nTindakan ini akan menghapus semua slip karyawan di bulan tersebut dari database.`)) {
      return;
    }

    setSyncing(true);
    showStatus('info', `Menghapus data gaji bulan ${month}...`);

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('slips')
          .delete()
          .eq('bulan', month);

        if (error) throw error;
        showStatus('success', `Berhasil menghapus seluruh data gaji bulan ${month} dari database Supabase.`);
      } else {
        const remainingLocal = slips.filter(s => s.bulan !== month);
        localStorage.setItem('gajiku_local_slips', JSON.stringify(remainingLocal));
        showStatus('success', `[Offline Demo] Berhasil menghapus data gaji bulan ${month} dari penyimpanan lokal.`);
      }

      if (selectedBulan === month) {
        setSelectedBulan('ALL');
      }

      await loadSlips();
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Gagal menghapus data: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Stats calculation
  const months = ['ALL', ...Array.from(new Set(slips.map(s => s.bulan)))];
  
  const filteredForStats = slips.filter(s => selectedBulan === 'ALL' || s.bulan === selectedBulan);
  
  const totalEmployees = filteredForStats.length;
  const totalSalary = filteredForStats.reduce((sum, s) => sum + s.gaji_bersih, 0);
  const avgSalary = totalEmployees > 0 ? totalSalary / totalEmployees : 0;

  return (
    <div className="container dashboard-layout">
      {/* Header Bar */}
      <div className="header-bar no-print">
        <div>
          <h1 style={{ fontSize: '2.25rem', color: '#1e3a8a' }}>Gajiku Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>PT. Senndyt Sarungtangan Kreatif — Admin: {adminEmail}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => {
          if (window.confirm('Apakah Anda yakin ingin keluar dari portal Gajiku?')) {
            onLogout();
          }
        }}>
          <LogOut size={16} className="mr-2" />
          Keluar
        </button>
      </div>

      {/* Upload & Stat Grid */}
      <div className="no-print" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem'
      }}>
        {/* Upload Zone */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '1rem' }}>
            Import Data Penggajian Bulan Baru
          </h3>
          <div 
            className={`upload-zone ${dragActive ? 'dragging' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
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
              Drag & Drop file Excel di sini
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              atau klik untuk mencari file (.xlsx atau .xls)
            </p>
          </div>
        </div>

        {/* Info & Status Box */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', color: '#1e3a8a', marginBottom: '0.75rem' }}>
              Status Sistem & Database
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <span className={`badge ${isSupabaseConfigured ? 'badge-success' : 'badge-warning'}`}>
                {isSupabaseConfigured ? 'Supabase Terkoneksi' : 'Penyimpanan Lokal'}
              </span>
              <button 
                className="btn btn-outline btn-sm" 
                onClick={loadSlips} 
                disabled={loading || syncing} 
                style={{ padding: '0.25rem 0.5rem' }}
                title="Reload data"
              >
                <RefreshCw size={12} className={loading ? 'spin-effect' : ''} />
              </button>
            </div>
          </div>

          {/* Kelola Data Bulanan (List Month & Hapus) */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9375rem', color: '#1e3a8a', marginBottom: '0.75rem', fontWeight: 600 }}>
              Kelola Data Bulanan
            </h4>
            {months.filter(m => m !== 'ALL').length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>
                Belum ada data bulanan. Silakan import file Excel.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
                {months.filter(m => m !== 'ALL').map(month => {
                  const count = slips.filter(s => s.bulan === month).length;
                  return (
                    <div key={month} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.8125rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{month}</span>
                        <span className="badge badge-info" style={{ fontSize: '0.6875rem', padding: '0.125rem 0.375rem' }}>
                          {count} Slip
                        </span>
                      </div>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => handleDeleteMonth(month)}
                        disabled={syncing}
                        title={`Hapus semua data bulan ${month}`}
                        style={{ padding: '0.25rem', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Toast */}
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

      {/* Month Filter & Print Panel */}
      <div className="glass-card no-print" style={{ 
        padding: '1.25rem 1.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem',
        borderLeft: '4px solid var(--primary)',
        marginTop: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: 'var(--radius-sm)', 
            backgroundColor: 'var(--primary-glow)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--primary)',
            flexShrink: 0
          }}>
            <Calendar size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px', display: 'block' }}>
              Periode Penggajian (Bulan)
            </label>
            <select 
              className="filter-select"
              value={selectedBulan}
              onChange={(e) => setSelectedBulan(e.target.value)}
              style={{ width: '100%', maxWidth: '320px', border: '1px solid var(--border-color)', fontWeight: 500, marginTop: '0.25rem' }}
            >
              {months.map(m => (
                <option key={m} value={m}>{m === 'ALL' ? 'Semua Periode / Bulan' : m}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredForStats.length > 0 && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Menampilkan <strong>{filteredForStats.length}</strong> data slip gaji
            </span>
            <button 
              className="btn btn-primary" 
              onClick={handlePrintAll}
              style={{ 
                padding: '0.75rem 1.5rem', 
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600
              }}
            >
              <Printer size={18} />
              Cetak Semua Slip ({selectedBulan === 'ALL' ? 'Semua Bulan' : selectedBulan})
            </button>
          </div>
        )}
      </div>

      {/* Summary Widgets */}
      <div className="no-print">
        <div className="stats-grid">
          <div className="glass-card stat-card">
            <div className="stat-icon stat-icon-blue">
              <Users size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Karyawan</span>
              <span className="stat-value">{totalEmployees} Karyawan</span>
            </div>
          </div>

          <div className="glass-card stat-card">
            <div className="stat-icon stat-icon-emerald">
              <Banknote size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Gaji Dibayarkan</span>
              <span className="stat-value">{formatRupiah(totalSalary)}</span>
            </div>
          </div>

          <div className="glass-card stat-card">
            <div className="stat-icon stat-icon-teal">
              <Landmark size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Rata-rata Gaji</span>
              <span className="stat-value">{formatRupiah(avgSalary)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="no-print">
        {loading ? (
          <div className="glass-card text-center" style={{ padding: '4rem 1rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>Memuat data karyawan...</p>
          </div>
        ) : (
          <EmployeeTable 
            slips={filteredForStats} 
            onPreview={setPreviewSlip} 
            onSendWA={handleSendWA}
            generatingWAId={generatingWAId}
          />
        )}
      </div>

      {/* Hidden container for rendering WA images in background */}
      {renderingSlip && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '800px', pointerEvents: 'none' }}>
          <div id="hidden-slip-capture" style={{ background: '#ffffff', padding: '1rem' }}>
            <SlipGaji data={renderingSlip} />
          </div>
        </div>
      )}

      {/* Modal Overlay for Previewing and Printing a slip */}
      {previewSlip && (
        <div className="modal-overlay" onClick={() => setPreviewSlip(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: '#1e3a8a' }}>Detail Slip Gaji</h3>
              <button 
                className="btn btn-outline btn-sm btn-icon" 
                onClick={() => setPreviewSlip(null)}
                style={{ borderRadius: '50%', padding: '0.25rem 0.5rem', width: '32px', height: '32px' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <SlipGaji data={previewSlip} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setPreviewSlip(null)}>
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Customizing Period Name during Excel Import */}
      {showImportModal && importFile && (
        <div className="modal-overlay no-print" onClick={() => { setShowImportModal(false); setImportFile(null); }}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: '#1e3a8a' }}>Sesuaikan Periode Gaji</h3>
              <button 
                className="btn btn-outline btn-sm btn-icon" 
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                style={{ borderRadius: '50%', padding: '0.25rem 0.5rem', width: '32px', height: '32px' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ backgroundColor: 'white', padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>File Excel yang diupload:</p>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>{importFile.name}</p>
              </div>
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Nama Periode / Bulan Gaji</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Januari 2026"
                  value={importMonthName}
                  onChange={(e) => setImportMonthName(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block', lineHeight: 1.4 }}>
                  *Sesuaikan kolom ini jika pembayaran gaji mundur/terlambat (misal: gaji Januari baru dibayarkan awal Februari). Nama ini akan tertera di slips dan kelola data bulanan.
                </span>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '1rem 1.5rem' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
              >
                Batal
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (!importMonthName.trim()) {
                    alert('Nama periode tidak boleh kosong!');
                    return;
                  }
                  processFile(importFile, importMonthName.trim());
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                disabled={syncing}
              >
                Proses Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Area for All Slips */}
      {isPrintingAll && (
        <div className="print-all-area">
          {filteredForStats.map((slip, index) => (
            <React.Fragment key={slip.id || `${slip.nik}-${slip.bulan}`}>
              <div className="print-slip-wrapper">
                <SlipGaji data={slip} />
              </div>
              {index < filteredForStats.length - 1 && (
                <div className="print-cut-line">
                  <span>✂️ POTONG DI SINI untuk memisahkan slip gaji</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
