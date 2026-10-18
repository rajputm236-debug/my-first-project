(()=>{'use strict';
const SUPA_URL='https://jvvnl-quiz-api.crypticfiles40.workers.dev';
const SUPA_KEY='sb_publishable_D90wb1cJD2X6PjgIIa645Q_fofHiSku';
const sb=window.supabase.createClient(SUPA_URL,SUPA_KEY);
const app=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const md=s=>esc(s||'').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
let S={session:null,profile:null,subjects:null,config:{free_question_count:50,free_mock_per_subject:true,paid_validity_days:120},qcache:{}};
const isPaid=()=>!!(S.profile&&(S.profile.is_admin||(S.profile.is_paid&&(!S.profile.paid_until||S.profile.paid_until>=new Date().toISOString().slice(0,10)))));
const isAdmin=()=>!!(S.profile&&S.profile.is_admin);

async function fetchProfile(){const{data}=await sb.from('profiles').select('*').eq('id',S.session.user.id).single();S.profile=data;
  document.getElementById('navAdmin').classList.toggle('hidden',!isAdmin());
  const b=document.getElementById('userBadge');
  b.innerHTML=isAdmin()?'<span class="badge warn">ADMIN</span>':(isPaid()?'<span class="badge paid">PAID</span>':'<span class="badge free">FREE</span>');}
async function fetchSubjects(){if(!S.subjects){const{data}=await sb.from('subjects').select('*').order('sort');S.subjects=data||[];}
  const{data:cfg}=await sb.from('app_config').select('*');
  (cfg||[]).forEach(r=>{try{S.config[r.key]=JSON.parse(r.value)}catch(e){S.config[r.key]=r.value}});}
async function fetchQuestions(slug){if(S.qcache[slug])return S.qcache[slug];
  const{data,error}=await sb.from('questions').select('*').eq('subject_slug',slug).order('ord');
  if(error){console.warn(error);return[];} S.qcache[slug]=data||[]; return S.qcache[slug];}
async function fetchAttempts(){const{data}=await sb.from('attempts').select('question_id,subject_slug,chosen,correct,mode,created_at').eq('user_id',S.session.user.id);
  return data||[];}

async function importLegacy(){if(localStorage.getItem('portal_imported_v1'))return;
  try{const saved=JSON.parse(localStorage.getItem('jvvnl-source-bank-progress-v1')||'null');
    const ans=saved&&saved.answers&&typeof saved.answers==='object'?saved.answers:{};
    const ids=Object.keys(ans);let n=0;
    if(ids.length){const{data:qs}=await sb.from('questions').select('id,subject_slug,answer').in('id',ids.slice(0,10000));
      const byId={};(qs||[]).forEach(q=>byId[q.id]=q);
      const rows=ids.filter(id=>byId[id]!==undefined&&Number.isInteger(Number(ans[id]))).map(id=>({user_id:S.session.user.id,question_id:id,subject_slug:byId[id].subject_slug,chosen:Number(ans[id]),correct:Number(ans[id])===byId[id].answer,mode:'practice'}));
      for(let i=0;i<rows.length;i+=500){await sb.from('attempts').upsert(rows.slice(i,i+500),{onConflict:'user_id,question_id',ignoreDuplicates:true});n+=Math.min(500,rows.length-i);}
      if(n>0)localStorage.setItem('portal_import_note',n+' saved answers imported from the old site.');}
  }catch(e){console.warn('import failed',e);}
  localStorage.setItem('portal_imported_v1','1');}

function nav(active){document.getElementById('navbar').classList.remove('hidden');
  document.querySelectorAll('.navbar a').forEach(a=>a.classList.toggle('on',a.dataset.nav===active));
  document.getElementById('logoutBtn').classList.remove('hidden');}
function setApp(html){app.innerHTML=html;}
const subjName=slug=>((S.subjects||[]).find(s=>s.slug===slug)||{}).name||slug;

function vLogin(){document.getElementById('navbar').classList.add('hidden');document.getElementById('logoutBtn').classList.add('hidden');document.getElementById('userBadge').innerHTML='';
  setApp(`<div class="card center"><h2>JVVNL Quiz Portal</h2><p class="muted">Login for your personal dashboard, saved progress on every phone, and full question banks.</p></div>
  <div class="card"><div class="row"><button class="chipbtn on" id="tabIn" type="button">Login</button><button class="chipbtn" id="tabUp" type="button">New account</button></div>
  <div id="nameRow" class="hidden"><label>Your name</label><input id="fName" autocomplete="name"></div>
  <label>Email</label><input id="fEmail" type="email" autocomplete="email">
  <label>Password</label><input id="fPass" type="password" autocomplete="current-password">
  <button class="btn primary block" id="goBtn" type="button">Login</button>
  <p class="center mt"><a href="#" id="forgotL">Forgot password?</a></p>
  <div class="notice hidden" id="authMsg"></div></div>
  <p class="muted center mt">Free account: practice sets + 1 free mock per subject + basic dashboard.<br>Paid (ask Mahendra): all 6,400+ questions, unlimited mocks, weak-topic analysis, rank.</p>`);
  let mode='in';
  const tab=m=>{mode=m;document.getElementById('tabIn').classList.toggle('on',m==='in');document.getElementById('tabUp').classList.toggle('on',m==='up');
    document.getElementById('nameRow').classList.toggle('hidden',m==='in');document.getElementById('goBtn').textContent=m==='in'?'Login':'Create account';};
  document.getElementById('tabIn').onclick=()=>tab('in');document.getElementById('tabUp').onclick=()=>tab('up');
  document.getElementById('forgotL').onclick=async(e)=>{e.preventDefault();
    const email=document.getElementById('fEmail').value.trim(),msg=document.getElementById('authMsg');
    if(!email){msg.textContent='Pehle apna email upar daalo.';msg.classList.remove('hidden');return;}
    const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:'https://rajputm236-debug.github.io/my-first-project/portal.html'});
    msg.classList.remove('hidden');
    if(error){msg.textContent=error.message;}else{msg.textContent='Reset link bhej diya. Email kholo, link dabao, naya password set karo.';msg.classList.add('ok');}};
  document.getElementById('goBtn').onclick=async()=>{
    const email=document.getElementById('fEmail').value.trim(),pass=document.getElementById('fPass').value,msg=document.getElementById('authMsg');
    msg.classList.add('hidden');
    if(!email||pass.length<6){msg.textContent='Email aur 6+ character password daalo.';msg.classList.remove('hidden');return;}
    document.getElementById('goBtn').disabled=true;
    try{
      if(mode==='up'){const{error}=await sb.auth.signUp({email,password:pass,options:{data:{display_name:document.getElementById('fName').value.trim()}}});
        if(error)throw error;
        msg.innerHTML='Account ban gaya. Agar confirmation email aaye to link khol lena, phir login karna.';msg.classList.remove('hidden');msg.classList.add('ok');
        const{data:ses}=await sb.auth.getSession();if(ses&&ses.session){location.hash='#/home';return;}}
      else{const{error}=await sb.auth.signInWithPassword({email,password:pass});if(error)throw error;location.hash='#/home';return;}
    }catch(e){msg.textContent=e.message||'Login failed';msg.classList.remove('hidden');}
    document.getElementById('goBtn').disabled=false;};}

async function vHome(){nav('home');await fetchSubjects();
  const paid=isPaid();
  const note=localStorage.getItem('portal_import_note');if(note)localStorage.removeItem('portal_import_note');
  const{data:openMocks}=await sb.from('mock_attempts').select('id,subject_slug,started_at').eq('user_id',S.session.user.id).eq('status','in_progress').order('started_at',{ascending:false}).limit(1);
  setApp(`${note?`<div class="notice ok">${esc(note)}</div>`:''}
  ${openMocks&&openMocks.length?`<div class="card"><h3>Paused mock</h3><p class="muted">${esc(subjName(openMocks[0].subject_slug))} - chalu hai</p><a class="btn primary block" href="#/mockrun/${openMocks[0].id}">Resume mock</a></div>`:''}
  <div class="card"><h2>Subjects</h2><p class="muted">${paid?'Full access: saare questions aur unlimited mocks.':'Free access: har subject me pehle '+S.config.free_question_count+' questions + 1 free mock.'}</p></div>
  <div id="subjList">${S.subjects.map(s=>`<div class="subj" data-slug="${s.slug}"><div class="nm"><b>${esc(s.name)}</b><span class="muted">${paid?'Full bank':'Free: '+s.free_question_count+' Q'}</span></div>${paid?'<span class="badge paid">PAID</span>':'<span class="badge free">FREE</span>'}</div>`).join('')}</div>
  ${!paid?'<div class="card center"><h3>Unlock full access</h3><p class="muted">Saare 6,400+ questions, unlimited mocks, weak-topic analysis, rank. Mahendra se contact karo.</p></div>':''}`);
  document.querySelectorAll('.subj').forEach(d=>d.onclick=()=>{location.hash='#/subject/'+d.dataset.slug;});}

async function vSubject(slug){nav('home');await fetchSubjects();
  setApp(`<div class="card"><h2>${esc(subjName(slug))}</h2><p class="muted">Kya karna hai?</p>
  <a class="btn primary block" href="#/practice/${slug}">Practice</a>
  <a class="btn block" href="#/mocksetup/${slug}">Mock test</a></div>`);}

async function vPractice(slug){nav('home');
  setApp('<div class="card center muted">Questions load ho rahe hain…</div>');
  const qs=await fetchQuestions(slug);
  const atts=await fetchAttempts();
  const amap={};atts.forEach(a=>amap[a.question_id]=a);
  if(!qs.length){setApp('<div class="card center"><h3>No access</h3><p class="muted">Is subject ke questions abhi locked hain.</p><a class="btn block" href="#/home">Back</a></div>');return;}
  const sources=[...new Set(qs.map(q=>q.source).filter(Boolean))];
  let idx=0,filter='all',src='all';
  const filtered=()=>qs.filter(q=>(src==='all'||q.source===src)&&(filter==='all'||(filter==='unanswered'&&amap[q.id]===undefined)||(filter==='wrong'&&amap[q.id]&&!amap[q.id].correct)||(filter==='correct'&&amap[q.id]&&amap[q.id].correct)));
  function render(){const list=filtered();if(idx>=list.length)idx=Math.max(0,list.length-1);
    const q=list[idx];
    const srcOpts=['<option value="all">All sources/chapters</option>'].concat(sources.map(s=>`<option ${s===src?'selected':''} value="${esc(s)}">${esc(s)}</option>`)).join('');
    if(!q){setApp(`<div class="card"><div class="row"><a class="chipbtn" href="#/subject/${slug}">&lsaquo; Back</a></div>
      <div class="row mt"><select id="fSrc">${srcOpts}</select></div>
      <div class="row mt">${['all','unanswered','wrong','correct'].map(f=>`<button class="chipbtn ${f===filter?'on':''}" data-f="${f}" type="button">${f}</button>`).join('')}</div>
      <p class="center muted mt">Is filter me koi question nahi.</p></div>`);wire(list);return;}
    const a=amap[q.id],done=a!==undefined;
    setApp(`<div class="card"><div class="row"><a class="chipbtn" href="#/subject/${slug}">&lsaquo; Back</a><span class="muted">${idx+1} / ${list.length}</span><span class="sp"></span><span class="muted">${esc(subjName(slug))}</span></div>
    <div class="row mt"><select id="fSrc">${srcOpts}</select></div>
    <div class="row mt">${['all','unanswered','wrong','correct'].map(f=>`<button class="chipbtn ${f===filter?'on':''}" data-f="${f}" type="button">${f}</button>`).join('')}</div></div>
    <div class="card"><p class="muted">${esc(q.source||'')}</p><p class="qtext">${esc(q.question)}</p>
    ${q.options.map((o,i)=>`<button class="opt ${done&&i===q.answer?'right':''} ${done&&i===a.chosen&&i!==q.answer?'wrong':''}" data-i="${i}" type="button" ${done?'disabled':''}>${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('')}
    ${done?`<div class="expl"><b>Answer: ${String.fromCharCode(65+q.answer)}</b>${q.explanation?'<br>'+md(q.explanation):''}</div>`:''}
    <div class="row mt"><button class="btn" id="prevB" type="button" ${idx===0?'disabled':''}>&lsaquo; Prev</button><span class="sp"></span><button class="btn" id="nextB" type="button" ${idx>=list.length-1?'disabled':''}>Next &rsaquo;</button></div></div>`);
    wire(list,q);}
  function wire(list,q){document.getElementById('fSrc').onchange=e=>{src=e.target.value;idx=0;render();};
    document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{filter=b.dataset.f;idx=0;render();});
    if(q){document.querySelectorAll('.opt').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset.i);
      const row={user_id:S.session.user.id,question_id:q.id,subject_slug:slug,chosen:i,correct:i===q.answer,mode:'practice'};
      amap[q.id]={...row};render();
      sb.from('attempts').upsert(row,{onConflict:'user_id,question_id'}).then(r=>{if(r.error)console.warn(r.error)});});
    document.getElementById('prevB').onclick=()=>{if(idx>0){idx--;render();}};
    document.getElementById('nextB').onclick=()=>{if(idx<list.length-1){idx++;render();}};}}
  render();}

async function vMockSetup(slug){nav('home');await fetchSubjects();
  const paid=isPaid();
  const{count}=await sb.from('mock_attempts').select('id',{count:'exact',head:true}).eq('user_id',S.session.user.id).eq('subject_slug',slug);
  const freeLeft=S.config.free_mock_per_subject?(count<1):false;
  if(!paid&&!freeLeft){setApp(`<div class="card center"><h3>Free mock used</h3><p class="muted">${esc(subjName(slug))} ka free mock ho chuka. Paid me unlimited mocks milte hain.</p><a class="btn block" href="#/subject/${slug}">Back</a></div>`);return;}
  const qs=await fetchQuestions(slug);
  const maxN=qs.length;
  setApp(`<div class="card"><h2>Mock - ${esc(subjName(slug))}</h2>
  <p class="muted">${paid?'Paid: apni pasand ka size.':'FREE mock: 25 questions, 25 minutes.'} Available: ${maxN} questions.</p>
  ${paid?`<label>Questions</label><select id="mCount">${[25,50,100].filter(n=>n<=maxN).map(n=>`<option value="${n}">${n} questions (${n} min)</option>`).join('')}</select>`:''}
  <button class="btn primary block" id="startM" type="button">Start mock</button>
  <a class="btn block" href="#/subject/${slug}">Back</a></div>`);
  document.getElementById('startM').onclick=async()=>{
    const N=paid?Number(document.getElementById('mCount').value):25;
    const ids=qs.map(q=>q.id);
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    const pick=ids.slice(0,Math.min(N,ids.length));
    const endsAt=Date.now()+pick.length*60*1000;
    const{data,error}=await sb.from('mock_attempts').insert({user_id:S.session.user.id,subject_slug:slug,config:{question_ids:pick},state:{answers:{},idx:0,ends_at:endsAt},total:pick.length}).select('id').single();
    if(error){alert(error.message);return;}
    location.hash='#/mockrun/'+data.id;};}

let mockTimer=null;
async function vMockRun(id){nav('home');
  const{data:m,error}=await sb.from('mock_attempts').select('*').eq('id',id).eq('user_id',S.session.user.id).single();
  if(error||!m){setApp('<div class="card center muted">Mock nahi mila.</div>');return;}
  const ids=m.config.question_ids;
  const{data:qs}=await sb.from('questions').select('*').in('id',ids);
  const byId={};(qs||[]).forEach(q=>byId[q.id]=q);
  const list=ids.map(i=>byId[i]).filter(Boolean);
  if(m.status==='completed'){renderResult(m,list);return;}
  let st=m.state||{answers:{},idx:0,ends_at:Date.now()+list.length*60*1000};
  st.answers=st.answers||{};st.idx=st.idx||0;
  if(!st.ends_at){st.ends_at=Date.now()+list.length*60*1000;}
  const save=()=>sb.from('mock_attempts').update({state:st}).eq('id',m.id).then(()=>{});
  function tick(){const left=Math.max(0,st.ends_at-Date.now());
    const t=document.getElementById('mTimer');
    if(t){const mm=Math.floor(left/60000),ss=Math.floor(left%60000/1000);t.textContent=mm+':'+String(ss).padStart(2,'0');t.classList.toggle('low',left<120000);}
    if(left<=0){finish();}}
  function render(){const q=list[st.idx];if(!q){setApp('<div class="card center muted">Questions load nahi hue.</div>');return;}
    const sel=st.answers[q.id];
    const answered=Object.keys(st.answers).length;
    setApp(`<div class="card"><div class="row"><span class="muted">Mock · ${esc(subjName(m.subject_slug))}</span><span class="sp"></span><span class="timer" id="mTimer"></span></div>
    <div class="row mt"><span class="muted">Q ${st.idx+1} / ${list.length} · answered ${answered}</span></div></div>
    <div class="card"><p class="muted">${esc(q.source||'')}</p><p class="qtext">${esc(q.question)}</p>
    ${q.options.map((o,i)=>`<button class="opt ${sel===i?'sel':''}" data-i="${i}" type="button">${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('')}
    <div class="row mt"><button class="btn" id="mPrev" type="button" ${st.idx===0?'disabled':''}>&lsaquo; Prev</button><span class="sp"></span><button class="btn" id="mNext" type="button" ${st.idx>=list.length-1?'disabled':''}>Next &rsaquo;</button></div>
    <button class="btn primary block" id="mFinish" type="button">Submit mock</button></div>`);
    tick();
    document.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i);
      if(st.answers[q.id]===i)delete st.answers[q.id];else st.answers[q.id]=i;save();render();});
    document.getElementById('mPrev').onclick=()=>{if(st.idx>0){st.idx--;save();render();}};
    document.getElementById('mNext').onclick=()=>{if(st.idx<list.length-1){st.idx++;save();render();}};
    document.getElementById('mFinish').onclick=()=>{if(confirm('Submit mock? ('+Object.keys(st.answers).length+'/'+list.length+' answered)'))finish();};}
  async function finish(){if(mockTimer){clearInterval(mockTimer);mockTimer=null;}
    let score=0;const rows=[];
    list.forEach(q=>{const c=st.answers[q.id];if(c!==undefined){const ok=c===q.answer;if(ok)score++;
      rows.push({user_id:S.session.user.id,question_id:q.id,subject_slug:m.subject_slug,chosen:c,correct:ok,mode:'mock'});}});
    for(let i=0;i<rows.length;i+=500)await sb.from('attempts').upsert(rows.slice(i,i+500),{onConflict:'user_id,question_id'});
    await sb.from('mock_attempts').update({status:'completed',score,total:list.length,state:st,completed_at:new Date().toISOString()}).eq('id',m.id);
    renderResult({...m,status:'completed',score,total:list.length},list);}
  function renderResult(mm){const pct=mm.total?Math.round(100*mm.score/mm.total):0;
    setApp(`<div class="card center"><h2>Mock result</h2>
    <div class="grid2 mt"><div class="stat"><b>${mm.score}/${mm.total}</b><span>Score</span></div><div class="stat"><b>${pct}%</b><span>Accuracy</span></div></div>
    <a class="btn block" href="#/mockreview/${mm.id}">Review answers</a><a class="btn block" href="#/dashboard">Dashboard</a><a class="btn block" href="#/home">Home</a></div>`);}
  if(mockTimer)clearInterval(mockTimer);
  mockTimer=setInterval(tick,1000);render();}

async function vMockReview(id){nav('home');
  const{data:m}=await sb.from('mock_attempts').select('*').eq('id',id).eq('user_id',S.session.user.id).single();
  if(!m){setApp('<div class="card center muted">Nahi mila.</div>');return;}
  const{data:qs}=await sb.from('questions').select('*').in('id',m.config.question_ids);
  const byId={};(qs||[]).forEach(q=>byId[q.id]=q);
  const ans=(m.state&&m.state.answers)||{};
  setApp(`<div class="card"><div class="row"><a class="chipbtn" href="#/dashboard">&lsaquo; Dashboard</a><span class="sp"></span><span class="muted">Score ${m.score}/${m.total}</span></div></div>`+
    m.config.question_ids.map((qid,n)=>{const q=byId[qid];if(!q)return'';const c=ans[qid];
    return `<div class="card"><p class="muted">Q${n+1} · ${esc(q.source||'')}</p><p class="qtext">${esc(q.question)}</p>
    ${q.options.map((o,i)=>`<button class="opt ${i===q.answer?'right':''} ${c===i&&i!==q.answer?'wrong':''}" disabled type="button">${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('')}
    ${q.explanation?`<div class="expl">${md(q.explanation)}</div>`:''}</div>`;}).join(''));}

async function vDashboard(){nav('dashboard');await fetchSubjects();
  setApp('<div class="card center muted">Dashboard load ho raha hai…</div>');
  const atts=await fetchAttempts();
  const paid=isPaid();
  const per={};atts.forEach(a=>{per[a.subject_slug]=per[a.subject_slug]||{n:0,c:0};per[a.subject_slug].n++;if(a.correct)per[a.subject_slug].c++;});
  const totalA=atts.length,totalC=atts.filter(a=>a.correct).length;
  const days=[...new Set(atts.map(a=>(a.created_at||'').slice(0,10)))].sort().reverse();
  let streak=0;const today=new Date();for(let i=0;;i++){const d=new Date(today.getTime()-i*86400000).toISOString().slice(0,10);
    if(days.includes(d)){streak++;}else if(i===0){continue;}else break;}
  const{data:mocks}=await sb.from('mock_attempts').select('id,subject_slug,score,total,completed_at,status').eq('user_id',S.session.user.id).eq('status','completed').order('completed_at',{ascending:false}).limit(10);
  let paidHtml='';
  if(paid){
    const{data:lb}=await sb.rpc('leaderboard');
    let rankHtml='<div class="stat"><b>-</b><span>Rank (answer to enter)</span></div>';
    if(lb&&lb.length){const sorted=[...lb].sort((a,b)=>b.pct-a.pct||b.correct-a.correct);
      const pos=sorted.findIndex(r=>r.user_id===S.session.user.id);
      if(pos>=0)rankHtml=`<div class="stat"><b>#${pos+1} <span class="muted">of ${sorted.length}</span></b><span>All-time rank</span></div>`;}
    const{data:wj}=await sb.from('attempts').select('correct, questions(source)').eq('user_id',S.session.user.id).limit(5000);
    const bySrc={};(wj||[]).forEach(r=>{const s=(r.questions&&r.questions.source)||'Other';bySrc[s]=bySrc[s]||{n:0,c:0};bySrc[s].n++;if(r.correct)bySrc[s].c++;});
    const weak=Object.entries(bySrc).filter(([,v])=>v.n>=5).map(([k,v])=>({k,pct:Math.round(100*v.c/v.n),n:v.n})).sort((a,b)=>a.pct-b.pct).slice(0,5);
    paidHtml=`<div class="card"><h3>Weak topics (paid)</h3>${weak.length?weak.map(w=>`<div class="row"><span style="flex:1">${esc(w.k)}</span><span class="badge ${w.pct<50?'warn':'free'}">${w.pct}%</span><span class="muted">${w.n} Q</span></div>`).join(''):'<p class="muted">Thodi aur practice karo, phir analysis dikhega.</p>'}</div>
    <div class="card"><h3>Rank (paid)</h3><div class="grid2">${rankHtml}<div class="stat"><b>${totalA}</b><span>Total answered</span></div></div></div>`;}
  setApp(`<div class="card"><h2>Dashboard</h2>
    <div class="grid2 mt"><div class="stat"><b>${totalC}/${totalA}</b><span>Correct</span></div><div class="stat"><b>${totalA?Math.round(100*totalC/totalA):0}%</b><span>Accuracy</span></div>
    <div class="stat"><b>${streak}</b><span>Day streak</span></div><div class="stat"><b>${(mocks||[]).length}</b><span>Mocks done</span></div></div></div>
  <div class="card"><h3>Subject-wise</h3>${S.subjects.filter(s=>per[s.slug]).map(s=>`<div class="row"><span style="flex:1">${esc(s.name)}</span><span class="muted">${per[s.slug].c}/${per[s.slug].n} · ${Math.round(100*per[s.slug].c/per[s.slug].n)}%</span></div>`).join('')||'<p class="muted">Abhi koi practice nahi.</p>'}</div>
  ${paidHtml}
  <div class="card"><h3>Mock history</h3>${(mocks||[]).map(mk=>`<div class="row"><span style="flex:1">${esc(subjName(mk.subject_slug))}</span><span class="muted">${(mk.completed_at||'').slice(0,10)}</span><a href="#/mockreview/${mk.id}"><span class="badge paid">${mk.score}/${mk.total}</span></a></div>`).join('')||'<p class="muted">Koi mock nahi.</p>'}</div>
  ${!paid?'<div class="card center"><p class="muted">Paid me: weak-topic analysis, rank, unlimited mocks, saare questions.</p></div>':''}`);}

async function vAdmin(){nav('admin');
  if(!isAdmin()){setApp('<div class="card center muted">Admin only.</div>');return;}
  const{data:users}=await sb.from('profiles').select('*').order('created_at',{ascending:false});
  await fetchSubjects();
  const defDays=S.config.paid_validity_days||120;
  setApp(`<div class="card"><h2>Admin</h2><p class="muted">${(users||[]).length} users</p></div>
  <div class="card"><h3>Users</h3>
  ${(users||[]).map(u=>`<div class="row" style="border-bottom:1px solid var(--line);padding:8px 0">
    <div style="flex:1;min-width:140px"><b>${esc(u.display_name||'')}</b> ${u.is_admin?'<span class="badge warn">A</span>':''}<br><span class="muted">${esc(u.email||'')}</span></div>
    <button class="chipbtn ${u.is_paid?'on':''}" data-paid="${u.id}" data-cur="${u.is_paid?1:0}" type="button">${u.is_paid?'PAID':'free'}</button>
    <input type="date" data-until="${u.id}" value="${u.paid_until||''}" style="width:135px;padding:6px">
  </div>`).join('')||'<p class="muted">No users yet.</p>'}
  <p class="muted mt">Paid on karte hi validity default ${defDays} din set ho jayegi (date badal sakte ho).</p></div>
  <div class="card"><h3>Free limits per subject</h3>
  ${S.subjects.map(s=>`<div class="row"><span style="flex:1">${esc(s.name)}</span><input type="number" data-free="${s.slug}" value="${s.free_question_count}" style="width:90px;padding:6px"></div>`).join('')}
  <button class="btn primary block" id="saveCfg" type="button">Save free limits</button>
  <div class="notice hidden" id="cfgMsg"></div></div>`);
  document.querySelectorAll('[data-paid]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.paid,cur=b.dataset.cur==='1';
    const until=cur?null:new Date(Date.now()+defDays*86400000).toISOString().slice(0,10);
    const{error}=await sb.from('profiles').update({is_paid:!cur,paid_until:!cur?until:(document.querySelector(`[data-until="${id}"]`)||{}).value||null}).eq('id',id);
    if(error){alert(error.message);return;}
    b.dataset.cur=cur?'0':'1';b.classList.toggle('on',!cur);b.textContent=!cur?'PAID':'free';
    if(!cur){const dt=document.querySelector(`[data-until="${id}"]`);if(dt)dt.value=until;}});
  document.querySelectorAll('[data-until]').forEach(inp=>inp.onchange=async()=>{
    const id=inp.dataset.until;await sb.from('profiles').update({paid_until:inp.value||null}).eq('id',id);});
  document.getElementById('saveCfg').onclick=async()=>{
    const msg=document.getElementById('cfgMsg');msg.classList.add('hidden');msg.classList.remove('ok');
    for(const inp of document.querySelectorAll('[data-free]')){
      const{error}=await sb.rpc('admin_set_free_count',{p_slug:inp.dataset.free,p_count:Number(inp.value)||0});
      if(error){msg.textContent=error.message;msg.classList.remove('hidden');return;}}
    S.subjects=null;await fetchSubjects();
    msg.textContent='Saved. Free question counts update ho gaye.';msg.classList.remove('hidden');msg.classList.add('ok');};}

async function route(){const h=location.hash||'#/home';
  const{data}=await sb.auth.getSession();S.session=data.session;
  if(!S.session){vLogin();return;}
  if(!S.profile)await fetchProfile();
  if(!S.subjects)await fetchSubjects();
  await importLegacy();
  const parts=h.split('/');const view=parts[1],arg=parts[2];
  if(view==='home')return vHome();
  if(view==='subject')return vSubject(arg);
  if(view==='practice')return vPractice(arg);
  if(view==='mocksetup')return vMockSetup(arg);
  if(view==='mockrun')return vMockRun(arg);
  if(view==='mockreview')return vMockReview(arg);
  if(view==='dashboard')return vDashboard();
  if(view==='admin')return vAdmin();
  return vHome();}
document.getElementById('logoutBtn').onclick=async()=>{await sb.auth.signOut();S.profile=null;S.qcache={};S.subjects=null;location.hash='#/login';route();};
window.addEventListener('hashchange',route);
function vReset(){document.getElementById('navbar').classList.add('hidden');document.getElementById('logoutBtn').classList.add('hidden');
  setApp(`<div class="card center"><h2>Naya password set karo</h2></div>
  <div class="card"><label>New password (6+ characters)</label><input id="fNewPass" type="password" autocomplete="new-password">
  <button class="btn primary block" id="resetBtn" type="button">Save password</button>
  <div class="notice hidden" id="resetMsg"></div></div>`);
  document.getElementById('resetBtn').onclick=async()=>{
    const pass=document.getElementById('fNewPass').value,msg=document.getElementById('resetMsg');
    if(pass.length<6){msg.textContent='6+ characters ka password daalo.';msg.classList.remove('hidden');return;}
    const{error}=await sb.auth.updateUser({password:pass});
    msg.classList.remove('hidden');
    if(error){msg.textContent=error.message;return;}
    msg.textContent='Password set ho gaya. Ab login karo.';msg.classList.add('ok');
    await sb.auth.signOut();S.profile=null;S.qcache={};setTimeout(()=>{location.hash='#/login';route();},1200);};}
sb.auth.onAuthStateChange((e,s)=>{if(e==='SIGNED_IN'||e==='SIGNED_OUT')S.qcache={};S.session=s;if(e==='PASSWORD_RECOVERY'){vReset();}});
route();
})();
