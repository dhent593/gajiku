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

export interface ParsedKasEntry {
  tanggal: string; // YYYY-MM-DD format
  keterangan: string;
  uang_masuk: number;
  uang_keluar: number;
  saldo_akhir: number;
  bukti_transfer: string;
  catatan: string;
}

export const parseIndonesianCurrency = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const str = val.toString().trim();
  if (!str || str === '-') return 0;
  
  let isNegative = false;
  let norm = str.replace(/Rp/gi, '').replace(/\s/g, '');
  if (norm.startsWith('-') || (norm.startsWith('(') && norm.endsWith(')'))) {
    isNegative = true;
  }
  norm = norm.replace(/[^0-9.,-]/g, '');
  
  const lastComma = norm.lastIndexOf(',');
  const lastDot = norm.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    norm = norm.replace(/\./g, '').replace(/,/g, '.');
  } else if (lastDot > lastComma) {
    norm = norm.replace(/,/g, '');
  } else if (lastComma !== -1) {
    norm = norm.replace(/,/g, '.');
  }
  
  let num = parseFloat(norm);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
};

export const parseExcelDate = (val: any): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  
  const str = val.toString().trim();
  
  // Try YYYY-MM-DD or DD/MM/YYYY
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // DD/MM/YYYY
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    } else if (parts[0].length === 4) {
      // YYYY-MM-DD
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  const num = parseFloat(str);
  if (!isNaN(num) && num > 20000 && num < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const dateMs = excelEpoch.getTime() + num * 24 * 60 * 60 * 1000;
    return new Date(dateMs).toISOString().split('T')[0];
  }
  
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}
  
  return new Date().toISOString().split('T')[0];
};

export const parseExcelKas = (arrayBuffer: ArrayBuffer): Promise<ParsedKasEntry[]> => {
  return new Promise((resolve, reject) => {
    try {
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });

      // Find the Laporan Kas sheet: look for sheet containing 'KESELURUHAN'
      const sheetName = workbook.SheetNames.find(name => 
        name && name.toUpperCase().includes('KESELURUHAN')
      ) || workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Tidak ada sheet yang ditemukan di file Excel.');
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      // Find header row (it should contain Tanggal and Keterangan)
      let headerRowIndex = -1;
      for (let r = 0; r < Math.min(rows.length, 20); r++) {
        const row = rows[r];
        if (row && Array.isArray(row)) {
          const rowStr = Array.from(row).map(cell => (cell !== undefined && cell !== null ? cell.toString().toUpperCase() : ''));
          const hasTanggal = rowStr.some(cell => cell && cell.includes('TANGGAL'));
          const hasKeterangan = rowStr.some(cell => cell && cell.includes('KETERANGAN'));
          if (hasTanggal && hasKeterangan) {
            headerRowIndex = r;
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Format Excel tidak valid. Baris header dengan kolom "Tanggal" dan "Keterangan" tidak ditemukan.');
      }

      const rawHeaders = Array.from(rows[headerRowIndex] || []);
      const headers = rawHeaders.map(h => (h !== undefined && h !== null ? h.toString().trim() : ''));

      const getColIndex = (searchTerms: string[]) => {
        return headers.findIndex(h => 
          h && searchTerms.some(term => h.toUpperCase().includes(term.toUpperCase()))
        );
      };

      const tanggalIdx = getColIndex(['TANGGAL']);
      const keteranganIdx = getColIndex(['KETERANGAN']);
      const masukIdx = getColIndex(['UANG MASUK', 'PEMASUKAN', 'MASUK', 'DEBIT', 'DEBET']);
      const keluarIdx = getColIndex(['UANG KELUAR', 'PENGELUARAN', 'KELUAR', 'KREDIT']);
      const saldoIdx = getColIndex(['SALDO AKHIR', 'SALDO']);
      const buktiIdx = getColIndex(['BUKTI TRANSFER', 'BUKTI']);
      const catatanIdx = getColIndex(['CATATAN', 'KETERANGAN LAIN']);

      if (tanggalIdx === -1 || keteranganIdx === -1) {
        throw new Error('Kolom penting (Tanggal atau Keterangan) tidak ditemukan di baris header.');
      }

      const results: ParsedKasEntry[] = [];

      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const tanggalVal = row[tanggalIdx];
        const keteranganVal = row[keteranganIdx];

        // Skip rows that don't have keterangan or date
        if (!keteranganVal || !tanggalVal) continue;
        const ketStr = keteranganVal.toString().trim();
        if (!ketStr || ketStr.toUpperCase().includes('TOTAL') || ketStr.toUpperCase().includes('GRAND') || ketStr.toUpperCase() === 'NO') {
          continue;
        }

        const dateStr = parseExcelDate(tanggalVal);
        const masukVal = masukIdx !== -1 ? parseIndonesianCurrency(row[masukIdx]) : 0;
        const keluarVal = keluarIdx !== -1 ? parseIndonesianCurrency(row[keluarIdx]) : 0;
        const saldoVal = saldoIdx !== -1 ? parseIndonesianCurrency(row[saldoIdx]) : 0;
        const buktiStr = (buktiIdx !== -1 && row[buktiIdx] !== undefined && row[buktiIdx] !== null) ? row[buktiIdx].toString().trim() : '';
        const catatanStr = (catatanIdx !== -1 && row[catatanIdx] !== undefined && row[catatanIdx] !== null) ? row[catatanIdx].toString().trim() : '';

        results.push({
          tanggal: dateStr,
          keterangan: ketStr,
          uang_masuk: masukVal,
          uang_keluar: keluarVal,
          saldo_akhir: saldoVal,
          bukti_transfer: buktiStr,
          catatan: catatanStr
        });
      }

      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};

export interface ParsedInvoiceEntry {
  no: number;
  keterangan: string[];
  no_inv: string;
  tanggal: string | null;
  dpp_amount: number;
  no_bukti_potong: string;
  tanggal_bukti: string | null;
  pph_amount: number;
  net_received: number;
  potongan_reject: number;
}

export const parseExcelInvoice = (arrayBuffer: ArrayBuffer): Promise<ParsedInvoiceEntry[]> => {
  return new Promise((resolve, reject) => {
    try {
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });

      const sheetName = workbook.SheetNames.find(name => 
        name && (name.toUpperCase().includes('INV') || name.toUpperCase().includes('PENJUALAN'))
      ) || workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Tidak ada sheet invoice yang ditemukan.');
      }

      const sheet = workbook.Sheets[sheetName];
      const ref = sheet['!ref'];
      if (!ref) {
        throw new Error('Range sheet kosong.');
      }
      
      const range = XLSX.utils.decode_range(ref);
      const results: ParsedInvoiceEntry[] = [];
      let currentInvoice: ParsedInvoiceEntry | null = null;

      // Start parsing from row 7 (index 6) to the end of range
      for (let r = 6; r <= range.e.r; r++) {
        const noCell = sheet[XLSX.utils.encode_cell({ r, c: 1 })]; // Col B (1)
        const ketCell = sheet[XLSX.utils.encode_cell({ r, c: 2 })]; // Col C (2)
        const invCell = sheet[XLSX.utils.encode_cell({ r, c: 3 })]; // Col D (3)
        const dateCell = sheet[XLSX.utils.encode_cell({ r, c: 4 })]; // Col E (4)
        const dppCell = sheet[XLSX.utils.encode_cell({ r, c: 5 })]; // Col F (5)
        const bpCell = sheet[XLSX.utils.encode_cell({ r, c: 6 })]; // Col G (6)
        const bpDateCell = sheet[XLSX.utils.encode_cell({ r, c: 7 })]; // Col H (7)
        const pphCell = sheet[XLSX.utils.encode_cell({ r, c: 8 })]; // Col I (8)
        const netCell = sheet[XLSX.utils.encode_cell({ r, c: 9 })]; // Col J (9)
        const rejectCell = sheet[XLSX.utils.encode_cell({ r, c: 10 })]; // Col K (10)

        const no = noCell ? noCell.v : null;
        const keterangan = ketCell ? ketCell.v : null;
        const no_inv = invCell ? invCell.v : null;
        const tanggal_inv_serial = dateCell ? dateCell.v : null;
        const dpp_amount = dppCell ? dppCell.v : null;
        const no_bukti_potong = bpCell ? bpCell.v : null;
        const tanggal_bukti_serial = bpDateCell ? bpDateCell.v : null;
        const pph_amount = pphCell ? pphCell.v : null;
        const net_received = netCell ? netCell.v : null;
        const potongan_reject = rejectCell ? rejectCell.v : null;

        // Skip totals or headers if they leak in
        if (keterangan && String(keterangan).toUpperCase().includes('TOTAL')) {
          continue;
        }

        // Check if we have a number/valid value in Col B (new invoice entry)
        if (no !== null && (typeof no === 'number' || (!isNaN(Number(no)) && String(no).trim() !== ''))) {
          if (currentInvoice) {
            results.push(currentInvoice);
          }

          currentInvoice = {
            no: Number(no),
            keterangan: keterangan ? [String(keterangan).trim()] : [],
            no_inv: no_inv ? String(no_inv).trim() : '',
            tanggal: tanggal_inv_serial ? parseExcelDate(tanggal_inv_serial) : null,
            dpp_amount: typeof dpp_amount === 'number' ? dpp_amount : parseIndonesianCurrency(dpp_amount),
            no_bukti_potong: no_bukti_potong ? String(no_bukti_potong).trim() : '',
            tanggal_bukti: tanggal_bukti_serial ? parseExcelDate(tanggal_bukti_serial) : null,
            pph_amount: typeof pph_amount === 'number' ? pph_amount : parseIndonesianCurrency(pph_amount),
            net_received: typeof net_received === 'number' ? net_received : parseIndonesianCurrency(net_received),
            potongan_reject: typeof potongan_reject === 'number' ? potongan_reject : parseIndonesianCurrency(potongan_reject)
          };
        } else if (currentInvoice && keterangan !== null && String(keterangan).trim() !== '') {
          // Append description line
          currentInvoice.keterangan.push(String(keterangan).trim());
        }
      }

      if (currentInvoice) {
        results.push(currentInvoice);
      }

      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};

