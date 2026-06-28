export default async function handler(req, res) {
  // Responder a MP inmediatamente para evitar timeout
  res.status(200).json({ ok: true });

  if (req.method !== 'POST') return;
  
  const body = req.body;
  if (!body || body.type !== 'payment' || !body.data?.id) return;

  const paymentId = body.data.id;
  const scriptUrl = 'https://script.google.com/macros/s/AKfycbwZywLf4Qvz_BCLQv2nwZ2Gt4QeI0VNGH2C681ZWGuc39r6dV-5plinIgnFMLXjqDdF/exec';

  try {
    await fetch(`${scriptUrl}?type=payment&data.id=${paymentId}`);
  } catch (e) {
    console.error('Error llamando al script:', e);
  }
}
