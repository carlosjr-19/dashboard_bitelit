"""Funciones de apoyo: limpieza de textos, fechas y detección de columnas en las hojas."""
import re
import unicodedata
import pandas as pd


def clean_str(val):
    if val is None:
        return ""
    try:
        if pd.isna(val):
            return ""
    except (TypeError, ValueError):
        pass
    return str(val).strip()


def fix_mojibake(s):
    """Corrige textos con acentos rotos tipo 'AmÃ©rica' -> 'América' (UTF-8 leído como Latin-1)."""
    if s and ('Ã' in s or 'Â' in s):
        try:
            return s.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            return s
    return s


def normalize_col(col_name):
    if col_name is None:
        return ""
    s = str(col_name).strip().lower()
    s = unicodedata.normalize('NFKD', s)
    s = "".join([c for c in s if not unicodedata.combining(c)])
    s = re.sub(r'[^a-z0-9_ ]', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def has_word(c_norm, word):
    """True si 'word' aparece como palabra completa (evita que 'dn' coincida dentro de otra palabra)."""
    return re.search(r'(^|\s)' + re.escape(word) + r'(\s|$)', c_norm) is not None


def parse_date(val, dayfirst=True):
    """Convierte una fecha de Sheets a YYYY-MM-DD. Si no se puede, regresa el texto recortado.
    dayfirst=False para hojas con configuración regional de EE.UU. (mes/día/año)."""
    s = clean_str(val)
    if not s:
        return ""
    try:
        if re.match(r'^\d{4}-\d{1,2}-\d{1,2}', s):
            return pd.to_datetime(s[:10], format='%Y-%m-%d').strftime('%Y-%m-%d')
        return pd.to_datetime(s, dayfirst=dayfirst, format='mixed').strftime('%Y-%m-%d')
    except Exception:
        return s[:10]


def extract_sheet_id(value):
    """Acepta un ID o la URL completa de Google Sheets y regresa solo el ID."""
    v = clean_str(value)
    m = re.search(r'/spreadsheets/d/([a-zA-Z0-9_-]+)', v)
    return m.group(1) if m else v


def find_col(columns, include=(), exclude=(), used=None, override=None, words=()):
    """Regresa la PRIMERA columna cuyo nombre contenga alguno de 'include' (o una palabra completa de 'words')
    y ninguno de 'exclude'. 'override' fuerza un nombre exacto definido en la configuración."""
    if override:
        for c in columns:
            if normalize_col(c) == normalize_col(override):
                return c
    used = used or set()
    libres = [c for c in columns if c not in used and not any(x in normalize_col(c) for x in exclude)]
    # La prioridad la da el orden de las palabras clave (la primera es la preferida)
    for term in include:
        for c in libres:
            if term in normalize_col(c):
                return c
    for w in words:
        for c in libres:
            if has_word(normalize_col(c), w):
                return c
    return None


def best_filled_col(df, candidates):
    """De varias columnas candidatas, regresa la que tenga más celdas con datos."""
    best, best_n = None, 0
    for c in candidates:
        if c is None or c not in df.columns:
            continue
        n = int((df[c].astype(str).str.strip() != '').sum())
        if n > best_n:
            best, best_n = c, n
    return best
