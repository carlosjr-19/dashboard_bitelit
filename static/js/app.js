/**
 * Bitelit Interactive Dashboard Application Logic
 */

const BitelitApp = {
  data: null,
  activeTab: 'overview',
  filters: {
    search: '',
    ticketsStatus: 'all',
    ticketsAgent: 'all',
    procesosType: 'all',
    procesosAgent: 'all',
    finanzasBank: 'all',
    finanzasStatus: 'all'
  },
  pagination: {
    ticketsPage: 1,
    ticketsPerPage: 10,
    procesosPage: 1,
    procesosPerPage: 10,
    finanzasPage: 1,
    finanzasPerPage: 10,
    activacionesPage: 1,
    activacionesPerPage: 10
  },

  async init() {
    this.setupEventListeners();
    await this.fetchData();
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
  },

  updateClock() {
    const el = document.getElementById('liveClock');
    if (el) {
      const now = new Date();
      // Una sola línea, p. ej. "mar 20 oct · 17:32"
      const fecha = now.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '').replace(/\s+de\s+/g, ' ');
      const hora = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
      el.textContent = `${fecha} · ${hora}`;
    }
  },

  async fetchData(force = false) {
    try {
      this.showLoading(true);
      const url = force ? '/api/reload' : '/api/data';
      const method = force ? 'POST' : 'GET';
      const response = await fetch(url, { method });
      const result = await response.json();
      if (force && (result.status !== 'success' || !result.data)) {
        throw new Error(result.message || 'El servidor no pudo sincronizar');
      }
      this.data = force ? result.data : result;
      this.renderAll();
      this.showLoading(false);
      if (force) {
        this.showToast('Datos sincronizados correctamente con Google Sheets.');
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      this.showLoading(false);
      this.showToast('Error al sincronizar: ' + (err.message || 'revisa la consola'), 'error');
    }
  },

  showLoading(isLoading) {
    const loader = document.getElementById('globalLoader');
    if (loader) {
      loader.style.display = isLoading ? 'flex' : 'none';
    }
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `bitelit-card px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg border transition-all duration-300 transform translate-y-2 ${
      type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-blue-100 text-slate-800'
    }`;
    toast.innerHTML = `
      <div class="w-2 h-2 rounded-full ${type === 'error' ? 'bg-red-500' : 'bg-blue-600'}"></div>
      <span class="text-xs font-medium">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = btn.getAttribute('data-tab-target');
        this.switchTab(target);
      });
    });

    // Global Search
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value.toLowerCase().trim();
        this.renderCurrentTab();
      });
    }

    // Reload Button
    const reloadBtn = document.getElementById('btnReloadData');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.fetchData(true));
    }

    // Guardar configuración de fuentes
    const saveSrcBtn = document.getElementById('btnSaveSources');
    if (saveSrcBtn) saveSrcBtn.addEventListener('click', () => this.saveSourcesConfig());
    const adminForm = document.getElementById('adminForm');
    if (adminForm) adminForm.addEventListener('submit', (e) => { e.preventDefault(); this.adminDesbloquear(); });
    const lockBtn = document.getElementById('btnLockSources');
    if (lockBtn) lockBtn.addEventListener('click', () => this.adminBloquear());
    this.adminRefrescar();

    // Modal Closer
    const modalCloseBtn = document.getElementById('closeModalBtn');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.closeTicketModal());
    }
    const modalBackdrop = document.getElementById('ticketModal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) this.closeTicketModal();
      });
    }
  },

  switchTab(tabId) {
    this.activeTab = tabId;
    
    // Update navigation styles
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
      if (btn.getAttribute('data-tab-target') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Show / Hide Tab Contents
    document.querySelectorAll('.tab-content-panel').forEach(panel => {
      if (panel.id === `panel-${tabId}`) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // Re-render relevant charts for current tab to avoid sizing glitches
    setTimeout(() => {
      if (tabId === 'overview') BitelitCharts.renderOverviewCharts(this.ovAgg);
      if (tabId === 'tickets') BitelitCharts.renderTicketsCharts(this.data);
      if (tabId === 'procesos') BitelitCharts.renderProcesosCharts(this.data);
      if (tabId === 'finanzas') this.renderFinanzas();
      if (['activaciones', 'portabilidades', 'port-outs'].includes(tabId)) {
        this.updateFilteredCharts();
      }
    }, 50);

    this.renderCurrentTab();
  },

  renderAll() {
    this.setupExportListeners();
    if (!this.data) return;
    this.renderOverview();
    this.renderTickets();
    this.renderProcesos();
    this.renderActivaciones();
    this.renderFinanzas();
    this.renderArchivos();

    // Trigger charts
    BitelitCharts.renderOverviewCharts(this.ovAgg);
    BitelitCharts.renderTicketsCharts(this.data);
    BitelitCharts.renderProcesosCharts(this.data);
    this.updateFilteredCharts();
    this.renderCurrentTab();  // la tabla de la pestaña abierta también debe mostrar los datos nuevos
  },

  renderCurrentTab() {
    if (this.activeTab === 'tickets') this.renderTicketsTable();
    if (this.activeTab === 'procesos') this.renderProcesosTable();
    if (this.activeTab === 'activaciones') this.renderActivacionesTable();
    if (this.activeTab === 'finanzas') this.renderFinanzasTable();
    if (this.activeTab === 'portabilidades') this.renderPortabilidadesTable();
    if (this.activeTab === 'port-outs') this.renderPortOutsTable();
    if (this.activeTab === 'archivos') this.renderArchivos();
  },

  
  exportToCSV(filename, records) {
    if (!records || !records.length) {
      alert("No hay datos para exportar en este rango de fechas.");
      return;
    }
    const headers = Object.keys(records[0]).join(",");
    const rows = records.map(r => Object.values(r).map(v => `"${v}"`).join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  
  filterByDateRange(records, startId, endId) {
    const startEl = document.getElementById(startId);
    const endEl = document.getElementById(endId);
    const start = startEl ? startEl.value : '';
    const end = endEl ? endEl.value : '';
    let filtered = records;
    if (start) {
      filtered = filtered.filter(r => r.fecha >= start);
    }
    if (end) {
      filtered = filtered.filter(r => r.fecha <= end);
    }
    return filtered;
  },

  setupExportListeners() {
    if (this._exportListenersReady) return;
    this._exportListenersReady = true;

    // Port In: al entrar se muestra el mes en curso (del día 1 a hoy); el usuario puede cambiar el rango
    const pad = (n) => String(n).padStart(2, '0');
    const hoy = new Date();
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const iniPI = document.getElementById('dateStartPortIn');
    const finPI = document.getElementById('dateEndPortIn');
    if (iniPI && !iniPI.value) iniPI.value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    if (finPI && !finPI.value) finPI.value = iso(hoy);
    // Activaciones: mes en curso por defecto
    const iniAct = document.getElementById('dateStartAct');
    const finAct = document.getElementById('dateEndAct');
    if (iniAct && !iniAct.value) iniAct.value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    if (finAct && !finAct.value) finAct.value = iso(hoy);
    // Port Out: igual, mes en curso por defecto
    const iniPO = document.getElementById('dateStartPortOut');
    const finPO = document.getElementById('dateEndPortOut');
    if (iniPO && !iniPO.value) iniPO.value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    if (finPO && !finPO.value) finPO.value = iso(hoy);
    const btnAct = document.getElementById('btnExportAct');
    if (btnAct) btnAct.addEventListener('click', () => {
      const records = this.filterByDateRange(this.data.activaciones.records, 'dateStartAct', 'dateEndAct');
      this.exportToCSV('activaciones.csv', records);
    });

    const btnPortIn = document.getElementById('btnExportPortIn');
    if (btnPortIn) btnPortIn.addEventListener('click', () => {
      const records = this.filterByDateRange(this.data.portabilidades.records, 'dateStartPortIn', 'dateEndPortIn');
      this.exportToCSV('portabilidades.csv', records);
    });

    const btnPortOut = document.getElementById('btnExportPortOut');
    if (btnPortOut) btnPortOut.addEventListener('click', () => {
      const records = this.filterByDateRange(this.data.port_outs.records, 'dateStartPortOut', 'dateEndPortOut');
      this.exportToCSV('port_outs.csv', records);
    });
    
    // Add change listeners to inputs to re-render tables
    const reRender = () => { this.pagination.activacionesPage = 1; this.renderCurrentTab(); this.updateFilteredCharts(); };
    ['dateStartAct', 'dateEndAct', 'dateStartPortIn', 'dateEndPortIn', 'dateStartPortOut', 'dateEndPortOut'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', reRender);
    });
  },

  // Recalcula totales y gráficas de Port In / Port Out / Activaciones según el rango de fechas
  updateFilteredCharts() {
    if (!this.data) return;

    // Port In (los registros ya vienen filtrados por FVC Solicitada = SI desde el backend)
    let portIn = this.data.portabilidades ? (this.data.portabilidades.records || []) : [];
    portIn = this.filterByDateRange(portIn, 'dateStartPortIn', 'dateEndPortIn');
    const portInEl = document.getElementById('totalPortIn');
    if (portInEl) portInEl.textContent = portIn.length.toLocaleString();
    BitelitCharts.renderPortabilidadesCharts({ portabilidades: { records: portIn } });

    // Port Out
    let portOut = this.data.port_outs ? (this.data.port_outs.records || []) : [];
    portOut = this.filterByDateRange(portOut, 'dateStartPortOut', 'dateEndPortOut');
    const portOutEl = document.getElementById('totalPortOut');
    if (portOutEl) portOutEl.textContent = portOut.length.toLocaleString();
    BitelitCharts.renderPortOutsCharts({ port_outs: { records: portOut } });

    // Activaciones
    if (this.data.activaciones) {
      const actRecords = this.filterByDateRange(this.data.activaciones.records || [], 'dateStartAct', 'dateEndAct');
      const ini = (document.getElementById('dateStartAct') || {}).value;
      const fin = (document.getElementById('dateEndAct') || {}).value;
      const per = document.getElementById('actPeriodo');
      if (per) per.textContent = (ini || fin) ? `Del ${ini || 'inicio'} al ${fin || 'hoy'}` : 'Todo el historial';
      const dateCounts = {}, pkgCounts = {}, brandCounts = {};
      actRecords.forEach(r => {
        if (r.fecha) dateCounts[r.fecha] = (dateCounts[r.fecha] || 0) + 1;
        pkgCounts[r.paquete] = (pkgCounts[r.paquete] || 0) + 1;
        brandCounts[r.marca] = (brandCounts[r.marca] || 0) + 1;
      });
      const toList = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(e => ({ name: e[0], count: e[1] }));
      const timeline = Object.entries(dateCounts).sort().map(e => ({ date: e[0], count: e[1] }));
      const top_packages = toList(pkgCounts), top_brands = toList(brandCounts);
      BitelitCharts.renderActivacionesCharts({ activaciones: { timeline, top_packages, top_brands } });
      const actTotalEl = document.getElementById('actTotal');
      if (actTotalEl) actTotalEl.textContent = actRecords.length.toLocaleString();
      const pk = document.getElementById('actTopPackage');
      if (pk) pk.textContent = top_packages.length ? `${top_packages[0].name} (${top_packages[0].count})` : '—';
      const br = document.getElementById('actTopBrand');
      if (br) br.textContent = top_brands.length ? `${top_brands[0].name} (${top_brands[0].count})` : '—';
    }
  },

  // 1. OVERVIEW (siempre del mes en curso)
  renderOverview() {
    const pad = (n) => String(n).padStart(2, '0');
    const hoy = new Date();
    const ini = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`;
    const fin = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
    const enMes = (arr) => (arr || []).filter(r => r.fecha && r.fecha >= ini && r.fecha <= fin);
    const cuenta = (arr, k) => {
      const o = {};
      arr.forEach(r => { const v = r[k] || 'Sin dato'; o[v] = (o[v] || 0) + 1; });
      return Object.entries(o).sort((a, b) => b[1] - a[1]);
    };
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    const n = (v) => Number(v || 0).toLocaleString('es-MX');
    const money = (v) => `$${Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const D = this.data;

    const mesNombre = hoy.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    set('ovMesLabel', `${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} · al ${hoy.getDate()}`);

    // Ingresos: abonos bancarios del mes (hoja de cierre diario)
    const F = D.finanzas || {};
    const movMes = enMes(F.movimientos);
    const ing = movMes.reduce((a, m) => a + (m.abono || 0), 0);
    const nAb = movMes.filter(m => m.abono).length;
    set('ovTotalIngresos', F.configurado ? `${money(ing)} MXN` : 'Sin conectar');
    set('ovFinPeriodo', F.configurado ? `${n(nAb)} depósitos` : 'Ver Fuentes de Datos');
    const totBancos = (F.totales || []).find(t => /total bancos/i.test(t.name)) || (F.totales || []).slice(-1)[0];
    set('ovTicketPromedio', totBancos ? `${money(totBancos.monto)} MXN` : '—');

    // Tickets
    const tck = enMes((D.tickets || {}).records);
    const cerr = tck.filter(t => t.estatus === 'Cerrado').length;
    set('ovTotalTickets', n(tck.length));
    set('ovCerradosPct', tck.length ? `${(cerr / tck.length * 100).toFixed(1)}% resueltos` : 'Sin tickets');
    set('ovTicketsProceso', n(tck.length - cerr));

    // Trámites
    const proc = enMes((D.procesos || {}).records);
    const porTipo = cuenta(proc, 'proceso');
    const tipo = (nombre) => (porTipo.find(([k]) => k.toLowerCase() === nombre.toLowerCase()) || [0, 0])[1];
    set('ovTotalProcesos', n(proc.length));
    set('ovSimSwaps', `Sim Swaps: ${n(tipo('Sim Swap'))}`);
    set('ovCambiosDn', `${n(tipo('Cambio de DN'))} casos`);

    // Activaciones
    const act = enMes((D.activaciones || {}).records);
    const actMarca = cuenta(act, 'marca'), actPaq = cuenta(act, 'paquete');
    set('ovTotalActivaciones', n(act.length));
    set('ovActMarca', actMarca.length ? `Top: ${actMarca[0][0]} (${n(actMarca[0][1])})` : 'Sin activaciones');
    set('ovActPaquete', actPaq.length ? actPaq[0][0] : '—');

    // Port In (ya filtrado a FVC solicitada = SI)
    const pin = enMes((D.portabilidades || {}).records);
    const pinOp = cuenta(pin, 'operador'), pinMarca = cuenta(pin, 'marca');
    set('ovPortIn', n(pin.length));
    set('ovPortInOp', pinOp.length ? `Vienen de ${pinOp[0][0].split(',')[0]} (${n(pinOp[0][1])})` : 'Sin portabilidades');
    set('ovPortInMarca', pinMarca.length ? `${pinMarca[0][0]} (${n(pinMarca[0][1])})` : '—');

    // Port Out
    const pout = enMes((D.port_outs || {}).records);
    const poutOp = cuenta(pout, 'operador');
    const conDias = pout.filter(r => r.dias != null);
    set('ovPortOut', n(pout.length));
    set('ovPortOutDias', conDias.length ? `Duraron ${Math.round(conDias.reduce((a, r) => a + r.dias, 0) / conDias.length)} días en prom.` : 'Sin dato de días');
    set('ovPortOutOp', poutOp.length ? `${poutOp[0][0].split(',')[0]} (${n(poutOp[0][1])})` : '—');

    // Destacados
    const motivos = cuenta(tck, 'motivo');
    set('ovHlFalla', motivos.length ? `${motivos[0][0]}: ${n(motivos[0][1])} de ${n(tck.length)} tickets del mes (${(motivos[0][1] / tck.length * 100).toFixed(0)}%).` : 'Sin tickets este mes.');
    const neto = pin.length - pout.length;
    set('ovHlBalance', (pin.length || pout.length) ? `Entraron ${n(pin.length)} líneas y salieron ${n(pout.length)}: balance ${neto >= 0 ? '+' : ''}${n(neto)} en el mes.` : 'Sin movimientos de portabilidad este mes.');
    const porCat = {};
    movMes.forEach(m => { if (m.abono) porCat[m.categoria] = (porCat[m.categoria] || 0) + m.abono; });
    const topCat = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
    set('ovPasarelaPrincipal', topCat ? `${topCat[0]} aporta el ${(topCat[1] / ing * 100).toFixed(1)}% de los abonos del mes (${money(topCat[1])}).` : (F.configurado ? 'Sin abonos registrados este mes.' : 'Conecta la hoja de cierre bancario en Fuentes de Datos.'));

    // Datos para las gráficas del resumen
    const dias = [];
    for (let d = 1; d <= hoy.getDate(); d++) dias.push(`${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(d)}`);
    const porDia = (arr) => dias.map(f => arr.filter(r => r.fecha === f).length);
    this.ovAgg = { dias, portIn: porDia(pin), portOut: porDia(pout), procesos: porTipo, totalProcesos: proc.length };
  },

  // 2. TICKETS
  renderTickets() {
    const t = this.data.tickets;
    document.getElementById('tckTotal').textContent = t.total.toLocaleString();
    document.getElementById('tckCerrados').textContent = t.cerrados.toLocaleString();
    document.getElementById('tckEnProceso').textContent = t.en_proceso.toLocaleString();
    document.getElementById('tckTasa').textContent = `${t.tasa_resolucion}%`;

    // Populate Agente Filter
    const agentSelect = document.getElementById('filterTicketAgent');
    if (agentSelect && agentSelect.options.length <= 1) {
      agentSelect.innerHTML = '<option value="all">Todos los agentes</option>';
      t.top_agentes.forEach(ag => {
        agentSelect.innerHTML += `<option value="${ag.name}">${ag.name} (${ag.count})</option>`;
      });
      agentSelect.addEventListener('change', (e) => {
        this.filters.ticketsAgent = e.target.value;
        this.pagination.ticketsPage = 1;
        this.renderTicketsTable();
      });
    }

    // Status Filter
    const statusSelect = document.getElementById('filterTicketStatus');
    if (statusSelect && !statusSelect.hasAttribute('data-bound')) {
      statusSelect.setAttribute('data-bound', 'true');
      statusSelect.addEventListener('change', (e) => {
        this.filters.ticketsStatus = e.target.value;
        this.pagination.ticketsPage = 1;
        this.renderTicketsTable();
      });
    }

    this.renderTicketsTable();
  },

  renderTicketsTable() {
    const tbody = document.getElementById('ticketsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let records = this.data.tickets.records || [];

    // Filters
    if (this.filters.ticketsStatus !== 'all') {
      records = records.filter(r => r.estatus === this.filters.ticketsStatus);
    }
    if (this.filters.ticketsAgent !== 'all') {
      records = records.filter(r => r.agente.toLowerCase() === this.filters.ticketsAgent.toLowerCase());
    }
    if (this.filters.search) {
      const q = this.filters.search;
      records = records.filter(r => 
        r.id.toLowerCase().includes(q) || 
        r.dn.toLowerCase().includes(q) || 
        r.motivo.toLowerCase().includes(q) || 
        r.descripcion.toLowerCase().includes(q) ||
        r.agente.toLowerCase().includes(q)
      );
    }

    // Pagination
    const page = this.pagination.ticketsPage;
    const perPage = this.pagination.ticketsPerPage;
    const totalPages = Math.ceil(records.length / perPage) || 1;
    const slice = records.slice((page - 1) * perPage, page * perPage);

    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">No se encontraron tickets con los filtros aplicados.</td></tr>`;
      return;
    }

    slice.forEach(r => {
      const tr = document.createElement('tr');
      const badgeClass = r.estatus === 'Cerrado' ? 'badge-success' : 'badge-warning';
      tr.innerHTML = `
        <td class="font-medium text-blue-900">${r.id}</td>
        <td class="text-slate-500">${r.fecha}</td>
        <td class="font-mono text-xs">${r.dn}</td>
        <td><span class="badge-pill badge-cyan">${r.motivo}</span></td>
        <td class="font-medium">${r.agente}</td>
        <td><span class="badge-pill ${badgeClass}">${r.estatus}</span></td>
        <td class="text-right">
          <button class="btn-tertiary text-xs py-1 px-2.5" onclick="BitelitApp.openTicketModal('${r.id}')">
            Detalle
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Pagination info
    const info = document.getElementById('ticketsPaginationInfo');
    if (info) {
      info.textContent = `Mostrando ${slice.length} de ${records.length} tickets (Página ${page} de ${totalPages})`;
    }
    this.renderPaginationControls('ticketsPaginationBtns', page, totalPages, (newPage) => {
      this.pagination.ticketsPage = newPage;
      this.renderTicketsTable();
    });
  },

  openTicketModal(ticketId) {
    const ticket = this.data.tickets.records.find(t => t.id === ticketId);
    if (!ticket) return;

    document.getElementById('modalTicketId').textContent = ticket.id;
    document.getElementById('modalTicketFecha').textContent = ticket.fecha;
    document.getElementById('modalTicketDn').textContent = ticket.dn;
    document.getElementById('modalTicketAgente').textContent = ticket.agente;
    document.getElementById('modalTicketMotivo').textContent = ticket.motivo;
    
    const statusEl = document.getElementById('modalTicketStatus');
    statusEl.textContent = ticket.estatus;
    statusEl.className = `badge-pill ${ticket.estatus === 'Cerrado' ? 'badge-success' : 'badge-warning'}`;

    document.getElementById('modalTicketDescripcion').textContent = ticket.descripcion_full || ticket.descripcion;
    document.getElementById('modalTicketRespuesta').textContent = ticket.respuesta || 'En espera de respuesta técnica de Altan Redes.';

    const modal = document.getElementById('ticketModal');
    if (modal) modal.classList.remove('hidden');
  },

  closeTicketModal() {
    const modal = document.getElementById('ticketModal');
    if (modal) modal.classList.add('hidden');
  },

  // 3. PROCESOS
  renderProcesos() {
    const p = this.data.procesos;
    document.getElementById('procTotal').textContent = p.total.toLocaleString();
    document.getElementById('procSimSwap').textContent = p.sim_swap_count.toLocaleString();
    document.getElementById('procCambioDn').textContent = p.cambio_dn_count.toLocaleString();
    document.getElementById('procRollback').textContent = p.rollback_count.toLocaleString();

    // Process Type Filter
    const typeSelect = document.getElementById('filterProcType');
    if (typeSelect && typeSelect.options.length <= 1) {
      typeSelect.innerHTML = '<option value="all">Todos los trámites</option>';
      p.by_type.forEach(pt => {
        typeSelect.innerHTML += `<option value="${pt.name}">${pt.name} (${pt.count})</option>`;
      });
      typeSelect.addEventListener('change', (e) => {
        this.filters.procesosType = e.target.value;
        this.pagination.procesosPage = 1;
        this.renderProcesosTable();
      });
    }

    // Process Agent Filter
    const agSelect = document.getElementById('filterProcAgent');
    if (agSelect && agSelect.options.length <= 1) {
      agSelect.innerHTML = '<option value="all">Todos los agentes</option>';
      p.by_agente.forEach(ag => {
        agSelect.innerHTML += `<option value="${ag.name}">${ag.name} (${ag.count})</option>`;
      });
      agSelect.addEventListener('change', (e) => {
        this.filters.procesosAgent = e.target.value;
        this.pagination.procesosPage = 1;
        this.renderProcesosTable();
      });
    }

    this.renderProcesosTable();
  },

  renderProcesosTable() {
    const tbody = document.getElementById('procesosTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let records = this.data.procesos.records || [];

    if (this.filters.procesosType !== 'all') {
      records = records.filter(r => r.proceso === this.filters.procesosType);
    }
    if (this.filters.procesosAgent !== 'all') {
      records = records.filter(r => r.agente.toLowerCase() === this.filters.procesosAgent.toLowerCase());
    }
    if (this.filters.search) {
      const q = this.filters.search;
      records = records.filter(r => 
        r.proceso.toLowerCase().includes(q) || 
        r.motivo.toLowerCase().includes(q) || 
        r.dn.toLowerCase().includes(q) || 
        r.agente.toLowerCase().includes(q) ||
        r.marca.toLowerCase().includes(q)
      );
    }

    const page = this.pagination.procesosPage;
    const perPage = this.pagination.procesosPerPage;
    const totalPages = Math.ceil(records.length / perPage) || 1;
    const slice = records.slice((page - 1) * perPage, page * perPage);

    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">No se encontraron trámites registrados.</td></tr>`;
      return;
    }

    slice.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-slate-500">${r.fecha}</td>
        <td><span class="badge-pill ${r.proceso === 'Sim Swap' ? 'badge-cyan' : 'badge-info'}">${r.proceso}</span></td>
        <td class="text-slate-700 text-xs">${r.motivo}</td>
        <td class="font-mono text-xs font-medium">${r.dn}</td>
        <td class="text-slate-500 text-xs">${r.marca}</td>
        <td class="font-medium text-slate-800">${r.agente}</td>
      `;
      tbody.appendChild(tr);
    });

    const info = document.getElementById('procesosPaginationInfo');
    if (info) {
      info.textContent = `Mostrando ${slice.length} de ${records.length} trámites (Página ${page} de ${totalPages})`;
    }
    this.renderPaginationControls('procesosPaginationBtns', page, totalPages, (newPage) => {
      this.pagination.procesosPage = newPage;
      this.renderProcesosTable();
    });
  },

  // 4. ACTIVACIONES
  renderActivaciones() {
    const a = this.data.activaciones;
    document.getElementById('actTotal').textContent = a.total.toLocaleString();
    if (a.top_packages.length > 0) {
      document.getElementById('actTopPackage').textContent = a.top_packages[0].name.slice(0, 20);
    }
    if (a.top_brands.length > 0) {
      document.getElementById('actTopBrand').textContent = a.top_brands[0].name;
    }
    this.renderActivacionesTable();
  },

  renderActivacionesTable() {
    const tbody = document.getElementById('activacionesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let records = this.data.activaciones.records || [];
    records = this.filterByDateRange(records, 'dateStartAct', 'dateEndAct');

    if (this.filters.search) {
      const q = this.filters.search;
      records = records.filter(r => 
        r.msisdn.toLowerCase().includes(q) || 
        r.nombre.toLowerCase().includes(q) || 
        r.paquete.toLowerCase().includes(q) || 
        r.marca.toLowerCase().includes(q)
      );
    }

    const page = this.pagination.activacionesPage;
    const perPage = this.pagination.activacionesPerPage;
    const totalPages = Math.ceil(records.length / perPage) || 1;
    const slice = records.slice((page - 1) * perPage, page * perPage);

    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">No hay activaciones en el rango seleccionado.</td></tr>`;
      const info0 = document.getElementById('activacionesPaginationInfo');
      if (info0) info0.textContent = '0 líneas';
      this.renderPaginationControls('activacionesPaginationBtns', 1, 1, () => {});
      return;
    }

    slice.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono text-xs font-semibold text-blue-900">${r.msisdn}</td>
        <td class="text-slate-800 text-xs">${r.nombre}</td>
        <td><span class="badge-pill badge-cyan">${r.paquete}</span></td>
        <td class="text-slate-600 text-xs font-medium">${r.marca}</td>
        <td class="text-slate-400 text-xs">${r.fecha}</td>
      `;
      tbody.appendChild(tr);
    });

    const info = document.getElementById('activacionesPaginationInfo');
    if (info) {
      info.textContent = `Mostrando ${slice.length} de ${records.length} líneas (Página ${page} de ${totalPages})`;
    }
    this.renderPaginationControls('activacionesPaginationBtns', page, totalPages, (newPage) => {
      this.pagination.activacionesPage = newPage;
      this.renderActivacionesTable();
    });
  },

  // 5. FINANZAS (Google Sheet "CIERRE DIARIO BANCARIO")
  finanzasAgg() {
    const f = this.data.finanzas || {};
    const movs = this.filterByDateRange(f.movimientos || [], 'dateStartFin', 'dateEndFin');
    const sum = (arr, k) => arr.reduce((a, m) => a + (Number(m[k]) || 0), 0);
    const fechas = [...new Set(movs.map(m => m.fecha))].sort();
    const porDia = (k) => fechas.map(fe => sum(movs.filter(m => m.fecha === fe), k));
    const cats = {};
    movs.forEach(m => { if (m.abono) cats[m.categoria] = (cats[m.categoria] || 0) + m.abono; });
    return {
      movs, fechas,
      abonos: sum(movs, 'abono'), cargos: sum(movs, 'cargo'),
      nAbonos: movs.filter(m => m.abono).length, nCargos: movs.filter(m => m.cargo).length,
      abonosDia: porDia('abono'), cargosDia: porDia('cargo'),
      categorias: Object.entries(cats).sort((a, b) => b[1] - a[1]),
      conceptos: (f.conceptos || []).slice().sort((a, b) => b.monto - a.monto)
    };
  },

  renderFinanzas() {
    const f = this.data.finanzas || {};
    const money = (v) => `$${Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

    // Rango por defecto: mes en curso
    const pad = (n) => String(n).padStart(2, '0');
    const hoy = new Date();
    const ini = document.getElementById('dateStartFin'), fin = document.getElementById('dateEndFin');
    if (ini && !ini.value) ini.value = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`;
    if (fin && !fin.value) fin.value = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

    const aviso = document.getElementById('finAvisoFuente');
    const errs = ((this.data.fuentes || {}).errores || {}).finanzas || [];
    if (aviso) {
      if (!f.configurado) {
        aviso.classList.remove('hidden');
        aviso.innerHTML = '<strong>Falta conectar la hoja "CIERRE DIARIO BANCARIO".</strong> Ve a <em>Fuentes de Datos</em>, pega su ID o URL en "Cierre diario bancario" y presiona Guardar y sincronizar. Compártela antes con el correo de la cuenta de servicio de credentials.json.';
      } else if (errs.length) {
        aviso.classList.remove('hidden');
        aviso.innerHTML = `<strong>Hubo problemas al leer la hoja de cierre:</strong><br>${errs.join('<br>')}`;
      } else aviso.classList.add('hidden');
    }
    set('finSubtitulo', f.corte ? `${f.titulo || 'Cierre diario bancario'} · acumulado al ${f.corte}` : (f.titulo || 'Cierre diario bancario'));

    // Tarjetas de totales (las que tenga el resumen: TOTAL INGRESOS, TOTAL EGRESOS, SALDO EN BANCO...)
    const tot = document.getElementById('finTotales');
    if (tot) {
      const tots = f.totales || [];
      tot.innerHTML = tots.length ? tots.map((t, i) => {
        const dark = i === 0;
        const label = t.name.charAt(0) + t.name.slice(1).toLowerCase();
        return `<div class="${dark ? 'metric-card-dark' : 'bitelit-card p-4'} flex flex-col justify-between">
          <span class="text-xs uppercase tracking-wider ${dark ? 'text-blue-200' : 'text-slate-500'} font-medium">${label}</span>
          <div class="text-xl lg:text-2xl font-bold tracking-tight my-2 ${dark ? '' : (/egreso/i.test(t.name) ? 'text-rose-700' : (/saldo|banco/i.test(t.name) ? 'text-emerald-700' : 'text-slate-900'))}">${money(t.monto)}</div>
        </div>`;
      }).join('') : '<p class="text-xs text-slate-400 col-span-full">Sin datos del resumen.</p>';
    }

    // Pasarelas: capturas sin fecha en movimientos + historial del Apps Script
    const lista = document.getElementById('finPasarelasLista');
    if (lista) {
      const caps = f.capturas || [];
      const hist = Object.entries(f.pasarelas || {});
      let html = caps.length ? caps.map(c => `<div class="flex justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100"><span class="font-semibold text-slate-700">${c.name}</span><span class="font-semibold text-slate-900">${money(c.monto)}</span></div>`).join('')
        : '<p class="text-slate-400">No hay montos capturados arriba de la tabla de movimientos.</p>';
      if (hist.length) {
        html += '<p class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold pt-2">Última consulta automática</p>' +
          hist.map(([n, h]) => `<div class="p-2.5 rounded-lg border ${h.error ? 'border-red-200 bg-red-50/50' : 'border-slate-200'}">
            <div class="flex justify-between"><span class="font-semibold text-slate-800">${n}</span><span class="text-[10px] text-slate-400">${h.fecha} ${h.hora}</span></div>
            ${h.error ? `<div class="text-red-700 mt-1">${h.error}</div>` : `
            ${h.proxima_dispersion != null ? `<div class="flex justify-between mt-1"><span class="text-slate-500">Próxima dispersión</span><span class="font-semibold">${money(h.proxima_dispersion)}</span></div>` : ''}
            ${h.saldo_a_favor != null ? `<div class="flex justify-between"><span class="text-slate-500">Saldo a favor</span><span>${money(h.saldo_a_favor)}</span></div>` : ''}
            ${h.ultima_dispersion != null ? `<div class="flex justify-between"><span class="text-slate-500">Última dispersión</span><span>${money(h.ultima_dispersion)}${h.fecha_ultima_dispersion ? ' · ' + h.fecha_ultima_dispersion.slice(0, 5) : ''}</span></div>` : ''}
            ${h.neto_ayer != null ? `<div class="flex justify-between mt-1"><span class="text-slate-500">Neto de ayer (${h.transacciones_ayer || 0} pagos)</span><span class="font-semibold">${money(h.neto_ayer)}</span></div>` : ''}
            ${h.neto_ayer == null && h.proxima_dispersion == null && h.disponible != null ? `<div class="flex justify-between mt-1"><span class="text-slate-500">Disponible</span><span class="font-semibold">${money(h.disponible)}</span></div>` : ''}`}
          </div>`).join('');
      }
      lista.innerHTML = html;
    }

    // Movimientos del periodo
    const agg = this.finanzasAgg();
    set('finAbonos', `${money(agg.abonos)}`);
    set('finAbonosSub', `${agg.nAbonos.toLocaleString('es-MX')} depósitos`);
    set('finCargos', `${money(agg.cargos)}`);
    set('finCargosSub', `${agg.nCargos.toLocaleString('es-MX')} pagos / retiros`);
    const neto = agg.abonos - agg.cargos;
    const netoEl = document.getElementById('finNeto');
    if (netoEl) { netoEl.textContent = `${neto < 0 ? '-' : '+'}${money(Math.abs(neto))}`; netoEl.className = `text-2xl font-bold my-2 ${neto < 0 ? 'text-rose-700' : 'text-emerald-700'}`; }
    const ult = agg.movs.find(m => m.saldo != null);
    set('finSaldo', ult ? money(ult.saldo) : '—');
    set('finSaldoSub', ult ? `Movimiento del ${ult.fecha}` : 'Sin movimientos en el periodo');

    // Filtro de categoría
    const sel = document.getElementById('filterFinBank');
    if (sel) {
      const actual = this.filters.finanzasBank;
      const cats = [...new Set((f.movimientos || []).map(m => m.categoria))].sort();
      sel.innerHTML = '<option value="all">Todas las categorías</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
      sel.value = cats.includes(actual) ? actual : 'all';
      if (!sel.hasAttribute('data-bound')) {
        sel.setAttribute('data-bound', 'true');
        sel.addEventListener('change', (e) => { this.filters.finanzasBank = e.target.value; this.pagination.finanzasPage = 1; this.renderFinanzasTable(); });
      }
    }
    if (!this._finListeners) {
      this._finListeners = true;
      ['dateStartFin', 'dateEndFin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { this.pagination.finanzasPage = 1; this.renderFinanzas(); });
      });
      const btn = document.getElementById('btnExportFin');
      if (btn) btn.addEventListener('click', () => this.exportToCSV('movimientos_bancarios.csv', this.finanzasAgg().movs));
    }

    BitelitCharts.renderFinanzasCharts(agg);
    this.renderFinanzasTable();
  },

  renderFinanzasTable() {
    const tbody = document.getElementById('finanzasTableBody');
    if (!tbody) return;
    const money = (v) => v ? `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
    let records = this.finanzasAgg().movs;
    if (this.filters.finanzasBank !== 'all') records = records.filter(r => r.categoria === this.filters.finanzasBank);
    if (this.filters.search) {
      const q = this.filters.search;
      records = records.filter(r => (r.concepto || '').toLowerCase().includes(q) || (r.categoria || '').toLowerCase().includes(q));
    }
    const page = this.pagination.finanzasPage, perPage = this.pagination.finanzasPerPage;
    const totalPages = Math.ceil(records.length / perPage) || 1;
    const slice = records.slice((page - 1) * perPage, page * perPage);
    tbody.innerHTML = slice.length ? slice.map(r => `
      <tr>
        <td class="text-xs text-slate-600 whitespace-nowrap">${r.fecha}</td>
        <td class="text-xs text-slate-700 max-w-md">${r.concepto}</td>
        <td><span class="badge-pill badge-cyan">${r.categoria}</span></td>
        <td class="text-right text-xs text-rose-700">${money(r.cargo)}</td>
        <td class="text-right text-xs font-semibold text-emerald-700">${money(r.abono)}</td>
        <td class="text-right text-xs text-slate-500">${r.saldo != null ? money(r.saldo) : ''}</td>
      </tr>`).join('')
      : `<tr><td colspan="6" class="text-center py-8 text-slate-400">No hay movimientos en el periodo seleccionado.</td></tr>`;
    const info = document.getElementById('finanzasPaginationInfo');
    if (info) info.textContent = `Mostrando ${slice.length} de ${records.length} movimientos (Página ${page} de ${totalPages})`;
    this.renderPaginationControls('finanzasPaginationBtns', page, totalPages, (p) => { this.pagination.finanzasPage = p; this.renderFinanzasTable(); });
  },

  renderPortabilidadesTable() {
    const tbody = document.getElementById('table-portabilidades-body');
    if (!tbody) return;

    let records = this.data.portabilidades ? this.data.portabilidades.records : [];
    records = this.filterByDateRange(records, 'dateStartPortIn', 'dateEndPortIn');
    if (this.filters.search) {
      const q = this.filters.search;
      records = records.filter(r =>
        (r.dn || '').includes(q) ||
        (r.marca || '').toLowerCase().includes(q) ||
        (r.operador || '').toLowerCase().includes(q));
    }

    const slice = records.slice(0, 50);
    const info = document.getElementById('pagination-portabilidades');
    if (info) info.textContent = records.length ? `Mostrando ${slice.length} de ${records.length.toLocaleString()} portabilidades (FVC solicitada = SI)` : '';

    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-slate-400">No hay portabilidades exitosas (FVC solicitada = SI) en el rango seleccionado.</td></tr>`;
      return;
    }

    tbody.innerHTML = slice.map(r => `
      <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors">
        <td class="py-2.5 px-6 whitespace-nowrap">${r.fecha || '—'}</td>
        <td class="py-2.5 px-6 font-semibold">${r.dn}</td>
        <td class="py-2.5 px-6"><span class="badge-pill badge-primary">${r.marca}</span></td>
        <td class="py-2.5 px-6 font-medium text-slate-700">${r.operador || 'Sin dato'}</td>
      </tr>
    `).join('');
  },

  renderPortOutsTable() {
    const tbody = document.getElementById('table-portouts-body');
    if (!tbody) return;
    
    let records = this.data.port_outs ? this.data.port_outs.records : [];
    records = this.filterByDateRange(records, 'dateStartPortOut', 'dateEndPortOut');
    if (this.filters.search) {
      const q = this.filters.search;
      records = records.filter(r => (r.dn || '').includes(q) || (r.operador || '').toLowerCase().includes(q));
    }
    
    const slice = records.slice(0, 50);
    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-slate-400">No hay port outs en el rango seleccionado.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = slice.map(r => `
      <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors">
        <td class="py-2.5 px-6 whitespace-nowrap">${r.fecha}</td>
        <td class="py-2.5 px-6 font-semibold">${r.dn}</td>
        <td class="py-2.5 px-6"><span class="badge-pill badge-warning">${r.marca}</span></td>
        <td class="py-2.5 px-6 font-medium text-slate-700">${r.operador}</td>
        <td class="py-2.5 px-6 text-right text-slate-600">${r.dias != null ? Math.round(r.dias).toLocaleString('es-MX') : '—'}</td>
      </tr>
    `).join('');
  },

  renderArchivos() {
    if (!this.data) return;
    const grid = document.getElementById('sourcesConfigGrid');
    if (!grid) return;

    const fuentes = this.data.fuentes || {};
    const cfg = fuentes.config || {};
    const columnas = fuentes.columnas || {};
    const errores = fuentes.errores || {};
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    const conteos = {
      tickets: `${(this.data.tickets ? this.data.tickets.total : 0).toLocaleString()} tickets`,
      procesos: `${(this.data.procesos ? this.data.procesos.total : 0).toLocaleString()} trámites`,
      activaciones: `${(this.data.activaciones ? this.data.activaciones.total : 0).toLocaleString()} líneas`,
      portabilidades: `${(this.data.portabilidades ? this.data.portabilidades.total : 0).toLocaleString()} con FVC = SI` +
        (this.data.portabilidades && this.data.portabilidades.total_hoja ? ` (de ${this.data.portabilidades.total_hoja.toLocaleString()} filas)` : ''),
      port_outs: `${(this.data.port_outs ? this.data.port_outs.total : 0).toLocaleString()} bajas`,
      finanzas: `${((this.data.finanzas || {}).movimientos || []).length} movimientos`
    };
    // Columnas que el usuario puede fijar a mano (si la detección automática no acierta)
    const columnasEditables = {
      portabilidades: [['operador', 'Columna operador origen']],
      port_outs: [['fecha', 'Columna fecha de salida'], ['dias', 'Columna días'], ['operador', 'Columna operador destino']]
    };
    const orden = ['tickets', 'procesos', 'activaciones', 'portabilidades', 'port_outs', 'finanzas'];

    if (!Object.keys(cfg).length) {
      grid.innerHTML = `<div class="text-xs text-slate-500">Presiona "Sincronizar" para cargar la configuración de fuentes.</div>`;
      return;
    }

    grid.innerHTML = orden.filter(k => cfg[k]).map(key => {
      const c = cfg[key];
      const errs = (errores[key] || []).concat(errores[key + '_avisos'] || []);
      const headersPorPestana = columnas[key] || {};
      const todasColumnas = [...new Set(Object.values(headersPorPestana).flat())];
      const usadas = key === 'portabilidades' && this.data.portabilidades ? (this.data.portabilidades.columnas_usadas || {}) : {};
      const extra = (columnasEditables[key] || []).map(([ck, label]) => `
          <label class="block">
            <span class="text-[10px] uppercase font-semibold text-slate-500">${label}</span>
            <input list="cols-${key}" data-src="${key}" data-col="${ck}" value="${esc((c.columnas || {})[ck] || '')}"
              placeholder="Automático${usadas[ck] ? ' → ' + esc(usadas[ck]) : ''}"
              ${this.adminUnlocked ? '' : 'disabled'} class="src-input disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed mt-1 w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500">
          </label>`).join('');

      return `
        <div class="border ${errs.length ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-slate-50/50'} rounded-xl p-4 flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg ${errs.length ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-900'} flex items-center justify-center font-bold text-xs shrink-0">GS</div>
            <div class="min-w-0">
              <h4 class="text-xs font-bold text-slate-900 truncate">${esc(c.nombre || key)}</h4>
              <a class="text-[10px] text-blue-700 hover:underline" target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/${esc(c.sheet_id)}/edit">Abrir hoja ↗</a>
            </div>
          </div>
          <label class="block">
            <span class="text-[10px] uppercase font-semibold text-slate-500">ID o URL de la hoja</span>
            <input data-src="${key}" data-field="sheet_id" value="${esc(c.sheet_id)}"
              ${this.adminUnlocked ? '' : 'disabled'} class="src-input disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed mt-1 w-full text-xs font-mono border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500">
          </label>
          <label class="block">
            <span class="text-[10px] uppercase font-semibold text-slate-500">Pestaña(s) <span class="normal-case font-normal">separadas por coma</span></span>
            <input data-src="${key}" data-field="pestanas" value="${esc((c.pestanas || []).join(', '))}" placeholder="${key === 'finanzas' ? 'Vacío = detectar automáticamente' : ''}"
              ${this.adminUnlocked ? '' : 'disabled'} class="src-input disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed mt-1 w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500">
          </label>
          ${extra}
          <datalist id="cols-${key}">${todasColumnas.map(h => `<option value="${esc(h)}">`).join('')}</datalist>
          ${errs.length ? `<div class="text-[11px] text-red-700 leading-snug">${errs.map(esc).join('<br>')}</div>` : ''}
          ${todasColumnas.length ? `<details class="text-[11px] text-slate-500"><summary class="cursor-pointer select-none">Ver columnas detectadas (${todasColumnas.length})</summary><div class="mt-1 leading-relaxed">${todasColumnas.map(esc).join(' · ')}</div></details>` : ''}
          <div class="mt-auto pt-3 border-t border-slate-200 text-[11px] text-slate-600 flex justify-between">
            <span>Registros:</span>
            <span class="font-semibold ${errs.length ? 'text-red-800' : 'text-green-900'}">${conteos[key] || ''}</span>
          </div>
        </div>`;
    }).join('');

  },

  // ---- Bloqueo de edición de fuentes (la validación real está en el servidor)
  adminUnlocked: false,

  adminPintar(info) {
    this.adminUnlocked = !!(info && info.desbloqueado);
    const est = document.getElementById('adminEstado');
    const form = document.getElementById('adminForm');
    const lock = document.getElementById('btnLockSources');
    const save = document.getElementById('btnSaveSources');
    if (est) {
      est.textContent = this.adminUnlocked ? `🔓 Edición habilitada (${info.minutos_restantes ?? ''} min)` : (info && info.configurada === false ? '🔒 Sin clave configurada' : '🔒 Bloqueado');
      est.className = `badge-pill text-[11px] py-1 px-2.5 ${this.adminUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`;
    }
    // style.display en lugar de la clase 'hidden' (choca con 'flex' de Tailwind)
    if (form) form.style.display = this.adminUnlocked ? 'none' : 'flex';
    if (lock) lock.style.display = this.adminUnlocked ? '' : 'none';
    if (save) save.style.display = this.adminUnlocked ? 'flex' : 'none';
    if (info && info.configurada === false) this.adminMensaje('Aún no hay clave de administrador. Créala con <strong>establecer_clave_admin.bat</strong> en la carpeta del proyecto.', false);
    this.renderArchivos();
  },

  adminMensaje(html, ok) {
    const m = document.getElementById('adminMsg');
    if (!m) return;
    m.innerHTML = html || '';
    m.className = `text-[11px] w-full ${html ? '' : 'hidden'} ${ok ? 'text-emerald-700' : 'text-red-700'}`;
  },

  async adminRefrescar() {
    try {
      const r = await fetch('/api/admin/estado', { cache: 'no-store' });
      this.adminPintar(await r.json());
    } catch (e) { console.error(e); }
  },

  async adminDesbloquear() {
    const inp = document.getElementById('adminClave');
    const clave = inp ? inp.value : '';
    if (inp) inp.value = '';
    try {
      const r = await fetch('/api/admin/desbloquear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave }) });
      const j = await r.json();
      if (j.status !== 'success') { this.adminMensaje(j.message || 'Clave incorrecta', false); return; }
      this.adminMensaje(`Edición habilitada por ${j.minutos} minutos.`, true);
      await this.adminRefrescar();
      clearTimeout(this._adminTimer);
      this._adminTimer = setTimeout(() => this.adminRefrescar(), j.minutos * 60 * 1000 + 2000);
    } catch (e) { this.adminMensaje('No se pudo validar la clave.', false); }
  },

  async adminBloquear() {
    try { await fetch('/api/admin/bloquear', { method: 'POST' }); } catch (e) { /* nada */ }
    this.adminMensaje('', true);
    this.adminRefrescar();
  },

  async saveSourcesConfig() {
    if (!this.adminUnlocked) { this.adminMensaje('Desbloquea con la clave de administrador para editar.', false); return; }
    const payload = {};
    document.querySelectorAll('#sourcesConfigGrid .src-input').forEach(el => {
      const key = el.dataset.src;
      payload[key] = payload[key] || {};
      if (el.dataset.field) payload[key][el.dataset.field] = el.value.trim();
      if (el.dataset.col) {
        payload[key].columnas = payload[key].columnas || {};
        payload[key].columnas[el.dataset.col] = el.value.trim();
      }
    });
    try {
      this.showLoading(true);
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (res.status === 403) { this.adminRefrescar(); throw new Error(result.message || 'Edición bloqueada'); }
      if (result.status !== 'success') throw new Error(result.message || 'Error al guardar');
      this.data = result.data;
      this.renderAll();
      this.renderArchivos();
      const errores = (this.data.fuentes && this.data.fuentes.errores) || {};
      const n = Object.keys(errores).length;
      this.showToast(n ? `Configuración guardada. ${n} fuente(s) con error, revisa los detalles.` : 'Configuración guardada y datos sincronizados.', n ? 'error' : 'success');
    } catch (err) {
      console.error(err);
      this.showToast('No se pudo guardar la configuración: ' + err.message, 'error');
    } finally {
      this.showLoading(false);
    }
  },

  renderPaginationControls(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = `btn-tertiary text-xs py-1 px-2.5 ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : ''}`;
    prevBtn.textContent = '← Anterior';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => onPageChange(currentPage - 1);
    container.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.className = `btn-tertiary text-xs py-1 px-2.5 ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : ''}`;
    nextBtn.textContent = 'Siguiente →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => onPageChange(currentPage + 1);
    container.appendChild(nextBtn);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  BitelitApp.init();
});
