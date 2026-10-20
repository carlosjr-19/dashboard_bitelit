"""Rutas del proyecto y configuración por defecto de las fuentes de datos."""
import os

# Carpeta raíz del proyecto (la que contiene app.py)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(ROOT_DIR, 'config')
DATA_DIR = os.path.join(ROOT_DIR, 'data')

# En un servidor (Railway / AWS) el disco del contenedor se borra en cada deploy. Si BITELIT_STATE_DIR
# apunta a un volumen persistente, ahí se guardan los IDs de hojas editados y el caché.
# Sin esa variable (en tu PC) todo sigue en config/ y data/ como siempre.
STATE_DIR = os.environ.get('BITELIT_STATE_DIR', '').strip()

SEED_CONFIG_FILE = os.path.join(CONFIG_DIR, 'sheets_config.json')  # la que viene con el código
CONFIG_FILE = os.path.join(STATE_DIR, 'sheets_config.json') if STATE_DIR else SEED_CONFIG_FILE
CREDENTIALS_FILE = os.path.join(CONFIG_DIR, 'credentials.json')
CACHE_FILE = os.path.join(STATE_DIR or DATA_DIR, 'dashboard_data_cache.json')

CACHE_VERSION = 6  # súbelo si cambia la estructura de los datos


# Configuración por defecto de las fuentes. Se edita desde la pestaña "Fuentes de Datos"
# y se guarda en sheets_config.json (puedes editar ese archivo a mano también).
DEFAULT_CONFIG = {
    'tickets': {
        'nombre': 'Tickets & Fallas Altan',
        'sheet_id': '1JTn77UqsFhtB9pxguKJEmSj5RFjFvDpZPgUOrNqlQaA',
        'pestanas': ['Respuestas de formulario 1'],
        'columnas': {}
    },
    'procesos': {
        'nombre': 'Procesos Manuales',
        'sheet_id': '1pDWbJV0PoKOKHMiIXZSJVrZ7H6cwmmDRHK8-byrvIwk',
        'pestanas': ['PROCESOS', 'Respuestas de formulario 1'],
        'columnas': {}
    },
    'activaciones': {
        'nombre': 'Activaciones',
        'sheet_id': '10Hc7N_73aX78h17MjxzKitoqIXNSPtv_cxNOVDSY-ek',
        'pestanas': ['2026'],
        'columnas': {}
    },
    'portabilidades': {
        'nombre': 'Portabilidades (Port In)',
        'sheet_id': '15M_3W8l43v5gbEBFQ27sKZj7-UalZHB8C8_UBihnVRs',
        'pestanas': ['AÑO COMPLETO'],
        'columnas': {'operador': '', 'agente': ''}
    },
    'port_outs': {
        'nombre': 'Port Outs',
        'sheet_id': '11LZkRNehJykY2DKwmTC856h-vdMT1YLX4lDkHMtvs0Q',
        'pestanas': ['PORT OUT GUI'],
        'columnas': {'operador': '', 'fecha': '', 'dias': ''}
    },
    'finanzas': {
        'nombre': 'Cierre diario bancario',
        # ID o URL del Google Sheet "CIERRE DIARIO BANCARIO". Las pestañas se detectan solas por su contenido
        # (resumen = la que tiene TOTAL INGRESOS; movimientos = la que tiene Fecha/Abono; HISTORIAL PASARELAS).
        'sheet_id': '',
        'pestanas': [],
        'columnas': {}
    }
}
