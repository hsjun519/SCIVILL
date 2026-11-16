"""Run with python -m collector.run. stdlib only, no language-model services."""
from __future__ import annotations
import argparse, datetime as dt, hashlib, ipaddress, json, pathlib, re, socket, time, urllib.error, urllib.parse, urllib.request, urllib.robotparser
from html import unescape
from html.parser import HTMLParser
from .core import now, connect, records, upsert, recommend, lifecycle, canonical, assess

ROOT=pathlib.Path(__file__).resolve().parents[1]
UA='CYVIL-CompetitionCollector/1.0 (+https://github.com/hsjun519/SCIVILL)'
def load(path,default):
    try: return json.loads(path.read_text(encoding='utf-8-sig'))
    except FileNotFoundError: return default
def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True); tmp=path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); tmp.replace(path)
class Text(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]; self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ['script','style','noscript']: self.skip+=1
        if not self.skip and tag in ['p','br','li','h1','h2','h3','section','div']: self.parts.append('\n')
    def handle_endtag(self,tag):
        if tag in ['script','style','noscript'] and self.skip: self.skip-=1
    def handle_data(self,data):
        if not self.skip: self.parts.append(data)
def text(html):
    parser=Text(); parser.feed(html)
    return '\n'.join(re.sub(r'\s+',' ',line).strip() for line in ''.join(parser.parts).splitlines() if line.strip())
def safe_url(url,hosts):
    p=urllib.parse.urlsplit(url)
    if p.scheme!='https' or p.hostname not in hosts or p.port not in [None,443] or p.username or p.password: raise ValueError('URL not on HTTPS source allowlist')
    ips={item[4][0] for item in socket.getaddrinfo(p.hostname,443,type=socket.SOCK_STREAM)}
    if any(not ipaddress.ip_address(ip).is_global for ip in ips): raise ValueError('Non-public destination denied')
    return url
class Redirect(urllib.request.HTTPRedirectHandler):
    def __init__(self,hosts): self.hosts=hosts
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        safe_url(newurl,self.hosts)
        return super().redirect_request(req,fp,code,msg,headers,newurl)
class Fetcher:
    def __init__(self,hosts): self.hosts=hosts; self.last=0; self.cache={}; self.robots={}
    def raw(self,url):
        safe_url(url,self.hosts)
        if url in self.cache: return self.cache[url]
        error=None
        for attempt in range(3):
            time.sleep(max(0,1.1-(time.monotonic()-self.last))); self.last=time.monotonic()
            try:
                req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/json,application/xml,text/plain'})
                with urllib.request.build_opener(Redirect(self.hosts)).open(req,timeout=20) as r:
                    body=r.read(3_000_001)
                    if len(body)>3_000_000: raise ValueError('Response exceeds 3 MB')
                    ctype=r.headers.get_content_type()
                    if ctype not in ['text/html','text/plain','application/json','application/xml','text/xml']: raise ValueError('Unexpected content type')
                    encoding=r.headers.get_content_charset() or 'utf-8'; result=body.decode(encoding,errors='replace'); self.cache[url]=result; return result
            except urllib.error.HTTPError as exc:
                if exc.code not in [429,500,502,503,504]: raise
                error=exc
            except (OSError,TimeoutError) as exc: error=exc
            time.sleep(2**attempt)
        raise RuntimeError(str(error))
    def get(self,url):
        safe_url(url,self.hosts); p=urllib.parse.urlsplit(url); origin=f'{p.scheme}://{p.netloc}'
        if origin not in self.robots:
            rp=urllib.robotparser.RobotFileParser()
            try: rp.parse(self.raw(origin+'/robots.txt').splitlines())
            except urllib.error.HTTPError as exc:
                if exc.code in [404,410]: rp.parse(['User-agent: *','Allow: /'])
                else: raise RuntimeError(f'robots verification failed ({exc.code})')
            self.robots[origin]=rp
        if not self.robots[origin].can_fetch(UA,url): raise RuntimeError('robots disallows collection')
        return self.raw(url)
def discover_korea(html,url):
    block=re.search(r'<div class="list_type event">(.*?)</ul>',html,re.S)
    if not block: raise ValueError('Event list structure changed')
    result=[]
    for item in re.findall(r'<li>(.*?)</li>',block[1],re.S):
        a=re.search(r'<a[^>]+href="([^"]+)"',item); title=re.search(r'<strong>(.*?)</strong>',item,re.S); period=re.search(r'(20\d{2})\.(\d{1,2})\.(\d{1,2})\s*~\s*(20\d{2})\.(\d{1,2})\.(\d{1,2})',item)
        if not (a and title): continue
        title=text(title[1]); org=re.match(r'\[([^\]]+)\]',title)
        if not re.search(r'공모|경진|챌린지|해커톤|대회',title): continue
        c={'title':re.sub(r'^\[[^]]+\]\s*','',title),'organizer':org[1] if org else '', 'officialUrl':unescape(a[1]),'sourceUrl':url,'sourceId':'korea-events','officialVerified':False,'eligibility':'','description':'공식 주최기관 모집요강의 참가 자격과 핵심 정보 확인이 필요한 수집 후보입니다.','evidence':{}}
        if period:
            y,m,d,y2,m2,d2=map(int,period.groups()); c.update(applicationStartAt=f'{y:04}-{m:02}-{d:02}',applicationEndAt=f'{y2:04}-{m2:02}-{d2:02}',deadlineTimeConfirmed=False)
        result.append(c)
    return result
def discover_ai(html,url):
    paths=sorted(set(unescape(s) for s in re.findall(r'href="(/competitions/[a-zA-Z0-9_-]+)"',html)))
    return [urllib.parse.urljoin(url,path) for path in paths][:6]
def ai_candidate(html,url):
    body=text(html); title=(re.search(r'<h1[^>]*>(.*?)</h1>',html,re.S) or [None,url])[1]
    c={'title':text(title).removesuffix(' 소개'),'organizer':'과학기술정보통신부','officialUrl':url,'sourceUrl':url,'sourceId':'ai-official','officialVerified':True,'eligibility':'','theme':None,'description':'공식 페이지에서 수집한 공고입니다. 세부 활동은 공식 모집요강에서 확인하세요.','evidence':{},'lastCollectedAt':now().isoformat()}
    # Only bounded labelled sections can establish eligibility. A word elsewhere on the page cannot.
    for label,field in [('참가대상','eligibility'),('참가자격','eligibility'),('시상내역','awards'),('시상 내역','awards'),('공모주제','theme')]:
        section=re.search(r'<h[23][^>]*>\s*'+label+r'\s*</h[23]>(.*?)(?=<h[23]|</section>)',html,re.S)
        if section:
            value=text(section[1])[:250]; c[field]=value
            if field in ['eligibility','awards']: c['evidence'][field]=value
    dates=[]
    for line in body.splitlines():
        if not re.search(r'접수기간|접수 기간|작품 접수',line): continue
        m=re.search(r'(20\d{2})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2}).{0,12}?~\s*(\d{1,2})\D{0,3}(\d{1,2})',line)
        if m:
            y,mo,d,mo2,d2=map(int,m.groups()); dates.append((f'{y:04}-{mo:02}-{d:02}',f'{y:04}-{mo2:02}-{d2:02}',line[:160]))
    if dates:
        c['applicationStartAt'],c['applicationEndAt'],c['evidence']['dates']=dates[0]; c['deadlineTimeConfirmed']=False
        if len({(a,b) for a,b,_ in dates})>1: c['conflict']='서로 다른 접수 기간이 있어 검토 필요'
    if '접수기간\n26년 추후 공지' in body: c['conflict']='접수 기간에 추후 공지 문구가 남아 있어 검토 필요'
    return c
def revalidate(c,html):
    """Revalidate a known official template; do not guess fields on unrelated pages."""
    c=dict(c); body=text(html)
    if c['id']=='mofa-tcs-poster-2026':
        if not re.search(r'초[·ㆍ・]중[·ㆍ・]고등학생',body): raise ValueError('Official eligibility text changed; review required')
        match=re.search(r'접수기간\s*[:：]?\s*(20\d{2})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2}).{0,15}?~\s*(\d{1,2})\D{0,3}(\d{1,2}).{0,12}?(\d{1,2}):(\d{2})',body)
        if not match: raise ValueError('Official application dates could not be verified')
        y,m,d,m2,d2,h,minute=map(int,match.groups()); c['applicationStartAt']=f'{y:04}-{m:02}-{d:02}'; c['applicationEndAt']=f'{y:04}-{m2:02}-{d2:02}T{h:02}:{minute:02}:00+09:00'
        if '외교부장관상' not in body: raise ValueError('Award evidence changed; review required')
        c['evidence']['dates']=match[0]
    else:
        # Known unstructured content stays in review until a dedicated safe adapter exists.
        if c.get('evidence',{}).get('eligibility') and c['evidence']['eligibility'] not in body: raise ValueError('Eligibility evidence not found')
    c['lastVerifiedAt']=now().isoformat(); c['lastCollectedAt']=now().isoformat(); return c
def export(db,output,job,sources,automation):
    items=[assess(c) for c in records(db)]; overrides=load(ROOT/'collector/overrides.json',{})
    for c in items:
        c.update({k:v for k,v in overrides.get('competitions',{}).get(c['id'],{}).items() if k in ['hidden','pinned','excludeRecommendation']})
        c['status']=lifecycle(c); c['scoreBreakdown']=__import__('collector.core',fromlist=['score']).score(c); c['relevanceScore']=sum(c['scoreBreakdown'].values())
    rec=recommend(items); db.execute('DELETE FROM CompetitionRecommendation')
    for cat,ids in rec.items(): db.executemany('INSERT INTO CompetitionRecommendation VALUES(?,?)',[(cat,i) for i in ids])
    public=[c for c in items if c.get('publicationStatus')=='published' and not c.get('hidden')]
    logs=[json.loads(r[0]) for r in db.execute('SELECT payload FROM CompetitionImportJob ORDER BY id DESC LIMIT 15')]
    changes=[{'competitionId':r[0],'changedAt':r[1]} for r in db.execute('SELECT competitionId,changedAt FROM CompetitionChangeLog ORDER BY id DESC LIMIT 30')]
    write(output/'competitions.json',{'schemaVersion':2,'mode':'real','generatedAt':now().isoformat(),'lastCollectedAt':max((s.get('lastSuccessAt') or '' for s in sources),default=None),'lastVerifiedAt':max((c.get('lastVerifiedAt','') for c in public),default=None),'competitions':public,'recommendations':rec,'changes':changes})
    # Public operational facts only. Candidate contents remain behind GitHub edit permissions.
    write(output/'status.json',{'schemaVersion':2,'generatedAt':now().isoformat(),'automation':automation,'schedule':'0 23 * * *','timezone':'Asia/Seoul','nextSchedule':'매일 오전 8시 KST (GitHub 지연 가능)','job':job,'sources':sources,'recommendationCounts':{k:len(v) for k,v in rec.items()},'publishedCount':len(public),'reviewCount':sum(c.get('publicationStatus')=='review' for c in items),'jobs':logs,'changes':changes})
    db.commit()
def run(dbpath=None,output=None,offline=False,automation=None):
    dbpath=pathlib.Path(dbpath or ROOT/'collector/data/competitions.sqlite'); dbpath.parent.mkdir(parents=True,exist_ok=True)
    output=pathlib.Path(output or ROOT/'platform/data'); db=connect(dbpath)
    curated=load(ROOT/'collector/curated.json',[]); overrides=load(ROOT/'collector/overrides.json',{})
    existing={c['id']:c for c in records(db)}
    # Seed only once: an old seed must never roll back a verified deadline extension.
    for c in curated+overrides.get('manualCompetitions',[]):
        fingerprint=hashlib.sha256(json.dumps(c,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        revision=db.execute('SELECT fingerprint FROM CuratedRevision WHERE id=?',(c.get('id',''),)).fetchone()
        if not revision or revision[0]!=fingerprint:
            upsert(db,c)
            db.execute('INSERT OR REPLACE INTO CuratedRevision VALUES(?,?)',(c['id'],fingerprint))
    sources=load(ROOT/'collector/sources.json',[]); job={'id':now().isoformat(),'startedAt':now().isoformat(),'status':'running','discovered':0,'new':0,'duplicates':0,'failures':0,'checkedSources':0,'autoPublished':0}
    for source in sources:
        previous=db.execute('SELECT payload FROM CompetitionSource WHERE id=?',(source['id'],)).fetchone()
        if previous:
            old=json.loads(previous[0]); source.update({k:old.get(k) for k in ['lastSuccessAt','lastFailure','lastCount']})
        source['enabled']=overrides.get('sources',{}).get(source['id'],source['enabled'])
        if offline or not source['enabled']:
            source['state']='disabled' if not source['enabled'] else 'not_run'; continue
        job['checkedSources']+=1; count=0; fetcher=Fetcher(source['allowedHosts'])
        try:
            html=fetcher.get(source['url'])
            candidates=[]
            if source['adapter']=='korea': candidates=discover_korea(html,source['url'])
            elif source['adapter']=='ai':
                for url in discover_ai(html,source['url']):
                    candidates.append(ai_candidate(fetcher.get(url),url))
            for candidate in candidates:
                # Preserve curated and already verified official records instead of downgrading with catalogue metadata.
                old=next((c for c in records(db) if canonical(c['officialUrl'])==canonical(candidate['officialUrl']) and (c.get('applicationStartAt') or '')[:4]==(candidate.get('applicationStartAt') or '')[:4]),None)
                if old:
                    if candidate.get('officialVerified'):
                        merged=dict(old); merged.update(candidate); merged['id']=old['id']
                        if assess(merged)['verificationStatus']=='verified': merged['lastVerifiedAt']=now().isoformat()
                        upsert(db,merged)
                    job['duplicates']+=1; continue
                candidate['lastCollectedAt']=now().isoformat(); added=upsert(db,candidate); job['new']+=int(added); job['duplicates']+=int(not added); count+=1
            for c in records(db):
                if c.get('sourceId')==source['id'] and c.get('revalidationUrl'):
                    try: updated=revalidate(c,html if c['revalidationUrl']==source['url'] else fetcher.get(c['revalidationUrl']))
                    except ValueError as exc:
                        disputed=dict(c); disputed['conflict']=str(exc); upsert(db,disputed); raise
                    upsert(db,updated); count+=1
            source.update(state='success',lastSuccessAt=now().isoformat(),lastFailure=None,lastCount=count)
            job['discovered']+=len(candidates)
        except Exception as exc:
            # No URLs with credentials, response bodies or environment variables are logged.
            source.update(state='failed',lastFailure=type(exc).__name__+': '+str(exc)[:180],lastCount=0); job['failures']+=1
        db.execute('INSERT OR REPLACE INTO CompetitionSource VALUES(?,?)',(source['id'],json.dumps(source,ensure_ascii=False)))
    for c in records(db): upsert(db,c)
    job['status']='partial' if job['failures'] else 'success'; job['completedAt']=now().isoformat(); job['autoPublished']=sum(c.get('publicationStatus')=='published' for c in records(db)); job['reviewCount']=sum(c.get('publicationStatus')=='review' for c in records(db))
    if offline: job['status']='not_run'
    db.execute('INSERT OR REPLACE INTO CompetitionImportJob VALUES(?,?)',(job['id'],json.dumps(job,ensure_ascii=False)))
    try:
        export(db,output,job,sources,automation or load(ROOT/'collector/automation.json',{'state':'pending','detail':'워크플로 배포 및 첫 실행 확인 대기'}))
        return job
    finally: db.close()
if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--offline',action='store_true'); args=parser.parse_args()
    print(json.dumps(run(offline=args.offline),ensure_ascii=False))
