import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Battle,swarmAlive} from '../dist/battle.mjs';
import {LAMP} from '../dist/strategy.mjs';
import {cameraState,shipCamera,project,groundPoint,world,meshes,normalMatrix} from '../dist/space3d.mjs';
import {buildScene,bloodTexture} from '../dist/scene3d.mjs';
import {Strategy} from '../dist/strategy.mjs';
import {buildMapScene,mapWorld,mapFromGround} from '../dist/mapscene3d.mjs';
import {vertexShader,fragmentShader} from '../dist/shaders3d.mjs';
let roundtrips=0;
for(const aspect of [1,1.4,2])for(const yaw of [0,1.4,3.1])for(const elevation of [.48,.82,1.38])for(const zoom of [.65,1,1.7]){const cam=cameraState(aspect,yaw,elevation,zoom);for(const p of [{x:45,y:45},{x:930,y:580},{x:500,y:325},{x:300,y:490}]){const q=project(cam.vp,world(p.x,p.y),1000,1000/aspect);const r=groundPoint(cam.inv,q.x,q.y,1000,1000/aspect);assert(Math.hypot(r.x-p.x,r.y-p.y)<.3);roundtrips++;}}
// Flagship cameras: water in front of the ship round-trips through screen space, and the eye stays above water.
let shipRoundtrips=0;for(const view of ['rear','first'])for(const angle of [0,1.2,-2.5,3.1])for(const look of [-.8,0,.8])for(const zoom of [.65,1,1.7]){const ship={x:300,y:300,angle},h=angle+look,cam=shipCamera(1.4,view,ship,h,view==='first'?-.25:.32,zoom);assert(cam.eye.every(Number.isFinite)&&cam.eye[1]>0);const p={x:ship.x+Math.cos(h)*260,y:ship.y+Math.sin(h)*260},q=project(cam.vp,world(p.x,p.y),1000,1000/1.4);assert(q,`${view} sees water ahead`);const r=groundPoint(cam.inv,q.x,q.y,1000,1000/1.4);assert(Math.hypot(r.x-p.x,r.y-p.y)<.5,`${view} roundtrip`);shipRoundtrips++;}
const b=new Battle();b.enemy.bleed=4;for(let i=0;i<9;i++)b.addPool(620+i*14,330-i*7,.4);b.activateSkills(['stake','lance','guard']);b.mode='running';b.time=1;b.enemyWindup();b.entry={x:280,y:490};const scene=buildScene(b,'lance',true);
for(const o of [...scene.solid,...scene.transparent]){assert(meshes[o.mesh]);assert(o.model.every(Number.isFinite));assert([...normalMatrix(o.model)].every(Number.isFinite));assert(o.color.every(Number.isFinite));}
// Every telegraph phase of the slam must stay invertible (a zero-radius ring breaks normalMatrix).
const slam=new Battle();slam.mode='running';slam.enemy.form=2;slam.enemy.attackCount=1;slam.enemyWindup();for(const age of [0,1.7,3.399,3.4]){slam.enemy.attack.age=age;const s2=buildScene(slam);for(const o of [...s2.solid,...s2.transparent])assert(normalMatrix(o.model),`slam telegraph at ${age}s`)}
slam.enemyImpact(slam.enemy.attack);for(const age of [0,.45,.89]){slam.effects.forEach(f=>f.age=age);const s3=buildScene(slam);for(const o of [...s3.solid,...s3.transparent])assert(normalMatrix(o.model),`slam impact at ${age}s`)}
// 眷属の群れ（4体の泳ぎ・飛びかかり・薙ぎ払い・沈没・撃破後の沈み）と砲撃（砲弾・閃光・水柱）と航跡：全モデルが有限値で逆行列を持つ。
{const ok=sc=>{for(const o of [...sc.solid,...sc.transparent]){assert(meshes[o.mesh]);assert(o.model.every(Number.isFinite));assert(normalMatrix(o.model),'invertible');assert(o.color.every(Number.isFinite));assert(Number.isFinite(o.glow))}};
 const eyes=sc=>sc.solid.filter(o=>o.color[0]===1&&o.color[1]===.62&&o.glow>1).length;
 const k=new Battle({enemyKind:'kin',fleet:['lance','stake','escort','escort'],auto:true,island:false});k.start();k.ships.forEach((x,i)=>{x.x=k.enemy.x-210;x.y=k.enemy.y+(i-1.5)*60});
 assert(eyes(buildScene(k))>=8,'4 glowing-eyed monsters');let kinds=new Set();
 k.ships.forEach(x=>x.x-=190);k.enemy.nextAttack=0;for(let i=0;i<30;i++){k.step(.025);for(const f of k.effects)kinds.add(f.type);ok(buildScene(k))}k.ships.forEach(x=>x.x+=190);k.enemy.nextAttack=3;
 for(let i=0;i<520;i++){k.step(.025);for(const f of k.effects)kinds.add(f.type);if(i%13===0)ok(buildScene(k,'lance',true))}
 for(const t of ['muzzle','splash','leap'])assert(kinds.has(t),'effect '+t);
 const w=k.ships.find(x=>x.kind==='escort');assert(w.trail.length>3);
 for(const dmg of [110,110,110]){k.hitEnemy(dmg,'stake',k.ship('stake'));for(const age of [0,.5,1.2]){k.effects.forEach(f=>f.age=Math.min(f.age,age));ok(buildScene(k))}}
 k.after+=2;assert.equal(eyes(buildScene(k)),2*swarmAlive(k.enemy),'eyes follow the living monsters');assert(swarmAlive(k.enemy)<4);
 k.hitEnemy(1e4,'stake',k.ship('stake'));assert.equal(k.mode,'ended');for(let i=0;i<60;i++){k.advancePresentation(.05);ok(buildScene(k))}assert.equal(eyes(buildScene(k)),0,'all sunk');
 const n=new Battle({auto:true});n.start();n.hitEnemy(1e5,'stake',n.ship('stake'));for(let i=0;i<40;i++){n.advancePresentation(.05);ok(buildScene(n))}}
for(const g of Object.values(meshes)){assert.equal(g.vertices.length,g.normals.length);assert.equal(g.vertices.length%9,0);assert(g.vertices.every(Number.isFinite));}
// 戦略マップ：全モデルが有限値で、法線行列が逆行列を持つ。艦隊の選択・移動先・敵の出現・島の包囲の各状態を含める。
{const st=new Strategy();st.order('main',900,700);st.enemy('kin3').active=true;st.enemy('nephilim').x=LAMP.x+LAMP.r+30;st.enemy('nephilim').y=LAMP.y;st.enemy('nephilim').siege=true;st.fleet('detached').ships[1].hp=0;
 for(const [now,sel] of [[0,'main'],[1.3,'detached'],[5,null]]){const ms=buildMapScene(st,{selected:sel,now});assert(ms.solid.length>100);for(const o of [...ms.solid,...ms.transparent]){assert(meshes[o.mesh]);assert(o.model.every(Number.isFinite));assert(normalMatrix(o.model).every(Number.isFinite));assert(o.color.every(Number.isFinite));assert(Number.isFinite(o.glow))}}
 const e=new Strategy();assert(buildMapScene(e).solid.length>0);
 // 非active（kin3）は描かない：敵の数だけ影の円盤が増えることで確かめる。
 const count=s=>buildMapScene(s).transparent.filter(o=>o.mesh==='disc'&&o.color[3]===.32).length;assert.equal(count(e),3);assert.equal(count(st),4);
 const p=mapFromGround({x:mapWorld(1234,567)[0]+500,y:mapWorld(1234,567)[2]+325});assert(Math.hypot(p.x-1234,p.y-567)<1e-6)}
const camera=cameraState(1000/720),data={width:1000,height:720,scene,camera:{eye:camera.eye,vp:Array.from(camera.vp)},meshes:Object.fromEntries(Object.entries(meshes).map(([k,v])=>[k,{vertices:v.vertices,normals:v.normals}])),normals:[...scene.solid,...scene.transparent].map(o=>Array.from(normalMatrix(o.model))),blood:Array.from(bloodTexture(b)),vertexShader,fragmentShader};
writeFileSync('/tmp/minnezang-3d-scene.json',JSON.stringify(data));
console.log(JSON.stringify({coordinateRoundtrips:roundtrips,flagshipRoundtrips:shipRoundtrips,objects:scene.solid.length+scene.transparent.length,meshes:Object.keys(meshes).length,bloodPixels:data.blood.length/4}));
