import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Battle} from '../dist/battle.mjs';
import {cameraState,project,groundPoint,world,meshes,normalMatrix} from '../dist/space3d.mjs';
import {buildScene,bloodTexture} from '../dist/scene3d.mjs';
import {vertexShader,fragmentShader} from '../dist/shaders3d.mjs';
let roundtrips=0;
for(const aspect of [1,1.4,2])for(const yaw of [0,1.4,3.1])for(const elevation of [.48,.82,1.38])for(const zoom of [.65,1,1.7]){const cam=cameraState(aspect,yaw,elevation,zoom);for(const p of [{x:45,y:45},{x:930,y:580},{x:500,y:325},{x:300,y:490}]){const q=project(cam.vp,world(p.x,p.y),1000,1000/aspect);const r=groundPoint(cam.inv,q.x,q.y,1000,1000/aspect);assert(Math.hypot(r.x-p.x,r.y-p.y)<.3);roundtrips++;}}
const b=new Battle();b.enemy.bleed=4;for(let i=0;i<9;i++)b.addPool(620+i*14,330-i*7,.4);b.activateSkills(['stake','lance','guard']);b.mode='running';b.time=1;b.enemyWindup();b.entry={x:280,y:490};const scene=buildScene(b,'lance',true);
for(const o of [...scene.solid,...scene.transparent]){assert(meshes[o.mesh]);assert(o.model.every(Number.isFinite));assert([...normalMatrix(o.model)].every(Number.isFinite));assert(o.color.every(Number.isFinite));}
// Every telegraph phase of the slam must stay invertible (a zero-radius ring breaks normalMatrix).
const slam=new Battle();slam.mode='running';slam.enemy.form=2;slam.enemy.attackCount=1;slam.enemyWindup();for(const age of [0,1.7,3.399,3.4]){slam.enemy.attack.age=age;const s2=buildScene(slam);for(const o of [...s2.solid,...s2.transparent])assert(normalMatrix(o.model),`slam telegraph at ${age}s`)}
slam.enemyImpact(slam.enemy.attack);for(const age of [0,.45,.89]){slam.effects.forEach(f=>f.age=age);const s3=buildScene(slam);for(const o of [...s3.solid,...s3.transparent])assert(normalMatrix(o.model),`slam impact at ${age}s`)}
for(const g of Object.values(meshes)){assert.equal(g.vertices.length,g.normals.length);assert.equal(g.vertices.length%9,0);assert(g.vertices.every(Number.isFinite));}
const camera=cameraState(1000/720),data={width:1000,height:720,scene,camera:{eye:camera.eye,vp:Array.from(camera.vp)},meshes:Object.fromEntries(Object.entries(meshes).map(([k,v])=>[k,{vertices:v.vertices,normals:v.normals}])),normals:[...scene.solid,...scene.transparent].map(o=>Array.from(normalMatrix(o.model))),blood:Array.from(bloodTexture(b)),vertexShader,fragmentShader};
writeFileSync('/tmp/minnezang-3d-scene.json',JSON.stringify(data));
console.log(JSON.stringify({coordinateRoundtrips:roundtrips,objects:scene.solid.length+scene.transparent.length,meshes:Object.keys(meshes).length,bloodPixels:data.blood.length/4}));
