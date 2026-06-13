import * as XLSX from 'xlsx';

export interface ParsedSlip {
  nik: string;
  nama: string;
  jabatan: string;
  bulan: string;
  gaji_bersih: number;
  no_wa: string;
  no_rek: string;
  details: Record<string, any>;
}

export const parseExcelPayroll = (arrayBuffer: ArrayBuffer, customMonth?: string): Promise<ParsedSlip[]> => {
  return new Promise((resolve, reject) => {
    try {
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });

      // Find the Laporan Gaji sheet (prefer exact name, fallback to first sheet)
      const sheetName = workbook.SheetNames.find(name => 
        name && name.toUpperCase().includes('LAPORAN') || name.toUpperCase().includes('GAJI')
      ) || workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Tidak ada sheet yang ditemukan di file Excel.');
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      // Parse metadata from the top rows
      let fileMonth = customMonth || '';
      
      // Let's look for "Tanggal Cetak" in the top 10 rows
      if (!fileMonth) {
        for (let r = 0; r < Math.min(rows.length, 10); r++) {
          const row = rows[r];
          if (row && Array.isArray(row)) {
            const rowStr = Array.from(row).map(cell => (cell !== undefined && cell !== null ? cell.toString().toUpperCase() : ''));
            const idx = rowStr.findIndex(cell => cell && cell.includes('TANGGAL CETAK'));
            if (idx !== -1) {
              const dateCell = row.slice(idx + 1).find(cell => cell !== undefined && cell !== null && cell.toString().trim() !== ':' && cell.toString().trim() !== '');
              if (dateCell) {
                if (dateCell instanceof Date) {
                  const monthsIndo = [
                    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                  ];
                  const day = dateCell.getDate();
                  const month = monthsIndo[dateCell.getMonth()];
                  const year = dateCell.getFullYear();
                  fileMonth = `${day} ${month} ${year}`;
                } else {
                  fileMonth = dateCell.toString().trim();
                }
                break;
              }
            }
          }
        }
      }

      // If we didn't find "Tanggal Cetak" and no custom month provided, fallback to finding the Month
      if (!fileMonth) {
        for (let r = 0; r < Math.min(rows.length, 10); r++) {
          const row = rows[r];
          if (row && Array.isArray(row)) {
            const rowStr = Array.from(row).map(cell => (cell !== undefined && cell !== null ? cell.toString().toUpperCase() : ''));
            const idx = rowStr.findIndex(cell => cell && cell.includes('BULAN'));
            if (idx !== -1) {
              const monthCell = row.slice(idx + 1).find(cell => cell !== undefined && cell !== null && cell.toString().trim() !== ':' && cell.toString().trim() !== '');
              if (monthCell) {
                fileMonth = monthCell.toString().trim() + ' 2026';
                break;
              }
            }
          }
        }
      }

      // Final fallback
      if (!fileMonth) {
        fileMonth = 'Juni 2026';
      }

      // Find header row (it should contain NIK and Nama)
      let headerRowIndex = -1;
      for (let r = 0; r < Math.min(rows.length, 20); r++) {
        const row = rows[r];
        if (row && Array.isArray(row)) {
          const rowStr = Array.from(row).map(cell => (cell !== undefined && cell !== null ? cell.toString().toUpperCase() : ''));
          const hasNik = rowStr.some(cell => cell && cell.includes('NIK'));
          const hasNama = rowStr.some(cell => cell && cell.includes('NAMA'));
          if (hasNik && hasNama) {
            headerRowIndex = r;
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Format Excel tidak valid. Baris header dengan kolom "NIK" dan "Nama" tidak ditemukan.');
      }

      const rawHeaders = Array.from(rows[headerRowIndex] || []);
      // Normalize headers (clean up spaces and undefined values)
      const headers = rawHeaders.map(h => (h !== undefined && h !== null ? h.toString().trim() : ''));

      // Find indexes of core columns
      const getColIndex = (searchTerms: string[]) => {
        return headers.findIndex(h => 
          h && searchTerms.some(term => h.toUpperCase().includes(term.toUpperCase()))
        );
      };

      const nikIdx = getColIndex(['NIK']);
      const namaIdx = getColIndex(['NAMA']);
      const jabatanIdx = getColIndex(['JABATAN']);
      const gajiBersihIdx = getColIndex(['TOTAL GAJI BERSIH', 'GAJI BERSIH', 'BERSIH']);
      const waIdx = getColIndex(['WHATSAPP', 'NO WHATSAPP', 'WA']);
      const rekIdx = getColIndex(['REKENING', 'NO REKENING', 'REK']);

      if (nikIdx === -1 || namaIdx === -1 || gajiBersihIdx === -1) {
        throw new Error('Kolom penting (NIK, Nama, atau Gaji Bersih) tidak ditemukan di baris header.');
      }

      const results: ParsedSlip[] = [];

      // Loop through data rows starting after the header
      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const nikValue = row[nikIdx];
        const namaValue = row[namaIdx];

        // Skip rows that don't have NIK or Nama, or rows that have summary text (like "TOTAL" or "Grand Total")
        if (!nikValue || !namaValue) continue;
        const nikStr = nikValue.toString().trim();
        const namaStr = namaValue.toString().trim();
        if (
          !nikStr || 
          !namaStr || 
          namaStr.toUpperCase().includes('TOTAL') || 
          namaStr.toUpperCase().includes('GRAND')
        ) {
          continue;
        }

        // Build details object for all other columns
        const details: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (!header) return;
          // Skip core fields from details to avoid redundancy
          if (
            index === nikIdx || 
            index === namaIdx || 
            index === jabatanIdx || 
            index === gajiBersihIdx || 
            index === waIdx || 
            index === rekIdx ||
            header.toUpperCase() === 'NO. URUT' || 
            header === ''
          ) {
            return;
          }

          const val = row[index];
          details[header] = val !== undefined ? val : null;
        });

        // Parse clean values
        const gajiBersihVal = parseFloat(row[gajiBersihIdx]?.toString().replace(/[^0-9.-]+/g, '') || '0');
        const noWaVal = row[waIdx] !== undefined && row[waIdx] !== null ? row[waIdx].toString().trim() : '';
        const noRekVal = row[rekIdx] !== undefined && row[rekIdx] !== null ? row[rekIdx].toString().trim() : '';

        results.push({
          nik: nikStr,
          nama: namaStr,
          jabatan: row[jabatanIdx]?.toString().trim() || 'KARYAWAN',
          bulan: fileMonth,
          gaji_bersih: isNaN(gajiBersihVal) ? 0 : gajiBersihVal,
          no_wa: noWaVal,
          no_rek: noRekVal,
          details
        });
      }

      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};
