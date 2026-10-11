import {Battle,FORMATIONS,SKILLS,DIFFICULTY,WIDTH,HEIGHT,FLAGSHIP,SHOALS,simulate,predict} from './battle.mjs';
import {PROLOGUE,epilogue,loadRecords,saveRecord,difficultyName,battleVerdict,campaignReport} from './campaign.mjs';
import {SeaRenderer} from './render3d.mjs';
import {loadConfig,saveConfig,applyConfig} from './config.mjs';
import {createAudio} from './audio.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let renderer=null;try{renderer=new SeaRenderer($('#sea'),{reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches});}catch(error){$('#renderError').hidden=false;$('#renderError').textContent=error.message;}
const config=loadConfig();
if(renderer){renderer.setView(config.view);$('#viewMode').value=renderer.view}$('#skipBattle').checked=config.skipBattle;$('#autoTiming').checked=config.autoTiming;$('#shortCutin').checked=config.shortCutin;
const audio=createAudio();audio.setEnabled(config.sound);audio.setVolume(config.volume);$('#sound').checked=config.sound;$('#volume').value=config.volume;
// 連戦の状態。story=プロローグ／エピローグのドラマ画面、phase=prep（出撃準備）／watch（観戦）／summary（サマリー）／result（結果）。
const FLEET=['lance','stake','escort'],ENEMY_MAX=2250,TICK=.025,FAST=20;
let story='prologue',phase=null,report=null,newBest=false,cutinKey='';
let camp={hp:ENEMY_MAX,history:[]},plan={formation:'free',order:['stake','lance']},lastRep=null,sumLog=[],sumSeen=0,endAt=0,predTimer=0,predToken=0,predResult=null,storyKey='',judgeKey='',sumKey='';
const options=()=>({fleet:FLEET,skillOrder:plan.order,formation:plan.formation,duration:30,enemyHp:camp.hp,enemyMaxHp:ENEMY_MAX,island:false});
const newBattle=()=>applyConfig(new Battle({...options(),auto:true,joustPolicy:'manual'}),config);
let b=newBattle(),selected=FLAGSHIP,last=performance.now(),acc=0,lastUI=0,lastLog=-1;
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
// カットインの立ち絵。ない騎士は紋章だけを出す。
const PORTRAITS={stake:'./art/kanaan.png',lance:'./art/miralka.png',guard:'./art/olive.png'};for(const src of Object.values(PORTRAITS))new Image().src=src;
const crest=s=>SKILLS[s.kind]?.crest||'◈',pct=n=>Math.round(n*100)+'%';
function build(){ $('#shipList').innerHTML=b.ships.map(s=>`<button class="member" data-ship="${s.id}" tabindex="-1" style="--ship-color:${s.color}"><span class="member-crest">${crest(s)}</span><span class="member-body"><span class="member-name"><strong>${s.name}</strong><span id="${s.id}-hp"></span></span><span class="bar hp"><i id="${s.id}-hpbar"></i></span><span class="bar blood"><i id="${s.id}-bloodbar"></i></span><span class="member-foot"><span id="${s.id}-status"></span><span id="${s.id}-blood"></span></span></span></button>`).join('')}
// 流れの切り替え。toPrep=出撃準備、launch=出撃（観戦／サマリー／完全スキップ）、toResult=結果、nextStep=次の戦闘かエピローグ。
function toPrep(){story=null;phase='prep';report=null;b=newBattle();acc=0;lastLog=-1;build();prepUI();schedulePredict();ui()}
function newCampaign(){camp={hp:ENEMY_MAX,history:[]};toPrep()}
function launch(kind){if(kind==='skip'){toResult(simulate(options(),{joustPolicy:'normal'}));return}b=newBattle();b.start();phase=kind;sumLog=[];sumSeen=0;sumKey='';judgeKey='';endAt=0;acc=0;lastLog=-1;build();ui()}
function toSummary(){if(phase!=='watch')return;if(b.mode==='paused')b.resume();phase='summary';sumLog=[];sumSeen=0;sumKey='';ui()}
function toResult(rep){phase='result';lastRep=rep;camp.history.push(rep);camp.hp=rep.enemyHp;endAt=0;resultUI();ui()}
function nextStep(){const v=battleVerdict(lastRep);if(v.kind==='kill'||v.kind==='retreat'){report=campaignReport(camp.history,v.kind==='kill');newBest=saveRecord(report);recordUI();story='epilogue';phase=null;ui()}else toPrep()}
function play(){if(story==='prologue'){toPrep();return}if(story==='epilogue'){newCampaign();return}if(phase==='prep')launch('watch');else if(phase==='result')nextStep();else if(phase==='watch'){if(b.mode==='running')b.pause();else if(b.mode==='paused')b.resume()}else if(phase==='summary'&&b.mode==='paused')b.resume();ui()}
// 判定ゲージ：左が与ダメージ率、右が被ダメージ率（同じ目盛りで、半分の長さ＝50%）。与が被以上なら優勢。
const verdictWord=(d,t)=>d>=t?(d>0?'優勢':'互角'):'劣勢';
const gaugeHTML=(d,t,mid)=>{const w=n=>Math.min(100,n*200).toFixed(1);return `<div class="jg-side jg-d${d>=t&&d>0?' lead':''}"><b>与<span class="jg-full">ダメージ</span></b><span class="jg-bar"><i style="width:${w(d)}%"></i></span><em>${pct(d)}</em></div><div class="jg-mid">${mid}</div><div class="jg-side jg-t${d<t?' lead':''}"><em>${pct(t)}</em><span class="jg-bar"><i style="width:${w(t)}%"></i></span><b>被<span class="jg-full">ダメージ</span></b></div>`};
// 準備画面：陣形とスキルの順番を選び、予測を表示する。変えるたびに110ms待ってから試算し直す。
function prepUI(){const o=plan.order,combo=o.indexOf('stake')>=0&&o.indexOf('lance')===o.indexOf('stake')+1;
 $('#prepTitle').textContent=`第${camp.history.length+1}戦　ネフェリム`;$('#prepHpBar').style.width=camp.hp/ENEMY_MAX*100+'%';$('#prepHpText').textContent=`${camp.hp} / ${ENEMY_MAX}`;
 $('#prepFleet').innerHTML=b.ships.map(s=>`<div class="fleet-ship" style="--ship-color:${s.color}"><span class="member-crest">${crest(s)}</span><span class="fleet-name"><b>${esc(s.name)}</b><small>耐久 ${s.maxHp}</small></span></div>`).join('');
 $('#prepFormations').innerHTML=Object.entries(FORMATIONS).map(([k,f])=>`<button data-form="${k}" class="${plan.formation===k?'selected':''}" aria-pressed="${plan.formation===k}" title="${f.note}"><b>${f.name}</b><small>${f.note.split('。').pop()}</small></button>`).join('');$('#prepFormNote').textContent=FORMATIONS[plan.formation].note;
 $('#prepSkills').innerHTML=b.ships.filter(s=>SKILLS[s.id]).map(s=>{const i=o.indexOf(s.id);return `<button class="skill-card${i>=0?' on':''}" data-skill="${s.id}" aria-pressed="${i>=0}" style="--ship-color:${s.color}"><span class="skill-card-crest">${SKILLS[s.id].crest}</span><b>〈${SKILLS[s.id].name}〉</b><small>${esc(s.name)}</small><i>${i>=0?`${i+1}番目`:'使わない'}</i></button>`}).join('');
 $('#prepCombo').textContent=combo?'連携〈杭と十字架の馬上槍試合〉が成立する順です。':'縫い留め→ジョストの順だと連携〈杭と十字架の馬上槍試合〉。';$('#prepCombo').classList.toggle('active',combo)}
function schedulePredict(){predResult=null;predUI();clearTimeout(predTimer);const tok=++predToken;predTimer=setTimeout(()=>{const r=predict(options());if(tok===predToken){predResult=r;predUI()}},110)}
const outlook=p=>p.normal.win>=.67?'優勢':p.normal.win>0?'五分':p.perfect.win>=.67?'会心で優勢':p.perfect.win>0?'会心で五分':'劣勢';
function predUI(){const el=$('#prepPredict');if(!predResult){el.innerHTML='<p class="calc">試算中…</p>';return}const {normal:n,perfect:c}=predResult,rg=a=>a[0]===a[1]?`${a[0]}`:`${a[0]}〜${a[1]}`,out=outlook(predResult),tone=out==='優勢'?'good':out==='劣勢'?'bad':'mid';
 el.innerHTML=`<dl><div><dt>与ダメージ</dt><dd>${rg(n.dealt)}<small>（会心時 ${rg(c.dealt)}）</small></dd></div><div><dt>被ダメージ</dt><dd>${rg(n.taken)}${rg(c.taken)!==rg(n.taken)?`<small>（会心時 ${rg(c.taken)}）</small>`:''}</dd></div><div class="outlook ${tone}"><dt>予測の判定</dt><dd>${out}</dd></div></dl>${n.dealt[0]>=camp.hp?'<p class="calc">通常射出でも残りの耐久を削り切れる見込みです。</p>':''}`}
function prepChanged(){prepUI();schedulePredict()}
// 結果画面：判定、与・被ダメージ、判定ゲージ、ネフェリムの残り耐久、会心の回数。
function resultUI(){const r=lastRep,v=battleVerdict(r),d=r.judge.dealtRatio,t=r.judge.takenRatio,over=v.kind==='kill'||v.kind==='retreat';
 $('#result').classList.toggle('lost',v.kind==='retreat'||v.kind==='push');$('#resultPlace').textContent=`第${camp.history.length}戦　ネフェリム · 戦果`;$('#resultTitle').textContent=v.title;$('#resultStamp').textContent=v.stamp;$('#resultNote').textContent=v.note;
 $('#resultGauge').innerHTML=gaugeHTML(d,t,`<b class="jg-time">${over?v.title:verdictWord(d,t)}</b>`);
 $('#resultStats').innerHTML=[['与ダメージ',`${r.dealtTotal}（${pct(d)}）`],['被ダメージ',`${r.taken}（${pct(t)}）`],['会心',`${r.perfect}回`],['ジョスト命中',`${r.joustHits}回`],['連携',`${r.combos}回`],['生還',`${r.ships.filter(s=>!s.sunk).length} / ${r.ships.length}`]].map(([k,x])=>`<div><dt>${k}</dt><dd>${x}</dd></div>`).join('');
 $('#resultHpBar').style.width=r.enemyHp/ENEMY_MAX*100+'%';$('#resultHpText').textContent=`${r.enemyHp} / ${ENEMY_MAX}`;$('#resultGo').textContent=over?'エピローグへ ［Space］':'次の戦闘へ ［Space］'}
// 観戦・サマリー中のHUD：判定ゲージと残り時間、サマリーの記録。
function flowUI(){const watch=phase==='watch',sum=phase==='summary';
 $('#prep').hidden=phase!=='prep';$('#result').hidden=phase!=='result';$('#summary').hidden=!sum;$('#watchCtl').hidden=!watch;$('#judge').hidden=!(watch||sum);$('#prepSkip').hidden=!config.skipBattle;
 if(!(watch||sum))return;
 if(watch){$('#pauseBtn').textContent=b.mode==='paused'?'再開 ［Space］':'一時停止 ［Space］';$('#pauseBtn').disabled=b.mode==='cutin'||b.mode==='ended'}
 {const rt=b.ratios(),left=Math.max(0,Math.ceil(b.duration-b.time)),key=`${Math.round(rt.dealtRatio*100)}:${Math.round(rt.takenRatio*100)}:${left}`;if(key!==judgeKey){judgeKey=key;$('#judge').innerHTML=gaugeHTML(rt.dealtRatio,rt.takenRatio,`<b class="jg-time">残り ${left}秒</b><small>${verdictWord(rt.dealtRatio,rt.takenRatio)}</small>`)}}
 if(sum){const fresh=b.logs.filter(l=>l.id>sumSeen).reverse();if(fresh.length){sumLog.push(...fresh);sumSeen=b.logs[0].id}const key=`${sumLog.length}:${!!b.timing}`;if(key!==sumKey){sumKey=key;const el=$('#summaryLog');el.innerHTML=sumLog.map(l=>`<div class="log-entry ${l.type}"><time>${clock(l.time)}</time><span>${esc(l.text)}</span></div>`).join('');el.scrollTop=el.scrollHeight;$('#summaryNote').textContent=b.timing?'ジョストの射出集中。通常の速さに戻りました。金色の範囲でFキーか射出ボタンを。':`戦闘を${FAST}倍速で進行中。ジョストのタイミングだけ通常の速さに戻ります。`;$('#summaryNote').classList.toggle('alert',!!b.timing)}}}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const speech=lines=>lines.map(l=>`<p><b>${esc(l.speaker)}</b><span>${esc(l.text)}</span></p>`).join('');
function storyUI(){
 $('#story').hidden=!story;const key=story+(report?report.battles:'');if(!story||key===storyKey){if(!story)storyKey='';return}storyKey=key;const ep=story==='epilogue';
 $('#story').classList.toggle('lost',ep&&report.result!=='victory');
 if(!ep){$('#storyPlace').textContent=PROLOGUE.place;$('#storyTitle').textContent=PROLOGUE.title;$('#storyNote').textContent=`難易度：${difficultyName(b.difficulty)}　·　${DIFFICULTY[b.difficulty].note}`;$('#storyLines').innerHTML=speech(PROLOGUE.lines);$('#storyStats').hidden=true;$('#storyRank').hidden=true;$('#storyHints').innerHTML='';$('#storyGo').textContent='出撃準備へ ［Space］';$('#storyClose').hidden=true;return}
 const e=epilogue(report),r=report;$('#storyPlace').textContent=`戦果報告 · ${difficultyName(r.difficulty)} · 全${r.battles}戦`;$('#storyTitle').textContent=e.title;$('#storyRank').hidden=false;$('#storyRank').textContent=r.rank;$('#storyRank').dataset.rank=r.rank;$('#storyNote').textContent=e.note+(newBest&&r.result==='victory'?'　·　自己ベスト更新':'');$('#storyLines').innerHTML=speech(e.lines);
 $('#storyStats').hidden=false;$('#storyStats').innerHTML=[['戦闘回数',`${r.battles}戦`],['総与ダメージ',r.dealtTotal],['総被害',r.taken],['連携',`${r.combos}回`],['会心',`${r.perfect}回`],['生還',`${r.ships.filter(s=>!s.sunk).length} / ${r.ships.length}`]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
 $('#storyHints').innerHTML='';$('#storyGo').textContent='最初から ［Space］';$('#storyClose').hidden=true;
}
function recordUI(){const rec=loadRecords()[b.difficulty];$('#bestRecord').textContent=rec?`最高評価 ${rec.rank}${rec.rank!=='—'?` · ${rec.battles?`${rec.battles}戦`:clock(rec.time)}`:''}`:'記録なし'}
// 状態の変化を前回値と比べて音を鳴らす。Battle が作り直されたら前回値を取り直す（鳴らさない）。
let pb=null,pMode='',pCutin='',pRoot=0,pLunge=false,pImpact=0,lastHeart=0,pHit={};
// 姫の心臓は見せず、被弾と危機を画面の揺れと「ドクン」と縮む動きで間接的に表す（動きを減らす設定ではCSS側で止まる）。
const stage=$('.stage');function screenFx(k){if(!stage?.classList)return;stage.classList.remove(k);void stage.offsetWidth;stage.classList.add(k)}
function sound(){const e=b.enemy,fl=b.ship(FLAGSHIP),ck=b.mode==='cutin'&&b.cutin?`${b.cutin.index}:${b.cutin.ids[b.cutin.index]}`:'',lunge=!!fl.lunge,imp=Math.max(0,...b.effects.filter(f=>f.type==='impact').map(f=>f.id));
 audio.music(story||phase==='result'?'drama':phase==='prep'?'march':e.form===2?'waltz2':'waltz');audio.duck(b.mode==='paused'||$('#help').open);
 if(pb===b){if(b.mode!==pMode&&(b.mode==='paused'||b.mode==='ended'))audio.sfx('bell');if(ck&&ck!==pCutin)audio.sfx('cutin');if(e.rootUntil>pRoot)audio.sfx('stake');if(lunge&&!pLunge)audio.sfx('cross');if(imp>pImpact)audio.sfx('hit');
  const now=performance.now();if(b.mode==='running'&&fl.hp>0&&fl.hp/fl.maxHp<=.3&&now-lastHeart>1000){lastHeart=now;audio.sfx('heart');screenFx('fx-beat')}
  for(const s of b.ships)if(s.hitUntil>(pHit[s.id]||0)){if(s.id===FLAGSHIP){screenFx('fx-hit');setTimeout(()=>screenFx('fx-beat'),200)}else screenFx('fx-bump')}}
 for(const s of b.ships)pHit[s.id]=s.hitUntil;
 pb=b;pMode=b.mode;pCutin=ck;pRoot=e.rootUntil;pLunge=lunge;pImpact=imp}
function ui(){storyUI();flowUI();sound();$('#clock').textContent=clock(b.time);$('#statusText').textContent={ready:'出撃準備',running:'交戦中',paused:'一時停止',cutin:'騎士の誓い',ended:'戦闘終了'}[b.mode];const body=document.body;if(body){body.dataset.mode=b.mode;body.dataset.phase=phase||'';body.dataset.threat=b.enemy.attack&&b.mode!=='ended'?'on':'';body.dataset.story=story||phase==='prep'||phase==='result'?'on':''}
 $('#monsterBar').style.width=$('#monsterLag').style.width=b.enemy.hp/b.enemy.maxHp*100+'%';$('#monsterText').textContent=`${Math.ceil(b.enemy.hp)} / ${b.enemy.maxHp}`;$('#formLabel').textContent=b.enemy.form===2?'第二形態':'第一形態';$('#bleedText').innerHTML=`<span class="bleed-label">失血</span>${'<i class="on"></i>'.repeat(b.enemy.bleed)}${'<i></i>'.repeat(5-b.enemy.bleed)}${b.enemy.rootUntil>b.time?'<span class="tag root">拘束中</span>':''}`;
 for(const s of b.ships){$(`#${s.id}-hp`).textContent=`${Math.ceil(s.hp)} / ${s.maxHp}`;$(`#${s.id}-hpbar`).style.width=s.hp/s.maxHp*100+'%';$(`#${s.id}-status`).textContent=s.hp<=0?'戦闘不能':s.status;$(`#${s.id}-blood`).textContent=`血${Math.floor(s.blood)}${s.blood>=25?` · 強化${Math.floor(s.blood/25)}`:''}`;$(`#${s.id}-bloodbar`).style.width=s.blood+'%';$(`[data-ship="${s.id}"]`).classList.toggle('down',s.hp<=0)}
 const a=b.enemy.attack,counter=!a&&b.time<b.enemy.recoveryUntil;$('#threatStrip').classList.toggle('danger',!!a&&b.mode!=='ended');$('#threatStrip').classList.toggle('chance',counter);$('#threatTitle').textContent=a?(a.type==='slam'?'血潮の墜落':'薙ぎ払い'):'';$('#threatTime').textContent=a?(a.duration-a.age).toFixed(1):'';$('#threatText').textContent=b.mode==='ended'?b.reason:a?(a.type==='slam'?`${b.ship(a.targetId).name}の足元 · 赤い円の全艦に命中`:'赤い扇形の範囲の全艦に命中'):(counter?'反撃チャンス！ 敵は後隙 · ジョストで押し戻せ':'');
 $('#cutin').hidden=b.mode!=='cutin';if(b.cutin){const id=b.cutin.ids[b.cutin.index],sk=SKILLS[id];$('#cutin').style.setProperty('--cutin-color',b.ship(id).accent||b.ship(id).color);$('#cutin').style.setProperty('--cutin-ink',b.ship(id).accent?'#fff':'#0a1620');$('#cutinCount').textContent=`${b.cutin.index+1} / ${b.cutin.ids.length}`;const key=`${b.time}:${b.cutin.index}:${id}`;if(key!==cutinKey){cutinKey=key;const el=$('#cutin');el.classList.remove('play');void el.offsetWidth;el.classList.add('play')}$('#cutinCrest').textContent=sk.crest;const portrait=$('#cutinPortrait');if(portrait){const src=PORTRAITS[id];portrait.hidden=!src;if(src&&portrait.getAttribute('src')!==src)portrait.src=src;$('#cutin').classList.toggle('has-portrait',!!src)}$('#cutinKnight').textContent=b.ship(id).name;$('#cutin').classList.toggle('declare',!!sk.declare);$('#cutinSkill').textContent=sk.declare?sk.quote.replace('、','、\n'):sk.name;$('#cutinQuote').textContent=sk.declare?`〈${sk.name}〉`:sk.quote;}
 $('#timingPanel').hidden=!b.timing;$('#timingBtn').disabled=!b.timing||b.timing.pressed||b.mode!=='running';if(b.timing){$('#timingNeedle').style.left=b.timing.progress*100+'%';$('#timingText').textContent=b.mode==='paused'?'戦術ポーズ中。再開すると入力を続けられます。':b.timing.pressed?b.lastTiming:'金色の範囲でFキー / ボタン。入力なしでも通常射出。';}
 drawChart();
 if(lastLog!==b.logs[0]?.id){lastLog=b.logs[0]?.id;$('#logList').innerHTML=b.logs.slice(0,4).map(l=>`<div class="log-entry ${l.type}"><time>${clock(l.time)}</time><span>${l.text}</span></div>`).join('')}
}
// 左上の海図：彼我の位置、血域、浅瀬、敵の攻撃範囲を常に描く（見るだけ）。
const chart=$('#chart'),chartCtx=chart?.getContext?.('2d'),TAU=Math.PI*2;
function drawChart(){if(!chartCtx)return;const dpr=Math.min(2,window.devicePixelRatio||1),w=chart.clientWidth||240,h=chart.clientHeight||156,cw=Math.round(w*dpr),ch=Math.round(h*dpr);if(chart.width!==cw||chart.height!==ch){chart.width=cw;chart.height=ch}const c=chartCtx,k=w/WIDTH,u=1/k,circle=(x,y,r)=>{c.beginPath();c.arc(x,y,r,0,TAU)};c.setTransform(dpr*k,0,0,dpr*h/HEIGHT,0,0);c.clearRect(0,0,WIDTH,HEIGHT);
 c.strokeStyle='#e2c07a1f';c.lineWidth=u;c.beginPath();for(let x=100;x<WIDTH;x+=100){c.moveTo(x,0);c.lineTo(x,HEIGHT)}for(let y=100;y<HEIGHT;y+=100){c.moveTo(0,y);c.lineTo(WIDTH,y)}c.stroke();
 for(const p of b.pools){c.fillStyle=`rgba(194,31,58,${Math.max(.08,Math.min(.5,p.life/24*.5))})`;circle(p.x,p.y,p.radius);c.fill()}
 for(const o of SHOALS){c.fillStyle='rgba(236,226,190,.16)';circle(o.x,o.y,o.r);c.fill();c.strokeStyle='rgba(236,226,190,.32)';c.lineWidth=u;c.setLineDash([4*u,4*u]);c.stroke();c.setLineDash([])}
 const a=b.enemy.attack;if(a&&b.mode!=='ended'){c.beginPath();if(a.type==='slam')c.arc(a.x,a.y,a.range,0,TAU);else{c.moveTo(a.x,a.y);c.arc(a.x,a.y,a.range,a.angle-a.arc,a.angle+a.arc);c.closePath()}c.fillStyle='#ff4d5e44';c.fill();c.strokeStyle='#ff4d5e';c.lineWidth=1.5*u;c.stroke()}
 const e=b.enemy;c.fillStyle=e.rootUntil>b.time?'#c21f3a':'#ff4d5e';c.strokeStyle='#fff';c.lineWidth=1.5*u;c.beginPath();c.moveTo(e.x+Math.cos(e.angle)*44,e.y+Math.sin(e.angle)*44);c.lineTo(e.x+Math.cos(e.angle+2.4)*32,e.y+Math.sin(e.angle+2.4)*32);c.lineTo(e.x+Math.cos(e.angle-2.4)*32,e.y+Math.sin(e.angle-2.4)*32);c.closePath();c.fill();c.stroke();
 for(const s of b.ships){const down=s.hp<=0;c.globalAlpha=down?.4:1;circle(s.x,s.y,22);c.fillStyle=s.color;c.fill();c.strokeStyle='#06121f';c.lineWidth=u;c.stroke();if(s.id===FLAGSHIP){circle(s.x,s.y,8);c.fillStyle='#06121f';c.fill()}c.globalAlpha=1}
}
// Phones play in landscape. Android allows locking only in fullscreen; iOS ignores it and the CSS rotate hint covers portrait.
const touch=window.matchMedia('(pointer: coarse)').matches;
function landscape(){if(!touch||document.fullscreenElement||!document.documentElement?.requestFullscreen)return;document.documentElement.requestFullscreen({navigationUI:'hide'}).then(()=>screen.orientation?.lock?.('landscape')).catch(()=>{})}
$('#storyGo').onclick=()=>{landscape();if(story==='epilogue')newCampaign();else toPrep()};$('#resetBtn').onclick=newCampaign;$('#prepGo').onclick=()=>{landscape();launch('watch')};$('#prepSummary').onclick=()=>{landscape();launch('summary')};$('#prepSkip').onclick=()=>launch('skip');$('#resultGo').onclick=nextStep;$('#pauseBtn').onclick=play;$('#toSummary').onclick=toSummary;
$('#prepFormations').onclick=ev=>{const el=ev.target.closest('[data-form]');if(!el)return;plan.formation=el.dataset.form;prepChanged()};$('#prepSkills').onclick=ev=>{const el=ev.target.closest('[data-skill]');if(!el)return;const i=plan.order.indexOf(el.dataset.skill);if(i>=0)plan.order.splice(i,1);else plan.order.push(el.dataset.skill);prepChanged()};
$('#prepMenu').onclick=()=>$('#helpBtn').click();$('#helpBtn').onclick=()=>{if(b.mode==='running')b.pause();$('#help').open=!$('#help').open;ui()};$('#helpClose').onclick=()=>{$('#help').open=false;ui()};$('#skipCutin').onclick=()=>{b.finishCutins();ui()};const setConfig=(k,v)=>{config[k]=v;applyConfig(b,config);saveConfig(config);ui()};$('#skipBattle').onchange=e=>setConfig('skipBattle',e.target.checked);$('#autoTiming').onchange=e=>setConfig('autoTiming',e.target.checked);$('#shortCutin').onchange=e=>setConfig('shortCutin',e.target.checked);$('#sound').onchange=e=>{setConfig('sound',e.target.checked);audio.setEnabled(e.target.checked)};$('#volume').oninput=e=>{setConfig('volume',+e.target.value);audio.setVolume(+e.target.value)};$('#timingBtn').onclick=()=>{b.pressTiming();ui()};
$('#viewMode').onchange=e=>{renderer?.setView(e.target.value);config.view=e.target.value;saveConfig(config)};$('#zoomIn').onclick=()=>renderer?.zoomBy(.85);$('#zoomOut').onclick=()=>renderer?.zoomBy(1.17);$('#cameraReset').onclick=()=>renderer?.resetCamera();
$('#sea').addEventListener('renderlost',()=>{if(b.mode==='cutin')b.finishCutins();b.pause('3D表示が停止しました','ページを再読み込みしてください。');$('#renderError').hidden=false;$('#renderError').textContent='3D描画が中断されました。ページを再読み込みしてください。';ui()});

document.addEventListener('keydown',ev=>{if(['INPUT','SELECT','TEXTAREA'].includes(ev.target.tagName)||ev.repeat)return;if(ev.key.toLowerCase()==='f'){ev.preventDefault();b.pressTiming();ui();return}if(ev.code==='Space'&&ev.target.tagName!=='BUTTON'){ev.preventDefault();play()}});
const portrait=window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 820px)');portrait.addEventListener?.('change',e=>{if(!e.matches)return;if(b.mode==='cutin')b.finishCutins();if(b.mode==='running')b.pause('縦向きのため停止','横向きに戻して再開してください。');ui()});
const unlock=()=>audio.unlock();document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);document.addEventListener('click',ev=>{if(ev.target.closest?.('button,.order-option'))audio.sfx('ui')},true);document.addEventListener('visibilitychange',()=>audio.suspend(document.hidden));
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(b.mode==='cutin')b.finishCutins();if(b.mode==='running')b.pause('画面を離れたため停止','戻ったら再開してください。');ui()}});
function frame(now){const dt=Math.min(.08,Math.max(0,(now-last)/1000));last=now;const watch=phase==='watch',fast=phase==='summary';
 if(watch||fast){if(fast){if(b.mode==='paused'&&!document.hidden&&!$('#help').open)b.resume();if(b.mode==='cutin')b.finishCutins()}b.advancePresentation(dt);
  if(b.mode==='running'){acc+=dt*(b.timing?.12:fast?FAST:1);for(let n=0;acc>=TICK&&b.mode==='running'&&n<600;n++){b.step(TICK);acc-=TICK;if(fast&&b.mode==='cutin')b.finishCutins();if(fast&&b.timing){acc=0;break}}}else acc=0;
  if(b.mode==='ended'){if(!endAt)endAt=now+(watch?1500:350);else if(now>=endAt)toResult(b.report())}}
 if(now-lastUI>40){ui();lastUI=now}renderer?.render(b,selected,false);requestAnimationFrame(frame)}
build();recordUI();ui();requestAnimationFrame(frame);
