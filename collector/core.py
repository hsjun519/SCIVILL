from __future__ import annotations
import datetime as dt
import hashlib
import json
import re
import sqlite3
import unicodedata
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

KST = dt.timezone(dt.timedelta(hours=9))
CATEGORIES = ['장관상 대회', '공학', '소프트웨어', '기타·환경']
def now(): return dt.datetime.now(KST)
def canonical(url):
    p=urlsplit(url)
    return urlunsplit((p.scheme.lower(),p.netloc.lower(),p.path.rstrip('/'),urlencode(sorted((k,v) for k,v in parse_qsl(p.query) if not k.lower().startswith(('utm_','fbclid')))),''))
def identity(c):
    # Year and organizer prevent annual editions from being merged together.
    title=re.sub(r'[^0-9a-z가-힣]','',unicodedata.normalize('NFKC',c.get('title','')).lower())
    year=c.get('applicationStartAt','')[:4] or (re.search(r'20\d{2}',title) or ['unknown'])[0]
    return hashlib.sha256(f"{title}|{c.get('organizer','')}|{year}|{c.get('applicationStartAt','')}".encode()).hexdigest()[:20]
def deadline(c):
    value=c.get('applicationEndAt')
    if not value: return None
    value=value.replace('Z','+00:00')
    if len(value)==10: return dt.datetime.fromisoformat(value+'T23:59:59.999999+09:00')
    result=dt.datetime.fromisoformat(value)
    if result.tzinfo is None: raise ValueError('Deadline must have an explicit timezone')
    return result.astimezone(KST)
def lifecycle(c,at=None):
    at=at or now()
    try: end=deadline(c)
    except ValueError: return 'unknown'
    if not end: return 'unknown'
    if at>end: return 'closed'
    start=c.get('applicationStartAt')
    if start and at<dt.datetime.fromisoformat(start[:10]+'T00:00:00+09:00'): return 'upcoming'
    return 'open'
def eligibility(text):
    text=re.sub(r'\s+',' ',text or '')
    if re.search(r'고등학생.{0,8}(제외|불가)|대학\(?원?\)?생\s*(만|전용)|대학.{0,10}(재학생\s*대상|이상)|사업자등록증\s*필수|기업\s*전용',text): return 'ineligible'
    if re.search(r'만\s*\d+\s*세|지역\s*거주|관내|로봇을\s*보유|국적자.{0,10}팀',text): return 'conditional'
    if re.search(r'고등학생|고등학교\s*재학생|초[·ㆍ・,\s]*중[·ㆍ・,\s]*고|중[·ㆍ・,\s]*고등학생|연령\s*제한\s*없',text): return 'confirmed'
    # A generic "청소년", or an unrestricted audience without age evidence, needs review.
    return 'review'
def categories(c):
    body=' '.join(str(c.get(k,'')) for k in ['title','theme','description'])
    result=[]
    # Sponsor names are deliberately excluded: awards evidence alone controls this tag.
    if re.search(r'(장관상|장관\s*표창)',c.get('awards') or '') and c.get('evidence',{}).get('awards'): result.append(CATEGORIES[0])
    if re.search(r'로봇|공학|발명|메이커|자율주행|아두이노|하드웨어|모빌리티|CAD|3D\s*프린',body,re.I): result.append(CATEGORIES[1])
    software=re.search(r'AI|소프트웨어|프로그래밍|데이터|알고리즘|앱\s*개발|웹\s*개발|정보보안',body,re.I)
    artwork=re.search(r'포스터|그림|회화',c.get('title','')) and not re.search(r'AI\s*활용|프로그래밍|데이터\s*분석',c.get('title',''))
    if software and not artwork: result.append(CATEGORIES[2])
    if re.search(r'환경|생태|생물|멸종|에너지|탄소|기후|지속가능|융합|과학',body): result.append(CATEGORIES[3])
    return result
def assess(c):
    c=dict(c); c['id']=c.get('id') or identity(c)
    c['eligibilityStatus']=eligibility(c.get('eligibility',''))
    c['tags']=categories(c); c['hasMinisterAward']=CATEGORIES[0] in c['tags']
    reasons=[]
    for field in ['title','organizer','applicationStartAt','applicationEndAt','eligibility','officialUrl']:
        if not c.get(field): reasons.append(f'{field}: 필수 정보 확인 필요')
    p=urlsplit(c.get('officialUrl') or '')
    if p.scheme!='https' or not p.hostname or p.username or p.password or p.hostname in ['localhost','127.0.0.1','::1']: reasons.append('안전한 HTTPS 공식 URL 필요')
    for field in ['eligibility','dates']:
        if not c.get('evidence',{}).get(field): reasons.append(f'{field}: 공식 근거 문구 확인 필요')
    if not c.get('officialVerified'): reasons.append('공식 출처 검증 필요')
    if c['eligibilityStatus']!='confirmed': reasons.append('참가 자격: '+c['eligibilityStatus'])
    if not c['tags']: reasons.append('이공계/장관상 분야 적합성 확인 필요')
    try:
        end=deadline(c)
        start=c.get('applicationStartAt')
        if start and end and start[:10]>end.date().isoformat(): reasons.append('접수 기간 역전')
    except ValueError: reasons.append('날짜 형식 확인 필요')
    if c.get('conflict'): reasons.append(c['conflict'])
    c['reviewReasons']=reasons
    c['verificationStatus']='verified' if not reasons else 'needs_review'
    c['publicationStatus']='published' if not reasons else 'review'
    c['scoreBreakdown']=score(c)
    c['relevanceScore']=sum(c['scoreBreakdown'].values())
    return c
def score(c,at=None):
    at=at or now()
    try: end=deadline(c) if c.get('applicationEndAt') else None
    except ValueError: end=None
    days=(end-at).total_seconds()/86400 if end else -1
    body=(c.get('title') or '')+' '+(c.get('theme') or '')
    return {'학생·동아리 적합성':30 if c.get('eligibilityStatus')=='confirmed' else 10,
            '분야 적합성':25 if c.get('tags') else 0,
            '공식 출처 신뢰성':20 if c.get('officialVerified') else 0,
            '탐구·제작 연계':15 if re.search(r'로봇|개발|설계|분석|탐구|제작|발명',body) else 8,
            '준비 기간':10 if 7<=days<=60 else 7 if days>60 else 4 if days>=3 else 1 if days>=0 else 0}
def recommend(items,at=None):
    at=at or now(); result={cat:[] for cat in CATEGORIES}; used=set()
    eligible=[c for c in items if c.get('publicationStatus')=='published' and c.get('verificationStatus')=='verified' and c.get('eligibilityStatus')=='confirmed' and lifecycle(c,at)=='open' and not c.get('hidden') and not c.get('excludeRecommendation')]
    def rank(c):
        breakdown=score(c,at); completion=sum(bool(c.get(k)) for k in ['teamMinSize','teamMaxSize','theme','awards','submission'])
        checked=dt.datetime.fromisoformat(c['lastVerifiedAt']).timestamp() if c.get('lastVerifiedAt') else 0
        return (-bool(c.get('pinned')),-sum(breakdown.values()),-completion,-min(60,max(0,(deadline(c)-at).days)),-checked,c['id'])
    # Newest verification first, then deterministic stable ordering.
    eligible.sort(key=lambda c:c.get('lastVerifiedAt',''),reverse=True)
    eligible.sort(key=rank)
    for category in CATEGORIES:
        for c in eligible:
            if c['id'] not in used and category in c.get('tags',[]) and len(result[category])<3:
                result[category].append(c['id']); used.add(c['id'])
    return result
def connect(path):
    db=sqlite3.connect(path); db.row_factory=sqlite3.Row
    db.executescript('''
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS Competition(id TEXT PRIMARY KEY, canonicalUrl TEXT UNIQUE NOT NULL, payload TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS CompetitionSource(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS CompetitionImportJob(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS CompetitionVerification(competitionId TEXT PRIMARY KEY REFERENCES Competition(id), payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS CompetitionRecommendation(category TEXT, competitionId TEXT REFERENCES Competition(id), PRIMARY KEY(category,competitionId));
    CREATE TABLE IF NOT EXISTS CompetitionChangeLog(id INTEGER PRIMARY KEY, competitionId TEXT, changedAt TEXT NOT NULL, beforeJson TEXT, afterJson TEXT);
    CREATE TABLE IF NOT EXISTS CuratedRevision(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL);
    '''); return db
def upsert(db,c):
    c=assess(c); url=canonical(c['officialUrl'])+'|'+str(c.get('applicationStartAt') or '')[:10]; row=db.execute('SELECT id,payload FROM Competition WHERE id=? OR canonicalUrl=?',(c['id'],url)).fetchone()
    if row:
        c['id']=row['id']; old=json.loads(row['payload'])
        # Transport failure never deletes an existing record. Actual eligibility changes are held for review.
        before={k:v for k,v in old.items() if k not in ['lastCollectedAt','lastVerifiedAt','scoreBreakdown','relevanceScore']}
        after={k:v for k,v in c.items() if k not in ['lastCollectedAt','lastVerifiedAt','scoreBreakdown','relevanceScore']}
        if before!=after: db.execute('INSERT INTO CompetitionChangeLog(competitionId,changedAt,beforeJson,afterJson) VALUES(?,?,?,?)',(c['id'],now().isoformat(),json.dumps(old,ensure_ascii=False),json.dumps(c,ensure_ascii=False)))
    db.execute('INSERT INTO Competition VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET canonicalUrl=excluded.canonicalUrl,payload=excluded.payload,updatedAt=excluded.updatedAt',(c['id'],url,json.dumps(c,ensure_ascii=False),now().isoformat()))
    db.execute('INSERT OR REPLACE INTO CompetitionVerification VALUES(?,?)',(c['id'],json.dumps({'status':c['verificationStatus'],'evidence':c.get('evidence',{}),'reasons':c['reviewReasons']},ensure_ascii=False)))
    return not bool(row)
def records(db): return [json.loads(r[0]) for r in db.execute('SELECT payload FROM Competition ORDER BY id')]
