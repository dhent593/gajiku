import React, { useState } from 'react';
import { Search, MessageSquare, Link as LinkIcon, Check, Eye } from 'lucide-react';
import { formatRupiah } from './SlipGaji';
import type { SlipData } from './SlipGaji';

interface EmployeeTableProps {
  slips: SlipData[];
  onPreview: (slip: SlipData) => void;
  onSendWA: (slip: SlipData) => Promise<void>;
  generatingWAId: string | null;
}

export const EmployeeTable: React.FC<EmployeeTableProps> = ({ 
  slips, 
  onPreview, 
  onSendWA,
  generatingWAId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJabatan, setSelectedJabatan] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Get unique list of Jabatan for the dropdown filter
  const jabatans = ['ALL', ...Array.from(new Set(slips.map(s => s.jabatan))).filter(Boolean)];

  // Filtered slips
  const filteredSlips = slips.filter(slip => {
    const matchSearch = 
      slip.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
      slip.nik.includes(searchTerm);
    const matchJabatan = selectedJabatan === 'ALL' || slip.jabatan === selectedJabatan;
    return matchSearch && matchJabatan;
  });

  const handleCopyLink = (slip: SlipData) => {
    if (!slip.id) return;
    const publicUrl = `${window.location.origin}/slip/${slip.id}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopiedId(slip.id!);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="glass-card" style={{ padding: '1.5rem', width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <h3 style={{ fontSize: '1.25rem', color: '#1e3a8a' }}>Daftar Slip Gaji Karyawan</h3>
        <span className="badge badge-info">{filteredSlips.length} Karyawan</span>
      </div>

      {/* Search & Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Cari berdasarkan NIK atau Nama..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <select
            className="filter-select"
            value={selectedJabatan}
            onChange={(e) => setSelectedJabatan(e.target.value)}
          >
            {jabatans.map(jab => (
              <option key={jab} value={jab}>
                {jab === 'ALL' ? 'Semua Jabatan' : jab}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filteredSlips.length === 0 ? (
        <div className="text-center" style={{ padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          Tidak ada data karyawan yang cocok dengan pencarian/filter.
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>NIK</th>
                <th>Nama Karyawan</th>
                <th>Jabatan</th>
                <th className="text-right">Gaji Bersih</th>
                <th>No Rekening</th>
                <th>WhatsApp</th>
                <th className="text-center" style={{ width: '180px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSlips.map(slip => (
                <tr key={slip.id || `${slip.nik}-${slip.bulan}`}>
                  <td style={{ fontWeight: 600 }}>{slip.nik}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{slip.nama}</div>
                  </td>
                  <td>
                    <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                      {slip.jabatan}
                    </span>
                  </td>
                  <td className="text-right" style={{ fontWeight: 700, color: '#2563eb' }}>
                    {formatRupiah(slip.gaji_bersih)}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {slip.no_rek || '-'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {slip.no_wa || '-'}
                  </td>
                  <td className="text-center">
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.375rem' }}>
                      {/* Preview Button */}
                      <button 
                        className="btn btn-outline btn-sm btn-icon" 
                        onClick={() => onPreview(slip)}
                        title="Preview Slip Gaji"
                      >
                        <Eye size={15} />
                      </button>

                      {/* Copy Link Button */}
                      <button 
                        className="btn btn-outline btn-sm btn-icon" 
                        onClick={() => handleCopyLink(slip)}
                        title="Salin Link Slip Online"
                        disabled={!slip.id}
                        style={copiedId === slip.id ? { borderColor: 'var(--success)', color: 'var(--success)' } : {}}
                      >
                        {copiedId === slip.id ? <Check size={15} /> : <LinkIcon size={15} />}
                      </button>

                      {/* WhatsApp Button */}
                      <button 
                        className="btn btn-secondary btn-sm btn-icon" 
                        onClick={() => onSendWA(slip)}
                        disabled={generatingWAId !== null}
                        title="Kirim Gambar Slip via WhatsApp"
                        style={{ backgroundColor: '#10b981' }}
                      >
                        {generatingWAId === slip.id ? (
                          <span style={{ fontSize: '0.7rem' }}>...</span>
                        ) : (
                          <MessageSquare size={15} />
                        )}
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
  );
};
