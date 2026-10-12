import {Battle,FORMATIONS,SKILLS,DIFFICULTY,WIDTH,HEIGHT,FLAGSHIP,SHOALS,KNIGHTS,ESCORT,simulate,swarmAlive} from './battle.mjs';
import {epilogue,loadRecords,saveRecord,difficultyName,battleVerdict,strategyReport,strategyHints} from './campaign.mjs';
import {Strategy,MAP,LAMP,SHOALS as MAP_SHOALS,ISLETS} from './strategy.mjs';
import {FLEET_COLOR,shipMaxHp} from './mapscene3d.mjs';
import {SeaRenderer} from './render3d.mjs';
import {loadConfig,saveConfig,applyConfig} from './config.mjs';
import {createAudio} from './audio.mjs';
import {loadScript} from './story.mjs';
import {createTalk} from './talk.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let renderer=null;try{renderer=new SeaRenderer($('#sea'),{reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches});}catch(error){$('#renderError').hidden=false;$('#renderError').textContent=error.message;}
const config=loadConfig();
if(renderer){renderer.setView(config.view);$('#viewMode').value=renderer.view}$('#skipBattle').checked=config.skipBattle;$('#autoTiming').checked=config.autoTiming;$('#shortCutin').checked=config.shortCutin;
const audio=createAudio();audio.setEnabled(config.sound);audio.setVolume(config.volume);$('#sound').checked=config.sound;$('#volume').value=config.volume;
// 全体の流れ。story=エピローグのドラマ画面（プロローグ・接触・幕間の会話は talk が重ねて再生する）、phase=map（戦略マップ）／prep（出撃準備）／watch（観戦。倍速つき）／result（結果）。
// 戦略マップの進行は st（Strategy）、接触した戦闘は enc（st.encounter）と b（Battle）が持つ。
const TICK=.025,SPEEDS=[1,2,4];
let story=null,phase='map',report=null,newBest=false,cutinKey='';
let st=new Strategy(),history=[],enc=null,fleetSel='main',mapSpeed=1,contactAt=0,finishAt=0,fleetKey='',mapLogKey=null,hintKey='',pPaused=true;
let lastRep=null,endAt=0,predTimer=0,predToken=0,predResult=null,storyKey='',judgeKey='',watchSpeed=1;
const options=()=>st.battleOptions(enc);
const newBattle=()=>{const x=applyConfig(new Battle(options()),config);if(renderer)renderer.flagship=x.flag().id;return x};
let b=applyConfig(new Battle({island:false,auto:true}),config),selected=FLAGSHIP,last=performance.now(),acc=0,lastUI=0,lastLog=-1;
const fleetOf=()=>st.fleet(enc.fleetId),foeOf=()=>st.enemy(enc.enemyId),hasLance=()=>b.ships.some(s=>s.id==='lance'),inMap=()=>phase==='map'||!phase;
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
// カットインの立ち絵。ない騎士は紋章だけを出す。
const PORTRAITS={stake:'./art/kanaan.png',lance:'./art/miralka.png',guard:'./art/olive.png'};for(const src of Object.values(PORTRAITS))new Image().src=src;
const crest=s=>SKILLS[s.kind]?.crest||'◈',pct=n=>Math.round(n*100)+'%';
function build(){ $('#shipList').innerHTML=b.ships.map(s=>`<button class="member" data-ship="${s.id}" tabindex="-1" style="--ship-color:${s.color}"><span class="member-crest">${crest(s)}</span><span class="member-body"><span class="member-name"><strong>${s.name}</strong><span id="${s.id}-hp"></span></span><span class="bar hp"><i id="${s.id}-hpbar"></i></span><span class="bar blood"><i id="${s.id}-bloodbar"></i></span><span class="member-foot"><span id="${s.id}-status"></span><span id="${s.id}-blood"></span></span></span></button>`).join('')}
// 流れの切り替え。newGame=最初から、toMap=戦略マップ（ポーズ状態）、toPrep=接触した戦闘の出撃準備、launch=出撃（観戦／完全スキップ）、toResult=結果、backToMap=戦闘の結果を戦略へ反映、finish=戦略の決着。
function newGame(){st=new Strategy();history=[];fleetSel='main';mapSpeed=1;report=null;toMap()}
function toMap(){story=null;phase='map';enc=null;contactAt=0;finishAt=0;fleetKey='';mapLogKey=null;st.paused=true;$('#contact').hidden=true;ui()}
function toPrep(){enc=st.encounter;story=null;phase='prep';report=null;$('#contact').hidden=true;b=newBattle();acc=0;lastLog=-1;build();prepUI();schedulePredict();ui();if(enc.enemyId==='nephilim'&&!st.seen.contact){st.seen.contact=true;scene('contact-nephilim',ui)}}
// 物語の場面（story/名前.txt）を会話で再生し、終わったら done を呼ぶ。台本が読めなければそのまま done。
function scene(name,done){talk.begin();loadScript(name).then(c=>talk.play(c,done),e=>{console.warn(e.message);talk.abort();done?.()})}
function launch(kind){if(kind==='skip'){toResult(simulate(options(),{joustPolicy:'normal'}));return}b=newBattle();b.start();phase=kind;judgeKey='';endAt=0;acc=0;lastLog=-1;build();ui()}
function toResult(rep){phase='result';lastRep=rep;endAt=0;resultUI();ui()}
function backToMap(){history.push(lastRep);st.applyBattle(enc,lastRep);toMap()}
function finish(){report=strategyReport(st,history);newBest=saveRecord(report);recordUI();$('#contact').hidden=true;story='epilogue';phase=null;ui()}
function banner(text){$('#contactText').textContent=text;$('#contact').hidden=false;audio.sfx('bell')}
// 観戦の倍速（×1／×2／×4）。倍速のあいだはカットインを短くする。
function setSpeed(n){if(SPEEDS.includes(n))watchSpeed=n;b.shortCutin=config.shortCutin||watchSpeed>1;ui()}
function togglePause(){if(phase!=='map'||st.encounter||st.result||contactAt||finishAt)return;st.paused=!st.paused;ui()}
function play(){if(story==='prologue'||story==='epilogue'){newGame();return}if(phase==='map')togglePause();else if(phase==='prep')launch('watch');else if(phase==='result')backToMap();else if(phase==='watch'){if(b.mode==='running')b.pause();else if(b.mode==='paused')b.resume()}ui()}
// 判定ゲージ：左が与ダメージ率、右が被ダメージ率（同じ目盛りで、半分の長さ＝50%）。与が被以上なら優勢。
const verdictWord=(d,t)=>d>=t?(d>0?'優勢':'互角'):'劣勢';
const gaugeHTML=(d,t,mid)=>{const w=n=>Math.min(100,n*200).toFixed(1);return `<div class="jg-side jg-d${d>=t&&d>0?' lead':''}"><b>与<span class="jg-full">ダメージ</span></b><span class="jg-bar"><i style="width:${w(d)}%"></i></span><em>${pct(d)}</em></div><div class="jg-mid">${mid}</div><div class="jg-side jg-t${d<t?' lead':''}"><em>${pct(t)}</em><span class="jg-bar"><i style="width:${w(t)}%"></i></span><b>被<span class="jg-full">ダメージ</span></b></div>`};
// 準備画面：陣形とスキルの順番を選び、予測を表示する。艦隊ごとに fleet.formation / fleet.skillOrder へ保存する。変えるたびに110ms待ってから試算し直す。
function prepUI(){const f=fleetOf(),e=foeOf(),o=f.skillOrder,has=id=>b.ships.some(s=>s.id===id),combo=has('stake')&&has('lance')&&o.indexOf('stake')>=0&&o.indexOf('lance')===o.indexOf('stake')+1,even=e.kind!=='nephilim';
 $('#prepTitle').textContent=`${f.name}　対　${e.name}`;$('#prepOdds').textContent=even?'同格':'格上';$('#prepOdds').classList.toggle('even',even);$('#prepEnemy').textContent=e.name;$('#prepHpBar').style.width=e.hp/e.maxHp*100+'%';$('#prepHpText').textContent=`${Math.ceil(e.hp)} / ${e.maxHp}`;
 $('#prepFleet').innerHTML=b.ships.map(s=>`<div class="fleet-ship" style="--ship-color:${s.color}"><span class="member-crest">${crest(s)}</span><span class="fleet-name"><b>${esc(s.name)}</b><small>耐久 ${Math.ceil(s.hp)} / ${s.maxHp}</small></span></div>`).join('');
 $('#prepFormations').innerHTML=Object.entries(FORMATIONS).map(([k,x])=>`<button data-form="${k}" class="${f.formation===k?'selected':''}" aria-pressed="${f.formation===k}" title="${x.note}"><b>${x.name}</b><small>${x.note.split('。').pop()}</small></button>`).join('');$('#prepFormNote').textContent=FORMATIONS[f.formation].note;
 $('#prepSkills').innerHTML=b.ships.filter(s=>SKILLS[s.id]).map(s=>{const i=o.indexOf(s.id);return `<button class="skill-card${i>=0?' on':''}" data-skill="${s.id}" aria-pressed="${i>=0}" style="--ship-color:${s.color}"><span class="skill-card-crest">${SKILLS[s.id].crest}</span><b>〈${SKILLS[s.id].name}〉</b><small>${esc(s.name)}</small><i>${i>=0?`${i+1}番目`:'使わない'}</i></button>`}).join('');
 $('#prepCombo').textContent=!hasLance()?'この艦隊にジョストはありません。戦闘は観戦でも完全にオートで進みます。':combo?'連携〈杭と十字架の馬上槍試合〉が成立する順です。':'縫い留め→ジョストの順だと連携〈杭と十字架の馬上槍試合〉。';$('#prepCombo').classList.toggle('active',combo)}
function schedulePredict(){predResult=null;predUI();clearTimeout(predTimer);const tok=++predToken;predTimer=setTimeout(()=>{if(!enc)return;const r=st.predictFor(enc);if(tok===predToken){predResult=r;predUI()}},110)}
const outlook=p=>p.normal.win>=.67?'優勢':p.normal.win>0?'五分':p.perfect.win>=.67?'会心で優勢':p.perfect.win>0?'会心で五分':'劣勢';
function predUI(){const el=$('#prepPredict');if(!predResult){el.innerHTML='<p class="calc">試算中…</p>';return}const {normal:n,perfect:c}=predResult,rg=a=>a[0]===a[1]?`${a[0]}`:`${a[0]}〜${a[1]}`,out=outlook(predResult),tone=out==='優勢'?'good':out==='劣勢'?'bad':'mid';
 el.innerHTML=`<dl><div><dt>与ダメージ</dt><dd>${rg(n.dealt)}<small>（会心時 ${rg(c.dealt)}）</small></dd></div><div><dt>被ダメージ</dt><dd>${rg(n.taken)}${rg(c.taken)!==rg(n.taken)?`<small>（会心時 ${rg(c.taken)}）</small>`:''}</dd></div><div class="outlook ${tone}"><dt>予測の判定</dt><dd>${out}</dd></div></dl>${n.dealt[0]>=Math.ceil(foeOf().hp)?'<p class="calc">通常射出でも残りの耐久を削り切れる見込みです。</p>':''}`}
function prepChanged(){prepUI();schedulePredict()}
// 結果画面：判定、与・被ダメージ、判定ゲージ、敵の残り耐久、会心の回数（ジョストを持つ艦隊のみ）。
function resultUI(){const r=lastRep,v=battleVerdict(r),d=r.judge.dealtRatio,t=r.judge.takenRatio,over=v.kind==='kill'||v.kind==='retreat',f=fleetOf(),e=foeOf();
 $('#result').classList.toggle('lost',v.kind==='retreat'||v.kind==='push');$('#resultPlace').textContent=`${f.name} · ${e.name} · 戦果`;$('#resultTitle').textContent=v.title;$('#resultStamp').textContent=v.stamp;$('#resultNote').textContent=v.note;
 $('#resultGauge').innerHTML=gaugeHTML(d,t,`<b class="jg-time">${over?v.title:verdictWord(d,t)}</b>`);
 $('#resultStats').innerHTML=[['与ダメージ',`${r.dealtTotal}（${pct(d)}）`],['被ダメージ',`${r.taken}（${pct(t)}）`],...(hasLance()?[['会心',`${r.perfect}回`],['ジョスト命中',`${r.joustHits}回`],['連携',`${r.combos}回`]]:[]),['生還',`${r.ships.filter(s=>!s.sunk).length} / ${r.ships.length}`]].map(([k,x])=>`<div><dt>${k}</dt><dd>${x}</dd></div>`).join('');
 $('#resultEnemy').textContent=e.name;$('#resultHpBar').style.width=r.enemyHp/e.maxHp*100+'%';$('#resultHpText').textContent=`${r.enemyHp} / ${e.maxHp}`;$('#resultGo').textContent='海図へ戻る ［Space］'}
// 観戦中のHUD：判定ゲージと残り時間、倍速ボタン。
function flowUI(){const watch=phase==='watch';
 $('#prep').hidden=phase!=='prep';$('#result').hidden=phase!=='result';$('#watchCtl').hidden=!watch;$('#judge').hidden=!watch;$('#prepSkip').hidden=!config.skipBattle;
 if(!watch)return;
 if(watch){$('#pauseBtn').textContent=b.mode==='paused'?'再開 ［Space］':'一時停止 ［Space］';$('#pauseBtn').disabled=b.mode==='cutin'||b.mode==='ended';$$('#speedCtl [data-speed]').forEach(el=>{const on=+el.dataset.speed===watchSpeed;el.classList.toggle('on',on);el.setAttribute('aria-pressed',on)})}
 {const rt=b.ratios(),left=Math.max(0,Math.ceil(b.duration-b.time)),key=`${Math.round(rt.dealtRatio*100)}:${Math.round(rt.takenRatio*100)}:${left}`;if(key!==judgeKey){judgeKey=key;$('#judge').innerHTML=gaugeHTML(rt.dealtRatio,rt.takenRatio,`<b class="jg-time">残り ${left}秒</b><small>${verdictWord(rt.dealtRatio,rt.takenRatio)}</small>`)}}
}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const speech=lines=>lines.map(l=>`<p><b>${esc(l.speaker)}</b><span>${esc(l.text)}</span></p>`).join('');
function storyUI(){
 $('#story').hidden=!story;const key=story+(report?report.battles+':'+report.time:'');if(!story||key===storyKey){if(!story)storyKey='';return}storyKey=key;const ep=story==='epilogue';
 $('#story').classList.toggle('lost',ep&&report.result!=='victory');
 const e=epilogue(report),r=report;$('#storyPlace').textContent=`戦果報告 · ${difficultyName(r.difficulty)} · 全${r.battles}戦`;$('#storyTitle').textContent=e.title;$('#storyRank').hidden=false;$('#storyRank').textContent=r.rank;$('#storyRank').dataset.rank=r.rank;$('#storyNote').textContent=e.note+(newBest&&r.result==='victory'?'　·　自己ベスト更新':'');$('#storyLines').innerHTML=speech(e.lines);
 $('#storyStats').hidden=false;$('#storyStats').innerHTML=[['所要時間',clock(r.time)],['戦闘回数',`${r.battles}戦`],['峰の灯',`${r.island} / 100`],['総与ダメージ',r.dealtTotal],['総被害',r.taken],['生還',`${r.ships.filter(s=>!s.sunk).length} / ${r.ships.length}`]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
 $('#storyHints').innerHTML=strategyHints(r).map(h=>`<li>${esc(h)}</li>`).join('');$('#storyGo').textContent='最初から ［Space］';$('#storyClose').hidden=true;
}
function recordUI(){const rec=loadRecords()[b.difficulty];$('#bestRecord').textContent=rec?`最高評価 ${rec.rank}${rec.rank!=='—'?` · ${clock(rec.time)}${rec.battles?` · ${rec.battles}戦`:''}`:''}`:'記録なし'}
// 状態の変化を前回値と比べて音を鳴らす。Battle が作り直されたら前回値を取り直す（鳴らさない）。
let pb=null,pMode='',pCutin='',pRoot=0,pLunge=false,pImpact=0,pMuz=0,pSunk=0,lastGun=0,lastHeart=0,pHit={};
// 姫の心臓は見せず、被弾と危機を画面の揺れと「ドクン」と縮む動きで間接的に表す（動きを減らす設定ではCSS側で止まる）。
const stage=$('.stage');function screenFx(k){if(!stage?.classList)return;stage.classList.remove(k);void stage.offsetWidth;stage.classList.add(k)}
function sound(){const map=phase==='map',battle=phase==='watch'||phase==='prep';
 audio.music(story||talk.active||phase==='result'?'drama':!battle||phase==='prep'||b.enemyKind==='kin'?'march':b.enemy.form===2?'waltz2':'waltz');audio.duck(!talk.active&&((map?st.paused:b.mode==='paused')||$('#help').open));
 if(map){if(st.paused!==pPaused&&!talk.active&&!st.encounter&&!st.result&&!contactAt&&!finishAt)audio.sfx('bell');pPaused=st.paused;pb=null;return}
 if(!battle)return;
 const e=b.enemy,fl=b.flag(),ck=b.mode==='cutin'&&b.cutin?`${b.cutin.index}:${b.cutin.ids[b.cutin.index]}`:'',lunge=!!b.ship('lance')?.lunge,imp=Math.max(0,...b.effects.filter(f=>f.type==='impact').map(f=>f.id)),muz=Math.max(0,...b.effects.filter(f=>f.type==='muzzle').map(f=>f.id)),sunk=e.sunk?e.sunk.filter(t=>t!=null&&t>-50).length:0;
 if(pb===b){if(b.mode!==pMode&&(b.mode==='paused'||b.mode==='ended'))audio.sfx('bell');if(ck&&ck!==pCutin)audio.sfx('cutin');if(e.rootUntil>pRoot)audio.sfx('stake');if(lunge&&!pLunge)audio.sfx('cross');if(imp>pImpact)audio.sfx('hit');
  const now=performance.now();if(muz>pMuz&&now-lastGun>700){lastGun=now;audio.sfx('hit')}if(sunk>pSunk)audio.sfx('stake');if(b.mode==='running'&&fl.hp>0&&fl.hp/fl.maxHp<=.3&&now-lastHeart>1000){lastHeart=now;audio.sfx('heart');screenFx('fx-beat')}
  for(const s of b.ships)if(s.hitUntil>(pHit[s.id]||0)){if(s===fl){screenFx('fx-hit');setTimeout(()=>screenFx('fx-beat'),200)}else screenFx('fx-bump')}}
 for(const s of b.ships)pHit[s.id]=s.hitUntil;
 pb=b;pMode=b.mode;pCutin=ck;pRoot=e.rootUntil;pLunge=lunge;pImpact=imp;pMuz=muz;pSunk=sunk}
function ui(){storyUI();flowUI();sound();const map=inMap(),body=document.body;
 if(body){body.dataset.view=map?'map':'battle';body.dataset.mode=map?(st.paused?'paused':'running'):b.mode;body.dataset.phase=phase||'';body.dataset.threat=!map&&b.enemy.attack&&b.mode!=='ended'?'on':'';body.dataset.story=story||phase==='prep'||phase==='result'?'on':'';body.dataset.talk=talk.active?'on':''}
 const hint=map?'ドラッグ：視点移動 ／ ホイール：ズーム ／ 艦隊をクリックで選択、海面をクリックで移動 ／ Space：進行・戦術ポーズ':'ドラッグ：旋回 ／ ホイール：ズーム ／ Space：一時停止・再開 ／ F：ジョスト射出';if(hint!==hintKey){hintKey=hint;$('#cameraHint').textContent=hint}
 if(map)mapUI();else battleUI()}
// 戦略マップのHUD：ネフェリムと峰の灯の耐久、経過時間、艦隊一覧、ログ、操作ボタン。
function mapUI(){
 if(!st.fleet(fleetSel))fleetSel=st.fleets[0]?.id||null;
 const nep=st.enemy('nephilim'),sel=st.fleet(fleetSel),live=phase==='map'&&!st.encounter&&!st.result&&!contactAt&&!finishAt,lamp=st.lamp.hp;
 $('#mapNepBar').style.width=(nep?nep.hp/nep.maxHp*100:0)+'%';$('#mapNepText').textContent=nep?`${Math.ceil(nep.hp)} / ${nep.maxHp}`:'撃破';
 $('#mapLampBar').style.width=lamp+'%';$('#mapLampText').textContent=`${Math.ceil(lamp)} / 100`;$('#mapBar').classList.toggle('siege',st.enemies.some(e=>e.active&&e.siege));$('#mapClock').textContent=clock(st.time);
 $('#tacPause').hidden=!(phase==='map'&&st.paused&&live);$('#tacHint').textContent='Spaceで進行 ／ 艦隊を選び、海面をクリックで移動指示';
 $('#mapPlay').textContent=st.paused?'進行 ［Space］':'ポーズ ［Space］';$('#mapPlay').disabled=!live;$('#mapStop').disabled=!sel||!sel.target;$('#mapSpeed').textContent=`×${mapSpeed}`;
 const key=st.fleets.map(f=>`${f.id}:${f.id===fleetSel}:${fleetState(f)}:${f.ships.map(s=>Math.ceil(s.hp)).join(',')}`).join('|');
 if(key!==fleetKey){fleetKey=key;$('#fleetList').innerHTML=st.fleets.map(f=>`<button class="member fleet-card${f.id===fleetSel?' selected':''}" data-fleet="${f.id}" tabindex="-1" aria-pressed="${f.id===fleetSel}" style="--ship-color:${FLEET_COLOR[f.id]||'#d23a54'}"><span class="fleet-head"><strong>${esc(f.name)}</strong><small>${fleetState(f)}</small></span><span class="fleet-ships">${f.ships.map(s=>{const k=KNIGHTS[s.type]||ESCORT;return `<span class="mini-ship" title="${esc(k.name)}" style="--ship-color:${k.color}"><span class="member-crest">${SKILLS[s.type]?.crest||'◈'}</span><span class="bar hp"><i style="width:${s.hp/shipMaxHp(s.type)*100}%"></i></span><small>${Math.ceil(s.hp)}</small></span>`}).join('')}</span></button>`).join('')}
 if(st.log[0]!==mapLogKey){mapLogKey=st.log[0];$('#logList').innerHTML=st.log.slice(0,4).map(l=>`<div class="log-entry"><time>${clock(l.time)}</time><span>${esc(l.text)}</span></div>`).join('')}
 $('#chartTip').textContent='海域全図 · クリックで移動指示';drawMapChart()}
const fleetState=f=>Math.hypot(f.x-LAMP.x,f.y-LAMP.y)<=LAMP.r+60?'補給圏':f.target?'移動中':'待機';
function battleUI(){$('#clock').textContent=clock(b.time);$('#statusText').textContent={ready:'出撃準備',running:'交戦中',paused:'一時停止',cutin:'騎士の誓い',ended:'戦闘終了'}[b.mode];$('#bossName').textContent=b.enemyName;
 $('#monsterBar').style.width=$('#monsterLag').style.width=b.enemy.hp/b.enemy.maxHp*100+'%';$('#monsterText').textContent=`${Math.ceil(b.enemy.hp)} / ${b.enemy.maxHp}`;$('#formLabel').textContent=b.enemyKind==='kin'?`残り${swarmAlive(b.enemy)}体`:b.enemy.form===2?'第二形態':'第一形態';$('#bleedText').innerHTML=`<span class="bleed-label">失血</span>${'<i class="on"></i>'.repeat(b.enemy.bleed)}${'<i></i>'.repeat(5-b.enemy.bleed)}${b.enemy.rootUntil>b.time?'<span class="tag root">拘束中</span>':''}`;
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
// 戦略マップ用の海図：海域全体（島・浅瀬・小島・艦隊・敵・移動先）。
function drawMapChart(){if(!chartCtx)return;const dpr=Math.min(2,window.devicePixelRatio||1),w=chart.clientWidth||240,h=chart.clientHeight||160,cw=Math.round(w*dpr),ch=Math.round(h*dpr);if(chart.width!==cw||chart.height!==ch){chart.width=cw;chart.height=ch}const c=chartCtx,k=w/MAP.w,u=1/k,circle=(x,y,r)=>{c.beginPath();c.arc(x,y,r,0,TAU)};c.setTransform(dpr*k,0,0,dpr*h/MAP.h,0,0);c.clearRect(0,0,MAP.w,MAP.h);
 c.strokeStyle='#e2c07a1f';c.lineWidth=u;c.beginPath();for(let x=500;x<MAP.w;x+=500){c.moveTo(x,0);c.lineTo(x,MAP.h)}for(let y=500;y<MAP.h;y+=500){c.moveTo(0,y);c.lineTo(MAP.w,y)}c.stroke();
 for(const o of MAP_SHOALS){c.fillStyle='rgba(236,226,190,.16)';circle(o.x,o.y,o.r);c.fill();c.strokeStyle='rgba(236,226,190,.32)';c.setLineDash([3*u,3*u]);c.stroke();c.setLineDash([])}
 for(const o of ISLETS){c.fillStyle='#46565a';circle(o.x,o.y,o.r);c.fill();c.strokeStyle='#8b9a96';c.stroke()}
 c.strokeStyle='#e2c07a88';c.setLineDash([3*u,3*u]);circle(LAMP.x,LAMP.y,LAMP.r+60);c.stroke();c.setLineDash([]);c.fillStyle=st.enemies.some(e=>e.active&&e.siege)?'#ff4d5e':'#f2d58f';circle(LAMP.x,LAMP.y,LAMP.r);c.fill();c.fillStyle='#0c0814';circle(LAMP.x,LAMP.y,LAMP.r*.35);c.fill();
 for(const f of st.fleets){const col=FLEET_COLOR[f.id]||'#d23a54';if(f.target){c.strokeStyle=col;c.lineWidth=1.2*u;c.setLineDash([3*u,3*u]);c.beginPath();c.moveTo(f.x,f.y);c.lineTo(f.target.x,f.target.y);c.stroke();c.setLineDash([]);circle(f.target.x,f.target.y,5*u);c.stroke()}}
 for(const e of st.enemies){if(!e.active)continue;const nep=e.kind==='nephilim';c.fillStyle=nep?'#ff4d5e':'#9b3a52';c.strokeStyle='#fff';c.lineWidth=u;circle(e.x,e.y,(nep?7:4.5)*u);c.fill();c.stroke()}
 for(const f of st.fleets){const col=FLEET_COLOR[f.id]||'#d23a54';c.fillStyle=col;c.strokeStyle='#06121f';c.lineWidth=1.2*u;circle(f.x,f.y,6*u);c.fill();c.stroke();if(f.id===fleetSel){c.strokeStyle='#f2d58f';c.lineWidth=1.8*u;circle(f.x,f.y,9.5*u);c.stroke()}}
}
// Phones play in landscape. Android allows locking only in fullscreen; iOS ignores it and the CSS rotate hint covers portrait.
const touch=window.matchMedia('(pointer: coarse)').matches;
const hero={name:()=>config.heroName,form:()=>config.heroForm,setName:v=>{config.heroName=v;saveConfig(config)},setForm:v=>{config.heroForm=v;saveConfig(config)}};
const talk=createTalk({root:$('#talk'),stage:$('.stage'),audio,shake:()=>screenFx('fx-hit'),onTap:()=>landscape(),hero});
function landscape(){if(!touch||document.fullscreenElement||!document.documentElement?.requestFullscreen)return;document.documentElement.requestFullscreen({navigationUI:'hide'}).then(()=>screen.orientation?.lock?.('landscape')).catch(()=>{})}
$('#storyGo').onclick=()=>{landscape();newGame()};$('#resetBtn').onclick=newGame;$('#prepGo').onclick=()=>{landscape();launch('watch')};$('#prepSkip').onclick=()=>launch('skip');$('#resultGo').onclick=backToMap;$('#pauseBtn').onclick=play;$('#speedCtl').onclick=ev=>{const el=ev.target.closest('[data-speed]');if(!el)return;setSpeed(+el.dataset.speed);el.blur()};
$('#prepFormations').onclick=ev=>{const el=ev.target.closest('[data-form]');if(!el)return;fleetOf().formation=el.dataset.form;prepChanged()};$('#prepSkills').onclick=ev=>{const el=ev.target.closest('[data-skill]');if(!el)return;const o=fleetOf().skillOrder,i=o.indexOf(el.dataset.skill);if(i>=0)o.splice(i,1);else o.push(el.dataset.skill);prepChanged()};
// 戦略マップの操作：再生／ポーズ、停止、倍速、艦隊の選択、海面・海図のクリックで移動指示。
$('#mapPlay').onclick=ev=>{togglePause();ev.currentTarget.blur()};$('#mapStop').onclick=ev=>{if(fleetSel)st.stop(fleetSel);ev.currentTarget.blur();ui()};$('#mapSpeed').onclick=ev=>{mapSpeed=SPEEDS[(SPEEDS.indexOf(mapSpeed)+1)%SPEEDS.length];ev.currentTarget.blur();ui()};
$('#fleetList').onclick=ev=>{const el=ev.target.closest('[data-fleet]');if(!el)return;fleetSel=el.dataset.fleet;el.blur();ui()};
const orderTo=(x,y)=>{if(phase==='map'&&fleetSel&&!st.encounter&&!st.result)st.order(fleetSel,x,y)};
$('#sea').addEventListener('click',ev=>{if(phase!=='map'||!renderer)return;const c=renderer.mapClick(ev,st);if(!c)return;if(c.fleet)fleetSel=c.fleet.id;else if(c.enemy)orderTo(c.enemy.x,c.enemy.y);else if(c.point)orderTo(c.point.x,c.point.y);ui()});
chart.addEventListener('click',ev=>{if(phase!=='map')return;const r=chart.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*MAP.w,y=(ev.clientY-r.top)/r.height*MAP.h,near=st.fleets.find(f=>Math.hypot(f.x-x,f.y-y)<110);if(near)fleetSel=near.id;else orderTo(x,y);ui()});

$('#prepMenu').onclick=()=>$('#helpBtn').click();$('#helpBtn').onclick=()=>{if(b.mode==='running')b.pause();if(phase==='map')st.paused=true;$('#help').open=!$('#help').open;ui()};$('#helpClose').onclick=()=>{$('#help').open=false;ui()};$('#skipCutin').onclick=()=>{b.finishCutins();ui()};const setConfig=(k,v)=>{config[k]=v;applyConfig(b,config);saveConfig(config);ui()};$('#skipBattle').onchange=e=>setConfig('skipBattle',e.target.checked);$('#autoTiming').onchange=e=>setConfig('autoTiming',e.target.checked);$('#shortCutin').onchange=e=>setConfig('shortCutin',e.target.checked);$('#sound').onchange=e=>{setConfig('sound',e.target.checked);audio.setEnabled(e.target.checked)};$('#volume').oninput=e=>{setConfig('volume',+e.target.value);audio.setVolume(+e.target.value)};$('#timingBtn').onclick=()=>{b.pressTiming();ui()};
$('#viewMode').onchange=e=>{renderer?.setView(e.target.value);config.view=e.target.value;saveConfig(config)};$('#zoomIn').onclick=()=>renderer?.zoomBy(.85);$('#zoomOut').onclick=()=>renderer?.zoomBy(1.17);$('#cameraReset').onclick=()=>renderer?.resetCamera();
$('#sea').addEventListener('renderlost',()=>{if(b.mode==='cutin')b.finishCutins();b.pause('3D表示が停止しました','ページを再読み込みしてください。');st.paused=true;$('#renderError').hidden=false;$('#renderError').textContent='3D描画が中断されました。ページを再読み込みしてください。';ui()});

document.addEventListener('keydown',ev=>{if(['INPUT','SELECT','TEXTAREA'].includes(ev.target.tagName)||ev.repeat)return;const play_=phase==='watch';if(play_&&['1','2','4'].includes(ev.key)){setSpeed(+ev.key);return}if(ev.key.toLowerCase()==='f'){ev.preventDefault();if(play_){b.pressTiming();ui()}return}if(phase==='map'&&(ev.key==='1'||ev.key==='2')){const f=st.fleets[+ev.key-1];if(f){fleetSel=f.id;ui()}return}if(ev.code==='Space'&&ev.target.tagName!=='BUTTON'){ev.preventDefault();play()}});
const portrait=window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 820px)');portrait.addEventListener?.('change',e=>{if(!e.matches)return;if(b.mode==='cutin')b.finishCutins();if(b.mode==='running')b.pause('縦向きのため停止','横向きに戻して再開してください。');if(phase==='map')st.paused=true;ui()});
const unlock=()=>audio.unlock();document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);document.addEventListener('click',ev=>{if(ev.target.closest?.('button,.order-option'))audio.sfx('ui')},true);document.addEventListener('click',ev=>{if(ev.detail>0)ev.target.closest?.('button')?.blur()});document.addEventListener('visibilitychange',()=>audio.suspend(document.hidden));
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(b.mode==='cutin')b.finishCutins();if(b.mode==='running')b.pause('画面を離れたため停止','戻ったら再開してください。');if(phase==='map')st.paused=true;ui()}});
// 戦略マップの1フレーム：接触・決着の演出を待ってから次の画面へ。それ以外は倍速つきで戦略の時間を進める（0.1秒刻み）。
function mapFrame(now,dt){
 if(st.encounter){if(!contactAt){contactAt=now+1500;banner(st.log[0].text)}else if(now>=contactAt)toPrep();return}
 if(st.result){if(!finishAt){finishAt=now+1800;banner(st.reason)}else if(now>=finishAt)finish();return}
 if(talk.active||st.paused||document.hidden||$('#help').open)return;
 for(let left=dt*mapSpeed;left>1e-9&&!st.paused&&!st.encounter&&!st.result;left-=.1)st.step(Math.min(.1,left));
 // 幕間：戦闘を経験した主力艦隊が初めて峰の灯の補給圏に入ったら、進行を止めて会話を流す。
 if(!st.seen.interlude&&st.battles>0&&!st.encounter&&!st.result){const m=st.fleet('main');if(m&&fleetState(m)==='補給圏'){st.seen.interlude=true;st.paused=true;scene('interlude-lamp',toMap)}}}
function frame(now){const raw=Math.max(0,(now-last)/1000),dt=Math.min(.08,raw);last=now;const watch=phase==='watch';
 if(phase==='map')mapFrame(now,Math.min(.25,raw));
 else if(watch){b.shortCutin=config.shortCutin||watchSpeed>1;
  // 撃破の瞬間は0.6秒ほどスロー（動きを減らす設定では使わない）。倍速のあいだもカットインだけは速く、ジョストの射出集中は通常の速さ（0.12倍）に戻す。
  const slow=b.mode==='ended'&&b.decided==='kill'&&endAt&&now<endAt-1800&&!renderer?.reducedMotion?.3:1;b.advancePresentation(dt*slow*(b.mode==='cutin'?watchSpeed:1));
  if(b.mode==='running'){acc+=dt*(b.timing?.12:watchSpeed);for(let n=0;acc>=TICK&&b.mode==='running'&&n<600;n++){b.step(TICK);acc-=TICK}}else acc=0;
  if(b.mode==='ended'){if(!endAt)endAt=now+(b.decided==='kill'?2400:1500);else if(now>=endAt)toResult(b.report())}}
 if(now-lastUI>40){ui();lastUI=now}if(talk.active&&talk.bg==='sea')renderer?.render(b,b.flag().id,false);else if(inMap()||talk.active)renderer?.renderMap(st,{selected:fleetSel});else renderer?.render(b,b.flag().id,false);requestAnimationFrame(frame)}
Object.defineProperty(window,'__st',{get:()=>st});Object.defineProperty(window,'__battle',{get:()=>b});
build();recordUI();ui();requestAnimationFrame(frame);// 起動のたびに、姫の姿の選択 → プロローグ（途中で名前入力）→ 戦略マップ。名前はプロローグで付け直す。
talk.pickForm(()=>{hero.setName('');scene('prologue',toMap)});
