export const formatWhatsAppNumber = (phone: string): string => {
  if (!phone) return '';
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  // If it starts with 0, replace with 62
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned;
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

export const generateWhatsAppMessage = (slip: any, slipUrl: string): string => {
  // Helper to safely get nested detail numbers
  const getDetailNumber = (key: string): number => {
    if (!slip.details) return 0;
    let val = slip.details[key];
    if (val === undefined || val === null) {
      // Case-insensitive & space-insensitive fallback
      const targetClean = key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const foundKey = Object.keys(slip.details).find(k => {
        const kClean = k.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return kClean === targetClean;
      });
      if (foundKey) {
        val = slip.details[foundKey];
      }
    }
    if (val === undefined || val === null) return 0;
    const parsed = typeof val === 'number' ? val : parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatRupiah = (val: number): string => {
    return 'Rp ' + val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Get details
  const gapok = getDetailNumber('Gaji Pokok');
  const upahHari = getDetailNumber('Upah /Hari') || getDetailNumber('Upah/Hari');
  const totalMasuk = getDetailNumber('Total Masuk');
  const totalGajiA = getDetailNumber('Total Gaji A');
  const premi = getDetailNumber('Premi');
  const tunjangan = getDetailNumber('Tunjangan');
  const totalLemburJam = getDetailNumber('Total Lembur (jam)') || getDetailNumber('Total Lembur');
  const gajiLembur = getDetailNumber('Gaji Lembur');
  const upahBorongan = getDetailNumber('Upah Borongan') || getDetailNumber('Borongan');
  const overTarget = getDetailNumber('Over Target');
  const potonganKehadiran = getDetailNumber('Potongan');
  const potonganLain = getDetailNumber('Potongan (Lain - lain)') || getDetailNumber('Potongan Lain-lain');
  const lainLain = getDetailNumber('Lain - Lain') || getDetailNumber('Lain-lain') || getDetailNumber('Lain - Lain (THR)') || getDetailNumber('Lain-lain (THR)') || getDetailNumber('THR');

  // Build items lists
  const penerimaanLines: string[] = [];
  if (gapok > 0) penerimaanLines.push(`- Gaji Pokok: ${formatRupiah(gapok)}`);
  if (upahHari > 0) penerimaanLines.push(`- Upah Harian: ${formatRupiah(upahHari)}/Hari (x ${totalMasuk} Hari)`);
  if (totalGajiA > 0 && upahHari > 0) penerimaanLines.push(`- Subtotal Upah Harian: ${formatRupiah(totalGajiA)}`);
  if (premi > 0) penerimaanLines.push(`- Premi Kehadiran: ${formatRupiah(premi)}`);
  if (tunjangan > 0) penerimaanLines.push(`- Tunjangan Kerja: ${formatRupiah(tunjangan)}`);
  if (gajiLembur > 0) penerimaanLines.push(`- Lembur: ${formatRupiah(gajiLembur)} (${totalLemburJam} Jam)`);
  if (upahBorongan > 0) penerimaanLines.push(`- Upah Borongan: ${formatRupiah(upahBorongan)}`);
  if (overTarget > 0) penerimaanLines.push(`- Insentif Over Target: ${formatRupiah(overTarget)}`);
  if (lainLain > 0) penerimaanLines.push(`- Lain-lain / THR: ${formatRupiah(lainLain)}`);

  const potonganLines: string[] = [];
  if (potonganKehadiran > 0) potonganLines.push(`- Potongan Kehadiran: ${formatRupiah(potonganKehadiran)}`);
  if (potonganLain > 0) potonganLines.push(`- Potongan Lain-lain / Kasbon: ${formatRupiah(potonganLain)}`);

  let detailsText = '';
  if (penerimaanLines.length > 0) {
    detailsText += `\n*Penerimaan / Pendapatan:*\n${penerimaanLines.join('\n')}\n`;
  }
  if (potonganLines.length > 0) {
    detailsText += `\n*Potongan Gaji:*\n${potonganLines.join('\n')}\n`;
  }

  return `Halo *${slip.nama}*,

Berikut adalah rincian slip gaji Anda untuk bulan *${slip.bulan}*:
${detailsText}
*Total Gaji Bersih:* *${formatRupiah(slip.gaji_bersih)}*
(Terbilang: _${getTerbilang(slip.gaji_bersih)}_)

Detail slip gaji online resmi Anda dapat diakses melalui tautan berikut:
${slipUrl}

Terima kasih,
*PT. Senndyt Sarungtangan Kreatif*`;
};

export const getWhatsAppWebLink = (phone: string, message: string): string => {
  const formattedPhone = formatWhatsAppNumber(phone);
  const encodedText = encodeURIComponent(message);
  return `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
};
