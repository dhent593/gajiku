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

export const generateWhatsAppMessage = (nama: string, bulan: string, slipUrl: string): string => {
  return `Halo *${nama}*,

Berikut adalah rincian slip gaji Anda untuk bulan *${bulan}*.

Detail slip gaji online Anda dapat diakses melalui tautan berikut:
${slipUrl}

Silakan paste (Ctrl + V) di obrolan ini untuk melampirkan gambar slip gaji yang sudah diunduh secara otomatis.

Terima kasih,
*PT. Senndyt Sarungtangan Kreatif*`;
};

export const getWhatsAppWebLink = (phone: string, message: string): string => {
  const formattedPhone = formatWhatsAppNumber(phone);
  const encodedText = encodeURIComponent(message);
  return `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
};
