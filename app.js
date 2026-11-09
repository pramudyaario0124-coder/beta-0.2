(() => {
"use strict";
const $ = s => document.querySelector(s);
const state = {clips:[], selected:-1, offset:0, playing:false, raf:0, startedAt:0, ratio:"9:16", fit:"Isi", zoom:1, tool:"clip", audioUrl:null, audioName:"", audio:null, exportCancel:false};
const canvas=$("#preview"), ctx=canvas.getContext("2d"), fileInput=$("#fileInput");
let toastTimer=null, exportRecorder=null, exportStream=null;
const fmt = n => {n=Math.max(0,Number(n)||0);return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(Math.floor(n%60)).padStart(2,"0")}`};
const clipDuration = c => Math.max(0.05,(c.end-c.start)/c.rate);
const totalDuration = () => state.clips.reduce((sum,c)=>sum+clipDuration(c),0);
const selected = () => state.clips[state.selected] || null;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2400)}
function setStatus(text){$("#saveState").textContent=text}
function resizeCanvas(){const [w,h]=state.ratio.split(":").map(Number);canvas.width=720;canvas.height=Math.round(720*h/w);drawFrame()}
function updateLabels(){
 const total=totalDuration();$("#clipCount").textContent=`${state.clips.length} klip`;
 $("#timeReadout").textContent=`${fmt(state.offset)} / ${fmt(total)}`;$("#currentTime").textContent=fmt(state.offset);
 $("#timelineHint").textContent=selected()?selected().name:"Pilih klip untuk mengedit";
 $("#rulerMid").textContent=fmt(total/2);$("#rulerEnd").textContent=fmt(total);
}
function locate(globalTime){
 let t=Math.max(0,globalTime);
 for(let i=0;i<state.clips.length;i++){const c=state.clips[i],d=clipDuration(c);if(t<d || i===state.clips.length-1)return {clip:c,index:i,sourceTime:c.start+Math.min(t,d)*c.rate};t-=d}
 return null;
}
function drawFrame(){
 ctx.fillStyle="#08090b";ctx.fillRect(0,0,canvas.width,canvas.height);
 const item=locate(state.offset);
 if(item){const c=item.clip,v=c.video;
  if(v.readyState>=2){try{if(Math.abs(v.currentTime-item.sourceTime)>.08)v.currentTime=item.sourceTime}catch(e){}
   const cw=canvas.width,ch=canvas.height,ratio=(v.videoWidth||9)/(v.videoHeight||16),cr=cw/ch;
   let w,h;if(state.fit==="Isi"){w= Math.max(cw,ch*ratio);h=Math.max(ch,cw/ratio)}else{w=ratio>cr?cw:ch*ratio;h=ratio>cr?cw/ratio:ch}
   ctx.save();ctx.filter=`${c.filter} brightness(${c.brightness}%) contrast(${c.contrast}%) saturate(${c.saturation}%)`;
   ctx.drawImage(v,(cw-w)/2,(ch-h)/2,w,h);ctx.restore();
   if(c.text){ctx.save();const size=c.textSize;ctx.font=`700 ${size}px system-ui`;ctx.textAlign="center";ctx.textBaseline="middle";const y=c.textPosition==="Atas"?ch*.13:c.textPosition==="Tengah"?ch*.5:ch*.86;ctx.lineWidth=Math.max(3,size*.09);ctx.strokeStyle="#000";ctx.fillStyle=c.textColor;ctx.strokeText(c.text,cw/2,y,cw-48);ctx.fillText(c.text,cw/2,y,cw-48);ctx.restore()}
  }
 }
 updateLabels();
}
function renderTimeline(){
 const box=$("#timeline");box.innerHTML="";
 if(!state.clips.length){box.innerHTML='<div class="timeline-empty">Klip yang diimpor akan muncul di sini</div>';return}
 state.clips.forEach((c,i)=>{const b=document.createElement("button");b.className="clip"+(i===state.selected?" selected":"");b.type="button";
  const index=document.createElement("span");index.className="clip-index";index.textContent=String(i+1);
  const name=document.createElement("strong");name.textContent=c.name;
  const meta=document.createElement("small");meta.textContent=`${fmt(clipDuration(c))} · video`;
  b.append(index,name,meta);b.style.flexBasis=`${Math.max(95,118*state.zoom)}px`;b.onclick=()=>selectClip(i);box.appendChild(b);
 });
}
function selectClip(i){state.selected=i;renderTimeline();renderTool();drawFrame();$("#emptyState").classList.add("hidden");$("#selectedName").textContent=selected()?.name||"Belum ada klip"}
function addFiles(files){
 const videos=[...files].filter(f=>f.type.startsWith("video/"));
 if(!videos.length){toast("Pilih file video terlebih dahulu.");return}
 let pending=videos.length;
 videos.forEach(file=>{
  const url=URL.createObjectURL(file),v=document.createElement("video");v.src=url;v.muted=true;v.playsInline=true;v.preload="metadata";
  v.addEventListener("loadedmetadata",()=>{
   const duration=Number.isFinite(v.duration)?v.duration:0;
   state.clips.push({file,url,video:v,name:file.name,duration,start:0,end:duration,rate:1,brightness:100,contrast:100,saturation:100,filter:"none",text:"",textColor:"#ffffff",textSize:44,textPosition:"Bawah"});
   if(state.selected<0)state.selected=0;pending--;if(pending===0){renderTimeline();selectClip(state.selected);setStatus("Perubahan lokal");toast(`${videos.length} video ditambahkan`)}
  },{once:true});
  v.addEventListener("error",()=>{pending--;URL.revokeObjectURL(url);toast(`Tidak bisa membaca ${file.name}`)},{once:true});
 });
}
function controlRow(label,control,output=""){return `<div class="control-row"><label>${label}</label>${control}${output?`<output>${output}</output>`:""}</div>`}
function renderTool(){
 const c=selected(),host=$("#toolEditor");
 if(!c){host.innerHTML='<div class="editor-placeholder">Impor video, lalu pilih klip di timeline untuk membuka pengaturannya.</div>';return}
 const tool=state.tool;
 if(tool==="clip"){
  host.innerHTML=controlRow("Awal klip",`<input id="trimStart" type="range" min="0" max="${Math.max(.1,c.duration)}" step=".1" value="${c.start}">`,fmt(c.start))+
   controlRow("Akhir klip",`<input id="trimEnd" type="range" min="${Math.max(.1,c.start+.1)}" max="${Math.max(.2,c.duration)}" step=".1" value="${c.end}">`,fmt(c.end))+
   `<div class="control-actions"><button class="btn btn-secondary" id="splitClip">Potong di posisi playhead</button><button class="btn btn-secondary" id="deleteClip">Hapus klip</button></div>`;
  $("#trimStart").oninput=e=>{c.start=Math.min(Number(e.target.value),c.end-.1);e.target.nextElementSibling.textContent=fmt(c.start);state.offset=Math.min(state.offset,totalDuration());renderTimeline();drawFrame();setStatus("Belum disimpan")};
  $("#trimEnd").oninput=e=>{c.end=Math.max(Number(e.target.value),c.start+.1);e.target.nextElementSibling.textContent=fmt(c.end);renderTimeline();drawFrame();setStatus("Belum disimpan")};
  $("#deleteClip").onclick=()=>removeClip(state.selected);
  $("#splitClip").onclick=splitClip;
 }else if(tool==="adjust"){
  host.innerHTML=controlRow("Filter",`<select id="filter"><option value="none">Asli</option><option value="grayscale(1)">Hitam putih</option><option value="sepia(.75)">Sepia</option><option value="saturate(1.4)">Vivid</option><option value="contrast(1.2) saturate(1.1)">Dramatis</option><option value="hue-rotate(18deg) saturate(1.2)">Hangat</option></select>`)+
   controlRow("Cerah",`<input id="bright" type="range" min="50" max="150" value="${c.brightness}">`,c.brightness+"%")+
   controlRow("Kontras",`<input id="contrast" type="range" min="50" max="150" value="${c.contrast}">`,c.contrast+"%")+
   controlRow("Saturasi",`<input id="saturation" type="range" min="0" max="200" value="${c.saturation}">`,c.saturation+"%");
  $("#filter").value=c.filter;
  $("#filter").onchange=e=>{c.filter=e.target.value;drawFrame();setStatus("Belum disimpan")};
  [["bright","brightness"],["contrast","contrast"],["saturation","saturation"]].forEach(([id,key])=>$("#"+id).oninput=e=>{c[key]=Number(e.target.value);e.target.nextElementSibling.textContent=c[key]+"%";drawFrame();setStatus("Belum disimpan")});
 }else if(tool==="text"){
  host.innerHTML=controlRow("Teks",`<input class="full" id="overlayText" type="text" maxlength="80" placeholder="Tulis teks di video…" value="${escapeHtml(c.text)}">`)+
   controlRow("Posisi",`<select id="textPosition"><option>Atas</option><option>Tengah</option><option>Bawah</option></select>`)+
   controlRow("Ukuran",`<input id="textSize" type="range" min="20" max="88" value="${c.textSize}">`,c.textSize+" px")+
   controlRow("Warna",`<select id="textColor"><option value="#ffffff">Putih</option><option value="#ffe16b">Kuning</option><option value="#ff82b2">Pink</option></select>`);
  $("#textPosition").value=c.textPosition;$("#textColor").value=c.textColor;
  $("#overlayText").oninput=e=>{c.text=e.target.value;drawFrame();setStatus("Belum disimpan")};
  $("#textPosition").onchange=e=>{c.textPosition=e.target.value;drawFrame()};
  $("#textColor").onchange=e=>{c.textColor=e.target.value;drawFrame()};
  $("#textSize").oninput=e=>{c.textSize=Number(e.target.value);e.target.nextElementSibling.textContent=c.textSize+" px";drawFrame()};
 }else if(tool==="speed"){
  host.innerHTML=controlRow("Kecepatan",`<select id="speed"><option value=".5">0.5×</option><option value=".75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>`)+`<p class="subtle">Durasi klip pada timeline ikut berubah sesuai kecepatan.</p>`;
  $("#speed").value=String(c.rate);$("#speed").onchange=e=>{c.rate=Number(e.target.value);renderTimeline();drawFrame();setStatus("Belum disimpan")};
 }else{
  host.innerHTML=`<p class="subtle">Audio terpisah untuk musik latar masih dalam tahap beta. File audio yang dipilih akan dipakai sebagai musik saat ekspor.</p><div class="control-actions"><button class="btn btn-secondary" id="pickAudio">＋ Pilih musik</button><button class="btn btn-secondary" id="removeAudio">Hapus musik</button></div><p class="subtle" id="audioName">${state.audioName||"Belum ada musik"}</p>`;
  $("#pickAudio").onclick=()=>$("#audioInput").click();$("#removeAudio").onclick=()=>{if(state.audioUrl)URL.revokeObjectURL(state.audioUrl);state.audioUrl=null;state.audioName="";state.audio=null;renderTool();toast("Musik dihapus")};
 }
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function removeClip(i){const c=state.clips[i];if(!c)return;URL.revokeObjectURL(c.url);state.clips.splice(i,1);state.selected=Math.min(state.selected,state.clips.length-1);state.offset=Math.min(state.offset,totalDuration());renderTimeline();renderTool();drawFrame();$("#emptyState").classList.toggle("hidden",state.clips.length>0);$("#selectedName").textContent=selected()?.name||"Belum ada klip";setStatus("Belum disimpan")}
function splitClip(){
 const item=locate(state.offset),c=selected();if(!item||!c||item.clip!==c){toast("Geser playhead ke dalam klip yang dipilih.");return}
 const cut=item.sourceTime;if(cut<=c.start+.15||cut>=c.end-.15){toast("Posisi potong terlalu dekat dengan tepi klip.");return}
 const second={...c,start:cut,video:c.video,url:c.url,file:c.file,name:c.name+" (potongan 2)"};
 c.end=cut;state.clips.splice(state.selected+1,0,second);state.selected++;renderTimeline();renderTool();drawFrame();toast("Klip berhasil dipisah");
}
function play(){
 if(!state.clips.length){toast("Impor video dulu.");return}
 if(state.playing){state.playing=false;cancelAnimationFrame(state.raf);$("#playBtn").textContent="▶";return}
 if(state.offset>=totalDuration())state.offset=0;
 state.playing=true;state.startedAt=performance.now()-state.offset*1000;$("#playBtn").textContent="Ⅱ";
 const tick=now=>{if(!state.playing)return;state.offset=(now-state.startedAt)/1000;if(state.offset>=totalDuration()){state.offset=totalDuration();state.playing=false;$("#playBtn").textContent="▶"}drawFrame();if(state.playing)state.raf=requestAnimationFrame(tick)};
 state.raf=requestAnimationFrame(tick);
}
function showTool(name){state.tool=name;document.querySelectorAll(".tool").forEach(b=>b.classList.toggle("active",b.dataset.tool===name));renderTool()}
function openExport(){if(!state.clips.length){toast("Tambahkan video dulu.");return}$("#exportModal").classList.remove("hidden");$("#exportStatus").textContent="Format keluaran WebM. Kompatibilitas bergantung browser."}
function stopExport(){state.exportCancel=true;if(exportRecorder&&exportRecorder.state!=="inactive")exportRecorder.stop();if(exportStream)exportStream.getTracks().forEach(t=>t.stop());$("#progressWrap").classList.add("hidden");$("#startExport").disabled=false;$("#startExport").textContent="Mulai ekspor"}
async function exportVideo(){
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast("Browser belum mendukung ekspor video.");return}
 const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));
 if(!mime){toast("Codec WebM tidak tersedia di browser ini.");return}
 const W=Number($("#resolution").value),fps=Number($("#fps").value),H=Math.round(W*canvas.height/canvas.width),out=document.createElement("canvas");out.width=W;out.height=H;
 const ox=out.getContext("2d"),stream=out.captureStream(fps);exportStream=stream;
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.max(1200000,W*W*2)});exportRecorder=recorder;
 const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 recorder.onstop=()=>{if(!state.exportCancel){const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="klip-studio-export.webm";a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);$("#exportStatus").textContent="Ekspor selesai. File WebM diunduh.";toast("Ekspor selesai")}stream.getTracks().forEach(t=>t.stop());exportStream=null;exportRecorder=null;$("#startExport").disabled=false;$("#startExport").textContent="Mulai ekspor";$("#progressWrap").classList.add("hidden");state.exportCancel=false};
 state.exportCancel=false;$("#startExport").disabled=true;$("#startExport").textContent="Mengekspor…";$("#progressWrap").classList.remove("hidden");recorder.start(250);
 const clips=state.clips.slice(),total=totalDuration();let elapsed=0;
 try{
  for(let i=0;i<clips.length;i++){
   if(state.exportCancel)break;
   const c=clips[i],v=c.video;v.pause();v.muted=true;v.playbackRate=c.rate;v.currentTime=c.start;await new Promise(resolve=>{if(v.readyState>=2)resolve();else v.addEventListener("loadeddata",resolve,{once:true})});await v.play().catch(()=>{});
   const duration=clipDuration(c),begin=performance.now();
   while(performance.now()-begin<duration*1000&&!state.exportCancel){
    const local=Math.min(duration,(performance.now()-begin)/1000),sourceT=c.start+local*c.rate;
    if(Math.abs(v.currentTime-sourceT)>.18){try{v.currentTime=sourceT}catch(e){}}
    ox.fillStyle="#000";ox.fillRect(0,0,W,H);
    const ratio=(v.videoWidth||9)/(v.videoHeight||16),cr=W/H;let dw,dh;if(state.fit==="Isi"){dw=Math.max(W,H*ratio);dh=Math.max(H,W/ratio)}else{dw=ratio>cr?W:H*ratio;dh=ratio>cr?W/ratio:H}
    if(v.readyState>=2){ox.save();ox.filter=`${c.filter} brightness(${c.brightness}%) contrast(${c.contrast}%) saturate(${c.saturation}%)`;ox.drawImage(v,(W-dw)/2,(H-dh)/2,dw,dh);ox.restore()}
    if(c.text){ox.save();ox.font=`700 ${Math.round(c.textSize*W/720)}px system-ui`;ox.textAlign="center";ox.textBaseline="middle";const y=c.textPosition==="Atas"?H*.13:c.textPosition==="Tengah"?H*.5:H*.86;ox.lineWidth=4;ox.strokeStyle="#000";ox.fillStyle=c.textColor;ox.strokeText(c.text,W/2,y,W-48);ox.fillText(c.text,W/2,y,W-48);ox.restore()}
    const pct=Math.min(99,Math.round((elapsed+local)/total*100));$("#progressBar").style.width=pct+"%";$("#progressLabel").textContent=`Mengekspor ${pct}% · klip ${i+1}/${clips.length}`;
    await new Promise(r=>setTimeout(r,Math.max(0,1000/fps)));
   }
   v.pause();elapsed+=duration;
  }
  if(!state.exportCancel){$("#progressBar").style.width="100%";$("#progressLabel").textContent="Menyelesaikan file…";setTimeout(()=>{if(recorder.state!=="inactive")recorder.stop()},300)}
  else if(recorder.state!=="inactive")recorder.stop();
 }catch(err){console.error(err);toast("Ekspor gagal. Coba resolusi lebih rendah.");if(recorder.state!=="inactive")recorder.stop()}
}
$("#importTop").onclick=$("#importEmpty").onclick=$("#addClip").onclick=$("#importBottom").onclick=()=>{fileInput.value="";fileInput.click()};
fileInput.onchange=e=>addFiles(e.target.files);
$("#audioInput").onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(state.audioUrl)URL.revokeObjectURL(state.audioUrl);state.audioUrl=URL.createObjectURL(f);state.audioName=f.name;state.audio=new Audio(state.audioUrl);state.audio.loop=true;renderTool();toast("Musik dipilih. Pencampuran musik saat ekspor belum aktif.")};
$("#playBtn").onclick=play;$("#ratioBtn").onclick=()=>{state.ratio=state.ratio==="9:16"?"16:9":state.ratio==="16:9"?"1:1":"9:16";$("#ratioBtn").textContent=state.ratio;resizeCanvas()};
$("#fitBtn").onclick=()=>{state.fit=state.fit==="Isi"?"Muat":"Isi";$("#fitBtn").textContent=state.fit;drawFrame()};
document.querySelectorAll(".tool").forEach(b=>b.onclick=()=>showTool(b.dataset.tool));
$("#zoomIn").onclick=()=>{state.zoom=Math.min(2.5,state.zoom+.25);renderTimeline()};$("#zoomOut").onclick=()=>{state.zoom=Math.max(.6,state.zoom-.25);renderTimeline()};
$("#exportBtn").onclick=$("#exportBottom").onclick=openExport;$("#closeModal").onclick=()=>$("#exportModal").classList.add("hidden");
$("#startExport").onclick=exportVideo;$("#cancelExport").onclick=()=>{if(exportRecorder){stopExport()}else $("#exportModal").classList.add("hidden")};
$("#newProject").onclick=()=>{if(!confirm("Mulai proyek baru? Semua klip di timeline akan dihapus."))return;state.clips.forEach(c=>URL.revokeObjectURL(c.url));state.clips=[];state.selected=-1;state.offset=0;state.playing=false;renderTimeline();renderTool();drawFrame();$("#emptyState").classList.remove("hidden");$("#selectedName").textContent="Belum ada klip";setStatus("Proyek baru")};
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
renderTimeline();renderTool();updateLabels();resizeCanvas();
})();