async function sendAccessEmail(email, codigo, plan, vencimiento) {
  const frontendUrl = await getConfig('FRONTEND_URL') || 'https://recetasai.netlify.app';
  const vencLabel = vencimiento === 'vitalicio' ? 'Vitalicio ♾️' : `Hasta el ${new Date(vencimiento).toLocaleDateString('es-AR')}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#0f1410;font-family:Arial,sans-serif">
  <table width="100%" style="background:#0f1410;padding:40px 20px">
    <tr><td align="center">
      <table width="560" style="background:#161d18;border-radius:12px;border:1px solid #2a3a2e;overflow:hidden">
        <tr><td style="padding:32px 40px;text-align:center;border-bottom:1px solid #2a3a2e">
          <p style="margin:0;font-size:28px">🥗</p>
          <h1 style="margin:12px 0 4px;color:#e8f0ea;font-size:22px">¡Tu acceso está listo!</h1>
          <p style="margin:0;color:#7a9480;font-size:14px">RecetasIA — Plan ${plan.charAt(0).toUpperCase()+plan.slice(1)}</p>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <p style="color:#e8f0ea;font-size:15px;margin:0 0 24px">Gracias por tu compra. Guardá este código:</p>
          <div style="background:#0f1410;border:2px solid #5dbd7a;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px">
            <p style="margin:0 0 8px;color:#7a9480;font-size:12px;text-transform:uppercase">Código de acceso</p>
            <p style="margin:0;font-family:monospace;font-size:24px;font-weight:700;color:#5dbd7a;letter-spacing:0.15em">${codigo}</p>
          </div>
          <p style="color:#7a9480;font-size:13px">Vigencia: ${vencLabel}</p>
          <a href="${frontendUrl}" style="display:block;background:#5dbd7a;color:#0f1410;text-decoration:none;border-radius:8px;padding:14px;text-align:center;font-weight:700;margin-top:20px">Ingresar ahora →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: '🥗 Tu código de acceso — RecetasIA',
      html
    })
  });
}
