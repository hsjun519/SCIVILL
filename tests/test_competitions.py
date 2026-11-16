import copy, datetime as dt, json, pathlib, tempfile, threading, unittest, urllib.request, urllib.error
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from collector.core import KST, assess, canonical, categories, connect, deadline, eligibility, lifecycle, recommend, records, score, upsert
from collector.run import discover_korea, safe_url, revalidate
from collector.server import make_handler

AT=dt.datetime(2026,11,16,8,tzinfo=KST)
def contest(i=1,**changes):
    c={'id':f'test-{i}','title':f'2026 고등학생 로봇 데이터 탐구대회 {i}','organizer':'테스트 주최기관','theme':'로봇 제작과 데이터 분석','eligibility':'전국 고등학교 재학생','applicationStartAt':'2026-11-01','applicationEndAt':'2026-12-01','officialUrl':f'https://example.org/official/{i}','officialVerified':True,'awards':'교육부장관상','evidence':{'eligibility':'전국 고등학교 재학생','dates':'2026.11.1~12.1','awards':'교육부장관상'},'lastVerifiedAt':'2026-11-16T08:00:00+09:00'}
    c.update(changes); return assess(c)
class Rules(unittest.TestCase):
    def test_eligibility_four_states(self):
        self.assertEqual(eligibility('전국 고등학생'),'confirmed'); self.assertEqual(eligibility('만 19세 이하 청소년'),'conditional'); self.assertEqual(eligibility('청소년 누구나'),'review'); self.assertEqual(eligibility('대학(원)생만 참가 가능'),'ineligible')
    def test_negative_qualifications_win(self): self.assertEqual(eligibility('고등학생 제외, 대학생 이상 참가'),'ineligible')
    def test_keyword_elsewhere_cannot_approve(self):
        c=contest(eligibility='청소년',description='고등학생이 좋아하는 로봇 대회')
        self.assertEqual(c['publicationStatus'],'review')
    def test_additional_equipment_is_conditional(self): self.assertEqual(eligibility('직접 정비 가능한 로봇을 보유한 개인 또는 팀'),'conditional')
    def test_sponsor_is_not_award(self):
        c=contest(organizer='교육부장관상 후원',awards=None,evidence={'eligibility':'고등학생','dates':'11월'})
        self.assertFalse(c['hasMinisterAward']); self.assertIn('공학',c['tags']); self.assertIn('소프트웨어',c['tags'])
    def test_award_requires_evidence(self): self.assertFalse(contest(evidence={'eligibility':'고등학생','dates':'11월'})['hasMinisterAward'])
    def test_missing_required_fields_blocks_publication(self): self.assertEqual(contest(applicationStartAt=None)['publicationStatus'],'review')
    def test_high_score_cannot_override_eligibility(self):
        c=contest(eligibility='대학생 이상'); c['relevanceScore']=100
        self.assertFalse(any(recommend([c],AT).values()))
    def test_kst_date_only_closes_at_end_of_day(self):
        c=contest(applicationEndAt='2026-11-16'); self.assertEqual(lifecycle(c,dt.datetime(2026,11,16,23,59,59,tzinfo=KST)),'open'); self.assertEqual(lifecycle(c,dt.datetime(2026,11,17,tzinfo=KST)),'closed')
    def test_exact_cutoff(self):
        c=contest(applicationEndAt='2026-11-16T17:00:00+09:00'); self.assertEqual(lifecycle(c,dt.datetime(2026,11,16,17,0,1,tzinfo=KST)),'closed')
    def test_upcoming(self): self.assertEqual(lifecycle(contest(applicationStartAt='2026-11-20'),AT),'upcoming')
    def test_invalid_dates_remain_review(self):
        c=contest(applicationEndAt='invalid'); self.assertEqual(c['publicationStatus'],'review'); self.assertEqual(lifecycle(c,AT),'unknown')
    def test_recommendations_unique_max_three_each(self):
        items=[contest(i) for i in range(15)]; rec=recommend(items,AT); ids=[x for group in rec.values() for x in group]
        self.assertTrue(all(len(group)<=3 for group in rec.values())); self.assertEqual(len(ids),len(set(ids))); self.assertEqual(len(rec['장관상 대회']),3)
    def test_expired_and_hidden_never_recommended(self):
        items=[contest(1,applicationEndAt='2026-11-15'),contest(2,hidden=True),contest(3,excludeRecommendation=True)]
        self.assertFalse(any(recommend(items,AT).values()))
    def test_preparation_time_not_just_nearest_deadline(self):
        self.assertGreater(score(contest(1,applicationEndAt='2026-11-30'),AT)['준비 기간'],score(contest(2,applicationEndAt='2026-11-17'),AT)['준비 기간'])
    def test_not_exactly_twelve(self): self.assertEqual(sum(map(len,recommend([contest()],AT).values())),1)
    def test_newest_verified_tie_break(self):
        a=contest(1,lastVerifiedAt='2026-11-15T08:00:00+09:00'); b=contest(2,lastVerifiedAt='2026-11-16T08:00:00+09:00')
        self.assertEqual(recommend([a,b],AT)['장관상 대회'][0],b['id'])
class Storage(unittest.TestCase):
    def setUp(self): self.tmp=tempfile.TemporaryDirectory(); self.db=connect(pathlib.Path(self.tmp.name)/'test.sqlite')
    def tearDown(self): self.db.close(); self.tmp.cleanup()
    def test_idempotent_import(self):
        self.assertTrue(upsert(self.db,contest())); self.assertFalse(upsert(self.db,contest())); self.assertEqual(len(records(self.db)),1)
    def test_same_url_merges(self):
        upsert(self.db,contest()); upsert(self.db,contest(2,officialUrl=contest()['officialUrl'])); self.assertEqual(len(records(self.db)),1)
    def test_yearly_edition_separate(self):
        upsert(self.db,contest()); upsert(self.db,contest(2,title='2027 고등학생 로봇 데이터 탐구대회',applicationStartAt='2027-11-01',applicationEndAt='2027-12-01')); self.assertEqual(len(records(self.db)),2)
    def test_same_official_url_different_year_preserved(self):
        a=contest(); b=contest(2,title='2027 고등학생 로봇 데이터 탐구대회',officialUrl=a['officialUrl'],applicationStartAt='2027-11-01',applicationEndAt='2027-12-01')
        upsert(self.db,a); upsert(self.db,b); self.assertEqual(len(records(self.db)),2)
    def test_extension_updates_and_keeps_log(self):
        c=contest(); upsert(self.db,c); c['applicationEndAt']='2026-12-15'; upsert(self.db,c)
        self.assertEqual(records(self.db)[0]['applicationEndAt'],'2026-12-15'); self.assertEqual(self.db.execute('SELECT count(*) FROM CompetitionChangeLog').fetchone()[0],1)
    def test_transport_failure_preserves_verified_data(self):
        from collector import run as runner
        self.db.close(); self.db=connect(pathlib.Path(self.tmp.name)/'test.sqlite'); upsert(self.db,contest()); self.db.commit()
        sources=[{'id':'fail','enabled':True,'url':'https://example.org/list','allowedHosts':['example.org'],'adapter':'korea'}]
        real_load=runner.load
        def fake_load(path,default):
            if path.name=='sources.json': return sources
            if path.name=='curated.json': return []
            return real_load(path,default)
        with patch.object(runner,'load',side_effect=fake_load),patch.object(runner.Fetcher,'get',side_effect=TimeoutError('timeout')):
            job=runner.run(pathlib.Path(self.tmp.name)/'test.sqlite',pathlib.Path(self.tmp.name)/'output')
        self.assertEqual(job['status'],'partial'); self.assertEqual(len(records(self.db)),1); self.assertEqual(records(self.db)[0]['publicationStatus'],'published')
class Network(unittest.TestCase):
    def test_no_private_destinations(self):
        with self.assertRaises(ValueError): safe_url('https://127.0.0.1/secret',['127.0.0.1'])
        with self.assertRaises(ValueError): safe_url('http://example.org/',['example.org'])
        with self.assertRaises(ValueError): safe_url('https://user:password@example.org/',['example.org'])
        with self.assertRaises(ValueError): safe_url('https://unapproved.org/',['example.org'])
    def test_discovery_does_not_auto_verify(self):
        html='<div class="list_type event"><ul><li><a href="https://example.org/a"><strong>[정부기관] 과학 공모전</strong><span>기간 : 2026.11.01 ~ 2026.12.01</span></a></li></ul></div>'
        items=discover_korea(html,'https://www.korea.kr/etc/byulbyulList.do'); self.assertEqual(len(items),1); self.assertEqual(assess(items[0])['publicationStatus'],'review')
    def test_source_layout_failure_is_explicit(self):
        with self.assertRaises(ValueError): discover_korea('<html>maintenance</html>','https://www.korea.kr/')
    def test_ai_endpoints_not_in_allowlist(self):
        from collector.remote_client import COLLECTION_HOSTS; sources=[{'allowedHosts':COLLECTION_HOSTS}]
        for s in sources:
            for host in s['allowedHosts']: self.assertNotRegex(host,r'openai|anthropic|generativelanguage|gemini')
    def test_schedule_utc_conversion(self):
        schedule=(pathlib.Path(__file__).parents[1]/'.github/workflows/cyvil-daily.yml').read_text(encoding='utf-8')
        self.assertIn("cron: '0 23 * * *'",schedule); self.assertEqual((23+9)%24,8)
class Api(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(); path=pathlib.Path(cls.tmp.name)/'api.sqlite'; db=connect(path); upsert(db,contest()); upsert(db,contest(2,eligibility='청소년')); db.commit(); db.close()
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),make_handler(path,token='test-only-ephemeral-token'))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True); cls.thread.start(); cls.base=f'http://127.0.0.1:{cls.server.server_port}'
    @classmethod
    def tearDownClass(cls): cls.server.shutdown(); cls.server.server_close(); cls.thread.join(); cls.tmp.cleanup()
    def test_public_query_hides_review_records(self):
        with urllib.request.urlopen(self.base+'/api/competitions') as r: data=json.load(r)
        self.assertEqual(len(data['competitions']),1); self.assertIn('status',data['competitions'][0])
    def test_admin_read_requires_server_auth(self):
        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(self.base+'/api/admin/competitions')
        self.assertEqual(e.exception.code,401)
    def test_admin_write_requires_server_auth(self):
        req=urllib.request.Request(self.base+'/api/admin/competition',data=b'{}',method='PATCH')
        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(req)
        self.assertEqual(e.exception.code,401)
    def test_approval_cannot_skip_validation(self):
        req=urllib.request.Request(self.base+'/api/admin/competition',data=json.dumps({'id':'test-2','action':'approve'}).encode(),method='PATCH',headers={'Authorization':'Bearer test-only-ephemeral-token'})
        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(req)
        self.assertEqual(e.exception.code,422)
if __name__=='__main__': unittest.main()

