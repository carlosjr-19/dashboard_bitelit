import os
import io
import csv
import hmac
import time
from flask import Flask, render_template, jsonify, request, Response, session
from werkzeug.middleware.proxy_fix import ProxyFix
from bitelit.data_loader import BitelitDataLoader
from bitelit import admin

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)  # detrás del proxy de Railway / ALB
app.secret_key = admin.secret_key()
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Strict',
                  # En el servidor (HTTPS) la cookie solo viaja cifrada
                  SESSION_COOKIE_SECURE=os.environ.get('SESSION_COOKIE_SECURE', '').lower() == 'true')
loader = BitelitDataLoader()

# Acceso al dashboard: si DASHBOARD_PASSWORD está definida (servidor), el navegador pide usuario y contraseña.
# En tu PC no se define y se entra directo, como siempre.
_ACCESS_USER = os.environ.get('DASHBOARD_USER', 'bitelit')
_ACCESS_PASS = os.environ.get('DASHBOARD_PASSWORD', '')


@app.before_request
def _proteger_acceso():
    if not _ACCESS_PASS or request.path == '/health':
        return None
    auth = request.authorization
    if auth and auth.type == 'basic' \
            and hmac.compare_digest(auth.username or '', _ACCESS_USER) \
            and hmac.compare_digest(auth.password or '', _ACCESS_PASS):
        return None
    return Response('Acceso restringido', 401, {'WWW-Authenticate': 'Basic realm="Dashboard Bitelit", charset="UTF-8"'})


@app.route('/health')
def health():
    # Para el health check de Railway / ALB: solo confirma que el servidor responde (no lee Google Sheets)
    return jsonify({'status': 'ok'})


def _es_admin():
    return session.get('admin_hasta', 0) > time.time()


@app.route('/api/admin/estado', methods=['GET'])
def admin_estado():
    return jsonify({'configurada': admin.clave_configurada(), 'desbloqueado': _es_admin(),
                    'minutos_restantes': max(0, int((session.get('admin_hasta', 0) - time.time()) // 60))})


@app.route('/api/admin/desbloquear', methods=['POST'])
def admin_desbloquear():
    clave = (request.get_json(silent=True) or {}).get('clave', '')
    ok, msg = admin.verificar(clave)
    if not ok:
        return jsonify({'status': 'error', 'message': msg}), 403
    session['admin_hasta'] = time.time() + admin.SESION_MINUTOS * 60
    return jsonify({'status': 'success', 'minutos': admin.SESION_MINUTOS})


@app.route('/api/admin/bloquear', methods=['POST'])
def admin_bloquear():
    session.pop('admin_hasta', None)
    return jsonify({'status': 'success'})

@app.route('/')
def index():
    # Versión de los archivos estáticos: cambia cada vez que se modifican, así el navegador no usa copias viejas
    static_dir = os.path.join(app.root_path, 'static')
    mtimes = [os.path.getmtime(os.path.join(r, f)) for r, _, fs in os.walk(static_dir) for f in fs]
    return render_template('index.html', asset_v=int(max(mtimes)) if mtimes else 0)

@app.route('/api/data', methods=['GET'])
def get_data():
    force = request.args.get('force', 'false').lower() == 'true'
    data = loader.load_all_data(force_reload=force)
    if 'fuentes' not in data:  # caché generado con la versión anterior
        data['fuentes'] = {'config': loader.get_config(), 'columnas': {}, 'errores': {}}
    return jsonify(data)

@app.route('/api/reload', methods=['POST'])
def reload_data():
    try:
        data = loader.load_all_data(force_reload=True)
        return jsonify({'status': 'success', 'message': 'Datos recargados correctamente', 'data': data})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify(loader.get_config())

@app.route('/api/config', methods=['POST'])
def save_config():
    """Guarda IDs / pestañas / columnas de las fuentes y vuelve a leer Google Sheets. Requiere clave de administrador."""
    if not _es_admin():
        return jsonify({'status': 'error', 'message': 'Edición bloqueada: desbloquea con la clave de administrador.'}), 403
    try:
        payload = request.get_json(force=True) or {}
        cfg = loader.update_config(payload)
        data = loader.load_all_data(force_reload=True)
        return jsonify({'status': 'success', 'config': cfg, 'data': data})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/export/<module>', methods=['GET'])
def export_csv(module):
    data = loader.load_all_data(force_reload=False)
    output = io.StringIO()
    writer = csv.writer(output)

    if module == 'tickets':
        records = data.get('tickets', {}).get('records', [])
        writer.writerow(['ID Remedy', 'Fecha', 'DN', 'Contacto', 'Agente', 'Motivo', 'Estatus', 'Descripción', 'Respuesta'])
        for r in records:
            writer.writerow([r.get('id'), r.get('fecha'), r.get('dn'), r.get('contacto'), r.get('agente'), r.get('motivo'), r.get('estatus'), r.get('descripcion'), r.get('respuesta')])
        filename = "Bitelit_Tickets.csv"

    elif module == 'procesos':
        records = data.get('procesos', {}).get('records', [])
        writer.writerow(['Fecha', 'Proceso', 'Motivo', 'DN', 'Marca MVNO', 'Agente', 'Comentario'])
        for r in records:
            writer.writerow([r.get('fecha'), r.get('proceso'), r.get('motivo'), r.get('dn'), r.get('marca'), r.get('agente'), r.get('comentario')])
        filename = "Bitelit_Procesos_Operaciones.csv"

    elif module == 'finanzas':
        records = data.get('finanzas', {}).get('dias', [])
        writer.writerow(['Fecha', 'Pasarela', 'Transacciones', 'Monto bruto', 'Comisiones', 'Monto neto', 'Depósitos wallet', 'Reembolsos'])
        for r in records:
            writer.writerow([r.get('fecha'), r.get('pasarela'), r.get('transacciones'), r.get('monto_bruto'), r.get('comisiones'), r.get('monto_neto'), r.get('depositos_wallet'), r.get('reembolsos')])
        filename = "Bitelit_Finanzas_Pasarelas.csv"

    elif module == 'activaciones':
        records = data.get('activaciones', {}).get('records', [])
        writer.writerow(['MSISDN', 'Nombre', 'Paquete', 'Marca', 'Fecha Activación', 'Vendedor'])
        for r in records:
            writer.writerow([r.get('msisdn'), r.get('nombre'), r.get('paquete'), r.get('marca'), r.get('fecha'), r.get('vendedor')])
        filename = "Bitelit_Activaciones.csv"

    else:
        return jsonify({'error': 'Módulo no válido'}), 400

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename={filename}"}
    )

if __name__ == '__main__':
    print("Iniciando servidor Bitelit Dashboard en http://localhost:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=True)
