(function(){
  const T=window.OVDTemplates;
  const $=id=>document.getElementById(id);
  const deep=v=>JSON.parse(JSON.stringify(v));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rad=d=>d*Math.PI/180;
  const W=1000,H=650;
  const uid=()=>`o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const dpr=()=>Math.max(1,Math.min(2.5,window.devicePixelRatio||1));
  const canvas=$('designCanvas'),ctx=canvas.getContext('2d');
  const viewport=$('viewport'),holder=$('canvasHolder');

  let objects=[],selectedId=null,tool='select',showGrid=true,snap=true,gridSize=20,zoom=1,canvasBg='#f6f9fd';
  let action=null,start=null,preview=null,polyDraft=[],history=[],future=[];
  let isPlaying=false,animationTime=0,lastFrame=0,raf=0;

  const defaultAnimation=()=>({preset:'none',duration:4,amount:160,loop:true,delay:0});
  function selected(){return objects.find(o=>o.id===selectedId)||null;}
  function prepareObject(o){
    const n=deep(o);n.id=n.id||uid();n.x=n.x??W/2;n.y=n.y??H/2;n.w=Math.max(4,n.w||80);n.h=Math.max(4,n.h||80);n.baseW=n.baseW||n.w;n.baseH=n.baseH||n.h;n.rotation=n.rotation||0;n.fill=n.fill||'#5f67e8';n.stroke=n.stroke||'#26384f';n.strokeWidth=n.strokeWidth??1;n.opacity=n.opacity??1;n.shadow=n.shadow??false;n.shadowBlur=n.shadowBlur??14;n.shadowY=n.shadowY??7;n.animation={...defaultAnimation(),...(n.animation||{})};n.visible=n.visible!==false;n.locked=!!n.locked;return n;
  }
  function addObjects(list,name='Asset'){
    pushHistory();const prepared=list.map(prepareObject);objects.push(...prepared);selectedId=prepared[0]?.id||null;setTool('select');changed(`${name} added`);
  }
  function pushHistory(){history.push(deep({objects,canvasBg}));if(history.length>70)history.shift();future=[];}
  function restore(state){objects=deep(state.objects||[]).map(prepareObject);canvasBg=state.canvasBg||'#f6f9fd';selectedId=null;$('canvasColor').value=canvasBg;changed('History restored',false);}
  function undo(){if(!history.length)return;future.push(deep({objects,canvasBg}));restore(history.pop());}
  function redo(){if(!future.length)return;history.push(deep({objects,canvasBg}));restore(future.pop());}
  function autosave(){try{localStorage.setItem('openglDesignerSafayetV4',JSON.stringify({objects,canvasBg,projectName:$('projectName').value}));}catch(e){}}
  function loadAutosave(){try{const s=JSON.parse(localStorage.getItem('openglDesignerSafayetV4'));if(s){objects=(s.objects||[]).map(prepareObject);canvasBg=s.canvasBg||'#f6f9fd';$('projectName').value=s.projectName||'Untitled Design';$('canvasColor').value=canvasBg;}}catch(e){}}

  function resizeBacking(){
    const ratio=dpr(),scale=ratio*zoom;
    canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);canvas.style.width=`${W*zoom}px`;canvas.style.height=`${H*zoom}px`;holder.style.width=`${W*zoom}px`;holder.style.height=`${H*zoom}px`;
    ctx.setTransform(scale,0,0,scale,0,0);
  }
  function toCanvas(e){const r=canvas.getBoundingClientRect();let x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;if(snap){x=Math.round(x/gridSize)*gridSize;y=Math.round(y/gridSize)*gridSize;}return{x:clamp(x,0,W),y:clamp(y,0,H)};}
  function localPoint(o,p){const c=Math.cos(rad(-o.rotation)),s=Math.sin(rad(-o.rotation)),dx=p.x-o.x,dy=p.y-o.y;return{x:dx*c-dy*s,y:dx*s+dy*c};}
  function worldPoint(o,p){const c=Math.cos(rad(o.rotation)),s=Math.sin(rad(o.rotation));return{x:o.x+p.x*c-p.y*s,y:o.y+p.x*s+p.y*c};}
  function hexRgb(hex){const h=(hex||'#000000').replace('#','');const v=h.length===3?h.split('').map(c=>c+c).join(''):h;return{r:parseInt(v.slice(0,2),16)||0,g:parseInt(v.slice(2,4),16)||0,b:parseInt(v.slice(4,6),16)||0};}
  function rgba(hex,a=1){const c=hexRgb(hex);return`rgba(${c.r},${c.g},${c.b},${a})`;}
  function fillStyleFor(c,w,h,themeFill){const fill=c.theme?themeFill:(c.fill||themeFill||'#000');if(!c.fill2)return fill;const g=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);g.addColorStop(0,fill);g.addColorStop(1,c.fill2);return g;}
  function fillStyleOn(target,c,w,h,themeFill){const fill=c.theme?themeFill:(c.fill||themeFill||'#000');if(!c.fill2)return fill;const g=target.createLinearGradient(-w/2,-h/2,w/2,h/2);g.addColorStop(0,fill);g.addColorStop(1,c.fill2);return g;}
  function easeValue(p){return p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;}
  function animatedObject(base,time=animationTime){
    const o={...base},a={...defaultAnimation(),...(base.animation||{})};if(!a||a.preset==='none')return o;const duration=Math.max(.2,+a.duration||4),local=time-(+a.delay||0);if(local<0)return o;let p=a.loop?(local%duration)/duration:clamp(local/duration,0,1);const ep=easeValue(p),wave=Math.sin(p*Math.PI*2),amount=+a.amount||160;if(a.preset==='slide')o.x+=(ep-1)*amount;if(a.preset==='float')o.y-=wave*amount;if(a.preset==='bounce')o.y-=Math.abs(Math.sin(p*Math.PI))*amount;if(a.preset==='rotate')o.rotation+=ep*360;if(a.preset==='pulse'){const sc=1+wave*(amount/600);o.w*=sc;o.h*=sc;}if(a.preset==='blink')o.opacity*=.25+.75*(.5+.5*wave);return o;
  }

  function traceShape(target,type,w,h,points){
    target.beginPath();
    if(type==='rectangle'||type==='rect')target.rect(-w/2,-h/2,w,h);
    else if(type==='ellipse')target.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);
    else if(type==='triangle'){target.moveTo(0,-h/2);target.lineTo(-w/2,h/2);target.lineTo(w/2,h/2);target.closePath();}
    else if(type==='polygon'){const pts=points||[];if(pts.length){const px=p=>Array.isArray(p)?p[0]:p.x,py=p=>Array.isArray(p)?p[1]:p.y;target.moveTo(px(pts[0])*w,py(pts[0])*h);pts.slice(1).forEach(p=>target.lineTo(px(p)*w,py(p)*h));target.closePath();}}
  }
  function drawPrimitive(target,c,w,h,themeFill){
    target.save();target.translate(c.x||0,c.y||0);if(c.rotation)target.rotate(rad(c.rotation));target.globalAlpha*=c.opacity??1;target.lineCap='round';target.lineJoin='round';const cw=Math.max(.1,c.w??w),ch=Math.max(.1,c.h??h);target.strokeStyle=c.stroke||c.fill||themeFill||'#000';target.lineWidth=c.strokeWidth??0;target.fillStyle=fillStyleOn(target,c,cw,ch,themeFill);
    if(c.type==='line'){target.beginPath();target.moveTo(-cw/2,-ch/2);target.lineTo(cw/2,ch/2);target.stroke();}
    else if(c.type==='text'){target.fillStyle=c.theme?themeFill:(c.fill||themeFill);target.font=`700 ${c.fontSize||Math.max(12,ch)}px Inter,Segoe UI,Arial`;target.textAlign='center';target.textBaseline='middle';target.fillText(c.text||'Text',0,0);}
    else{traceShape(target,c.type,cw,ch,c.points);target.fill();if((c.strokeWidth??0)>0)target.stroke();}
    target.restore();
  }
  function drawObjectOn(target,base,selectedFlag=false,time=animationTime){
    if(base.visible===false)return;const o=animatedObject(base,time);target.save();target.translate(o.x,o.y);target.rotate(rad(o.rotation));target.globalAlpha=o.opacity??1;target.lineCap='round';target.lineJoin='round';if(o.shadow&&o.type!=='group'){target.shadowColor=rgba('#28456c',.20);target.shadowBlur=o.shadowBlur??14;target.shadowOffsetY=o.shadowY??7;}
    if(o.type==='group'){
      const sx=o.w/(o.baseW||o.w),sy=o.h/(o.baseH||o.h);target.scale(sx,sy);
      (o.children||[]).forEach(c=>drawPrimitive(target,c,o.baseW||o.w,o.baseH||o.h,o.fill));
    }else if(o.type==='line'||o.type==='freehand'){
      const pts=o.points||[];target.beginPath();if(pts.length){target.moveTo(pts[0].x*o.w,pts[0].y*o.h);pts.slice(1).forEach(p=>target.lineTo(p.x*o.w,p.y*o.h));}target.strokeStyle=o.stroke;target.lineWidth=o.strokeWidth;target.stroke();
    }else if(o.type==='text'){
      target.fillStyle=o.fill;target.font=`700 ${Math.max(12,o.h)}px Inter,Segoe UI,Arial`;target.textAlign='center';target.textBaseline='middle';target.fillText(o.text,0,0);
    }else{target.fillStyle=o.fill2?(()=>{const g=target.createLinearGradient(-o.w/2,-o.h/2,o.w/2,o.h/2);g.addColorStop(0,o.fill);g.addColorStop(1,o.fill2);return g;})():o.fill;target.strokeStyle=o.stroke;target.lineWidth=o.strokeWidth;traceShape(target,o.type,o.w,o.h,o.points);target.fill();if(o.strokeWidth>0)target.stroke();}
    target.restore();if(selectedFlag)drawSelection(target,o);
  }
  function drawSelection(target,o){
    const corners=[[-o.w/2,-o.h/2],[o.w/2,-o.h/2],[o.w/2,o.h/2],[-o.w/2,o.h/2]].map(([x,y])=>worldPoint(o,{x,y}));target.save();target.strokeStyle='#5369e9';target.lineWidth=1.6;target.setLineDash([7,5]);target.beginPath();target.moveTo(corners[0].x,corners[0].y);corners.slice(1).forEach(p=>target.lineTo(p.x,p.y));target.closePath();target.stroke();target.setLineDash([]);corners.forEach(p=>{target.fillStyle='#fff';target.strokeStyle='#5369e9';target.lineWidth=2;target.fillRect(p.x-5,p.y-5,10,10);target.strokeRect(p.x-5,p.y-5,10,10);});const top=worldPoint(o,{x:0,y:-o.h/2}),rot=worldPoint(o,{x:0,y:-o.h/2-32});target.beginPath();target.moveTo(top.x,top.y);target.lineTo(rot.x,rot.y);target.stroke();target.beginPath();target.arc(rot.x,rot.y,6,0,Math.PI*2);target.fillStyle='#fff';target.fill();target.stroke();target.restore();
  }
  function drawGrid(){if(!showGrid)return;ctx.save();ctx.strokeStyle='rgba(90,115,150,.12)';ctx.lineWidth=.8;for(let x=0;x<=W;x+=gridSize){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<=H;y+=gridSize){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.strokeStyle='rgba(70,95,130,.20)';ctx.lineWidth=1;for(let x=0;x<=W;x+=gridSize*5){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<=H;y+=gridSize*5){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.restore();}
  function drawDraft(){
    if(polyDraft.length){ctx.save();ctx.strokeStyle='#586be8';ctx.fillStyle='#586be8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(polyDraft[0].x,polyDraft[0].y);polyDraft.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));if(preview)ctx.lineTo(preview.x,preview.y);ctx.stroke();polyDraft.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,i===0?5:4,0,Math.PI*2);ctx.fill();});ctx.restore();}
    if(action?.kind==='draw'&&preview){const x=(start.x+preview.x)/2,y=(start.y+preview.y)/2,w=Math.max(1,Math.abs(preview.x-start.x)),h=Math.max(1,Math.abs(preview.y-start.y));ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(94,104,235,.16)';ctx.strokeStyle='#586be8';ctx.lineWidth=2;ctx.setLineDash([7,5]);if(tool==='line'){ctx.beginPath();ctx.moveTo(-w/2,-h/2);ctx.lineTo(w/2,h/2);ctx.stroke();}else{traceShape(ctx,tool,w,h);ctx.fill();ctx.stroke();}ctx.restore();}
    if(action?.kind==='freehand'){const pts=action.points||[];ctx.save();ctx.beginPath();if(pts.length){ctx.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));}ctx.strokeStyle='#243d67';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();ctx.restore();}
  }
  function redraw(exporting=false,target=ctx,time=animationTime){
    if(target===ctx){resizeBacking();ctx.clearRect(0,0,W,H);}target.save();target.fillStyle=canvasBg;target.fillRect(0,0,W,H);if(target===ctx&&!exporting)drawGrid();objects.forEach(o=>drawObjectOn(target,o,!exporting&&o.id===selectedId,time));if(target===ctx&&!exporting)drawDraft();target.restore();
  }

  function hit(o,p){if(o.visible===false||o.locked)return false;const l=localPoint(o,p);if(o.type==='ellipse')return(l.x*l.x)/(o.w*o.w/4)+(l.y*l.y)/(o.h*o.h/4)<=1;return Math.abs(l.x)<=o.w/2+5&&Math.abs(l.y)<=o.h/2+5;}
  function handleAt(o,p){const l=localPoint(o,p),hs=[{n:'nw',x:-o.w/2,y:-o.h/2},{n:'ne',x:o.w/2,y:-o.h/2},{n:'se',x:o.w/2,y:o.h/2},{n:'sw',x:-o.w/2,y:o.h/2}];for(const h of hs)if(Math.hypot(l.x-h.x,l.y-h.y)<12)return h.n;if(Math.hypot(l.x,l.y+o.h/2+32)<12)return'rotate';return null;}
  function normalizePoints(points){const xs=points.map(p=>p.x),ys=points.map(p=>p.y),l=Math.min(...xs),r=Math.max(...xs),t=Math.min(...ys),b=Math.max(...ys),w=Math.max(1,r-l),h=Math.max(1,b-t),cx=(l+r)/2,cy=(t+b)/2;return{x:cx,y:cy,w,h,points:points.map(p=>({x:(p.x-cx)/w,y:(p.y-cy)/h}))};}
  function makeShape(type,x,y,w,h,extra={}){return prepareObject({type,name:extra.name||type[0].toUpperCase()+type.slice(1),x,y,w,h,rotation:0,fill:extra.fill||'#7f95f5',fill2:extra.fill2||'#5f67e8',stroke:extra.stroke||'#354a69',strokeWidth:extra.strokeWidth??2,opacity:1,shadow:extra.shadow??true,points:extra.points||null,text:extra.text||'Text'});}
  function finishPolygon(){if(polyDraft.length<3){polyDraft=[];preview=null;changed('Polygon cancelled',false);return;}pushHistory();const n=normalizePoints(polyDraft);objects.push(makeShape('polygon',n.x,n.y,n.w,n.h,{points:n.points,fill:'#7f95f5'}));selectedId=objects.at(-1).id;polyDraft=[];preview=null;setTool('select');changed('Polygon finished');}
  function setTool(t){if(tool==='polygon'&&polyDraft.length&&t!=='polygon')finishPolygon();tool=t;document.querySelectorAll('.tool-button').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));const messages={select:'Select: click an object to move, resize or rotate it.',rectangle:'Rectangle: drag on the canvas.',ellipse:'Ellipse: drag on the canvas.',triangle:'Triangle: drag on the canvas.',line:'Line: drag from one point to another.',polygon:'Polygon: click points, then double-click or press Enter to finish.',freehand:'Freehand: drag to draw. The stroke appears live.',text:'Text: click the canvas and enter your text.'};$('statusText').textContent=messages[t]||'Ready';}

  canvas.addEventListener('mousedown',e=>{
    const p=toCanvas(e),o=selected();
    if(tool==='select'){
      if(o){const h=handleAt(o,p);if(h){pushHistory();action={kind:h==='rotate'?'rotate':'resize',handle:h,origin:deep(o),start:p};return;}}
      const target=[...objects].reverse().find(obj=>hit(obj,p));if(target){selectedId=target.id;pushHistory();action={kind:'move',start:p,origin:{x:target.x,y:target.y}};changed('Object selected',false);}else{selectedId=null;changed('Selection cleared',false);}return;
    }
    if(tool==='polygon'){polyDraft.push(p);preview=p;redraw();return;}
    if(tool==='text'){const value=prompt('Enter text:','OpenGL Design');if(value){pushHistory();objects.push(makeShape('text',p.x,p.y,Math.max(100,value.length*18),38,{text:value,fill:'#213451',fill2:null,strokeWidth:0,shadow:false}));selectedId=objects.at(-1).id;setTool('select');changed('Text added');}return;}
    if(tool==='freehand'){action={kind:'freehand',points:[p]};redraw();return;}
    start=p;preview=p;action={kind:'draw'};redraw();
  });
  canvas.addEventListener('mousemove',e=>{
    const p=toCanvas(e);$('mouseCoordinates').textContent=`Mouse: ${Math.round(p.x)}, ${Math.round(H-p.y)}`;
    if(tool==='polygon'&&polyDraft.length&&!action){preview=p;redraw();}
    if(!action)return;
    const o=selected();
    if(action.kind==='move'&&o){o.x=clamp(action.origin.x+(p.x-action.start.x),-o.w,W+o.w);o.y=clamp(action.origin.y+(p.y-action.start.y),-o.h,H+o.h);redraw();refreshPanels(false);}
    else if(action.kind==='rotate'&&o){o.rotation=Math.atan2(p.y-o.y,p.x-o.x)*180/Math.PI+90;redraw();refreshPanels(false);}
    else if(action.kind==='resize'&&o){const orig=action.origin,l=localPoint(orig,p),opposite={nw:{x:orig.w/2,y:orig.h/2},ne:{x:-orig.w/2,y:orig.h/2},se:{x:-orig.w/2,y:-orig.h/2},sw:{x:orig.w/2,y:-orig.h/2}}[action.handle],left=Math.min(l.x,opposite.x),right=Math.max(l.x,opposite.x),top=Math.min(l.y,opposite.y),bottom=Math.max(l.y,opposite.y),center=worldPoint(orig,{x:(left+right)/2,y:(top+bottom)/2});o.x=center.x;o.y=center.y;o.w=Math.max(12,right-left);o.h=Math.max(12,bottom-top);redraw();refreshPanels(false);}
    else if(action.kind==='draw'){preview=p;redraw();}
    else if(action.kind==='freehand'){const pts=action.points,prev=pts.at(-1);if(!prev||Math.hypot(p.x-prev.x,p.y-prev.y)>2)pts.push(p);redraw();}
  });
  window.addEventListener('mouseup',()=>{
    if(!action)return;const a=action;action=null;
    if(a.kind==='draw'&&start&&preview){const w=Math.abs(preview.x-start.x),h=Math.abs(preview.y-start.y);if(Math.max(w,h)>5){pushHistory();const x=(start.x+preview.x)/2,y=(start.y+preview.y)/2;if(tool==='line'){const dx=preview.x-start.x,dy=preview.y-start.y;objects.push(makeShape('line',x,y,Math.max(1,w),Math.max(1,h),{fill:'#243d67',fill2:null,stroke:'#243d67',strokeWidth:4,shadow:false,points:[{x:-.5*Math.sign(dx||1),y:-.5*Math.sign(dy||1)},{x:.5*Math.sign(dx||1),y:.5*Math.sign(dy||1)}]}));}else objects.push(makeShape(tool,x,y,w,h,{fill:'#7f95f5'}));selectedId=objects.at(-1).id;setTool('select');}start=null;preview=null;changed('Shape added');return;}
    if(a.kind==='freehand'){if(a.points.length>1){pushHistory();const n=normalizePoints(a.points);objects.push(makeShape('freehand',n.x,n.y,n.w,n.h,{points:n.points,fill:'#243d67',fill2:null,stroke:'#243d67',strokeWidth:4,shadow:false}));selectedId=objects.at(-1).id;setTool('select');changed('Freehand stroke added');return;}}
    changed('Object updated');
  });
  canvas.addEventListener('dblclick',e=>{if(tool==='polygon'){e.preventDefault();finishPolygon();}});

  function updateProperties(){
    const o=selected();$('canvasProperties').classList.toggle('hidden',!!o);$('objectProperties').classList.toggle('hidden',!o);$('selectionType').textContent=o?o.type:'Canvas';if(!o)return;$('propName').value=o.name;$('propX').value=Math.round(o.x);$('propY').value=Math.round(H-o.y);$('propW').value=Math.round(o.w);$('propH').value=Math.round(o.h);$('propRotation').value=Math.round(o.rotation);$('rotationOutput').textContent=`${Math.round(o.rotation)}°`;$('propFill').value=o.fill||'#5f67e8';$('propStroke').value=o.stroke||'#26384f';$('propStrokeWidth').value=o.strokeWidth;$('propOpacity').value=o.opacity;$('propShadow').checked=!!o.shadow;$('propAnimation').value=o.animation?.preset||'none';$('propDuration').value=o.animation?.duration||4;$('propAmount').value=o.animation?.amount||160;$('propLoop').checked=o.animation?.loop!==false;$('ungroupBtn').disabled=o.type!=='group';
  }
  function updateLayers(){
    $('layersList').innerHTML='';$('layerCount').textContent=objects.length;[...objects].reverse().forEach(o=>{const item=document.createElement('button');item.className='layer-item'+(o.id===selectedId?' selected':'');item.innerHTML=`<span class="layer-bullet"></span><span>${escapeHtml(o.name)}${o.type==='group'?` <span class="layer-meta">(${o.children?.length||0} parts)</span>`:''}</span><span class="layer-meta">${o.type}</span>`;item.onclick=()=>{selectedId=o.id;setTool('select');changed('Layer selected',false);};$('layersList').append(item);});
  }
  function refreshPanels(save=true){updateProperties();updateLayers();updateCodePreview();updateFooter();updateFloatingToolbar();if(save)autosave();}
  function changed(message='Ready',save=true){redraw();refreshPanels(save);$('footerState').textContent=message;}
  function updateFooter(){$('footerMeta').textContent=`Objects: ${objects.length} · Zoom: ${Math.round(zoom*100)}% · Grid: ${gridSize}`;$('zoomLabel').textContent=`${Math.round(zoom*100)}%`;}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

  function duplicateSelected(){const o=selected();if(!o)return;pushHistory();const copy=prepareObject(o);copy.id=uid();copy.name=`${o.name} Copy`;copy.x+=22;copy.y+=22;objects.push(copy);selectedId=copy.id;changed('Object duplicated');}
  function deleteSelected(){if(!selectedId)return;pushHistory();objects=objects.filter(o=>o.id!==selectedId);selectedId=null;changed('Object deleted');}
  function bringFront(){const o=selected();if(!o)return;pushHistory();objects=objects.filter(v=>v!==o);objects.push(o);changed('Brought to front');}
  function sendBack(){const o=selected();if(!o)return;pushHistory();objects=objects.filter(v=>v!==o);objects.unshift(o);changed('Sent to back');}
  function ungroupSelected(){
    const g=selected();if(!g||g.type!=='group')return;pushHistory();const sx=g.w/(g.baseW||g.w),sy=g.h/(g.baseH||g.h),out=[];(g.children||[]).forEach((c,i)=>{const lp={x:(c.x||0)*sx,y:(c.y||0)*sy},wp=worldPoint(g,lp),type=c.type==='rect'?'rectangle':c.type;const o=prepareObject({type,name:`${g.name} — Part ${i+1}`,x:wp.x,y:wp.y,w:Math.max(2,(c.w||2)*sx),h:Math.max(2,(c.h||2)*sy),rotation:g.rotation+(c.rotation||0),fill:c.theme?g.fill:(c.fill||g.fill),fill2:c.fill2||null,stroke:c.stroke||c.fill||g.stroke,strokeWidth:c.strokeWidth??0,opacity:g.opacity*(c.opacity??1),shadow:false,text:c.text,points:c.points?c.points.map(p=>Array.isArray(p)?{x:p[0],y:p[1]}:p):null});out.push(o);});objects=objects.filter(o=>o.id!==g.id);objects.push(...out);selectedId=out[0]?.id||null;changed(`${g.name} ungrouped into ${out.length} editable parts`);
  }

  function createFloatingToolbar(){
    const bar=document.createElement('div');bar.id='floatingToolbar';bar.className='floating-toolbar hidden';bar.innerHTML='<button data-act="duplicate">Duplicate</button><button data-act="front">Front</button><button data-act="back">Back</button><button data-act="delete" class="delete">Delete</button>';viewport.append(bar);bar.onclick=e=>{const a=e.target.dataset.act;if(a==='duplicate')duplicateSelected();if(a==='front')bringFront();if(a==='back')sendBack();if(a==='delete')deleteSelected();};
  }
  function updateFloatingToolbar(){const bar=$('floatingToolbar'),o=selected();if(!bar||!o){bar?.classList.add('hidden');return;}const r=canvas.getBoundingClientRect(),vr=viewport.getBoundingClientRect(),top=worldPoint(o,{x:0,y:-o.h/2-42});bar.style.left=`${r.left-vr.left+(top.x/W)*r.width}px`;bar.style.top=`${r.top-vr.top+(top.y/H)*r.height}px`;bar.classList.remove('hidden');}

  function setProp(id,fn){$(id).addEventListener('input',()=>{const o=selected();if(!o)return;fn(o,$(id));changed('Property updated');});}
  setProp('propName',(o,e)=>o.name=e.value||'Object');setProp('propX',(o,e)=>o.x=+e.value||0);setProp('propY',(o,e)=>o.y=H-(+e.value||0));setProp('propW',(o,e)=>o.w=Math.max(1,+e.value||1));setProp('propH',(o,e)=>o.h=Math.max(1,+e.value||1));setProp('propRotation',(o,e)=>{o.rotation=+e.value||0;$('rotationOutput').textContent=`${Math.round(o.rotation)}°`;});setProp('propFill',(o,e)=>o.fill=e.value);setProp('propStroke',(o,e)=>o.stroke=e.value);setProp('propStrokeWidth',(o,e)=>o.strokeWidth=Math.max(0,+e.value||0));setProp('propOpacity',(o,e)=>o.opacity=clamp(+e.value||1,.1,1));setProp('propShadow',(o,e)=>o.shadow=e.checked);setProp('propAnimation',(o,e)=>o.animation.preset=e.value);setProp('propDuration',(o,e)=>o.animation.duration=Math.max(.2,+e.value||4));setProp('propAmount',(o,e)=>o.animation.amount=Math.max(1,+e.value||160));setProp('propLoop',(o,e)=>o.animation.loop=e.checked);

  function renderAssets(){
    const q=$('assetSearch').value.trim().toLowerCase(),cat=$('assetCategory').value;const list=T.assets.filter(a=>(cat==='all'||a.category===cat)&&(!q||a.name.toLowerCase().includes(q)||a.category.includes(q)));$('assetCount').textContent=list.length;$('assetGrid').innerHTML='';$('assetEmpty').classList.toggle('hidden',list.length>0);list.forEach(asset=>{const card=document.createElement('button');card.className='asset-card';card.innerHTML=`<span class="asset-category-label">${asset.category}</span><div class="asset-preview"><canvas width="220" height="112"></canvas></div><div class="asset-name">${escapeHtml(asset.name)}</div>`;card.onclick=()=>addObjects(asset.factory(),asset.name);$('assetGrid').append(card);requestAnimationFrame(()=>drawAssetPreview(card.querySelector('canvas'),asset.factory()));});
  }
  function boundsOf(os){let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;os.forEach(o=>{l=Math.min(l,o.x-o.w/2);r=Math.max(r,o.x+o.w/2);t=Math.min(t,o.y-o.h/2);b=Math.max(b,o.y+o.h/2);});return{l,r,t,b,w:Math.max(1,r-l),h:Math.max(1,b-t)};}
  function drawAssetPreview(cnv,os){const pc=cnv.getContext('2d'),ratio=2;cnv.width=220*ratio;cnv.height=112*ratio;pc.setTransform(ratio,0,0,ratio,0,0);pc.clearRect(0,0,220,112);const bg=pc.createLinearGradient(0,0,0,112);bg.addColorStop(0,'#f9fcff');bg.addColorStop(1,'#eaf2fb');pc.fillStyle=bg;pc.fillRect(0,0,220,112);const bs=boundsOf(os),sc=Math.min(200/bs.w,96/bs.h),cx=(bs.l+bs.r)/2,cy=(bs.t+bs.b)/2;pc.save();pc.translate(110,56);pc.scale(sc,sc);pc.translate(-cx,-cy);os.forEach(o=>drawObjectOn(pc,prepareObject(o),false,0));pc.restore();}

  function f(v){return`${(+v||0).toFixed(2)}f`;}
  function rgbArgs(hex){const c=hexRgb(hex);return`${(c.r/255).toFixed(3)}f, ${(c.g/255).toFixed(3)}f, ${(c.b/255).toFixed(3)}f`;}
  function primitiveCode(c,themeFill,indent='        '){
    const fill=c.theme?themeFill:(c.fill||themeFill||'#000000'),fill2=c.fill2||null,w=c.w||1,h=c.h||1,op=c.opacity??1;let s=`${indent}glPushMatrix();\n${indent}glTranslatef(${f(c.x||0)}, ${f(-(c.y||0))}, 0.0f);\n${indent}glRotatef(${f(-(c.rotation||0))}, 0.0f, 0.0f, 1.0f);\n`;
    if(c.type==='rect'){s+=fill2?`${indent}drawGradientRect(${f(-w/2)}, ${f(-h/2)}, ${f(w)}, ${f(h)}, ${rgbArgs(fill)}, ${rgbArgs(fill2)}, ${f(op)});\n`:`${indent}drawRect(${f(-w/2)}, ${f(-h/2)}, ${f(w)}, ${f(h)}, ${rgbArgs(fill)}, ${f(op)});\n`;}
    else if(c.type==='ellipse'){s+=fill2?`${indent}drawGradientEllipse(0.0f, 0.0f, ${f(w/2)}, ${f(h/2)}, ${rgbArgs(fill)}, ${rgbArgs(fill2)}, ${f(op)});\n`:`${indent}drawEllipse(0.0f, 0.0f, ${f(w/2)}, ${f(h/2)}, ${rgbArgs(fill)}, ${f(op)});\n`;}
    else if(c.type==='triangle'){s+=`${indent}glColor4f(${rgbArgs(fill)}, ${f(op)});\n${indent}glBegin(GL_TRIANGLES);\n${indent}    glVertex2f(0.0f, ${f(h/2)});\n${indent}    glVertex2f(${f(-w/2)}, ${f(-h/2)});\n${indent}    glVertex2f(${f(w/2)}, ${f(-h/2)});\n${indent}glEnd();\n`;}
    else if(c.type==='polygon'){s+=`${indent}glColor4f(${rgbArgs(fill)}, ${f(op)});\n${indent}glBegin(GL_POLYGON);\n`;for(const p of c.points||[]){const px=Array.isArray(p)?p[0]:p.x,py=Array.isArray(p)?p[1]:p.y;s+=`${indent}    glVertex2f(${f(px*w)}, ${f(-py*h)});\n`;}s+=`${indent}glEnd();\n`;}
    else if(c.type==='line'){s+=`${indent}glColor4f(${rgbArgs(c.stroke||fill)}, ${f(op)});\n${indent}glLineWidth(${f(Math.max(1,c.strokeWidth??1))});\n${indent}glBegin(GL_LINES);\n${indent}    glVertex2f(${f(-w/2)}, ${f(h/2)});\n${indent}    glVertex2f(${f(w/2)}, ${f(-h/2)});\n${indent}glEnd();\n`;}
    else if(c.type==='text'){s+=`${indent}glColor4f(${rgbArgs(fill)}, ${f(op)});\n${indent}glRasterPos2f(${f(-w/2)}, 0.0f);\n${indent}drawText("${String(c.text||'Text').replace(/\\/g,'\\\\').replace(/"/g,'\\"')}");\n`;}
    s+=`${indent}glPopMatrix();\n`;return s;
  }
  function objectCode(o,index=0,fullTransform=true){
    const a={...defaultAnimation(),...(o.animation||{})},tag=`p${index}`;let x=f(o.x),y=f(H-o.y),rot=f(-o.rotation),scaleX='1.0f',scaleY='1.0f',prefix='';
    if(a.preset!=='none'){
      prefix=`    float ${tag} = animationProgress(animationTime, ${f(a.delay)}, ${f(a.duration)}, ${a.loop?'true':'false'});\n`;
      const wave=`sinf(${tag} * 6.2831853f)`;if(a.preset==='slide')x=`${f(o.x)} + (${tag} - 1.0f) * ${f(a.amount)}`;if(a.preset==='float')y=`${f(H-o.y)} + ${wave} * ${f(a.amount)}`;if(a.preset==='bounce')y=`${f(H-o.y)} + fabsf(sinf(${tag} * 3.1415926f)) * ${f(a.amount)}`;if(a.preset==='rotate')rot=`${f(-o.rotation)} - ${tag} * 360.0f`;if(a.preset==='pulse'){scaleX=scaleY=`1.0f + ${wave} * ${(+a.amount/600).toFixed(3)}f`;}
    }
    let s=prefix+`    // ${o.name}\n    glPushMatrix();\n    glTranslatef(${x}, ${y}, 0.0f);\n    glRotatef(${rot}, 0.0f, 0.0f, 1.0f);\n`;
    if(o.type==='group'){s+=`    glScalef(${f(o.w/(o.baseW||o.w))}, ${f(o.h/(o.baseH||o.h))}, 1.0f);\n`;for(const c of o.children||[])s+=primitiveCode(c,o.fill,'    ');}
    else if(o.type==='line'||o.type==='freehand'){s+=`    glColor4f(${rgbArgs(o.stroke)}, ${f(o.opacity)});\n    glLineWidth(${f(o.strokeWidth)});\n    glBegin(${o.type==='line'?'GL_LINES':'GL_LINE_STRIP'});\n`;for(const p of o.points||[])s+=`        glVertex2f(${f(p.x*o.w)}, ${f(-p.y*o.h)});\n`;s+=`    glEnd();\n`;}
    else if(o.type==='text'){s+=`    glColor4f(${rgbArgs(o.fill)}, ${f(o.opacity)});\n    glRasterPos2f(${f(-o.w/2)}, 0.0f);\n    drawText("${String(o.text).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}");\n`;}
    else s+=primitiveCode({type:o.type,x:0,y:0,w:o.w,h:o.h,points:o.points,fill:o.fill,fill2:o.fill2,stroke:o.stroke,strokeWidth:o.strokeWidth,opacity:o.opacity},o.fill,'    ');
    s+=`    glPopMatrix();\n`;return s;
  }
  function helpersCode(){return`void drawRect(float x, float y, float w, float h, float r, float g, float b, float a) {\n    glColor4f(r, g, b, a);\n    glBegin(GL_QUADS);\n    glVertex2f(x, y); glVertex2f(x + w, y); glVertex2f(x + w, y + h); glVertex2f(x, y + h);\n    glEnd();\n}\n\nvoid drawGradientRect(float x, float y, float w, float h, float r1, float g1, float b1, float r2, float g2, float b2, float a) {\n    const int strips = 24;\n    for (int i = 0; i < strips; ++i) {\n        float t1 = static_cast<float>(i) / strips;\n        float t2 = static_cast<float>(i + 1) / strips;\n        float cr1 = r1 + (r2 - r1) * t1, cg1 = g1 + (g2 - g1) * t1, cb1 = b1 + (b2 - b1) * t1;\n        float cr2 = r1 + (r2 - r1) * t2, cg2 = g1 + (g2 - g1) * t2, cb2 = b1 + (b2 - b1) * t2;\n        glBegin(GL_QUADS);\n        glColor4f(cr1, cg1, cb1, a); glVertex2f(x + w * t1, y); glVertex2f(x + w * t1, y + h);\n        glColor4f(cr2, cg2, cb2, a); glVertex2f(x + w * t2, y + h); glVertex2f(x + w * t2, y);\n        glEnd();\n    }\n}\n\nvoid drawEllipse(float x, float y, float rx, float ry, float r, float g, float b, float a) {\n    glColor4f(r, g, b, a);\n    glBegin(GL_TRIANGLE_FAN);\n    glVertex2f(x, y);\n    for (int i = 0; i <= 100; ++i) {\n        float angle = 2.0f * 3.1415926f * static_cast<float>(i) / 100.0f;\n        glVertex2f(x + cosf(angle) * rx, y + sinf(angle) * ry);\n    }\n    glEnd();\n}\n\nvoid drawGradientEllipse(float x, float y, float rx, float ry, float r1, float g1, float b1, float r2, float g2, float b2, float a) {\n    glBegin(GL_TRIANGLE_FAN);\n    glColor4f(r1, g1, b1, a); glVertex2f(x, y);\n    glColor4f(r2, g2, b2, a);\n    for (int i = 0; i <= 100; ++i) {\n        float angle = 2.0f * 3.1415926f * static_cast<float>(i) / 100.0f;\n        glVertex2f(x + cosf(angle) * rx, y + sinf(angle) * ry);\n    }\n    glEnd();\n}\n\nvoid drawText(const char* text) {\n    for (const char* c = text; *c; ++c) glutBitmapCharacter(GLUT_BITMAP_HELVETICA_18, *c);\n}\n`;}
  function fullCode(){
    const bg=hexRgb(canvasBg),animated=objects.some(o=>(o.animation?.preset||'none')!=='none'),body=objects.filter(o=>o.visible!==false).map((o,i)=>objectCode(o,i)).join('\n');return`/*\n  Project: ${$('projectName').value}\n  Generated by OpenGL Visual Designer\n  Developed by Safayet Ullah\n  Department of Computer Science and Engineering\n  Southeast University\n\n  Copyright © 2026 Safayet Ullah. All rights reserved.\n*/\n\n#include <Windows.h>\n#include <GL/glut.h>\n#include <GL/glu.h>\n#include <cmath>\n\n${helpersCode()}\n${animated?`float animationTime = 0.0f;\nfloat animationProgress(float time, float delay, float duration, bool repeat) {\n    float local = time - delay; if (local <= 0.0f) return 0.0f;\n    if (repeat) return fmodf(local, duration) / duration;\n    float p = local / duration; return p < 0.0f ? 0.0f : (p > 1.0f ? 1.0f : p);\n}\nvoid timer(int) { animationTime = glutGet(GLUT_ELAPSED_TIME) / 1000.0f; glutPostRedisplay(); glutTimerFunc(16, timer, 0); }\n`:''}\nvoid display() {\n    glClear(GL_COLOR_BUFFER_BIT);\n    glEnable(GL_BLEND);\n    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);\n\n${body}\n    ${animated?'glutSwapBuffers();':'glFlush();'}\n}\n\nvoid init() {\n    glClearColor(${(bg.r/255).toFixed(3)}f, ${(bg.g/255).toFixed(3)}f, ${(bg.b/255).toFixed(3)}f, 1.0f);\n    glMatrixMode(GL_PROJECTION); glLoadIdentity(); gluOrtho2D(0.0, ${W}.0, 0.0, ${H}.0);\n    glMatrixMode(GL_MODELVIEW); glLoadIdentity();\n}\n\nint main(int argc, char** argv) {\n    glutInit(&argc, argv);\n    glutInitDisplayMode(${animated?'GLUT_DOUBLE':'GLUT_SINGLE'} | GLUT_RGB);\n    glutInitWindowSize(${W}, ${H});\n    glutCreateWindow("Safayet Ullah - OpenGL Visual Design");\n    init(); glutDisplayFunc(display); ${animated?'glutTimerFunc(16, timer, 0);':''}\n    glutMainLoop(); return 0;\n}\n`;}
  function updateCodePreview(){const o=selected();const code=o?objectCode(o,0):objects.length?objects.slice(0,2).map((v,i)=>objectCode(v,i)).join('\n'):'// Draw a shape or add a professional asset.\n// Live OpenGL code will appear here.';$('codePreview').textContent=code;}

  function saveProject(){const data={app:'OpenGL Visual Designer',version:'4.0',developer:'Safayet Ullah',department:'Computer Science and Engineering',university:'Southeast University',projectName:$('projectName').value,canvasBg,objects};downloadBlob(JSON.stringify(data,null,2),`${safeName($('projectName').value)}.json`,'application/json');}
  function openProject(file){const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);pushHistory();objects=(data.objects||[]).map(prepareObject);canvasBg=data.canvasBg||'#f6f9fd';$('canvasColor').value=canvasBg;$('projectName').value=data.projectName||'Untitled Design';selectedId=null;changed('Project opened');}catch(e){alert('Invalid project file.');}};r.readAsText(file);}
  function safeName(s){return(String(s||'opengl_design').trim().replace(/[^a-z0-9_-]+/gi,'_')||'opengl_design');}
  function downloadBlob(content,name,type){const blob=content instanceof Blob?content:new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportPNG(){const out=document.createElement('canvas'),scale=2;out.width=W*scale;out.height=H*scale;const c=out.getContext('2d');c.setTransform(scale,0,0,scale,0,0);c.fillStyle=canvasBg;c.fillRect(0,0,W,H);objects.forEach(o=>drawObjectOn(c,o,false,0));out.toBlob(blob=>downloadBlob(blob,`${safeName($('projectName').value)}.png`,'image/png'),'image/png');}

  function animationLoop(ts){if(!isPlaying)return;if(!lastFrame)lastFrame=ts;animationTime+=(ts-lastFrame)/1000;lastFrame=ts;redraw();raf=requestAnimationFrame(animationLoop);}
  function togglePlay(){isPlaying=!isPlaying;$('playBtn').textContent=isPlaying?'■ Stop':'▶ Preview';$('footerState').textContent=isPlaying?'Animation preview':'Ready';if(isPlaying){lastFrame=0;raf=requestAnimationFrame(animationLoop);}else{cancelAnimationFrame(raf);animationTime=0;redraw();}}
  function setZoom(v){zoom=clamp(v,.35,2);changed('Zoom changed',false);setTimeout(updateFloatingToolbar,20);}
  function fitCanvas(){requestAnimationFrame(()=>{const zw=(viewport.clientWidth-42)/W,zh=(viewport.clientHeight-42)/H;setZoom(Math.min(1.08,zw,zh));});}
  function centerCanvas(){viewport.scrollLeft=Math.max(0,(holder.offsetWidth-viewport.clientWidth)/2);viewport.scrollTop=Math.max(0,(holder.offsetHeight-viewport.clientHeight)/2);}

  document.querySelectorAll('.tool-button').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));$('assetSearch').oninput=renderAssets;$('assetCategory').onchange=renderAssets;
  $('newBtn').onclick=()=>{if(objects.length&&!confirm('Create a new project? Unsaved work will be cleared.'))return;pushHistory();objects=[];selectedId=null;canvasBg='#f6f9fd';$('canvasColor').value=canvasBg;$('projectName').value='Untitled Design';changed('New project');};$('openBtn').onclick=()=>$('projectFile').click();$('projectFile').onchange=e=>{const f=e.target.files?.[0];if(f)openProject(f);e.target.value='';};$('saveBtn').onclick=saveProject;$('exportBtn').onclick=exportPNG;$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('fitBtn').onclick=fitCanvas;$('zoomInBtn').onclick=()=>setZoom(zoom*1.12);$('zoomOutBtn').onclick=()=>setZoom(zoom/1.12);$('gridBtn').onclick=()=>{showGrid=!showGrid;$('gridBtn').classList.toggle('active',showGrid);changed('Grid toggled');};$('snapBtn').onclick=()=>{snap=!snap;$('snapBtn').classList.toggle('active',snap);changed('Snap toggled');};$('centerBtn').onclick=centerCanvas;$('playBtn').onclick=togglePlay;$('duplicateBtn').onclick=duplicateSelected;$('deleteBtn').onclick=deleteSelected;$('ungroupBtn').onclick=ungroupSelected;$('canvasColor').oninput=e=>{canvasBg=e.target.value;changed('Canvas color updated');};$('gridSize').onchange=e=>{gridSize=+e.target.value||20;changed('Grid size updated');};$('projectName').oninput=autosave;
  $('generateBtn').onclick=()=>{$('fullCode').value=fullCode();$('codeModal').classList.remove('hidden');};$('expandCodeBtn').onclick=()=>{$('fullCode').value=fullCode();$('codeModal').classList.remove('hidden');};$('closeCodeModal').onclick=()=>$('codeModal').classList.add('hidden');$('copyPreviewBtn').onclick=async()=>{await copyText($('codePreview').textContent);};$('copyFullCode').onclick=async()=>{await copyText($('fullCode').value);};$('downloadCpp').onclick=()=>downloadBlob($('fullCode').value,`${safeName($('projectName').value)}.cpp`,'text/x-c++src');$('aboutBtn').onclick=()=>$('aboutModal').classList.remove('hidden');$('closeAboutModal').onclick=()=>$('aboutModal').classList.add('hidden');document.querySelectorAll('.modal-backdrop').forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.add('hidden');});
  async function copyText(v){try{await navigator.clipboard.writeText(v);$('footerState').textContent='Copied to clipboard';}catch(e){alert('Copy failed. Select the code manually.');}}

  window.addEventListener('keydown',e=>{const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);if(typing)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected();}if(e.key==='Delete')deleteSelected();if(e.key==='Enter'&&tool==='polygon')finishPolygon();if(e.key==='Escape'){polyDraft=[];preview=null;action=null;setTool('select');changed('Action cancelled',false);}const map={v:'select',r:'rectangle',o:'ellipse',t:'triangle',l:'line',p:'polygon',b:'freehand'};if(map[e.key.toLowerCase()])setTool(map[e.key.toLowerCase()]);});window.addEventListener('resize',()=>setTimeout(fitCanvas,80));viewport.addEventListener('scroll',updateFloatingToolbar);

  createFloatingToolbar();loadAutosave();renderAssets();setTool('select');changed('Ready',false);setTimeout(()=>{fitCanvas();centerCanvas();},80);
})();
