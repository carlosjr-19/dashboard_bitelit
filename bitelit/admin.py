"""Clave de administrador para editar las Fuentes de Datos.

La clave NUNCA se guarda en texto plano: en config/admin.json solo queda su hash.

Para crear o cambiar la clave (solo quien tiene acceso a la carpeta del proyecto):
    python -m bitelit.admin
o doble clic en establecer_clave_admin.bat
"""
import json
import os
import secrets
import time
from getpass import getpass

from werkzeug.security import generate_password_hash, check_password_hash

from .config import CONFIG_DIR

ADMIN_FILE = os.path.join(CONFIG_DIR, 'admin.json')
SECRET_FILE = os.path.join(CONFIG_DIR, 'secret_key.txt')

SESION_MINUTOS = 30          # tiempo que dura desbloqueado
MAX_INTENTOS = 5             # intentos fallidos antes de bloquear
BLOQUEO_MINUTOS = 5          # bloqueo tras demasiados intentos

_fallos = {'n': 0, 'hasta': 0.0}


def secret_key():
    """Llave para firmar la sesión del navegador (se crea sola la primera vez)."""
    if os.environ.get('SECRET_KEY', '').strip():  # en el servidor
        return os.environ['SECRET_KEY'].strip()
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(SECRET_FILE):
        with open(SECRET_FILE, 'w', encoding='utf-8') as f:
            f.write(secrets.token_hex(32))
    with open(SECRET_FILE, encoding='utf-8') as f:
        return f.read().strip()


def _hash_guardado():
    """Hash de la clave: variable ADMIN_PASSWORD_HASH (servidor) o config/admin.json (PC)."""
    h = os.environ.get('ADMIN_PASSWORD_HASH', '').strip()
    if h:
        return h
    if os.path.exists(ADMIN_FILE):
        with open(ADMIN_FILE, encoding='utf-8') as f:
            return json.load(f).get('password_hash', '')
    return ''


def clave_configurada():
    return bool(_hash_guardado())


def verificar(clave):
    """Regresa (ok, mensaje)."""
    ahora = time.time()
    if _fallos['hasta'] > ahora:
        return False, f'Demasiados intentos. Espera {int((_fallos["hasta"] - ahora) // 60) + 1} min.'
    if not clave_configurada():
        return False, 'No hay clave de administrador. Créala con establecer_clave_admin.bat en la carpeta del proyecto.'
    h = _hash_guardado()
    if clave and check_password_hash(h, clave):
        _fallos['n'] = 0
        return True, 'ok'
    _fallos['n'] += 1
    if _fallos['n'] >= MAX_INTENTOS:
        _fallos['n'] = 0
        _fallos['hasta'] = ahora + BLOQUEO_MINUTOS * 60
        return False, f'Clave incorrecta. Edición bloqueada {BLOQUEO_MINUTOS} min por seguridad.'
    return False, f'Clave incorrecta ({MAX_INTENTOS - _fallos["n"]} intentos restantes).'


def guardar_clave(clave):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(ADMIN_FILE, 'w', encoding='utf-8') as f:
        json.dump({'password_hash': generate_password_hash(clave),
                   'actualizado': time.strftime('%Y-%m-%d %H:%M')}, f, indent=2)


if __name__ == '__main__':
    print('=== Clave de administrador del Dashboard Bitelit ===')
    print('Se usa para desbloquear la edición de IDs/URLs en "Fuentes de Datos".')
    if clave_configurada():
        print('(Ya existe una clave; la nueva la reemplazará.)')
    while True:
        c1 = getpass('Nueva clave (mínimo 8 caracteres, no se muestra): ')
        if len(c1) < 8:
            print('Muy corta, intenta de nuevo.')
            continue
        if getpass('Repite la clave: ') != c1:
            print('No coinciden, intenta de nuevo.')
            continue
        break
    guardar_clave(c1)
    print('Listo. Clave guardada (solo su hash) en config/admin.json. Reinicia el dashboard si está abierto.')
