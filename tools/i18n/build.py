"""Build /es/ and /ko/ copies of every English page, and add hreflang + a language switcher to all pages.

Usage: python3 tools/i18n/build.py
Translations live in tools/i18n/es.json and ko.json, keyed by the English segment with tag attributes
stripped and product names replaced by {0}, {1}... (see seg.canon). Edit English at the root, then rerun.
"""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seg import segments, needs, canon, uncanon

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SITE = 'https://34interactv.com'
LANGS = {'es': ('es_LA', 'Español'), 'ko': ('ko_KR', '한국어')}  # Spanish is neutral Latin American

# Legal pages (privacy, per-app privacy, terms, data deletion) are published in es/ko only after review.
# While False, es/ko legal pages are not generated and translated pages link to the English legal pages.
PUBLISH_LEGAL = False
DISCLAIMER = {
    'es': 'Si esta traducción y la versión en inglés difieren, prevalece la versión en inglés.',
    'ko': '이 번역본과 영어 원문이 서로 다를 경우 영어 원문이 우선합니다.',
}

def is_legal(rel):
    return rel in ('privacy.html', 'terms.html', 'data-deletion.html') or rel.startswith('privacy/')

def available(rel):
    return PUBLISH_LEGAL or not is_legal(rel)
SKIP = {'404.html'}  # GitHub Pages serves only the root 404 page
START, END = '<!--i18n:start-->', '<!--i18n:end-->'

def pages():
    out = []
    for f in sorted(glob.glob(ROOT + '/*.html') + glob.glob(ROOT + '/privacy/*.html')):
        rel = os.path.relpath(f, ROOT).replace(os.sep, '/')
        if rel not in SKIP: out.append(rel)
    return out

def pretty(rel, lang=None):
    p = rel[:-5]
    if p == 'index': p = ''
    elif p.endswith('/index'): p = p[:-5]
    return '/' + (lang + '/' if lang else '') + p

def strip_i18n(src):
    return re.sub(re.escape(START) + r'.*?' + re.escape(END), '', src, flags=re.S)

def head_links(rel, lang):
    if not available(rel): return ''
    links = [f'<link rel="alternate" hreflang="en" href="{SITE}{pretty(rel)}">']
    for l in LANGS: links.append(f'<link rel="alternate" hreflang="{l}" href="{SITE}{pretty(rel, l)}">')
    links.append(f'<link rel="alternate" hreflang="x-default" href="{SITE}{pretty(rel)}">')
    return START + ''.join(links) + END

def switcher(rel, lang):
    # An untranslated legal page sends es/ko visitors to that language's home page.
    items = [('en', 'English', pretty(rel))] + [(l, LANGS[l][1], pretty(rel if available(rel) else 'index.html', l)) for l in LANGS]
    a = []
    for code, name, href in items:
        cur = ' aria-current="true"' if code == lang else ''
        a.append(f'<a href="{href}" hreflang="{code}" lang="{code}"{cur}>{name}</a>')
    label = {'en': 'Language', 'es': 'Idioma', 'ko': '언어'}[lang]
    return START + f'<div class="lang-switch" role="navigation" aria-label="{label}">' + ''.join(a) + '</div>' + END

def add_chrome(src, rel, lang):
    src = src.replace('</head>', head_links(rel, lang) + '\n</head>', 1)
    src = src.replace('</nav>', '</nav>' + switcher(rel, lang), 1)
    return src

def fix_korean_particles(s):
    # Choose 은/는, 이/가, 을/를, 과/와, 으로/로 after a product name by its final Korean reading.
    batchim = {'VaultDrill': 'l', 'AnchorLine': 'n', 'Plumbline': 'n', 'Vigil': 'l'}
    names = ['Pegasus: A Call To Arms', 'Known Callers', 'VaultDrill', 'GlydeKeys', 'AnchorLine', 'TruckWorth',
             'BrewWorth', 'WashWorth', 'Plumbline', 'Pegasus', 'Skylease', 'Vigil Pro', 'Vigil', 'Plus', 'Caddy']
    pat = re.compile('(' + '|'.join(re.escape(n) for n in names) + r')(</a>|</strong>)?(은\(는\)|이\(가\)|을\(를\)|과\(와\)|와\(과\))')
    def r(m):
        name, close, p = m.group(1), m.group(2) or '', m.group(3)
        has = name in batchim
        pick = {'은(는)': ('은', '는'), '이(가)': ('이', '가'), '을(를)': ('을', '를'),
                '과(와)': ('과', '와'), '와(과)': ('과', '와')}[p]
        return name + close + (pick[0] if has else pick[1])
    s = pat.sub(r, s)
    return s

def rewrite_urls(src, rel, lang):
    base = os.path.dirname(rel)
    def fix(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r'^(?:[a-z]+:|#|//)', url): return m.group(0)
        path = url.split('#')[0].split('?')[0]
        if url.startswith('/'):
            if path.endswith('.html') or path == '/' or re.match(r'^/privacy(/[a-z]*)?$', path) or \
               re.match(r'^/(?:support|contact|terms|data-deletion|index|privacy|' + '|'.join(APPS) + r')$', path):
                tgt = path.lstrip('/')
                tgt = (tgt + 'index.html') if (tgt.endswith('/') or tgt == '') else (tgt if tgt.endswith('.html') else tgt + '.html')
                if not available(tgt): return m.group(0)  # legal page not yet translated: keep English
                return f'{attr}="/{lang}{url}"'
            return m.group(0)
        if path.endswith('.html') or path == '':
            target = os.path.normpath(os.path.join(base, path)).replace(os.sep, '/') if path else rel
            if path and not available(target):  # legal page not yet translated: link to English
                return f'{attr}="{pretty(target)}{url[len(path):]}"'
            return m.group(0)  # relative page link: stays in the language folder
        absu = '/' + os.path.normpath(os.path.join(base, url)).replace(os.sep, '/').lstrip('./')
        return f'{attr}="{absu}"'
    return re.sub(r'\b(href|src)="([^"]*)"', fix, src)

APPS = ['vaultdrill', 'glydekeys', 'anchorline', 'truckworth', 'vigil', 'brewworth', 'washworth', 'knowncallers', 'plumbline', 'pegasus', 'skylease']

def translate(src, table, missing, rel):
    segs = segments(src)
    out, last = [], 0
    for s, e, core, kind in segs:
        if not needs(core): continue
        key, tags, names = canon(core)
        if re.fullmatch(r'(\{\d+\}|<[^>]*>|\s|&middot;|·|:)*', key): continue
        tr = table.get(key)
        if tr is None:
            missing.setdefault(key, rel); continue
        new = uncanon(tr, tags, names)
        if kind == 'attr': new = new.replace('"', '&quot;')
        out.append(src[last:s]); out.append(new); last = e
    out.append(src[last:])
    return ''.join(out)

def load_tables():
    keys = None
    tables = {}
    for l in LANGS:
        p = os.path.join(HERE, l + '.json')
        tables[l] = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    return tables

def main():
    tables = load_tables()
    report = {}
    for rel in pages():
        path = os.path.join(ROOT, rel)
        src = strip_i18n(open(path, encoding='utf-8').read())
        open(path, 'w', encoding='utf-8').write(add_chrome(src, rel, 'en'))
        for lang, (locale, _) in LANGS.items():
            dst = os.path.join(ROOT, lang, rel)
            if not available(rel):
                if os.path.exists(dst): os.remove(dst)
                continue
            missing = {}
            t = translate(src, tables[lang], missing, rel)
            t = re.sub(r'<html lang="en"', f'<html lang="{lang}"', t, count=1)
            t = t.replace('content="en_US"', f'content="{locale}"')
            t = rewrite_urls(t, rel, lang)
            canon_url = SITE + pretty(rel, lang)
            t = re.sub(r'(<link rel="canonical" href=")[^"]*(")', r'\g<1>' + canon_url + r'\2', t)
            t = re.sub(r'(<meta property="og:url" content=")[^"]*(")', r'\g<1>' + canon_url + r'\2', t)
            if lang == 'ko': t = fix_korean_particles(t)
            if is_legal(rel):
                t = t.replace('</h1>', f'</h1>\n<p class="note small translation-note">{DISCLAIMER[lang]}</p>', 1)
            t = add_chrome(t, rel, lang)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            open(dst, 'w', encoding='utf-8').write(t)
            for k, v in missing.items(): report.setdefault(lang, {}).setdefault(k, v)
    # sitemap
    urls = []
    for rel in pages():
        for l in [None] + (list(LANGS) if available(rel) else []):
            urls.append(f'  <url><loc>{SITE}{pretty(rel, l)}</loc></url>')
    open(os.path.join(ROOT, 'sitemap.xml'), 'w').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls) + '\n</urlset>\n')
    for l, m in report.items():
        print(l, 'missing', len(m))
        for k, v in list(m.items())[:20]: print('  ', v, '|', k[:120].replace('\n', '⏎'))
    if not report: print('all segments translated')

if __name__ == '__main__':
    main()
