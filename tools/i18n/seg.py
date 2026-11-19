"""Find translatable segments in a page: leaf block inner HTML, orphan text nodes, and some attributes."""
from html.parser import HTMLParser
import re
BLOCK = set('p h1 h2 h3 h4 h5 h6 li ul ol div section article figcaption figure summary details td th tr table thead tbody address header footer nav main title label dt dd dl body head html form fieldset blockquote'.split())
VOID = set('meta link img br input hr source wbr'.split())
ATTRS = {'alt', 'aria-label', 'title', 'placeholder'}
META_NAMES = {'description', 'og:title', 'og:description', 'twitter:title', 'twitter:description'}

class P(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.lines = [0]
        for m in re.finditer('\n', src): self.lines.append(m.end())
        self.stack = []  # [tag, inner_start, has_block_child, text_nodes]
        self.segs = []   # (start, end, kind)
        self.raw = None
    def off(self):
        l, c = self.getpos(); return self.lines[l-1] + c
    def handle_starttag(self, tag, attrs):
        st = self.off(); txt = self.get_starttag_text(); end = st + len(txt)
        # attribute segments
        d = dict(attrs)
        for a in ATTRS:
            if d.get(a):
                m = re.search(r'\s%s="([^"]*)"' % re.escape(a), txt)
                if m and m.group(1).strip(): self.segs.append((st+m.start(1), st+m.end(1), 'attr'))
        if tag == 'meta' and (d.get('name') in META_NAMES or d.get('property') in META_NAMES):
            m = re.search(r'\scontent="([^"]*)"', txt)
            if m: self.segs.append((st+m.start(1), st+m.end(1), 'attr'))
        if tag in BLOCK:
            for s in self.stack: s[2] = True
        if tag in VOID: return
        if tag in ('script', 'style'):
            self.stack.append([tag, end, True, []]); return
        self.stack.append([tag, end, False, []])
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
    def handle_endtag(self, tag):
        if tag in VOID: return
        pos = self.off()
        # pop to matching tag
        while self.stack:
            t, start, hb, texts = self.stack.pop()
            if tag == t: break
            # unmatched: push texts up
        else:
            return
        if t in ('script', 'style'): return
        if t in BLOCK:
            if not hb and any(x[2].strip() for x in texts):
                self.segs.append((start, pos, 'block'))
            else:
                for x in texts: self.segs.append((x[0], x[1], 'text'))
        else:
            if self.stack: self.stack[-1][3].extend(texts)
    def _text(self, s, e):
        if self.stack and self.stack[-1][0] in ('script', 'style'): return
        if self.stack: self.stack[-1][3].append((s, e, self.src[s:e]))
    def handle_data(self, data):
        s = self.off(); self._text(s, s+len(data))
    def handle_entityref(self, name):
        s = self.off(); self._text(s, s+len(name)+2)
    def handle_charref(self, name):
        s = self.off(); self._text(s, s+len(name)+3)

def segments(src):
    p = P(src); p.feed(src); p.close()
    out = []
    for s, e, k in p.segs:
        raw = src[s:e]
        core = raw.strip()
        if not core: continue
        if k == 'text':
            # orphan text: merge happens per node; strip
            pass
        ls = s + (len(raw) - len(raw.lstrip()))
        out.append((ls, ls+len(core), core, k))
    # orphan text nodes within the same block may be fragments; fine.
    out.sort()
    return out

ID_RE = re.compile(r'^(?:[\s\d\-–—·.,:;/()+$%&]|&\w+;|&#\d+;)*$')
def needs(core):
    plain = re.sub(r'<[^>]+>', '', core)
    if ID_RE.match(plain): return False
    return True

NAMES = ['Pegasus: A Call To Arms', 'Known Callers', 'VaultDrill', 'GlydeKeys', 'AnchorLine', 'TruckWorth',
         'BrewWorth', 'WashWorth', 'Plumbline', 'Pegasus', 'Skylease', 'Vigil', 'RepRise', 'Cut']
NAME_RE = re.compile('|'.join(re.escape(n) for n in NAMES))
TAG_RE = re.compile(r'<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>')

def canon(core):
    """Return (key, tags, names): attributes stripped from start tags, product names -> {i}."""
    tags = []
    def t(m):
        tags.append(m.group(0)); return '<%s>' % m.group(1).lower()
    key = TAG_RE.sub(t, core)
    names = []
    # do not replace names inside tags (they have no attrs now, so safe)
    def n(m):
        names.append(m.group(0)); return '{%d}' % (len(names)-1)
    key = NAME_RE.sub(n, key)
    return key, tags, names

def uncanon(tr, tags, names):
    by = {}
    for i, tg in enumerate(tags):
        nm = TAG_RE.match(tg).group(1).lower(); by.setdefault(nm, []).append(tg)
    used = {}
    def t(m):
        nm = m.group(1).lower(); explicit = m.group(2)
        if explicit is not None: return by[nm][int(explicit)]
        k = used.get(nm, 0); used[nm] = k + 1
        return by[nm][k]
    out = re.sub(r'<([a-zA-Z][a-zA-Z0-9]*)(?:#(\d+))?>', t, tr)
    out = re.sub(r'\{(\d+)\}', lambda m: names[int(m.group(1))], out)
    return out
