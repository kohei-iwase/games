export const vertexShader=`
precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uVP;
uniform mat3 uNormal;
uniform mediump float uTime;
uniform mediump float uWater;
varying highp vec3 vWorld;
varying highp vec3 vNormal;
void main(){
 vec4 p=uModel*vec4(aPosition,1.0);
 if(uWater>0.5) p.y+=sin(p.x*.022+uTime*.85)*1.2+cos(p.z*.03-uTime*.7)*.8;
 vWorld=p.xyz;vNormal=normalize(uNormal*aNormal);
 gl_Position=uVP*p;
}`;
export const fragmentShader=`
precision highp float;
varying highp vec3 vWorld;
varying highp vec3 vNormal;
uniform vec4 uColor;
uniform vec3 uEye;
uniform mediump float uTime;
uniform mediump float uWater;
uniform float uGlow;
uniform sampler2D uBlood;
void main(){
 vec3 light=normalize(vec3(-.5,1.0,.45));
 vec3 normal=normalize(vNormal);
 float lambert=max(dot(normal,light),0.0);
 vec3 base=uColor.rgb;
 if(uWater>.5){
  vec2 uv=(vWorld.xz+vec2(500.,325.))/vec2(1000.,650.);
  float blood=0.;if(uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.)blood=texture2D(uBlood,uv).r;
  float wave=sin(vWorld.x*.052+vWorld.z*.024+uTime)*cos(vWorld.z*.05-uTime*.55);
  base=mix(vec3(.032,.13,.17),vec3(.085,.235,.255),wave*.18+.42);
  base=mix(base,vec3(.45,.025,.095),blood*.82);
  normal=normalize(vec3(cos(vWorld.x*.035+uTime)*.085,1.,sin(vWorld.z*.045-uTime)*.08));
  vec3 h=normalize(light+normalize(uEye-vWorld));
  base+=vec3(.38,.57,.59)*pow(max(dot(normal,h),0.),100.)*.45;
  float crest=pow(max(0.,wave),12.)*.07;base+=vec3(crest);
 }
 vec3 color=base*(.43+.65*lambert)+base*uGlow;
 float rim=pow(1.-abs(dot(normal,normalize(uEye-vWorld))),3.);
 if(uWater<.5)color+=vec3(.08,.13,.16)*rim;
 float fog=smoothstep(1400.,2800.,distance(uEye,vWorld));
 color=mix(color,vec3(.035,.09,.13),fog);
 gl_FragColor=vec4(pow(max(color,vec3(0.)),vec3(.86)),uColor.a);
}`;
