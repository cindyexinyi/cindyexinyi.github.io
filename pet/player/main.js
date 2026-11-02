import * as T from './three.module.js';
const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,innerWidth/innerHeight,.001,10);camera.position.set(0,0,.30);
const renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
scene.add(new T.HemisphereLight(0xffffff,0xbbb5b8,1.7));for(const [x,y,z,p] of [[-.2,.3,.3,1.8],[.2,.1,.2,1]]){let l=new T.DirectionalLight(0xffffff,p);l.position.set(x,y,z);scene.add(l)}
const pivot=new T.Group();scene.add(pivot);
const b=await fetch('device.glb?v=2').then(async r=>{if(!r.ok)throw new Error('Model download failed');const total=Number(r.headers.get('content-length')),reader=r.body.getReader(),chunks=[];let loaded=0;while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;document.querySelector('#status').textContent=total?`Loading… ${Math.min(100,Math.round(loaded/total*100))}%`:`Loading… ${(loaded/1048576).toFixed(1)} MB`;}const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes.buffer;}),dv=new DataView(b);let off=12,j,bin;while(off<b.byteLength){let n=dv.getUint32(off,true),t=dv.getUint32(off+4,true);off+=8;if(t===0x4e4f534a)j=JSON.parse(new TextDecoder().decode(new Uint8Array(b,off,n)));else bin=b.slice(off,off+n);off+=n}
function acc(i){let a=j.accessors[i],v=j.bufferViews[a.bufferView],C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];return new C(bin,(v.byteOffset||0)+(a.byteOffset||0),a.count*({VEC3:3,VEC2:2,SCALAR:1}[a.type]))}
async function tex(i,srgb=false){let im=j.images[j.textures[i].source],v=j.bufferViews[im.bufferView],url=URL.createObjectURL(new Blob([bin.slice(v.byteOffset,v.byteOffset+v.byteLength)],{type:im.mimeType}));let t=await new T.TextureLoader().loadAsync(url);t.flipY=false;if(srgb)t.colorSpace=T.SRGBColorSpace;return t}
let mat=new T.MeshStandardMaterial({map:await tex(0,true),roughness:1,metalness:1,metalnessMap:await tex(1),roughnessMap:await tex(1),normalMap:await tex(2),side:T.DoubleSide});for(let p of j.meshes[0].primitives){let g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(acc(p.attributes.POSITION),3));g.setAttribute('normal',new T.BufferAttribute(acc(p.attributes.NORMAL),3));g.setAttribute('uv',new T.BufferAttribute(acc(p.attributes.TEXCOORD_0),2));g.setIndex(new T.BufferAttribute(acc(p.indices),1));pivot.add(new T.Mesh(g,mat))}pivot.position.y=-.06;
const shell=pivot.children[0], shellGeo=shell.geometry, positions=shellGeo.attributes.position;
// Separate the wings so resin transmission does not affect the opaque toy body.
const wingIndices=[],bodyIndices=[],sourceIndex=shellGeo.index.array;
// Use the source material's pink/blue boundary, rather than a spatial cut through the body.
const selectionCanvas=document.createElement('canvas'),selectionImage=mat.map.image;selectionCanvas.width=selectionImage.width;selectionCanvas.height=selectionImage.height;const selectionContext=selectionCanvas.getContext('2d',{willReadFrequently:true});selectionContext.drawImage(selectionImage,0,0);const selectionPixels=selectionContext.getImageData(0,0,selectionCanvas.width,selectionCanvas.height).data;
function wingColor(id){const uv=shellGeo.attributes.uv,u=Math.max(0,Math.min(selectionCanvas.width-1,Math.floor(uv.getX(id)*selectionCanvas.width))),v=Math.max(0,Math.min(selectionCanvas.height-1,Math.floor(uv.getY(id)*selectionCanvas.height))),o=(v*selectionCanvas.width+u)*4,r=selectionPixels[o],g=selectionPixels[o+1],b=selectionPixels[o+2];return g>=r*.95 && b>=r*.97;}
for(let i=0;i<sourceIndex.length;i+=3){const ids=[sourceIndex[i],sourceIndex[i+1],sourceIndex[i+2]];
 const x=ids.reduce((v,k)=>v+positions.getX(k),0)/3,y=ids.reduce((v,k)=>v+positions.getY(k),0)/3,z=ids.reduce((v,k)=>v+positions.getZ(k),0)/3;
 const isWing=Math.abs(x)>.023 && (z<.0065||Math.abs(x)>.035) && y>.008 && y<.068 && ids.filter(wingColor).length>=2;
 (isWing?wingIndices:bodyIndices).push(...ids);
}
shellGeo.setIndex(bodyIndices);
const wingGeo=new T.BufferGeometry();for(const key of ['position','normal','uv'])wingGeo.setAttribute(key,shellGeo.attributes[key]);wingGeo.setIndex(wingIndices);
const resin=new T.MeshPhysicalMaterial({map:mat.map,color:0xd0e9ed,metalness:0,roughness:.16,transmission:.38,thickness:.006,ior:1.46,attenuationColor:0xcfe8ed,attenuationDistance:.07,clearcoat:1,clearcoatRoughness:.1,side:T.DoubleSide});
// Studio softboxes produce clear highlights on the resin's rounded edges.
const studioCanvas=document.createElement('canvas');studioCanvas.width=512;studioCanvas.height=256;const studioContext=studioCanvas.getContext('2d');studioContext.fillStyle='#9aa4aa';studioContext.fillRect(0,0,512,256);studioContext.fillStyle='#ffffff';studioContext.fillRect(60,35,65,155);studioContext.fillRect(330,45,105,90);studioContext.fillStyle='#dcebf0';studioContext.fillRect(180,15,90,35);
const studioTexture=new T.CanvasTexture(studioCanvas);studioTexture.mapping=T.EquirectangularReflectionMapping;studioTexture.colorSpace=T.SRGBColorSpace;
const studioPMREM=new T.PMREMGenerator(renderer);resin.envMap=studioPMREM.fromEquirectangular(studioTexture).texture;resin.envMapIntensity=.3;
resin.onBeforeCompile=shader=>{
 shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_fragment>',`
 // Keep the colored decorations solid while the pale blue resin transmits light.
 float decoration=smoothstep(.09,.22,max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b)-min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b));
 material.transmission*=1.0-decoration*.9;
 #include <transmission_fragment>
 `);
};
pivot.add(new T.Mesh(wingGeo,resin));
const baseZ=(x,y)=>.0168-10*x*x-8*(y-.026)*(y-.026);
const centers=[[-.019,.016],[-.007,.012],[.007,.012],[.019,.016]];
for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);if(z<.007)continue;for(const [cx,cy] of centers){const r=Math.hypot(x-cx,y-cy);if(r<.0055){const w=1-T.MathUtils.smoothstep(r,.0045,.0055);positions.setZ(i,T.MathUtils.lerp(z,baseZ(x,y),w));break;}}}
positions.needsUpdate=true;
// Sample the existing pink plastic rather than guessing a different pink.
let closest=Infinity,pinkUV=new T.Vector2();for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);if(z<.008)continue;let d=x*x+(y-.021)*(y-.021);if(d<closest){closest=d;pinkUV.set(shellGeo.attributes.uv.getX(i),shellGeo.attributes.uv.getY(i));}}
const video=document.querySelector('video'),vt=new T.VideoTexture(video);vt.colorSpace=T.SRGBColorSpace;
// Apply video per fragment on the original mesh; retain the complete pink bezel.
const playing={value:0};
mat.onBeforeCompile=shader=>{
 shader.uniforms.shellPinkUV={value:pinkUV};shader.uniforms.petVideo={value:vt};shader.uniforms.petPlaying=playing;
 shader.vertexShader='varying vec3 petPosition;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n petPosition=position;');
 shader.fragmentShader='uniform mat3 normalMatrix; uniform vec2 shellPinkUV; uniform sampler2D petVideo; uniform float petPlaying; varying vec3 petPosition;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
 #include <color_fragment>
// Project stripe spacing along each curved antenna rather than along a world axis.
 float antennaDistance=10.0,antennaT=0.0;
 for(int side=0;side<2;side++){
 vec2 a=side==0?vec2(-.014,.073):vec2(.014,.073);
 vec2 c=side==0?vec2(-.027,.105):vec2(.026,.107);
 vec2 b=side==0?vec2(-.034,.070):vec2(.034,.062);
 for(int k=0;k<40;k++){
 float t0=float(k)/40.0,t1=float(k+1)/40.0;
 vec2 p0=(1.0-t0)*(1.0-t0)*a+2.0*(1.0-t0)*t0*c+t0*t0*b;
 vec2 p1=(1.0-t1)*(1.0-t1)*a+2.0*(1.0-t1)*t1*c+t1*t1*b;
 vec2 segment=p1-p0;float h=clamp(dot(petPosition.xy-p0,segment)/dot(segment,segment),0.0,1.0);
 float dist=length(petPosition.xy-p0-h*segment);
 if(dist<antennaDistance){antennaDistance=dist;antennaT=mix(t0,t1,h);}
 }
 }
 float antennaMask=(1.0-smoothstep(.003,.004,antennaDistance))*(1.0-smoothstep(-.001,.003,petPosition.z));
 float stripeWave=sin((antennaT*10.0+.15)*3.14159265);
 float stripe=smoothstep(-fwidth(stripeWave),fwidth(stripeWave),stripeWave);
 diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.025,.030,.031),vec3(.70,.76,.73),stripe),antennaMask);
 float buttonDistance=min(min(distance(petPosition.xy,vec2(-.019,.016)),distance(petPosition.xy,vec2(.019,.016))),min(distance(petPosition.xy,vec2(-.007,.012)),distance(petPosition.xy,vec2(.007,.012))));
 float repair=(1.0-smoothstep(.0045,.0055,buttonDistance))*step(.007,petPosition.z);
 diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(map,shellPinkUV).rgb,repair);
 float backPanel=step(petPosition.z,-0.010)*step(abs(petPosition.x),0.034)*step(0.010,petPosition.y)*step(petPosition.y,0.052);
 float neutralGrey=1.0-smoothstep(0.025,0.09,max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b)-min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.72,0.42,0.59),backPanel*neutralGrey);
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
 #include <emissivemap_fragment>
 vec3 leftBulb=(petPosition-vec3(-.030,.070,.005))/vec3(.009,.010,.012);
 vec3 rightBulb=(petPosition-vec3(.028,.058,.006))/vec3(.009,.010,.012);
 float bulbRegion=1.0-smoothstep(.85,1.15,min(length(leftBulb),length(rightBulb)));
 float bulbNeutral=1.0-smoothstep(.10,.22,max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b)-min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b));
 float bulbLight=bulbRegion*bulbNeutral*smoothstep(.22,.5,min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b));
 totalEmissiveRadiance+=vec3(1.0,.90,.68)*.32*bulbLight;
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
 #include <normal_fragment_maps>
 vec3 repairedNormal=normalize(normalMatrix*vec3(20.0*petPosition.x,16.0*(petPosition.y-.026),1.0));
 normal=normalize(mix(normal,repairedNormal,repair));
 normal=normalize(mix(normal,normalize(vNormal),antennaMask));
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`
 #include <metalnessmap_fragment>
 metalnessFactor=mix(metalnessFactor,0.0,repair);
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
 #include <roughnessmap_fragment>
 roughnessFactor=mix(roughnessFactor,.4,repair);
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`
 #include <colorspace_fragment>
 vec2 screenUV=(petPosition.xy-vec2(-0.01635,0.027))/vec2(0.03085,0.0292);
 vec2 q=abs(petPosition.xy-vec2(-0.000925,0.0416))-vec2(0.015425-0.001,0.0146-0.001);
 float d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-0.001;
 float mask=(1.0-smoothstep(-0.00004,0.00004,d))*step(0.012,petPosition.z)*petPlaying;
 // The source texture identifies pink plastic independently of the geometric mask.
 float pink=step(diffuseColor.g+0.035,diffuseColor.r);
 mask*=1.0-pink;
 gl_FragColor.rgb=mix(gl_FragColor.rgb,texture2D(petVideo,screenUV).rgb,mask);`);
};
mat.needsUpdate=true;
video.loop=false;
function startFilm(){
 if(playing.value && !video.paused){video.pause();return;}
 if(!playing.value){video.currentTime=0;playing.value=1;}
 video.play().catch(()=>{video.muted=true;video.play().catch(()=>{});});
}
video.addEventListener('ended',()=>{playing.value=0;video.pause();video.currentTime=0;});
const capMat=new T.MeshPhysicalMaterial({color:0xd88eaf,roughness:.32,metalness:0,clearcoat:.55,clearcoatRoughness:.22});
const rimMat=new T.MeshPhysicalMaterial({color:0xb96389,roughness:.35,metalness:0,clearcoat:.4});
const gapMat=new T.MeshStandardMaterial({color:0x843d5a,roughness:.6});
const profile=[[0,-.0003],[.0029,-.0003],[.0031,0],[.00317,.0008],[.0031,.00115],[.0028,.0014],[.002,.00158],[0,.00165]].map(p=>new T.Vector2(...p));
const capGeo=new T.LatheGeometry(profile,96);capGeo.rotateX(Math.PI/2);
const buttons=[];for(const [x,y] of centers){const holder=new T.Group();holder.position.set(x,y,baseZ(x,y)+.0001);holder.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(20*x,16*(y-.026),1).normalize());pivot.add(holder);
 const well=new T.Mesh(new T.CircleGeometry(.0037,96),gapMat);well.position.z=.00015;holder.add(well);
 const rim=new T.Mesh(new T.TorusGeometry(.0037,.0003,24,96),rimMat);rim.position.z=.0003;holder.add(rim);
 const cap=new T.Mesh(capGeo,capMat);cap.position.z=.00025;cap.userData.rest=.00025;cap.userData.depth=0;holder.add(cap);buttons.push(cap);
}
// A soft plastic switch click, created locally on each physical press.
let buttonAudio;
function playButtonClick(){
 const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
 try{
 buttonAudio??=new AudioContext();const ctx=buttonAudio;
 const sound=()=>{const now=ctx.currentTime,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.035),ctx.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*.006));
 const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=buffer;filter.type='bandpass';filter.frequency.value=1500;filter.Q.value=.7;gain.gain.setValueAtTime(.22,now);gain.gain.exponentialRampToValueAtTime(.001,now+.035);noise.connect(filter).connect(gain).connect(ctx.destination);noise.start(now);
 const body=ctx.createOscillator(),bodyGain=ctx.createGain();body.type='sine';body.frequency.setValueAtTime(280,now);body.frequency.exponentialRampToValueAtTime(110,now+.025);bodyGain.gain.setValueAtTime(.075,now);bodyGain.gain.exponentialRampToValueAtTime(.001,now+.03);body.connect(bodyGain).connect(ctx.destination);body.start(now);body.stop(now+.035);};
 if(ctx.state==='suspended')ctx.resume().then(sound).catch(()=>{});else sound();
 }catch{}
}
let zoom=1;
function updateZoom(){camera.position.z=(innerWidth<600?.49:.30)/zoom;camera.updateProjectionMatrix();}
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();zoom=T.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.001),.65,2.5);updateZoom();},{passive:false});
let pinchDistance=0;
renderer.domElement.addEventListener('touchstart',e=>{if(e.touches.length===2){down=null;activeButton=null;pinchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}},{passive:true});
renderer.domElement.addEventListener('touchmove',e=>{if(e.touches.length!==2)return;e.preventDefault();down=null;activeButton=null;const distance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(pinchDistance){zoom=T.MathUtils.clamp(zoom*distance/pinchDistance,.65,2.5);updateZoom();}pinchDistance=distance;},{passive:false});
renderer.domElement.addEventListener('touchend',()=>{pinchDistance=0;});
const ray=new T.Raycaster(),mouse=new T.Vector2();let down=null,moved=false,activeButton=null;
function buttonAt(e){mouse.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(mouse,camera);return ray.intersectObjects(buttons)[0]?.object;}
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};moved=false;activeButton=buttonAt(e)||null;if(activeButton)playButtonClick();renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!down){renderer.domElement.style.cursor=buttonAt(e)?'pointer':'grab';return;}const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.hypot(e.clientX-down.startX,e.clientY-down.startY)>5)moved=true;if(moved){activeButton=null;pivot.rotation.y+=dx*.008;pivot.rotation.x=Math.max(-1.4,Math.min(1.4,pivot.rotation.x+dy*.008));}down.x=e.clientX;down.y=e.clientY;});
renderer.domElement.addEventListener('pointerup',e=>{if(!moved&&activeButton)startFilm();activeButton=null;down=null;});
renderer.domElement.addEventListener('pointercancel',()=>{activeButton=null;down=null;});
document.querySelector('#reset').onclick=()=>{pivot.rotation.set(0,0,0);zoom=1;updateZoom();};document.querySelector('#status').remove();function resize(){camera.aspect=innerWidth/innerHeight;camera.position.z=(innerWidth<600?.49:.30)/zoom;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}addEventListener('resize',resize);resize();renderer.setAnimationLoop(()=>{for(const cap of buttons){cap.userData.depth+=((cap===activeButton?.0011:0)-cap.userData.depth)*.3;cap.position.z=cap.userData.rest-cap.userData.depth;}renderer.render(scene,camera);});
