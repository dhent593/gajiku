import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Printer, Copy, Check } from 'lucide-react';

export interface SlipData {
  id?: string;
  nik: string;
  nama: string;
  jabatan: string;
  bulan: string;
  gaji_bersih: number;
  no_wa?: string;
  no_rek?: string;
  urut?: number;
  details: Record<string, any>;
}

interface SlipGajiProps {
  data: SlipData;
  isPublicView?: boolean;
}

// Helpers
export const formatRupiah = (val: any): string => {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return 'Rp 0';
  return 'Rp ' + num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const getTerbilang = (nilai: number): string => {
  if (nilai <= 0) return 'Nol Rupiah';
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];
  
  const hitung = (n: number): string => {
    let temp = '';
    const floor = Math.floor(n);
    if (floor < 12) {
      temp = bilangan[floor];
    } else if (floor < 20) {
      temp = hitung(floor - 10) + ' Belas';
    } else if (floor < 100) {
      temp = hitung(floor / 10) + ' Puluh ' + hitung(floor % 10);
    } else if (floor < 200) {
      temp = 'Seratus ' + hitung(floor - 100);
    } else if (floor < 1000) {
      temp = hitung(floor / 100) + ' Ratus ' + hitung(floor % 100);
    } else if (floor < 2000) {
      temp = 'Seribu ' + hitung(floor - 1000);
    } else if (floor < 1000000) {
      temp = hitung(floor / 1000) + ' Ribu ' + hitung(floor % 1000);
    } else if (floor < 1000000000) {
      temp = hitung(floor / 1000000) + ' Juta ' + hitung(floor % 1000000);
    } else if (floor < 1000000000000) {
      temp = hitung(floor / 1000000000) + ' Miliar ' + hitung(floor % 1000000000);
    }
    return temp;
  };

  const hasil = hitung(nilai).replace(/\s+/g, ' ').trim();
  return hasil + ' Rupiah';
};

export const SlipGaji: React.FC<SlipGajiProps> = ({ data, isPublicView = false }) => {
  const slipRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Helper to safely get nested detail numbers
  const getDetailNumber = (key: string): number => {
    const val = data.details[key];
    if (val === undefined || val === null) return 0;
    const parsed = typeof val === 'number' ? val : parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Parse fields
  const gapok = getDetailNumber('Gaji Pokok');
  const upahHari = getDetailNumber('Upah /Hari') || getDetailNumber('Upah/Hari');
  const totalMasuk = getDetailNumber('Total Masuk');
  const totalGajiA = getDetailNumber('Total Gaji A');
  const premi = getDetailNumber('Premi');
  const tunjangan = getDetailNumber('Tunjangan');
  const totalLemburJam = getDetailNumber('Total Lembur (jam)') || getDetailNumber('Total Lembur');
  const upahLemburJam = getDetailNumber('Upah Lembur /Jam') || getDetailNumber('Upah Lembur');
  const gajiLembur = getDetailNumber('Gaji Lembur');
  const upahBorongan = getDetailNumber('Upah Borongan') || getDetailNumber('Borongan');
  const overTarget = getDetailNumber('Over Target');
  
  // Total Penerimaan
  const totalGajiB = getDetailNumber('Total Gaji B') || (totalGajiA + premi + tunjangan + gajiLembur + upahBorongan + overTarget);

  // Potongan
  const potonganMasukJam = getDetailNumber('Potongan Masuk (jam)') || getDetailNumber('Potongan Masuk');
  const potonganKehadiran = getDetailNumber('Potongan');
  const potonganLain = getDetailNumber('Potongan (Lain - lain)') || getDetailNumber('Potongan Lain-lain');
  const totalPotongan = potonganKehadiran + potonganLain;

  // Lain-lain (THR)
  const lainLainThr = getDetailNumber('Lain - Lain (THR)') || getDetailNumber('Lain-lain (THR)') || getDetailNumber('THR');

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Generate Image PNG and trigger download
  const handleDownloadImage = async (): Promise<string | null> => {
    if (!slipRef.current) return null;
    setDownloading(true);
    try {
      // Create options for high quality rendering
      const options = {
        scale: 2.5, // High resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800
      };
      
      const canvas = await html2canvas(slipRef.current, options);
      const imgData = canvas.toDataURL('image/png');
      
      // Auto download
      const link = document.createElement('a');
      link.download = `Slip_Gaji_${data.nama.replace(/\s+/g, '_')}_${data.bulan.replace(/\s+/g, '_')}.png`;
      link.href = imgData;
      link.click();
      
      // Try to write to clipboard as well, so user can easily paste directly
      try {
        canvas.toBlob(async (blob) => {
          if (blob) {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
          }
        });
      } catch (clipboardErr) {
        console.warn('Could not write image to clipboard automatically:', clipboardErr);
      }

      setDownloading(false);
      return imgData;
    } catch (err) {
      console.error('Error generating image:', err);
      setDownloading(false);
      return null;
    }
  };

  const handleCopyLink = () => {
    if (!data.id) return;
    const publicUrl = `${window.location.origin}/slip/${data.id}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div>
      {/* Top action bar - Hidden during print */}
      <div className="flex justify-between items-center no-print" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.125rem', color: 'var(--text-main)' }}>
          {isPublicView ? 'Slip Gaji Online' : 'Preview Slip Gaji'}
        </h3>
        <div className="flex gap-2">
          {data.id && (
            <button className="btn btn-outline btn-sm" onClick={handleCopyLink}>
              {copiedLink ? <Check size={16} className="mr-2" style={{ color: 'var(--success)' }} /> : <Copy size={16} className="mr-2" />}
              {copiedLink ? 'Tersalin' : 'Salin Link'}
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={handlePrint}>
            <Printer size={16} className="mr-2" />
            Cetak PDF / Print
          </button>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleDownloadImage}
            disabled={downloading}
          >
            <Download size={16} className="mr-2" />
            {downloading ? 'Mengunduh...' : 'Unduh Gambar'}
          </button>
        </div>
      </div>

      {/* Slip Body container */}
      <div className="slip-container" ref={slipRef}>
        <div className="slip-watermark">PT. SENNDYT</div>
        
        {/* Header */}
        <div className="slip-header">
          <div className="flex justify-between items-start">
            <div>
              <div className="slip-company-name">PT. Senndyt Sarungtangan Kreatif</div>
              <div className="slip-company-sub">Jl. Pasar Turi RT 05, Sidomulyo, Bambanglipuro, Bantul, D.I. Yogyakarta</div>
            </div>
            <div className="text-right" style={{ fontSize: '0.75rem', color: '#4b5563' }}>
              <strong>SLIP GAJI KARYAWAN</strong>
              <div>Tanggal Cetak: {data.bulan}</div>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="slip-title">SLIP PENERIMAAN GAJI</div>

        {/* Metadata Grid */}
        <div className="slip-meta-grid">
          <div>
            <div className="slip-meta-row">
              <div className="slip-meta-label">NIK</div>
              <div className="slip-meta-colon">:</div>
              <div className="slip-meta-value">{data.nik}</div>
            </div>
            <div className="slip-meta-row">
              <div className="slip-meta-label">Nama Karyawan</div>
              <div className="slip-meta-colon">:</div>
              <div className="slip-meta-value">{data.nama}</div>
            </div>
            <div className="slip-meta-row">
              <div className="slip-meta-label">Jabatan</div>
              <div className="slip-meta-colon">:</div>
              <div className="slip-meta-value">{data.jabatan}</div>
            </div>
          </div>
          <div>
            <div className="slip-meta-row">
              <div className="slip-meta-label">No. Rekening</div>
              <div className="slip-meta-colon">:</div>
              <div className="slip-meta-value">{data.no_rek || '-'}</div>
            </div>
            <div className="slip-meta-row">
              <div className="slip-meta-label">No. WhatsApp</div>
              <div className="slip-meta-colon">:</div>
              <div className="slip-meta-value">{data.no_wa || '-'}</div>
            </div>
            <div className="slip-meta-row">
              <div className="slip-meta-label">Status Bayar</div>
              <div className="slip-meta-colon">:</div>
              <div className="slip-meta-value" style={{ color: '#10b981' }}>TRANSFER</div>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="slip-section-grid">
          {/* Earnings (Penerimaan) */}
          <div>
            <div className="slip-section-title">Penerimaan / Pendapatan</div>
            <table className="slip-details-table">
              <tbody>
                {gapok > 0 && (
                  <tr>
                    <td>Gaji Pokok</td>
                    <td className="slip-details-val">{formatRupiah(gapok)}</td>
                  </tr>
                )}
                {upahHari > 0 && (
                  <tr>
                    <td>Upah Harian ({upahHari.toLocaleString('id-ID')}/Hari)</td>
                    <td className="slip-details-val">x {totalMasuk} hari</td>
                  </tr>
                )}
                {totalGajiA > 0 && (
                  <tr>
                    <td>Subtotal Upah Harian</td>
                    <td className="slip-details-val">{formatRupiah(totalGajiA)}</td>
                  </tr>
                )}
                {premi > 0 && (
                  <tr>
                    <td>Premi Kehadiran</td>
                    <td className="slip-details-val">{formatRupiah(premi)}</td>
                  </tr>
                )}
                {tunjangan > 0 && (
                  <tr>
                    <td>Tunjangan Kerja</td>
                    <td className="slip-details-val">{formatRupiah(tunjangan)}</td>
                  </tr>
                )}
                {gajiLembur > 0 && (
                  <tr>
                    <td>Lembur ({totalLemburJam} Jam {upahLemburJam > 0 ? `@ ${upahLemburJam.toLocaleString('id-ID')}` : ''})</td>
                    <td className="slip-details-val">{formatRupiah(gajiLembur)}</td>
                  </tr>
                )}
                {upahBorongan > 0 && (
                  <tr>
                    <td>Upah Borongan</td>
                    <td className="slip-details-val">{formatRupiah(upahBorongan)}</td>
                  </tr>
                )}
                {overTarget > 0 && (
                  <tr>
                    <td>Insentif Over Target</td>
                    <td className="slip-details-val">{formatRupiah(overTarget)}</td>
                  </tr>
                )}
                {lainLainThr > 0 && (
                  <tr>
                    <td>Lain-Lain (THR / Bonus)</td>
                    <td className="slip-details-val">{formatRupiah(lainLainThr)}</td>
                  </tr>
                )}
                
                {/* Dynamically list custom fields if they contain values and aren't caught by static mapping */}
                {Object.entries(data.details).map(([key, val]) => {
                  const valNum = typeof val === 'number' ? val : parseFloat(val?.toString().replace(/[^0-9.-]+/g, '') || '');
                  if (isNaN(valNum) || valNum <= 0) return null;
                  
                  const isMapped = [
                    'Gaji Pokok', 'Upah /Hari', 'Upah/Hari', 'Total Masuk', 'Total Gaji A', 
                    'Premi', 'Tunjangan', 'Total Lembur (jam)', 'Total Lembur', 'Upah Lembur /Jam', 
                    'Upah Lembur', 'Gaji Lembur', 'Upah Borongan', 'Borongan', 'Over Target', 
                    'Total Gaji B', 'Potongan Masuk (jam)', 'Potongan Masuk', 'Potongan', 
                    'Potongan (Lain - lain)', 'Potongan Lain-lain', 'Lain - Lain (THR)', 'Lain-lain (THR)', 'THR'
                  ].some(term => key.toUpperCase().includes(term.toUpperCase()));

                  if (isMapped) return null;

                  return (
                    <tr key={key}>
                      <td>{key}</td>
                      <td className="slip-details-val">{formatRupiah(valNum)}</td>
                    </tr>
                  );
                })}

                <tr className="slip-total-row">
                  <td>Total Penerimaan (A)</td>
                  <td className="slip-details-val">{formatRupiah(totalGajiB + (lainLainThr > 0 ? 0 : 0) /* Total Gaji B already summarizes the main earnings */)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deductions (Potongan) */}
          <div>
            <div className="slip-section-title">Potongan Gaji</div>
            <table className="slip-details-table">
              <tbody>
                {potonganMasukJam > 0 && (
                  <tr>
                    <td>Potongan Absen ({potonganMasukJam} Jam)</td>
                    <td className="slip-details-val">{formatRupiah(potonganKehadiran)}</td>
                  </tr>
                )}
                {potonganMasukJam === 0 && potonganKehadiran > 0 && (
                  <tr>
                    <td>Potongan Kehadiran</td>
                    <td className="slip-details-val">{formatRupiah(potonganKehadiran)}</td>
                  </tr>
                )}
                {potonganLain > 0 && (
                  <tr>
                    <td>Potongan Lain-lain / Kasbon</td>
                    <td className="slip-details-val">{formatRupiah(potonganLain)}</td>
                  </tr>
                )}
                {totalPotongan === 0 && (
                  <tr>
                    <td style={{ fontStyle: 'italic', color: '#9ca3af' }}>Tidak ada potongan</td>
                    <td className="slip-details-val">Rp 0</td>
                  </tr>
                )}
                <tr className="slip-total-row">
                  <td>Total Potongan (B)</td>
                  <td className="slip-details-val">{formatRupiah(totalPotongan)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary box */}
        <div className="slip-summary-box">
          <div className="slip-summary-label">Total Gaji Bersih (A - B)</div>
          <div className="slip-summary-val">{formatRupiah(data.gaji_bersih)}</div>
        </div>

        {/* Terbilang */}
        <div className="slip-terbilang">
          <strong>Terbilang:</strong> {getTerbilang(data.gaji_bersih)}
        </div>

        {/* Footer */}
        <div className="slip-footer-grid">
          <div>
            <div>Penerima,</div>
            <div className="slip-sign-space"></div>
            <div className="slip-sign-name">{data.nama}</div>
          </div>
          <div>
            <div>Bantul, {data.bulan}</div>
            <div>HRD / Finance PT. Senndyt,</div>
            <div className="slip-sign-space"></div>
            <div className="slip-sign-name">Arif Setiawan</div>
          </div>
        </div>

        {/* Cut line */}
        <div className="slip-cut-line no-print">
          <div className="slip-cut-text">
            ✂️ Gunting disini (Simpan lembaran ini sebagai bukti resmi penerimaan gaji)
          </div>
        </div>
      </div>
    </div>
  );
};
