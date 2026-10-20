# Dashboard Empresarial Bitelit

Dashboard operativo y financiero conectado a Google Sheets y a los datos de las pasarelas de pago
(Conekta, OXXO Pay, Mercado Pago).

## Cómo usarlo

1. Doble clic en `ejecutar_dashboard.bat` (abre http://localhost:5000).
2. Para traer los cambios de las hojas, presiona **Sincronizar**.
3. Para cambiar de archivo (por ejemplo, el del próximo año), ve a **Fuentes de Datos**, pega el ID o la URL
   de la hoja nueva y presiona **Guardar y sincronizar**. Comparte la hoja con el correo de la cuenta de
   servicio de `config/credentials.json`.

Si es la primera vez en una computadora: `pip install -r requirements.txt`.

## Estructura

```
app.py                  Servidor Flask: rutas de la página y de la API (/api/data, /api/reload, /api/config...)
ejecutar_dashboard.bat  Arranca el servidor y abre el navegador
requirements.txt        Dependencias de Python

bitelit/                Código Python
  config.py             Rutas del proyecto y fuentes por defecto (IDs de hojas, pestañas, pasarelas)
  utils.py              Limpieza de textos, fechas y detección automática de columnas
  data_loader.py        Lee cada fuente (tickets, procesos, activaciones, Port In, Port Out, pasarelas)
                        y arma los datos que muestra la página

config/                 Configuración (no compartir)
  credentials.json      Cuenta de servicio de Google
  sheets_config.json    IDs, pestañas y columnas de cada fuente (lo edita la pestaña Fuentes de Datos)

data/
  dashboard_data_cache.json   Copia de la última sincronización (se regenera sola; se puede borrar)

static/                 CSS y JavaScript de la página (app.js = lógica, charts.js = gráficas)
templates/index.html    Estructura de la página

apps_script/
  Pasarelas.gs          Script para el Google Sheet de cierre: trae la próxima dispersión de Conekta y OXXO Pay
                        y el saldo de Mercado Pago a las celdas que indiques (instrucciones dentro del archivo)

_archivo/               Scripts de parches antiguos y respaldos. No se usa para correr el dashboard.
```

## Fuentes de datos

| Pestaña | Origen |
|---|---|
| Tickets y Fallas | Google Sheet / Excel de escalamientos Altan (si es .xlsx se descarga desde Drive) |
| Operaciones & Trámites | Hoja de procesos manuales |
| Activaciones | Hoja de activaciones (pestaña 2026) |
| Portabilidades (Port In) | Hoja de portabilidades; solo cuenta FVC_Solicitada = SI |
| Port Outs | Hoja PORT OUT GUI (columnas Fecha y Días) |
| Finanzas & Pasarelas | Google Sheet **CIERRE DIARIO BANCARIO**: pestaña de resumen (TOTAL INGRESOS...), pestaña de movimientos (Fecha / Concepto / Cargo / Abono / Saldo / categoría) y HISTORIAL PASARELAS. Las pestañas se detectan solas. |

Prueba rápida de la lectura de datos sin abrir la página: `python -m bitelit.data_loader`
