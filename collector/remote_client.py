"""Ephemeral GitHub Actions collector. No DB, candidate or token is logged/uploaded."""
import json, os, pathlib, tempfile, urllib.request, urllib.parse, urllib.error
from . import run as runner
from .core import connect, records

SITE='https://scvill-club-hub.softbrook129.chatgpt.site'
COLLECTION_HOSTS=['www.korea.kr','apac.spectory.net','aichallenge4all.or.kr','www.mofa.go.kr','www.nie.re.kr']

def validate_sources(sources):
    for source in sources:
        # Manual-only sources may be documented without granting network access.
        if source.get('enabled') and not set(source['allowedHosts'])<=set(COLLECTION_HOSTS):
            raise ValueError('Unapproved source host')

def token():
    url=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']+'&audience='+urllib.parse.quote(SITE,safe='')
    request=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN'],'User-Agent':runner.UA})
    try:
        with urllib.request.urlopen(request,timeout=30) as response: return json.load(response)['value']
    except urllib.error.HTTPError as error: raise SystemExit('GitHub identity provider HTTP '+str(error.code)) from None

def api(path,payload=None):
    headers={'Authorization':'Bearer '+token(),'Content-Type':'application/json','User-Agent':runner.UA}
    request=urllib.request.Request(SITE+'/api/collector/'+path,headers=headers,data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode())
    try:
        with urllib.request.urlopen(request,timeout=60) as response: return json.load(response)
    except urllib.error.HTTPError as error:
        # Only fixed stage and status; never log tokens, response bodies or private records.
        raise SystemExit('Private catalogue '+path+' HTTP '+str(error.code)) from None

def main():
    context=api('context')
    validate_sources(context['sources'])
    # Private D1 catalogue travels only over authenticated HTTPS to this trusted job.
    # All temporary records and SQLite files are deleted at job completion, never committed.
    with tempfile.TemporaryDirectory(prefix='cyvil-') as directory:
        root=pathlib.Path(directory); (root/'collector').mkdir()
        runner.ROOT=root
        runner.write(root/'collector/curated.json',context['competitions'])
        runner.write(root/'collector/sources.json',context['sources'])
        runner.write(root/'collector/overrides.json',{})
        job=runner.run()
        db=connect(root/'collector/data/competitions.sqlite')
        try:
            items=records(db)
            sources=[json.loads(r[0]) for r in db.execute('SELECT payload FROM CompetitionSource')]
        finally: db.close()
        result=api('result',{'revision':context['revision'],'competitions':items,'sources':sources,'job':job})
        print(json.dumps({'ok':result['ok'],'status':job['status'],'new':job['new'],'duplicates':job['duplicates'],'failures':job['failures'],'reviewCount':job['reviewCount']},ensure_ascii=False))
        if job['failures']: raise SystemExit('Some sources failed; existing catalogue preserved. See the owner console.')

if __name__=='__main__':
    try: main()
    except urllib.error.HTTPError as error: raise SystemExit('Collector service HTTP '+str(error.code)) from None
