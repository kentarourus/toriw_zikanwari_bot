export async function prepareChatImage(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12_000_000) {
    throw Error('12 MB以下のJPEG、PNG、WebPを選んでください。');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d', {alpha:false});
    context.fillStyle = '#fff';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for (const quality of [.84,.7,.55,.4,.28]) {
      const url = canvas.toDataURL('image/jpeg',quality);
      const data = url.slice('data:image/jpeg;base64,'.length);
      if (data.length <= 380000 && url.startsWith('data:image/jpeg;base64,')) return {url,data};
    }
    throw Error('画像が大きすぎます。必要な範囲に切り取ってください。');
  } finally {
    bitmap.close();
  }
}
