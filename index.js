const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

const SUPABASE_URL = 'https://rgmbmoasuqdiwavcaskl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const PORT = process.env.PORT || 3000;

// ── SUPABASE HELPERS ──
async function dbGet(table, filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  Object.entries(filters).forEach(([k, v]) => url += `${k}=eq.${encodeURIComponent(v)}&`);
  url += 'limit=1';
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const data = await r.json();
  return data[0] || null;
}

async function dbGetAll(table, filters = {}, extra = '') {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  Object.entries(filters).forEach(([k, v]) => url += `${k}=eq.${encodeURIComponent(v)}&`);
  url += extra;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  return r.json();
}

async function dbInsert(table, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function dbUpdate(table, filters, data) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  Object.entries(filters).forEach(([k, v]) => url += `${k}=eq.${encodeURIComponent(v)}&`);
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function dbDelete(table, filters) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  Object.entries(filters).forEach(([k, v]) => url += `${k}=eq.${encodeURIComponent(v)}&`);
  return fetch(url, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
}

async function getConfig(key) {
  const row = await dbGet('config', { clave: key });
  return row?.valor || null;
}

// ── HELPERS ──
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function generateId() {
  return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function addMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// ── EMAIL CON BREVO API ──
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

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'RecetasIA', email: 'noreply@recetasai.netlify.app' },
        to: [{ email }],
        subject: '🥗 Tu código de acceso — RecetasIA',
        htmlContent: html
      })
    });
    const data = await r.json();
    console.log('Email enviado:', JSON.stringify(data));
  } catch (err) {
    console.error('Error enviando email:', err);
  }
}

// ── MERCADOPAGO WEBHOOK ──
app.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true });

  const body = req.body;
  if (!body || body.type !== 'payment' || !body.data?.id) return;

  try {
    const paymentId = body.data.id;
    const mpToken = await getConfig('MP_ACCESS_TOKEN');

    const existing = await dbGet('pagos', { mp_payment_id: paymentId.toString() });
    if (existing) return;

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });
    const pago = await mpRes.json();
    console.log('Pago MP:', pago.status, pago.external_reference);

    if (pago.status !== 'approved') return;

    const [plan, email] = (pago.external_reference || '').split('|');
    if (!plan || !email) return;

    const codigo = generateCode();
    const vencimiento = plan === 'pro' ? 'vitalicio' : addMonths(12);

    await dbInsert('codigos', { codigo, email, plan, vencimiento, estado: 'activo', usos: 0 });
    await dbInsert('pagos', { id: generateId(), codigo, email, monto: pago.transaction_amount, plan, estado: 'aprobado', mp_payment_id: paymentId.toString() });
    await sendAccessEmail(email, codigo, plan, vencimiento);

    console.log('Pago procesado OK:', codigo, email);
  } catch (err) {
    console.error('Error procesando pago:', err);
  }
});

// ── API PRINCIPAL ──
app.all('/api', async (req, res) => {
  try {
    let body = req.method === 'GET' ? JSON.parse(decodeURIComponent(req.query.body || '{}')) : req.body;
    const action = body.action;

    const handlers = {
      'login': handleLogin,
      'logout': handleLogout,
      'validate_token': handleValidateToken,
      'generate_recipe': handleGenerateRecipe,
      'save_recipe': handleSaveRecipe,
      'get_recipes': handleGetRecipes,
      'delete_recipe': handleDeleteRecipe,
      'toggle_favorite': handleToggleFavorite,
      'get_profile': handleGetProfile,
      'log_calorias': handleLogCalorias,
      'get_calorias': handleGetCalorias,
      'get_calorias_semana': handleGetCaloriasSemana,
      'set_meta_kcal': handleSetMetaKcal,
      'log_agua': handleLogAgua,
      'log_peso': handleLogPeso,
      'get_peso': handleGetPeso,
      'set_peso_meta': handleSetPesoMeta,
      'get_groq_key': handleGetGroqKey,
      'create_preference': handleCreatePreference,
      'admin_login': handleAdminLogin,
      'admin_get_stats': handleAdminGetStats,
      'admin_get_codes': handleAdminGetCodes,
      'admin_create_code': handleAdminCreateCode,
      'admin_toggle_code': handleAdminToggleCode,
      'admin_get_payments': handleAdminGetPayments,
      'get_dieteticas': handleGetDieteticas,
      'get_ciudades': handleGetCiudades,
      'admin_get_dieteticas': handleAdminGetDieteticas,
      'admin_create_dietetica': handleAdminCreateDietetica,
      'admin_update_dietetica': handleAdminUpdateDietetica,
      'admin_delete_dietetica': handleAdminDeleteDietetica,
      'set_ciudad': handleSetCiudad,
    };

    if (!handlers[action]) return res.json({ ok: false, error: 'Acción desconocida: ' + action });
    const result = await handlers[action](body);
    res.json(result);
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ── AUTH ──
async function getValidSession(token) {
  if (!token) return null;
  const session = await dbGet('sesiones', { token, activa: true });
  return session;
}

async function handleLogin(body) {
  const { codigo } = body;
  if (!codigo) return { ok: false, error: 'Ingresá tu código de acceso.' };

  console.log('Buscando código:', codigo.toUpperCase().trim());
  const row = await dbGet('codigos', { codigo: codigo.toUpperCase().trim() });
  console.log('Resultado:', JSON.stringify(row));

  if (!row) return { ok: false, error: 'Código no encontrado.' };
  if (row.estado !== 'activo') return { ok: false, error: 'Este código está inactivo.' };

  if (row.vencimiento && row.vencimiento !== 'vitalicio') {
    if (new Date() > new Date(row.vencimiento)) return { ok: false, error: 'Tu acceso venció.' };
  }

  const token = generateToken();
  await dbInsert('sesiones', { token, codigo: row.codigo, email: row.email, activa: true });
  await dbUpdate('codigos', { codigo: row.codigo }, { usos: (row.usos || 0) + 1 });

  return {
    ok: true, token,
    usuario: { email: row.email, nombre: row.nombre, plan: row.plan, vencimiento: row.vencimiento, recetas_dia: row.plan === 'pro' ? 999 : 5 }
  };
}

async function handleLogout(body) {
  if (body.token) await dbUpdate('sesiones', { token: body.token }, { activa: false });
  return { ok: true };
}

async function handleValidateToken(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  await dbUpdate('sesiones', { token: body.token }, { ultimo_acceso: new Date().toISOString() });
  const user = await dbGet('codigos', { codigo: session.codigo });
  return { ok: true, usuario: { email: session.email, nombre: user?.nombre, plan: user?.plan, vencimiento: user?.vencimiento } };
}

// ── RECETAS ──
async function handleGenerateRecipe(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };

  const hoy = new Date().toISOString().slice(0, 10);
  const user = await dbGet('codigos', { codigo: session.codigo });
  const limite = user?.plan === 'pro' ? 999 : 5;

  // Contar generaciones de hoy en tabla generaciones
  const genUrl = `${SUPABASE_URL}/rest/v1/generaciones?codigo_usuario=eq.${session.codigo}&fecha=eq.${hoy}&select=id`;
  const genRes = await fetch(genUrl, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const generacionesHoy = await genRes.json();
  console.log('Generaciones hoy:', generacionesHoy.length, 'Límite:', limite);
  if (generacionesHoy.length >= limite) return { ok: false, error: `Límite de ${limite} recetas por día alcanzado.` };

  const apiKey = await getConfig('GROQ_API_KEY');
  const { filtros = {} } = body;
  const { categoria = '', ingredientes = [], restricciones = [], tiempo = '', porciones = 2, dificultad = 'fácil', libre = '' } = filtros;

  const prompt = `Sos un chef profesional. Generá una receta completa.
Categoría: ${categoria || 'cualquiera'}
Ingredientes: ${ingredientes.join(', ') || 'los apropiados'}
Restricciones: ${restricciones.join(', ') || 'ninguna'}
Porciones: ${porciones}, Dificultad: ${dificultad}
${tiempo ? `Tiempo máximo: ${tiempo} min` : ''}
${libre}

Respondé ÚNICAMENTE con JSON válido:
{"titulo":"...","categoria":"...","descripcion":"...","tiempo_prep":10,"tiempo_coccion":20,"porciones":${porciones},"dificultad":"${dificultad}","calorias_porcion":350,"tags":[],"ingredientes":[{"cantidad":"200","unidad":"g","nombre":"...","nota":""}],"pasos":[{"numero":1,"titulo":"...","descripcion":"...","tiempo_min":5}],"tips":[],"variantes":[],"info_nutricional":{"proteinas":"30g","carbohidratos":"10g","grasas":"12g","fibra":"2g"}}`;

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 2000, temperature: 0.7, messages: [{ role: 'system', content: 'Respondés ÚNICAMENTE con JSON válido.' }, { role: 'user', content: prompt }] })
  });

  const groqData = await groqRes.json();
  const text = groqData.choices?.[0]?.message?.content || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ok: false, error: 'Error generando la receta. Intentá de nuevo.' };

  // Registrar generación
  await dbInsert('generaciones', { id: generateId(), codigo_usuario: session.codigo, fecha: hoy });

  return { ok: true, receta: JSON.parse(jsonMatch[0]), generaciones_hoy: generacionesHoy.length + 1, limite };
}

async function handleSaveRecipe(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const { receta } = body;
  const id = generateId();
  await dbInsert('recetas', {
    id, codigo_usuario: session.codigo, titulo: receta.titulo, categoria: receta.categoria,
    tiempo: (receta.tiempo_prep || 0) + (receta.tiempo_coccion || 0), porciones: receta.porciones,
    ingredientes: receta.ingredientes, pasos: receta.pasos,
    notas: { descripcion: receta.descripcion, tips: receta.tips, variantes: receta.variantes, info_nutricional: receta.info_nutricional, calorias_porcion: receta.calorias_porcion, dificultad: receta.dificultad, tags: receta.tags },
    favorita: false
  });
  return { ok: true, id };
}

async function handleGetRecipes(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const { filtro_categoria, filtro_busqueda, solo_favoritas, pagina = 1, por_pagina = 12 } = body;

  let url = `${SUPABASE_URL}/rest/v1/recetas?codigo_usuario=eq.${session.codigo}&order=fecha.desc`;
  if (filtro_categoria) url += `&categoria=eq.${encodeURIComponent(filtro_categoria)}`;
  if (solo_favoritas) url += `&favorita=eq.true`;

  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  let recetas = await r.json();

  if (filtro_busqueda) {
    const q = filtro_busqueda.toLowerCase();
    recetas = recetas.filter(r => r.titulo?.toLowerCase().includes(q) || r.categoria?.toLowerCase().includes(q));
  }

  const total = recetas.length;
  const inicio = (pagina - 1) * por_pagina;
  const paginadas = recetas.slice(inicio, inicio + por_pagina).map(r => ({ ...r, ...(r.notas || {}), favorita: r.favorita }));

  return { ok: true, recetas: paginadas, total, paginas: Math.ceil(total / por_pagina), pagina_actual: pagina };
}

async function handleDeleteRecipe(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const receta = await dbGet('recetas', { id: body.id, codigo_usuario: session.codigo });
  if (!receta) return { ok: false, error: 'No encontrada.' };
  await dbDelete('recetas', { id: body.id });
  return { ok: true };
}

async function handleToggleFavorite(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const receta = await dbGet('recetas', { id: body.id, codigo_usuario: session.codigo });
  if (!receta) return { ok: false, error: 'No encontrada.' };
  await dbUpdate('recetas', { id: body.id }, { favorita: !receta.favorita });
  return { ok: true, favorita: !receta.favorita };
}

// ── PERFIL ──
async function handleGetProfile(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const user = await dbGet('codigos', { codigo: session.codigo });
  const hoy = new Date().toISOString().slice(0, 10);
  const recetas = await dbGetAll('recetas', { codigo_usuario: session.codigo });
  const calHoy = await dbGet('calorias', { codigo_usuario: session.codigo, fecha: hoy });

  return {
    ok: true,
    perfil: {
      email: user?.email, nombre: user?.nombre, plan: user?.plan, vencimiento: user?.vencimiento,
      recetas_guardadas: recetas.length,
      favoritas: recetas.filter(r => r.favorita).length,
      recetas_hoy: recetas.filter(r => r.fecha?.slice(0, 10) === hoy).length,
      limite_diario: user?.plan === 'pro' ? 999 : 5,
      kcal_hoy: calHoy?.kcal_total || 0,
      meta_kcal: calHoy?.meta_kcal || user?.meta_kcal || 2000,
      agua_hoy: calHoy?.agua_vasos || 0,
    }
  };
}

// ── CALORÍAS ──
async function handleLogCalorias(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const fecha = body.fecha || new Date().toISOString().slice(0, 10);
  const comidasNuevas = body.comidas || [];

  const existing = await dbGet('calorias', { codigo_usuario: session.codigo, fecha });
  let comidas = existing ? [...(existing.comidas || []), ...comidasNuevas] : comidasNuevas;
  const kcal_total = Math.round(comidas.reduce((s, c) => s + Number(c.kcal || 0), 0));
  const proteinas = Math.round(comidas.reduce((s, c) => s + Number(c.proteinas || 0), 0));
  const carbohidratos = Math.round(comidas.reduce((s, c) => s + Number(c.carbohidratos || 0), 0));
  const grasas = Math.round(comidas.reduce((s, c) => s + Number(c.grasas || 0), 0));

  const data = { comidas, kcal_total, proteinas, carbohidratos, grasas };

  if (existing) {
    await dbUpdate('calorias', { codigo_usuario: session.codigo, fecha }, data);
  } else {
    const user = await dbGet('codigos', { codigo: session.codigo });
    await dbInsert('calorias', { id: generateId(), codigo_usuario: session.codigo, fecha, ...data, agua_vasos: 0, meta_kcal: user?.meta_kcal || 2000 });
  }

  return { ok: true, fecha, ...data };
}

async function handleGetCalorias(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const fecha = body.fecha || new Date().toISOString().slice(0, 10);
  const row = await dbGet('calorias', { codigo_usuario: session.codigo, fecha });
  const user = await dbGet('codigos', { codigo: session.codigo });
  return { ok: true, dia: fecha, comidas: row?.comidas || [], kcal_total: row?.kcal_total || 0, proteinas: row?.proteinas || 0, carbohidratos: row?.carbohidratos || 0, grasas: row?.grasas || 0, agua_vasos: row?.agua_vasos || 0, meta_kcal: row?.meta_kcal || user?.meta_kcal || 2000, notas: row?.notas || '' };
}

async function handleGetCaloriasSemana(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const dias = body.dias || 7;
  const resultado = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const fecha = d.toISOString().slice(0, 10);
    const row = await dbGet('calorias', { codigo_usuario: session.codigo, fecha });
    resultado.push({ fecha, kcal_total: row?.kcal_total || 0, proteinas: row?.proteinas || 0, carbohidratos: row?.carbohidratos || 0, grasas: row?.grasas || 0, agua_vasos: row?.agua_vasos || 0, meta_kcal: row?.meta_kcal || 2000, cant_comidas: (row?.comidas || []).length });
  }
  const conDatos = resultado.filter(r => r.kcal_total > 0);
  return { ok: true, dias: resultado, promedio_kcal: conDatos.length ? Math.round(conDatos.reduce((s, r) => s + r.kcal_total, 0) / conDatos.length) : 0, promedio_agua: conDatos.length ? Math.round(conDatos.reduce((s, r) => s + r.agua_vasos, 0) / conDatos.length * 10) / 10 : 0, dias_cumplidos: resultado.filter(r => r.kcal_total > 0 && r.kcal_total <= r.meta_kcal).length, dias_con_datos: conDatos.length };
}

async function handleSetMetaKcal(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  await dbUpdate('codigos', { codigo: session.codigo }, { meta_kcal: body.meta_kcal });
  return { ok: true, meta_kcal: body.meta_kcal };
}

async function handleLogAgua(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const fecha = body.fecha || new Date().toISOString().slice(0, 10);
  const existing = await dbGet('calorias', { codigo_usuario: session.codigo, fecha });
  if (existing) {
    await dbUpdate('calorias', { codigo_usuario: session.codigo, fecha }, { agua_vasos: body.vasos });
  } else {
    const user = await dbGet('codigos', { codigo: session.codigo });
    await dbInsert('calorias', { id: generateId(), codigo_usuario: session.codigo, fecha, comidas: [], kcal_total: 0, proteinas: 0, carbohidratos: 0, grasas: 0, agua_vasos: body.vasos, meta_kcal: user?.meta_kcal || 2000 });
  }
  return { ok: true, agua_vasos: body.vasos };
}

// ── PESO ──
async function handleLogPeso(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const fecha = body.fecha || new Date().toISOString().slice(0, 10);
  const existing = await dbGet('peso', { codigo_usuario: session.codigo, fecha });
  if (existing) {
    await dbUpdate('peso', { codigo_usuario: session.codigo, fecha }, { peso_kg: body.peso_kg, notas: body.notas || '' });
  } else {
    await dbInsert('peso', { id: generateId(), codigo_usuario: session.codigo, fecha, peso_kg: body.peso_kg, notas: body.notas || '' });
  }
  return { ok: true, fecha, peso_kg: body.peso_kg };
}

async function handleGetPeso(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const user = await dbGet('codigos', { codigo: session.codigo });
  const registros = await dbGetAll('peso', { codigo_usuario: session.codigo }, 'order=fecha.asc');
  const pesoActual = registros.length ? registros[registros.length - 1].peso_kg : null;
  const primero = user?.peso_inicial || (registros.length ? registros[0].peso_kg : null);
  const bajado = primero && pesoActual ? Math.round((primero - pesoActual) * 10) / 10 : 0;
  const pctBajado = primero && bajado ? Math.round((bajado / primero) * 1000) / 10 : 0;
  const faltaMeta = user?.meta_peso && pesoActual ? Math.round((pesoActual - user.meta_peso) * 10) / 10 : null;
  const pctMeta = user?.meta_peso && primero ? Math.round(((primero - (pesoActual || primero)) / (primero - user.meta_peso)) * 100) : 0;
  return { ok: true, registros, todos: registros, stats: { peso_actual: pesoActual, peso_inicial: primero, peso_min: registros.length ? Math.min(...registros.map(r => r.peso_kg)) : null, peso_max: registros.length ? Math.max(...registros.map(r => r.peso_kg)) : null, kg_bajados: bajado, pct_bajado: pctBajado, meta_peso: user?.meta_peso, falta_meta: faltaMeta, pct_meta: Math.max(0, Math.min(100, pctMeta)), total_registros: registros.length } };
}

async function handleSetPesoMeta(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  await dbUpdate('codigos', { codigo: session.codigo }, { meta_peso: body.meta_peso, peso_inicial: body.peso_inicial });
  return { ok: true };
}

// ── GROQ KEY ──
async function handleGetGroqKey(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  const key = await getConfig('GROQ_API_KEY');
  return { ok: true, key };
}

// ── MERCADOPAGO PREFERENCIA ──
async function handleCreatePreference(body) {
  const { email, nombre, plan } = body;
  if (!email || !plan) return { ok: false, error: 'Email y plan requeridos.' };
  const mpToken = await getConfig('MP_ACCESS_TOKEN');
  const frontendUrl = await getConfig('FRONTEND_URL') || 'https://recetasai.netlify.app';
  const precio = Number(await getConfig('PRECIO_' + plan.toUpperCase()) || (plan === 'pro' ? 39999 : 19999));
  const renderUrl = process.env.RENDER_URL || 'https://recetasai-api.onrender.com';

  const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
    body: JSON.stringify({
      items: [{ title: `RecetasIA — Plan ${plan}`, quantity: 1, currency_id: 'ARS', unit_price: precio }],
      payer: { email, name: nombre || '' },
      back_urls: { success: `${frontendUrl}/pago-exitoso.html`, failure: `${frontendUrl}/pago-fallido.html`, pending: `${frontendUrl}/pago-exitoso.html` },
      auto_return: 'approved',
      external_reference: `${plan}|${email}|${Date.now()}`,
      notification_url: `${renderUrl}/webhook`,
    })
  });
  const data = await r.json();
  if (data.error) return { ok: false, error: data.message };
  return { ok: true, preference_id: data.id, init_point: data.init_point };
}

// ── DIETÉTICAS ──
async function handleGetCiudades(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };

  const url = `${SUPABASE_URL}/rest/v1/dieteticas?select=ciudad&estado=eq.activo`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const data = await r.json();

  // Ciudades únicas
  const ciudades = [...new Set(data.map(d => d.ciudad))].sort();
  return { ok: true, ciudades };
}

async function handleGetDieteticas(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };

  const { ciudad } = body;
  if (!ciudad) return { ok: false, error: 'Ciudad requerida.' };

  const hoy = new Date().toISOString().slice(0, 10);
  const ciudadLimpia = ciudad.trim();
  const url = `${SUPABASE_URL}/rest/v1/dieteticas?ciudad=ilike.*${encodeURIComponent(ciudadLimpia)}*&estado=eq.activo&order=destacado.desc`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  let dieteticas = await r.json();

  // Filtrar vencidas
  dieteticas = dieteticas.filter(d => !d.fecha_vencimiento || d.fecha_vencimiento >= hoy);

  return { ok: true, dieteticas };
}

async function handleSetCiudad(body) {
  const session = await getValidSession(body.token);
  if (!session) return { ok: false, error: 'Sesión inválida.' };
  await dbUpdate('codigos', { codigo: session.codigo }, { ciudad: body.ciudad });
  return { ok: true, ciudad: body.ciudad };
}

async function handleAdminGetDieteticas(body) {
  if (!verifyAdmin(body.admin_token)) return { ok: false, error: 'No autorizado.' };
  const dieteticas = await dbGetAll('dieteticas', {}, 'order=fecha_alta.desc');
  return { ok: true, dieteticas, total: dieteticas.length };
}

async function handleAdminCreateDietetica(body) {
  if (!verifyAdmin(body.admin_token)) return { ok: false, error: 'No autorizado.' };
  const { nombre, ciudad, direccion, telefono, whatsapp, instagram, descripcion, foto_url, fecha_vencimiento, destacado } = body;
  if (!nombre || !ciudad) return { ok: false, error: 'Nombre y ciudad requeridos.' };

  const id = generateId();
  await dbInsert('dieteticas', {
    id, nombre, ciudad, direccion: direccion || '', telefono: telefono || '',
    whatsapp: whatsapp || '', instagram: instagram || '', descripcion: descripcion || '',
    foto_url: foto_url || '', fecha_vencimiento: fecha_vencimiento || null,
    estado: 'activo', destacado: !!destacado
  });
  return { ok: true, id };
}

async function handleAdminUpdateDietetica(body) {
  if (!verifyAdmin(body.admin_token)) return { ok: false, error: 'No autorizado.' };
  const { id, ...campos } = body;
  if (!id) return { ok: false, error: 'ID requerido.' };
  delete campos.admin_token;
  delete campos.action;
  await dbUpdate('dieteticas', { id }, campos);
  return { ok: true };
}

async function handleAdminDeleteDietetica(body) {
  if (!verifyAdmin(body.admin_token)) return { ok: false, error: 'No autorizado.' };
  await dbDelete('dieteticas', { id: body.id });
  return { ok: true };
}

// ── ADMIN ──
const adminTokens = {};

async function handleAdminLogin(body) {
  const correct = await getConfig('ADMIN_PASSWORD');
  if (body.password !== correct) return { ok: false, error: 'Contraseña incorrecta.' };
  const token = generateToken();
  adminTokens[token] = Date.now();
  return { ok: true, admin_token: token };
}

function verifyAdmin(token) {
  if (!token || !adminTokens[token]) return false;
  if (Date.now() - adminTokens[token] > 8 * 60 * 60 * 1000) { delete adminTokens[token]; return false; }
  return true;
}

async function handleAdminGetStats(body) {
  if (!verifyAdmin(body.admin_token)) return { ok: false, error: 'No autorizado.' };
  const codigos = await dbGetAll('codigos', {});
  const pagos = await dbGetAll('pagos', {});
  const recetas = await dbGetAll('recetas', {});
  const hoy = new Date().toISOString().slice(0, 10);
  const esteMes = new Date().toISOString().slice(0, 7);
  return { ok: true, stats: {
    ingresos_total: pagos.filter(p => p.estado === 'aprobado').reduce((s, p) => s + Number(p.monto || 0), 0),
    ingresos_mes: pagos.filter(p => p.estado === 'aprobado' && p.fecha?.slice(0, 7) === esteMes).reduce((s, p) => s + Number(p.monto || 0), 0),
    usuarios_activos: codigos.filter(c => c.estado === 'activo').length,
    usuarios_basico: codigos.filter(c => c.plan === 'basico' && c.estado === 'activo').length,
    usuarios_pro: codigos.filter(c => c.plan === 'pro' && c.estado === 'activo').length,
    recetas_hoy: recetas.filter(r => r.fecha?.slice(0, 10) === hoy).length,
    total_recetas: recetas.length,
    ventas_7d: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - 6 + i);
      const ds = d.toISOString().slice(0, 10);
      return { fecha: ds, cant: pagos.filter(p => p.fecha?.slice(0, 10) === ds).length, monto: pagos.filter(p => p.fecha?.slice(0, 10) === ds).reduce((s, p) => s + Number(p.monto || 0), 0) };
    })
  }};
}

async function handleAdminGetCodes(body) {
  if (!verifyAdmin(body.admin_token)) return { ok: false, error: 'No autorizado.' };
  const codigos = await dbGetAll('codigos', {});
  return { ok: true, codigos, total: codigos.length, paginas: 1 };
}

async function handleAdminCreateCode(body) {
  if (!verifyAdmin(body.admin_token)) return { ok: false, error: 'No autorizado.' };
  const { email, nombre, plan, meses } = body;
  const codigo = generateCode();
  const vencimiento = (plan === 'pro' || meses === 0) ? 'vitalicio' : addMonths(Number(meses) || 12);
  await dbInsert('codigos', { codigo, email: email || '', nombre: nombre || '', plan: plan || 'basico', vencimiento, estado: 'activo', usos: 0 });
  if (email) await sendAccessEmail(email, codigo, plan || 'basico', vencimiento);
  return { ok: true, codigo, vencimiento };
}

async function handleAdminToggleCode(body) {
  if (!verifyAdmin(body.admin_token)) return { ok: false, error: 'No autorizado.' };
  const row = await dbGet('codigos', { codigo: body.codigo });
  if (!row) return { ok: false, error: 'Código no encontrado.' };
  const nuevo = row.estado === 'activo' ? 'suspendido' : 'activo';
  await dbUpdate('codigos', { codigo: body.codigo }, { estado: nuevo });
  return { ok: true, estado: nuevo };
}

async function handleAdminGetPayments(body) {
  if (!verifyAdmin(body.admin_token)) return { ok: false, error: 'No autorizado.' };
  const pagos = await dbGetAll('pagos', {});
  return { ok: true, pagos, total: pagos.length, paginas: 1 };
}

// ── START ──
app.get('/', (req, res) => res.json({ ok: true, msg: 'RecetasIA API activa' }));

app.listen(PORT, () => console.log(`RecetasIA API corriendo en puerto ${PORT}`));
