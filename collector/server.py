"""Optional always-on API for live DB queries and server-authorized admin changes.

GitHub Pages serves snapshots; deploy this module separately to enable an always-on API.
ADMIN_TOKEN is server-only. No token is included in the frontend or committed files.
"""
import hmac, json, os, pathlib, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from .core import connect, records, assess, upsert, lifecycle, recommend, now
from .run import ROOT, run, load, write
LOCK=threading.Lock()
def make_handler(dbpath=None,token=None,origin=None):
    dbpath=pathlib.Path(dbpath or os.environ.get('CYVIL_DB',ROOT/'collector/data/competitions.sqlite'))
    token=token if token is not None else os.environ.get('CYVIL_ADMIN_TOKEN','')
    origin=origin or os.environ.get('CYVIL_ALLOWED_ORIGIN','https://hsjun519.github.io')
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def reply(self,status,data):
            raw=json.dumps(data,ensure_ascii=False).encode(); self.send_response(status)
            self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff'); self.send_header('Content-Length',str(len(raw)))
            if self.headers.get('Origin')==origin: self.send_header('Access-Control-Allow-Origin',origin); self.send_header('Vary','Origin')
            self.end_headers(); self.wfile.write(raw)
        def authorized(self): return bool(token) and hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token)
        def do_OPTIONS(self):
            if self.headers.get('Origin')!=origin: return self.reply(403,{'error':'Origin not allowed'})
            self.send_response(204); self.send_header('Access-Control-Allow-Origin',origin); self.send_header('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS'); self.send_header('Access-Control-Allow-Headers','Authorization, Content-Type'); self.end_headers()
        def do_GET(self):
            path=urlsplit(self.path).path
            if path.startswith('/api/admin') and not self.authorized(): return self.reply(401,{'error':'관리자 인증 필요'})
            db=connect(dbpath)
            try:
                items=records(db)
                if path=='/api/admin/competitions': return self.reply(200,{'competitions':items})
                if path=='/api/competitions':
                    public=[dict(c,status=lifecycle(c)) for c in items if c.get('publicationStatus')=='published' and not c.get('hidden')]
                    return self.reply(200,{'schemaVersion':2,'mode':'real','generatedAt':now().isoformat(),'competitions':public,'recommendations':recommend(public)})
                if path=='/api/status': return self.reply(200,load(ROOT/'platform/data/status.json',{}))
                return self.reply(404,{'error':'Not found'})
            finally: db.close()
        def mutate(self):
            if not self.authorized(): return self.reply(401,{'error':'관리자 인증 필요'})
            if self.headers.get('Origin') not in [None,origin]: return self.reply(403,{'error':'Origin not allowed'})
            size=int(self.headers.get('Content-Length','0'))
            if size>100_000: return self.reply(413,{'error':'Request too large'})
            try: body=json.loads(self.rfile.read(size) or b'{}')
            except (ValueError,UnicodeError): return self.reply(400,{'error':'Invalid JSON'})
            if not LOCK.acquire(blocking=False): return self.reply(409,{'error':'수집/수정 작업 진행 중'})
            db=None
            try:
                path=urlsplit(self.path).path
                if path=='/api/admin/import': return self.reply(200,run(dbpath=dbpath))
                if path=='/api/admin/sources':
                    config=load(ROOT/'collector/overrides.json',{})
                    known={s['id'] for s in load(ROOT/'collector/sources.json',[])}
                    if body.get('id') not in known or not isinstance(body.get('enabled'),bool): return self.reply(400,{'error':'Invalid source update'})
                    config.setdefault('sources',{})[body['id']]=body['enabled']; write(ROOT/'collector/overrides.json',config)
                    return self.reply(200,{'saved':True})
                if path in ['/api/admin/competitions','/api/admin/competition']:
                    db=connect(dbpath); existing=next((c for c in records(db) if c['id']==body.get('id')),None)
                    c=dict(existing or {}); c.update(body)
                    if not c.get('officialUrl','').startswith('https://'): return self.reply(400,{'error':'HTTPS official URL required'})
                    # Neither an "approve" button nor a high score can bypass validation.
                    validated=assess(c)
                    if body.get('action')=='approve' and validated['verificationStatus']!='verified': return self.reply(422,{'error':'필수 근거 미충족','reasons':validated['reviewReasons']})
                    upsert(db,validated); db.commit(); return self.reply(200,{'competition':validated})
                return self.reply(404,{'error':'Not found'})
            except (ValueError,KeyError,TypeError) as exc: return self.reply(400,{'error':type(exc).__name__})
            finally:
                if db: db.close()
                LOCK.release()
        do_POST=mutate
        do_PATCH=mutate
    return Handler
if __name__=='__main__':
    if not os.environ.get('CYVIL_ADMIN_TOKEN'): print('Read-only mode: CYVIL_ADMIN_TOKEN is not configured.')
    ThreadingHTTPServer((os.environ.get('CYVIL_BIND','127.0.0.1'),int(os.environ.get('PORT','8787'))),make_handler()).serve_forever()
