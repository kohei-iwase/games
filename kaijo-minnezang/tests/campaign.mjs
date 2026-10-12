import assert from 'node:assert/strict';
import {Battle,simulate} from '../dist/battle.mjs';
import {loadConfig,saveConfig,applyConfig,DEFAULTS} from '../dist/config.mjs';
import {epilogue,hints,loadRecords,saveRecord,battleVerdict,campaignReport} from '../dist/campaign.mjs';
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))};
const win=new Battle();win.start();win.enemy.hp=1;win.hitEnemy(10,'stake',win.ship('stake'));const w=win.report();
const lose=new Battle();lose.start();lose.damageShip(lose.ship('lance'),9999,null);const l=lose.report();
assert.equal(epilogue(w).title,'凱歌');assert.equal(epilogue(l).title,'撤退の歌');
assert(hints(l).some(h=>h.includes('ミラルカ')));
const isl=new Battle();isl.start();isl.island.hp=0.01;isl.enemy.x=95+42+60;isl.enemy.y=330;isl.enemy.nextAttack=999;isl.ships.forEach(s=>{s.x=940;s.y=560;s.waypoint={x:940,y:560}});for(let i=0;i<400&&isl.mode!=='ended';i++){if(isl.mode==='paused')isl.resume();isl.step(.025)}const il=isl.report();assert.equal(il.lost,'island');assert(epilogue(il).lines[0].text.includes('峰の灯が……消えてしまいました'));assert.equal(epilogue(il).lines[0].speaker,'堅牢なるオリーヴェ');assert(hints(il)[0].includes('浅瀬'));assert(!epilogue(l).lines[0].text.includes('峰の灯'));assert.equal(l.lost,'flagship');
assert.equal(saveRecord(l),true);assert.equal(saveRecord(w),true);assert.equal(loadRecords().normal.rank,w.rank);
assert.equal(saveRecord(l),false,'a defeat never replaces a victory');
{const c=loadConfig();assert.deepEqual(c,DEFAULTS);c.pauseMode='none';c.view='first';assert(saveConfig(c));assert.equal(loadConfig().pauseMode,'none');assert.equal(applyConfig(new Battle(),loadConfig()).autoPause,false);store.set('minnezang-config','{"pauseMode":"bogus","autoTiming":"yes"}');assert.deepEqual(loadConfig(),DEFAULTS);store.set('minnezang-config','{"sound":false,"volume":0.3}');assert.equal(loadConfig().sound,false);assert.equal(loadConfig().volume,0.3);store.set('minnezang-config','{"volume":5}');assert.equal(loadConfig().volume,1);store.set('minnezang-config','{"volume":-2,"sound":"x"}');assert.equal(loadConfig().volume,0);assert.equal(loadConfig().sound,true);store.delete('minnezang-config');store.set('minnezang-view','overview');assert.equal(loadConfig().view,'overview')}
{const o={fleet:['lance','stake','escort'],skillOrder:['stake','lance'],formation:'free',duration:30,enemyMaxHp:2250,island:false};let hp=2250;const reps=[];while(hp>0&&reps.length<9){const r=simulate({...o,enemyHp:hp});reps.push(r);hp=r.enemyHp}
 assert.equal(reps.at(-1).decided,'kill');assert.equal(battleVerdict(reps.at(-1)).title,'撃破');assert.equal(battleVerdict(reps[0]).title,reps[0].result==='victory'?'判定勝ち':'判定負け');assert.equal(battleVerdict({decided:'flagship',result:'defeat'}).title,'撤退');
 const c=campaignReport(reps,true);assert.equal(c.result,'victory');assert.equal(c.battles,reps.length);assert(c.rank!=='—');assert.equal(c.taken,reps.reduce((n,r)=>n+r.taken,0));assert.equal(epilogue(c).title,'凱歌');assert(reps.length<2||epilogue(c).lines.length===4);assert(hints(c).length<=2);
 const f=campaignReport(reps.slice(0,1),false);assert.equal(f.rank,'—');assert.equal(epilogue(f).title,'撤退の歌');
 const fast=campaignReport(reps.slice(0,1),true),slow={...fast,battles:fast.battles+3,rank:fast.rank,time:fast.time-1};store.clear();assert.equal(saveRecord(slow),true);assert.equal(saveRecord(fast),true,'fewer battles beats more battles at the same rank');assert.equal(loadRecords().normal.battles,1);assert.equal(saveRecord(slow),false)}
delete globalThis.localStorage;assert.deepEqual(loadRecords(),{});assert.equal(typeof saveRecord(w),'boolean');
console.log(JSON.stringify({passed:'campaign',victory:w.rank,defeat:l.rank}));
