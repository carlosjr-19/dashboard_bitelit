/**
 * PG_PASARELAS DE PAGO -> CIERRE DIARIO BANCARIO
 * ===========================================
 * Consulta Conekta, OXXO Pay (Digital FEMSA) y Mercado Pago y escribe los montos en las
 * celdas que indiques abajo (PG_CONFIG.CELDAS). Así ya no hay que entrar a cada panel a copiarlos.
 *
 * Qué se obtiene (misma lógica que el Lambda balance-dashboard, ya validada contra los paneles):
 *   - Conekta / OXXO Pay:
 *       proxima_dispersion = transferencia más reciente con status "pending" en GET /transfers
 *                            ("Próxima dispersión" del panel)
 *       saldo_a_favor      = campo "pending" de GET /balance ("Saldo a favor" del panel)
 *       disponible         = campo "available" de GET /balance
 *       ultima_dispersion  = la transferencia más reciente (pendiente o ya pagada) y su fecha
 *   - Mercado Pago (pagos aprobados del día anterior, hora CDMX, vía /v1/payments/search):
 *       neto_ayer          = lo que recibes después de comisiones (net_received_amount)
 *       bruto_ayer         = monto cobrado a los clientes
 *       transacciones_ayer = número de pagos aprobados
 *     (El saldo de la cuenta Mercado Pago requiere un permiso especial que tu token no tiene: da 403.)
 *
 * INSTALACIÓN (una sola vez)
 *   1. En tu Google Sheet: Extensiones > Apps Script > botón "+" > Secuencia de comandos > nómbralo "Pasarelas".
 *      Pega este archivo completo y guarda.
 *   2. Configuración del proyecto (engrane) > Propiedades de la secuencia de comandos > agrega:
 *        CONEKTA_PRIVATE_KEY       = llave privada de Conekta (key_...)
 *        OXXOPAY_PRIVATE_KEY       = llave privada de OXXO Pay / Digital FEMSA
 *        MERCADOPAGO_ACCESS_TOKEN  = access token de producción de Mercado Pago (APP_USR-...)
 *      (Las llaves NO van en el código: así nadie las ve aunque tenga acceso al script.)
 *   3. Ajusta PG_CONFIG.HOJA y PG_CONFIG.CELDAS a tus celdas.
 *   4. Selecciona la función "probarPasarelas" y dale Ejecutar: autoriza los permisos y revisa el
 *      registro de ejecución. No escribe nada en la hoja, solo muestra lo que obtuvo.
 *   5. Ejecuta "activarPasarelasDiario": crea la actualización diaria y el menú "Pasarelas" en la hoja.
 */

const PG_CONFIG = {
  // Pestaña donde están las celdas a llenar
  HOJA: 'MOVIMIENTOS',

  // Qué dato va en qué celda. pasarela: CONEKTA | OXXOPAY | MERCADOPAGO
  // dato Conekta/OXXO: proxima_dispersion | ultima_dispersion | saldo_a_favor | disponible
  // dato Mercado Pago:  neto_ayer | bruto_ayer | transacciones_ayer
  CELDAS: [
    { pasarela: 'CONEKTA',     dato: 'proxima_dispersion', celda: 'D2' },
    { pasarela: 'OXXOPAY',     dato: 'proxima_dispersion', celda: 'D4' },
    { pasarela: 'MERCADOPAGO', dato: 'neto_ayer',          celda: 'D5' },
  ],

  // Pestaña donde se guarda un renglón por consulta (se crea sola). El dashboard puede leerla.
  // Pon '' si no quieres historial.
  HOJA_HISTORIAL: 'HISTORIAL PG_PASARELAS',

  // Hora (CDMX) de la actualización automática diaria
  HORA_DIARIA: 8,
};

const PG_ZONA = 'America/Mexico_City';

const PG_PASARELAS = {
  CONEKTA: { nombre: 'Conekta', tipo: 'conekta', api: 'https://api.conekta.io',
             accept: 'application/vnd.conekta-v2.3.0+json', llave: 'CONEKTA_PRIVATE_KEY' },
  OXXOPAY: { nombre: 'OXXO Pay', tipo: 'conekta', api: 'https://api.digitalfemsa.io',
             accept: 'application/vnd.app-v2.1.0+json', llave: 'OXXOPAY_PRIVATE_KEY' },
  MERCADOPAGO: { nombre: 'Mercado Pago', tipo: 'mercadopago', api: 'https://api.mercadopago.com',
                 llave: 'MERCADOPAGO_ACCESS_TOKEN' },
};

// ----------------------------------------------------------------------------- funciones principales

/** Consulta las pasarelas y escribe los montos en las celdas configuradas. */
function actualizarPasarelas() {
  const resultados = pgConsultarTodas_();
  const hoja = SpreadsheetApp.getActive().getSheetByName(PG_CONFIG.HOJA);
  if (!hoja) throw new Error(`No existe la pestaña "${PG_CONFIG.HOJA}". Revisa PG_CONFIG.HOJA.`);

  const ahora = Utilities.formatDate(new Date(), PG_ZONA, 'dd/MM/yyyy HH:mm');
  const resumen = [];
  PG_CONFIG.CELDAS.forEach(c => {
    const r = resultados[c.pasarela];
    const rango = hoja.getRange(c.celda);
    if (!r || r.error) {
      // No se borra el valor anterior: solo se deja una nota con el error
      rango.setNote(`No se pudo actualizar (${ahora}):\n${r ? r.error : 'pasarela desconocida'}`);
      resumen.push(`${c.celda}: ERROR ${PG_PASARELAS[c.pasarela] ? PG_PASARELAS[c.pasarela].nombre : c.pasarela}`);
      return;
    }
    const valor = r[c.dato];
    if (c.dato === 'proxima_dispersion' && valor === 0) {
      // Sin dispersión pendiente (ya se pagó o aún no se crea): no se pisa el monto que ya estaba
      rango.setNote(`${r.nombre}: sin dispersión pendiente al ${ahora}; se conservó el valor anterior.` +
                    (r.ultima_dispersion != null ? `\nÚltima dispersión: ${pgFormatoPesos_(r.ultima_dispersion)} (${r.ultima_dispersion_fecha || ''})` : ''));
      resumen.push(`${c.celda}: ${r.nombre} sin dispersión pendiente (no se modificó)`);
      return;
    }
    if (valor === undefined || valor === null) {
      rango.setNote(`Sin dato "${c.dato}" (${ahora})`);
      resumen.push(`${c.celda}: sin dato`);
      return;
    }
    rango.setValue(valor);
    rango.setNote(`${r.nombre} · ${c.dato}${r.dia ? ' (' + r.dia + ')' : ''}\nActualizado automáticamente: ${ahora}` +
                  (c.dato === 'proxima_dispersion' && r.proxima_dispersion_fecha ? `\nDispersión creada: ${r.proxima_dispersion_fecha}` : ''));
    resumen.push(`${c.celda}: ${r.nombre} ${pgFormatoPesos_(valor)}`);
  });

  pgGuardarHistorial_(resultados);
  const msg = resumen.join(' · ');
  console.log(msg);
  try { SpreadsheetApp.getActive().toast(msg, 'Pasarelas actualizadas', 8); } catch (e) { /* sin interfaz (disparador) */ }
  return resultados;
}

/** Solo consulta y muestra en el registro; no escribe nada en la hoja. Úsala para probar las llaves. */
function probarPasarelas() {
  const resultados = pgConsultarTodas_();
  Object.keys(resultados).forEach(k => console.log(k, JSON.stringify(resultados[k], null, 2)));
  return resultados;
}

/** Crea la actualización diaria y el menú "Pasarelas". Ejecútala una vez desde el editor. */
function activarPasarelasDiario() {
  desactivarPasarelasDiario();
  ScriptApp.newTrigger('actualizarPasarelas').timeBased().everyDays(1)
    .atHour(PG_CONFIG.HORA_DIARIA).inTimezone(PG_ZONA).create();
  ScriptApp.newTrigger('menuPasarelas').forSpreadsheet(SpreadsheetApp.getActive()).onOpen().create();
  menuPasarelas();
  console.log(`Listo: se actualizará todos los días entre las ${PG_CONFIG.HORA_DIARIA}:00 y ${PG_CONFIG.HORA_DIARIA + 1}:00 (CDMX).`);
}

/** Quita la actualización diaria y el menú creados por este script. */
function desactivarPasarelasDiario() {
  ScriptApp.getProjectTriggers()
    .filter(t => ['actualizarPasarelas', 'menuPasarelas'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/**
 * Agrega el menú "Pasarelas". Se instala con activarPasarelasDiario() como disparador propio,
 * así no choca con el onOpen que ya tengas (por ejemplo, el menú "Cierre Diario").
 */
function menuPasarelas() {
  SpreadsheetApp.getUi().createMenu('Pasarelas')
    .addItem('Actualizar montos ahora', 'actualizarPasarelas')
    .addSeparator()
    .addItem('Activar actualización diaria', 'activarPasarelasDiario')
    .addItem('Desactivar actualización diaria', 'desactivarPasarelasDiario')
    .addToUi();
}

// ----------------------------------------------------------------------------- consultas

function pgConsultarTodas_() {
  const necesarias = [...new Set(PG_CONFIG.CELDAS.map(c => c.pasarela))];
  if (PG_CONFIG.HOJA_HISTORIAL) Object.keys(PG_PASARELAS).forEach(k => { if (!necesarias.includes(k)) necesarias.push(k); });
  const res = {};
  necesarias.forEach(k => {
    const p = PG_PASARELAS[k];
    if (!p) { res[k] = { error: `Pasarela desconocida: ${k}` }; return; }
    const llave = PropertiesService.getScriptProperties().getProperty(p.llave);
    if (!llave) { res[k] = { nombre: p.nombre, error: `Falta la propiedad ${p.llave} en Configuración del proyecto` }; return; }
    try {
      res[k] = Object.assign({ nombre: p.nombre }, p.tipo === 'conekta' ? pgConsultarConekta_(p, llave) : pgConsultarMercadoPago_(p, llave));
    } catch (e) {
      res[k] = { nombre: p.nombre, error: String(e.message || e) };
    }
  });
  return res;
}

/** Conekta y OXXO Pay: misma API, distinto dominio. Montos en centavos. */
function pgConsultarConekta_(p, llave) {
  const headers = { Authorization: `Bearer ${llave}`, Accept: p.accept, 'Accept-Language': 'es' };
  const bal = pgGetJson_(`${p.api}/balance`, headers);
  const pendiente = pgMontoMxn_(bal.pending);
  const disponible = pgMontoMxn_(bal.available);

  const out = {
    saldo_a_favor: pendiente !== null ? pendiente / 100 : null,
    disponible: disponible !== null ? disponible / 100 : null,
    proxima_dispersion: 0,
    proxima_dispersion_fecha: null,
    proxima_dispersion_ref: null,
  };
  try {
    const tr = pgGetJson_(`${p.api}/transfers?limit=10`, headers);
    const todas = tr.data || [];
    if (todas.length) {
      const u = todas.reduce((a, b) => ((b.created_at || 0) > (a.created_at || 0) ? b : a));
      out.ultima_dispersion = (u.amount || 0) / 100;
      out.ultima_dispersion_fecha = u.created_at ? Utilities.formatDate(new Date(u.created_at * 1000), PG_ZONA, 'dd/MM/yyyy HH:mm') : null;
      out.ultima_dispersion_estatus = u.status || null;
    }
    const pendientes = todas.filter(t => t.status === 'pending');
    if (pendientes.length) {
      const t = pendientes.reduce((a, b) => ((b.created_at || 0) > (a.created_at || 0) ? b : a));
      out.proxima_dispersion = (t.amount || 0) / 100;
      out.proxima_dispersion_fecha = t.created_at ? Utilities.formatDate(new Date(t.created_at * 1000), PG_ZONA, 'dd/MM/yyyy HH:mm') : null;
      out.proxima_dispersion_ref = t.statement_reference || null;
    }
  } catch (e) {
    out.proxima_dispersion = null;
    out.error_dispersion = String(e.message || e);
  }
  return out;
}

/** Mercado Pago: pagos aprobados del día anterior (hora CDMX). */
function pgConsultarMercadoPago_(p, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const ayer = new Date(Date.now() - 24 * 3600 * 1000);
  const dia = Utilities.formatDate(ayer, PG_ZONA, 'yyyy-MM-dd');
  const base = `${p.api}/v1/payments/search?sort=date_approved&criteria=asc&range=date_approved` +
               `&begin_date=${encodeURIComponent(dia + 'T00:00:00.000-06:00')}` +
               `&end_date=${encodeURIComponent(dia + 'T23:59:59.999-06:00')}&status=approved&limit=100`;
  let offset = 0, total = Infinity, bruto = 0, neto = 0, n = 0;
  while (offset < total && offset < 10000) {
    const r = pgGetJson_(`${base}&offset=${offset}`, headers);
    total = (r.paging && r.paging.total) || 0;
    const res = r.results || [];
    res.forEach(pg => {
      n += 1;
      bruto += Number(pg.transaction_amount || 0);
      neto += Number((pg.transaction_details && pg.transaction_details.net_received_amount) || 0);
    });
    if (!res.length) break;
    offset += res.length;
  }
  return {
    dia: dia,
    transacciones_ayer: n,
    bruto_ayer: Math.round(bruto * 100) / 100,
    neto_ayer: Math.round(neto * 100) / 100,
    comisiones_ayer: Math.round((bruto - neto) * 100) / 100,
  };
}

// ----------------------------------------------------------------------------- historial

function pgGuardarHistorial_(resultados) {
  if (!PG_CONFIG.HOJA_HISTORIAL) return;
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName(PG_CONFIG.HOJA_HISTORIAL);
  if (!h) {
    h = ss.insertSheet(PG_CONFIG.HOJA_HISTORIAL);
    h.appendRow(['Fecha', 'Hora', 'Pasarela', 'Saldo a favor', 'Disponible', 'Próxima dispersión',
                 'Fecha dispersión', 'Referencia', 'Última dispersión', 'Fecha última dispersión',
                 'Ventas ayer (bruto)', 'Ventas ayer (neto)', 'Transacciones ayer', 'Error']);
    h.setFrozenRows(1);
    h.getRange('A1:N1').setFontWeight('bold');
  }
  const ahora = new Date();
  const fecha = Utilities.formatDate(ahora, PG_ZONA, 'yyyy-MM-dd');
  const hora = Utilities.formatDate(ahora, PG_ZONA, 'HH:mm');
  Object.keys(resultados).forEach(k => {
    const r = resultados[k];
    h.appendRow([fecha, hora, r.nombre || k,
      pgVacio_(r.saldo_a_favor), pgVacio_(r.disponible),
      pgVacio_(r.proxima_dispersion), r.proxima_dispersion_fecha || '', r.proxima_dispersion_ref || '',
      pgVacio_(r.ultima_dispersion), r.ultima_dispersion_fecha || '',
      pgVacio_(r.bruto_ayer), pgVacio_(r.neto_ayer), pgVacio_(r.transacciones_ayer),
      r.error || r.error_dispersion || '']);
  });
}

// ----------------------------------------------------------------------------- utilidades

function pgGetJson_(url, headers) {
  for (let intento = 1; intento <= 3; intento++) {
    const resp = UrlFetchApp.fetch(url, { method: 'get', headers, muteHttpExceptions: true });
    const code = resp.getResponseCode();
    if (code >= 200 && code < 300) return JSON.parse(resp.getContentText());
    if ([429, 500, 502, 503, 504].includes(code) && intento < 3) { Utilities.sleep(2000 * intento); continue; }
    throw new Error(`HTTP ${code} en ${url.replace(/\?.*/, '')}: ${resp.getContentText().slice(0, 300)}`);
  }
}

/** Conekta devuelve listas [{amount, currency}]; toma MXN (o la primera). */
function pgMontoMxn_(lista) {
  if (!lista || !lista.length) return null;
  const mxn = lista.find(x => x.currency === 'MXN');
  return (mxn || lista[0]).amount;
}

function pgNum_(v) { return v === undefined || v === null ? null : Number(v); }
function pgVacio_(v) { return v === undefined || v === null ? '' : v; }
function pgFormatoPesos_(v) { return '$' + Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
