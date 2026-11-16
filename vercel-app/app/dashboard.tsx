'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, api, login, logout } from '../lib/firebase-client';

type Member={uid:string;name:string;role:'member'|'admin'};
type Team={id:string;title:string;description:string;category:string;capacity:number;members:number;ownerUid:string;competitionId?:string};
type Competition={id:string;title:string;organizer:string;category:string;theme:string|null;award:string|null;teamSize:string|null;officialUrl:string;applicationEndAt:string};
type Application={id:string;message:string;status:string;applicantName:string};

export default function Dashboard(){
 const [user,setUser]=useState<User|null>(null);
 const [ready,setReady]=useState(false),[member,setMember]=useState<Member|null>(null);
 const [teams,setTeams]=useState<Team[]>([]),[competitions,setCompetitions]=useState<Competition[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[active,setActive]=useState<'competitions'|'teams'>('competitions');
 const [teamTitle,setTeamTitle]=useState(''),[teamDescription,setTeamDescription]=useState('');
 const [teamCategory,setTeamCategory]=useState('공학'),[capacity,setCapacity]=useState(4);
 const [applicationText,setApplicationText]=useState<Record<string,string>>({});
 const [pending,setPending]=useState<Record<string,Application[]>>({});
 const [busy,setBusy]=useState(false);
 async function reload(){
  const [t,c]=await Promise.all([api('/api/teams'),fetch('/api/competitions',{cache:'no-store'}).then(r=>r.json())]);
  setTeams(t.teams||[]);setCompetitions(c.competitions||[]);
 }
 useEffect(()=>{
   return onAuthStateChanged(auth,async current=>{
     setUser(current);setMember(null);setError('');setReady(true);
     if(!current)return;
     try{
       const data=await api('/api/me');
       setMember(data.member);
       await reload();
     }catch(e){setError(e instanceof Error?e.message:'회원 확인에 실패했습니다.');}
   });
 },[]);
 async function createTeam(e:React.FormEvent){
   e.preventDefault();setBusy(true);setError('');setNotice('');
   try{
     await api('/api/teams',{method:'POST',body:JSON.stringify({title:teamTitle,description:teamDescription,category:teamCategory,capacity})});
     setTeamTitle('');setTeamDescription('');setNotice('팀이 등록되었습니다.');await reload();
   }catch(e){setError(e instanceof Error?e.message:'등록 실패');}
   finally{setBusy(false);}
 }
 async function apply(teamId:string){
   setBusy(true);setError('');setNotice('');
   try{
     await api('/api/teams/'+teamId+'/applications',{method:'POST',body:JSON.stringify({message:applicationText[teamId]||''})});
     setNotice('참가 신청이 접수되었습니다.');
   }catch(e){setError(e instanceof Error?e.message:'신청 실패');}
   finally{setBusy(false);}
 }
 async function showApplications(teamId:string){
   try{const data=await api('/api/teams/'+teamId+'/applications');setPending(old=>({...old,[teamId]:data.applications}));}
   catch(e){setError(e instanceof Error?e.message:'신청 조회 실패');}
 }
 async function decide(teamId:string,id:string,status:'approved'|'rejected'){
   setBusy(true);
   try{
    await api('/api/applications/'+id,{method:'PATCH',body:JSON.stringify({status})});
    await showApplications(teamId);await reload();
    setNotice('신청 상태를 변경했습니다.');
   }catch(e){setError(e instanceof Error?e.message:'처리 실패');}
   finally{setBusy(false);}
 }
 return <div className="shell">
  <header className="bar"><div className="brand"><span className="mark">S</span><div>SCIVILL<small>SCIENCE TOGETHER</small></div></div><span className="bar-note">관심사를 연결하고, 아이디어를 현실로.</span><div className="account">{user?<><span>{member?.name||user.email}</span><button className="ghost" onClick={()=>logout()}>로그아웃</button></>:<button onClick={async()=>{try{await login();}catch{setError('Google 로그인이 취소되었거나 실패했습니다.');}}}>Google 로그인</button>}</div></header>
  <main className="main">
   <section className="hero"><div className="eyebrow">CYVIL CLUB HUB · SECURE COLLABORATION</div><h1>혼자 찾던 기회,<br/><em>이제 함께 만들어 갑니다.</em></h1><p>대회를 발견하고 함께할 팀원을 만나보세요.<br/>실제 팀 모집과 신청 내역은 서버 데이터베이스에 저장됩니다.</p><div className="chips"><span>서버 인증</span><span>승인된 회원 전용</span><span>공용 팀 모집</span></div></section>
   {error&&<div className="alert error" role="alert">{error}</div>}
   {notice&&<div className="alert" role="status">{notice}</div>}
   {!ready?<p>로그인 상태 확인 중…</p>:!user?<div className="panel"><h2>싸이빌 동아리 로그인</h2><p>공고는 공개 조회할 수 있습니다. 팀 모집과 신청은 승인된 회원만 사용할 수 있습니다.</p><button onClick={async()=>{try{await login();}catch{setError('Google 로그인이 실패했습니다.');}}}>Google 계정으로 로그인</button></div>:!member?<div className="panel"><h2>회원 승인 확인</h2><p>동아리 회원으로 초대된 이메일만 이용할 수 있습니다. 가입을 원한다면 관리자에게 연락해 주세요.</p></div>:<div className="member-note">로그인됨: <strong>{member.name}</strong> · {member.role==='admin'?'관리자':'승인된 부원'}</div>}
   <div className="tabs"><button className={active==='competitions'?'selected':''} onClick={()=>setActive('competitions')}>대회 탐색</button><button className={active==='teams'?'selected':''} onClick={()=>setActive('teams')}>팀원 모집</button></div>
   {active==='competitions'?<section><div className="section-head"><div><div className="eyebrow">OFFICIAL OPPORTUNITIES</div><h2>대회 탐색</h2><p>접수 종료일이 지나지 않은 검증된 공고만 표시합니다.</p></div></div>
     <div className="cards">{competitions.map(c=><article className="card" key={c.id}><span className="tag">{c.category}</span><h3>{c.title}</h3><p>{c.organizer}</p><dl><dt>마감일</dt><dd>{new Date(c.applicationEndAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</dd><dt>인원</dt><dd>{c.teamSize||'요강 확인'}</dd><dt>주제</dt><dd>{c.theme||'공식 요강 확인'}</dd><dt>시상</dt><dd>{c.award||'공식 요강 확인'}</dd></dl><a href={c.officialUrl} rel="noopener noreferrer" target="_blank">공식 공고 확인 ↗</a></article>)}</div>
     {!competitions.length&&<div className="panel">현재 PostgreSQL에 게시된 대회가 없습니다. 기존 수집 결과를 검증 후 이전해야 합니다.</div>}
   </section>:<section><div className="section-head"><div><div className="eyebrow">FIND YOUR TEAM</div><h2>팀원 모집</h2><p>프로젝트를 등록하고 지원자를 확인하세요.</p></div></div>
    {!member?<div className="panel">팀원 모집은 승인된 회원만 사용할 수 있습니다.</div>:<><form className="panel form" onSubmit={createTeam}><h3>새로운 팀 만들기</h3><label>팀명<input value={teamTitle} onChange={e=>setTeamTitle(e.target.value)} required minLength={3} maxLength={100}/></label><label>소개<textarea value={teamDescription} onChange={e=>setTeamDescription(e.target.value)} required minLength={10} maxLength={3000}/></label><div className="two"><label>카테고리<select value={teamCategory} onChange={e=>setTeamCategory(e.target.value)}><option>장관상</option><option>공학</option><option>소프트웨어</option><option>기타·환경</option></select></label><label>모집 정원<input type="number" min="2" max="30" value={capacity} onChange={e=>setCapacity(Number(e.target.value))}/></label></div><button disabled={busy}>팀 등록하기</button></form><div className="cards">{teams.map(t=><article className="card" key={t.id}><span className="tag">{t.category}</span><h3>{t.title}</h3><p>{t.description}</p><div className="member-count">팀원 {t.members} / {t.capacity}</div>{member.uid===t.ownerUid?<><button className="ghost" onClick={()=>showApplications(t.id)}>신청자 확인</button>{pending[t.id]?.map(a=><div className="application" key={a.id}><strong>{a.applicantName}</strong><p>{a.message}</p><small>{a.status}</small>{a.status==='pending'&&<div className="actions"><button disabled={busy} onClick={()=>decide(t.id,a.id,'approved')}>승인</button><button disabled={busy} className="ghost" onClick={()=>decide(t.id,a.id,'rejected')}>거절</button></div>}</div>)}</>:<><label>참가 신청 이유<textarea value={applicationText[t.id]||''} onChange={e=>setApplicationText(old=>({...old,[t.id]:e.target.value}))} placeholder="참여하고 싶은 이유와 기여할 수 있는 역량" minLength={5} maxLength={1000}/></label><button disabled={busy||t.members>=t.capacity} onClick={()=>apply(t.id)}>{t.members>=t.capacity?'모집 마감':'참가 신청'}</button></>}</article>)}</div></>}
   </section>}
  </main><footer className="footer">© 2026 SCIVILL · 공용 데이터는 서버에서 권한을 확인한 뒤 처리합니다.</footer>
 </div>;
}
