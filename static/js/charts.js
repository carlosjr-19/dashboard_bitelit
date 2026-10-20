/**
 * Bitelit Dashboard - Chart Configurations (ApexCharts)
 * Styled in accordance with Bitelit Design System
 */

// Bitelit Color Palette
const BITELIT_COLORS = {
  primaryDark: '#0D47A1',
  primary800: '#1565C0',
  primary700: '#1976D2',
  primary400: '#42A5F5',
  primary100: '#BBDEFB',
  cyanDark: '#0084DB',
  cyan600: '#0096C7',
  cyan400: '#48CAE4',
  cyan200: '#90E0EF',
  slate900: '#0F172A',
  slate500: '#64748B',
  slate200: '#E2E8F0',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444'
};

const defaultFont = {
  fontFamily: 'Poppins, sans-serif'
};

window.BitelitCharts = {
  instances: {},

  destroyAll() {
    Object.values(this.instances).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.instances = {};
  },

  // 1. OVERVIEW CHARTS (mes en curso, calculado en app.js)
  renderOverviewCharts(ov) {
    if (!ov) return;
    const lbl = { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } };

    const trendEl = document.querySelector("#overviewTrendChart");
    if (trendEl) {
      if (this.instances.overviewTrend) this.instances.overviewTrend.destroy();
      this.instances.overviewTrend = new ApexCharts(trendEl, {
        series: [{ name: 'Port In', data: ov.portIn }, { name: 'Port Out', data: ov.portOut }],
        chart: { type: 'bar', height: 290, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
        colors: ['#2563EB', '#D97706'],
        plotOptions: { bar: { columnWidth: '70%', borderRadius: 3, borderRadiusApplication: 'end' } },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        dataLabels: { enabled: false },
        xaxis: { categories: ov.dias.map(d => d.slice(8)), labels: lbl, axisBorder: { show: false }, axisTicks: { show: false },
                 title: { text: 'Día del mes', style: { color: BITELIT_COLORS.slate500, fontSize: '11px', fontWeight: 400 } } },
        yaxis: { min: 0, forceNiceScale: true, labels: { ...lbl, formatter: (v) => Math.round(v) } },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
        legend: { position: 'top', horizontalAlign: 'left', fontSize: '12px', labels: { colors: BITELIT_COLORS.slate500 } },
        tooltip: { shared: true, intersect: false, x: { formatter: (v, o) => ov.dias[o.dataPointIndex] }, y: { formatter: (v) => `${v} líneas` } },
        noData: { text: 'Sin portabilidades este mes' }
      });
      this.instances.overviewTrend.render();
    }

    const procDonutEl = document.querySelector("#overviewProcDonutChart");
    if (procDonutEl) {
      if (this.instances.overviewProcDonut) this.instances.overviewProcDonut.destroy();
      // 4 categorías principales + "Otros" para no repetir colores
      const top = ov.procesos.slice(0, 4);
      const resto = ov.procesos.slice(4).reduce((a, [, v]) => a + v, 0);
      if (resto) top.push(['Otros', resto]);
      this.instances.overviewProcDonut = new ApexCharts(procDonutEl, {
        series: top.map(p => p[1]),
        labels: top.map(p => p[0]),
        chart: { type: 'donut', height: 280, fontFamily: 'Poppins, sans-serif' },
        colors: [BITELIT_COLORS.primaryDark, BITELIT_COLORS.cyan600, BITELIT_COLORS.cyan400, BITELIT_COLORS.primary400, '#94A3B8'],
        plotOptions: { pie: { donut: { size: '72%', labels: { show: true,
          total: { show: true, label: 'Trámites', fontSize: '13px', color: BITELIT_COLORS.slate500, formatter: () => ov.totalProcesos.toLocaleString('es-MX') },
          value: { fontSize: '22px', fontWeight: 700, color: BITELIT_COLORS.slate900 } } } } },
        legend: { position: 'bottom', fontSize: '12px', labels: { colors: BITELIT_COLORS.slate500 } },
        dataLabels: { enabled: false },
        stroke: { width: 2, colors: ['#fff'] },
        noData: { text: 'Sin trámites este mes' }
      });
      this.instances.overviewProcDonut.render();
    }
  },

  // 2. TICKETS & FALLAS CHARTS
  renderTicketsCharts(data) {
    if (!data) return;
    const tck = data.tickets;

    // Motivos Chart
    const motivosEl = document.querySelector("#ticketsMotivosChart");
    if (motivosEl) {
      if (this.instances.ticketsMotivos) this.instances.ticketsMotivos.destroy();
      const items = tck.motivos.slice(0, 6);
      const options = {
        series: [{ name: 'Tickets', data: items.map(i => i.count) }],
        chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 6,
            barHeight: '55%',
            distributed: false
          }
        },
        colors: [BITELIT_COLORS.primary700],
        dataLabels: {
          enabled: true,
          style: { fontSize: '11px', fontFamily: 'Poppins, sans-serif', colors: ['#fff'] },
          formatter: (v) => v
        },
        xaxis: {
          categories: items.map(i => i.name),
          labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } }
        },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
        tooltip: { theme: 'light' }
      };
      this.instances.ticketsMotivos = new ApexCharts(motivosEl, options);
      this.instances.ticketsMotivos.render();
    }

    // Agentes Chart
    const agentesEl = document.querySelector("#ticketsAgentesChart");
    if (agentesEl) {
      if (this.instances.ticketsAgentes) this.instances.ticketsAgentes.destroy();
      const items = tck.top_agentes;
      const options = {
        series: [{ name: 'Tickets Atendidos', data: items.map(i => i.count) }],
        chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
        plotOptions: {
          bar: {
            columnWidth: '45%',
            borderRadius: 6,
            distributed: true
          }
        },
        colors: [BITELIT_COLORS.primaryDark, BITELIT_COLORS.primary800, BITELIT_COLORS.cyan600, BITELIT_COLORS.cyan400, BITELIT_COLORS.primary400, '#38BDF8'],
        legend: { show: false },
        xaxis: {
          categories: items.map(i => i.name),
          labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } }
        },
        yaxis: {
          labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } }
        },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
        tooltip: { theme: 'light' }
      };
      this.instances.ticketsAgentes = new ApexCharts(agentesEl, options);
      this.instances.ticketsAgentes.render();
    }
  },

  // 3. PROCESOS & TRAMITES CHARTS
  renderProcesosCharts(data) {
    if (!data) return;
    const proc = data.procesos;

    // Motivos SIM Swap Chart
    const simSwapEl = document.querySelector("#simSwapMotivosChart");
    if (simSwapEl) {
      if (this.instances.simSwapMotivos) this.instances.simSwapMotivos.destroy();
      const items = proc.by_motivo.slice(0, 6);
      const options = {
        series: [{ name: 'Solicitudes', data: items.map(i => i.count) }],
        chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 6,
            barHeight: '55%'
          }
        },
        colors: [BITELIT_COLORS.cyan600],
        dataLabels: { enabled: true, style: { fontSize: '11px', fontFamily: 'Poppins', colors: ['#fff'] } },
        xaxis: {
          categories: items.map(i => i.name),
          labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } }
        },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
        tooltip: { theme: 'light' }
      };
      this.instances.simSwapMotivos = new ApexCharts(simSwapEl, options);
      this.instances.simSwapMotivos.render();
    }

    // Productividad por Agente en Procesos
    const procAgentesEl = document.querySelector("#procesosAgentesChart");
    if (procAgentesEl) {
      if (this.instances.procAgentes) this.instances.procAgentes.destroy();
      const items = proc.by_agente;
      const options = {
        series: [{ name: 'Trámites Realizados', data: items.map(i => i.count) }],
        chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
        plotOptions: {
          bar: {
            columnWidth: '45%',
            borderRadius: 6
          }
        },
        colors: [BITELIT_COLORS.primaryDark],
        legend: { show: false },
        xaxis: {
          categories: items.map(i => i.name),
          labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } }
        },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
        tooltip: { theme: 'light' }
      };
      this.instances.procAgentes = new ApexCharts(procAgentesEl, options);
      this.instances.procAgentes.render();
    }
  },

  // 4. ACTIVACIONES CHARTS
  
  renderPortabilidadesCharts(data) {
    if (!data || !data.portabilidades || !data.portabilidades.records) return;
    const records = data.portabilidades.records;

    const countsMarca = {}, countsOp = {};
    records.forEach(r => {
      const m = r.marca || 'Sin marca';
      const o = r.operador || 'Sin dato';
      countsMarca[m] = (countsMarca[m] || 0) + 1;
      countsOp[o] = (countsOp[o] || 0) + 1;
    });
    const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
    const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
    const topMarcas = top(countsMarca, 10);
    const topOps = top(countsOp, 8);

    const barOpts = (items, color, name, full) => ({
      series: [{ name, data: items.map(i => i[1]) }],
      chart: { type: 'bar', height: 250, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
      dataLabels: { enabled: true, style: { fontSize: '11px', colors: ['#fff'] } },
      xaxis: { categories: items.map(i => cut(i[0], 26)), labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px' } } },
      yaxis: { labels: { maxWidth: 180, style: { colors: BITELIT_COLORS.slate500, fontSize: '11px' } } },
      grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
      colors: [color],
      tooltip: { theme: 'light', x: { formatter: (v, o) => full[o.dataPointIndex] } },
      noData: { text: 'Sin portabilidades en el rango seleccionado' }
    });

    const elM = document.querySelector("#chartPortInMarcas");
    if (elM) {
      if (this.instances.piMarcas) this.instances.piMarcas.destroy();
      this.instances.piMarcas = new ApexCharts(elM, barOpts(topMarcas, BITELIT_COLORS.primary700, 'Portabilidades', topMarcas.map(i => i[0])));
      this.instances.piMarcas.render();
    }

    const elO = document.querySelector("#chartPortInOperadores");
    if (elO) {
      if (this.instances.piOp) this.instances.piOp.destroy();
      this.instances.piOp = new ApexCharts(elO, barOpts(topOps, BITELIT_COLORS.cyan600, 'Usuarios portados', topOps.map(i => i[0])));
      this.instances.piOp.render();
    }
  },

  renderPortOutsCharts(data) {
    if (!data || !data.port_outs || !data.port_outs.records) return;
    const records = data.port_outs.records;
    
    // Agrupar por marca
    let countsMarca = {};
    let countsOp = {};
    records.forEach(r => {
        countsMarca[r.marca] = (countsMarca[r.marca] || 0) + 1;
        countsOp[r.operador || 'Desconocido'] = (countsOp[r.operador || 'Desconocido'] || 0) + 1;
    });

    const sortObj = (obj) => Object.entries(obj).sort((a,b) => b[1] - a[1]).slice(0,6);
    const topMarcas = sortObj(countsMarca);
    const topOps = sortObj(countsOp);

    if (document.querySelector("#chartPortOutMarcas")) {
      if (this.instances.poMarcas) this.instances.poMarcas.destroy();
      this.instances.poMarcas = new ApexCharts(document.querySelector("#chartPortOutMarcas"), {
        series: [{ name: 'Port Outs', data: topMarcas.map(m => m[1]) }],
        chart: { type: 'bar', height: 250, toolbar: {show: false}, fontFamily: 'Poppins, sans-serif' },
        plotOptions: { bar: { horizontal: false, borderRadius: 4, columnWidth: '40%' } },
        dataLabels: { enabled: false },
        xaxis: { categories: topMarcas.map(m => m[0].substring(0,10)) },
        colors: ['#f59e0b']
      });
      this.instances.poMarcas.render();
    }

    if (document.querySelector("#chartPortOutOperadores")) {
      if (this.instances.poOp) this.instances.poOp.destroy();
      this.instances.poOp = new ApexCharts(document.querySelector("#chartPortOutOperadores"), {
        series: topOps.map(o => o[1]),
        labels: topOps.map(o => o[0].substring(0,12)),
        chart: { type: 'donut', height: 250, fontFamily: 'Poppins, sans-serif' },
        colors: ['#f59e0b', '#fb7185', '#fb923c', '#94a3b8', '#64748b', '#cbd5e1'],
        dataLabels: { enabled: false },
        legend: { position: 'right' }
      });
      this.instances.poOp.render();
    }

    // Duración promedio (campo Días) por marca
    const diasEl = document.querySelector('#chartPortOutDias');
    const conDias = records.filter(r => r.dias != null && !isNaN(r.dias));
    const promEl = document.getElementById('portOutPromDias');
    if (promEl) promEl.textContent = conDias.length ? `${Math.round(conDias.reduce((a, r) => a + r.dias, 0) / conDias.length).toLocaleString('es-MX')} días` : 'Sin dato';
    if (diasEl) {
      const g = {};
      conDias.forEach(r => { const m = r.marca || 'Sin marca'; g[m] = g[m] || { s: 0, n: 0 }; g[m].s += r.dias; g[m].n += 1; });
      const items = Object.entries(g).sort((a, b) => b[1].n - a[1].n).slice(0, 12)
        .map(([m, v]) => ({ m, prom: Math.round(v.s / v.n), n: v.n }));
      if (this.instances.poDias) this.instances.poDias.destroy();
      this.instances.poDias = new ApexCharts(diasEl, {
        series: [{ name: 'Días promedio', data: items.map(i => i.prom) }],
        chart: { type: 'bar', height: 320, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end', barHeight: '62%' } },
        colors: ['#d97706'],
        dataLabels: { enabled: true, formatter: (v) => `${v} d`, style: { fontSize: '11px', colors: ['#fff'] } },
        xaxis: { categories: items.map(i => i.m), labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px' } } },
        yaxis: { labels: { maxWidth: 160, style: { colors: BITELIT_COLORS.slate500, fontSize: '11px' } } },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
        tooltip: { y: { formatter: (v, o) => `${v} días en promedio · ${items[o.dataPointIndex].n.toLocaleString('es-MX')} port outs` } },
        noData: { text: 'No hay datos del campo Días en el periodo' }
      });
      this.instances.poDias.render();
    }
  },

  renderActivacionesCharts(data) {
    if (!data) return;
    const act = data.activaciones;

    // Timeline Line Chart
    const actTimelineEl = document.querySelector("#activacionesTimelineChart");
    if (actTimelineEl) {
      if (this.instances.actTimeline) this.instances.actTimeline.destroy();
      const options = {
        series: [{
          name: 'Altas de Línea',
          data: act.timeline.map(t => t.count)
        }],
        chart: {
          type: 'line',
          height: 290,
          toolbar: { show: false },
          fontFamily: 'Poppins, sans-serif'
        },
        stroke: { curve: 'smooth', width: 3 },
        colors: [BITELIT_COLORS.primary800],
        xaxis: {
          categories: act.timeline.map(t => t.date.slice(5)),
          tickAmount: Math.min(act.timeline.length, 12),
          labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } }
        },
        yaxis: { min: 0, forceNiceScale: true, labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } } },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
        tooltip: { theme: 'light' }
      };
      this.instances.actTimeline = new ApexCharts(actTimelineEl, options);
      this.instances.actTimeline.render();
    }

    // Top Paquetes
    const pkgEl = document.querySelector("#activacionesPaquetesChart");
    if (pkgEl) {
      if (this.instances.actPackages) this.instances.actPackages.destroy();
      const items = act.top_packages.slice(0, 5);
      const options = {
        series: [{ name: 'Activaciones', data: items.map(i => i.count) }],
        chart: { type: 'bar', height: 290, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
        plotOptions: {
          bar: { horizontal: true, borderRadius: 6, barHeight: '55%' }
        },
        colors: [BITELIT_COLORS.cyan600],
        dataLabels: { enabled: true, style: { fontSize: '11px', fontFamily: 'Poppins', colors: ['#fff'] } },
        xaxis: {
          categories: items.map(i => i.name.slice(0, 25)),
          labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } }
        },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 }
      };
      this.instances.actPackages = new ApexCharts(pkgEl, options);
      this.instances.actPackages.render();
    }

    // Marcas que más activan (top 12 del periodo)
    const marcasEl = document.querySelector("#activacionesMarcasChart");
    if (marcasEl) {
      if (this.instances.actMarcas) this.instances.actMarcas.destroy();
      const items = (act.top_brands || []).slice(0, 12);
      const total = (act.top_brands || []).reduce((a, b) => a + b.count, 0);
      this.instances.actMarcas = new ApexCharts(marcasEl, {
        series: [{ name: 'Activaciones', data: items.map(i => i.count) }],
        chart: { type: 'bar', height: Math.max(220, items.length * 32 + 60), toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end', barHeight: '62%' } },
        colors: [BITELIT_COLORS.primary700],
        dataLabels: { enabled: true, formatter: (v) => v.toLocaleString('es-MX'), style: { fontSize: '11px', colors: ['#fff'] } },
        xaxis: { categories: items.map(i => i.name), labels: { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px' } } },
        yaxis: { labels: { maxWidth: 180, style: { colors: BITELIT_COLORS.slate500, fontSize: '12px' } } },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
        tooltip: { y: { formatter: (v) => `${v.toLocaleString('es-MX')} líneas · ${total ? (v / total * 100).toFixed(1) : 0}% del periodo` } },
        noData: { text: 'Sin activaciones en el periodo' }
      });
      this.instances.actMarcas.render();
    }
  },

  // 5. FINANZAS (movimientos bancarios; recibe el agregado de app.js)
  renderFinanzasCharts(agg) {
    if (!agg) return;
    const money = (v) => `$${Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const moneyK = (v) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`;
    const lbl = { style: { colors: BITELIT_COLORS.slate500, fontSize: '11px', fontFamily: 'Poppins' } };
    const mk = (key, sel, opts) => {
      if (this.instances[key]) this.instances[key].destroy();
      const el = document.querySelector(sel);
      if (!el) return;
      this.instances[key] = new ApexCharts(el, opts);
      this.instances[key].render();
    };
    const hbar = (key, sel, items, color, name) => mk(key, sel, {
      series: [{ name, data: items.map(i => Math.round(i[1] * 100) / 100) }],
      chart: { type: 'bar', height: Math.max(220, items.length * 30 + 60), toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end', barHeight: '62%' } },
      colors: [color],
      dataLabels: { enabled: false },
      xaxis: { categories: items.map(i => i[0]), labels: { ...lbl, formatter: moneyK }, tickAmount: 4 },
      yaxis: { labels: { ...lbl, maxWidth: 160 } },
      grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
      tooltip: { y: { formatter: (v) => `${money(v)} MXN` } },
      noData: { text: 'Sin datos' }
    });

    hbar('finanzasConceptos', '#finanzasConceptosChart', agg.conceptos.map(c => [c.name, c.monto]), BITELIT_COLORS.primary700, 'Ingresos');
    hbar('finanzasCategorias', '#finanzasCategoriasChart', agg.categorias.slice(0, 10), BITELIT_COLORS.cyan600, 'Abonos');

    mk('finanzasTimeline', '#finanzasTimelineChart', {
      series: [{ name: 'Abonos', data: agg.abonosDia.map(v => Math.round(v * 100) / 100) },
               { name: 'Cargos', data: agg.cargosDia.map(v => Math.round(v * 100) / 100) }],
      colors: ['#059669', '#E11D48'],
      chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
      plotOptions: { bar: { columnWidth: '65%', borderRadius: 3, borderRadiusApplication: 'end' } },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      dataLabels: { enabled: false },
      xaxis: { categories: agg.fechas.map(d => d.slice(5)), labels: lbl, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { min: 0, labels: { ...lbl, formatter: moneyK } },
      grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
      legend: { position: 'top', horizontalAlign: 'left', fontSize: '12px', labels: { colors: BITELIT_COLORS.slate500 } },
      tooltip: { shared: true, intersect: false, y: { formatter: (v) => `${money(v)} MXN` } },
      noData: { text: 'Sin movimientos en el periodo' }
    });
  }
};
