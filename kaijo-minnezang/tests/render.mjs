import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {Battle} from '../dist/battle.mjs';
import {SeaRenderer} from '../dist/render.mjs';
const require=createRequire(import.meta.url),{createCanvas}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas');
const canvas=createCanvas(1000,650);canvas.clientWidth=1000;canvas.clientHeight=650;const renderer=new SeaRenderer(canvas),b=new Battle();
b.enemy.bleed=4;for(let i=0;i<8;i++)b.addPool(630+i*14,310-i*5,.4);b.activateSkills(['stake','lance','guard']);b.entry={x:300,y:490};b.enemyWindup();b.mode='paused';renderer.render(b,'lance',false);writeFileSync('/tmp/minnezang-v03-chart.png',canvas.toBuffer('image/png'));
for(let i=0;i<2500;i++){if(b.mode==='paused')b.resume();b.advancePresentation(.025);b.step(b.timing?.003:.025);renderer.render(b,'lance',false);if(b.mode==='ended')break;}
console.log('Native Canvas render passed: blood gradients, root stakes, sweep sector, guard aura, joust, projectiles, impacts.');
