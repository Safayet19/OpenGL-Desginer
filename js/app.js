(function(){
  const OVD=window.OVD;
  const S=OVD.state;
  const U=OVD.util;
  const {WIDTH:W,HEIGHT:H}=OVD.constants;
  const $=id=>document.getElementById(id);
  const SVG_NS="http://www.w3.org/2000/svg";

  const artboard=$("artboard");
  const sceneLayer=$("sceneLayer");
  const selectionLayer=$("selectionLayer");
  const draftLayer=$("draftLayer");
  const defs=$("svgDefs");
  const frame=$("artboardFrame");
  const viewport=$("viewport");

  let activeTemplateCategory="all";
  let pointerDown=false;
  let spacePressed=false;
  let panAction=null;
  let lastPointer={x:0,y:0};
  let currentTextPoint=null;
  let rafId=0;

  function svg(tag,attributes={}){
    const element=document.createElementNS(SVG_NS,tag);
    Object.entries(attributes).forEach(([key,value])=>{
      if(value===null||value===undefined) return;
      element.setAttribute(key,String(value));
    });
    return element;
  }

  function gradientId(key){return "g_"+String(key).replace(/[^a-zA-Z0-9_-]/g,"_");}

  function createPaint(fill,fill2,key){
    if(!fill2) return fill;
    const id=gradientId(key);
    let gradient=$(id);
    if(!gradient){
      gradient=svg("linearGradient",{id,x1:"0%",y1:"0%",x2:"100%",y2:"100%",class:"dynamic-gradient"});
      gradient.append(svg("stop",{offset:"0%","stop-color":fill}));
      gradient.append(svg("stop",{offset:"100%","stop-color":fill2}));
      defs.append(gradient);
    }
    return `url(#${id})`;
  }

  function clearDynamicGradients(){
    defs.querySelectorAll(".dynamic-gradient").forEach(g=>g.remove());
  }

  function animatedView(object,time){
    const clone={...object};
    const a={preset:"none",duration:4,amount:180,loop:true,delay:0,...(object.animation||{})};
    if(a.preset==="none"||!S.playing) return clone;
    const local=Math.max(0,time-(a.delay||0));
    const duration=Math.max(.2,a.duration||4);
    let p=a.loop?(local%duration)/duration:Math.min(1,local/duration);
    const wave=Math.sin(p*Math.PI*2);
    if(a.preset==="slide") clone.x+=(p-1)*(a.amount||180);
    if(a.preset==="float") clone.y-=wave*(a.amount||40);
    if(a.preset==="bounce") clone.y-=Math.abs(Math.sin(p*Math.PI))*(a.amount||70);
    if(a.preset==="rotate") clone.rotation+=p*360;
    if(a.preset==="pulse"){
      const factor=1+wave*((a.amount||50)/500);
      clone.w*=factor; clone.h*=factor;
    }
    if(a.preset==="blink") clone.opacity*=.25+.75*(.5+.5*wave);
    return clone;
  }

  function renderChild(child,parent,key){
    const group=svg("g",{transform:`translate(${child.x*parent.w} ${child.y*parent.h}) rotate(${child.rotation||0})`,opacity:child.opacity??1});
    const cw=child.w*parent.w,ch=child.h*parent.h;
    const fill=child.theme?parent.fill:(child.fill||parent.fill);
    const paint=createPaint(fill,child.fill2,`${key}_${fill}_${child.fill2||""}`);
    const common={
      fill:paint,
      stroke:child.stroke||fill,
      "stroke-width":(child.strokeWidth??0)<1?(child.strokeWidth??0)*Math.max(parent.w,parent.h):(child.strokeWidth??0),
      "vector-effect":"non-scaling-stroke",
      "stroke-linejoin":"round",
      "stroke-linecap":"round"
    };
    let shape=null;
    if(child.type==="rect") shape=svg("rect",{x:-cw/2,y:-ch/2,width:cw,height:ch,rx:(child.radius||0)*Math.min(parent.w,parent.h),...common});
    if(child.type==="ellipse") shape=svg("ellipse",{cx:0,cy:0,rx:Math.abs(cw/2),ry:Math.abs(ch/2),...common});
    if(child.type==="triangle") shape=svg("polygon",{points:`0,${-ch/2} ${-cw/2},${ch/2} ${cw/2},${ch/2}`,...common});
    if(child.type==="polygon"){
      const points=(child.points||[]).map(p=>`${p[0]*parent.w},${p[1]*parent.h}`).join(" ");
      shape=svg("polygon",{points,...common});
    }
    if(child.type==="line"){
      shape=svg("line",{x1:-cw/2,y1:-ch/2,x2:cw/2,y2:ch/2,fill:"none",stroke:child.stroke||fill,"stroke-width":Math.max(1,(child.strokeWidth||.01)*Math.max(parent.w,parent.h)),"stroke-linecap":"round","vector-effect":"non-scaling-stroke"});
    }
    if(shape) group.append(shape);
    return group;
  }

  function objectElement(base,index,time){
    const object=animatedView(base,time);
    const group=svg("g",{
      "data-object-id":base.id,
      transform:`translate(${object.x} ${object.y}) rotate(${object.rotation})`,
      opacity:object.opacity,
      cursor:S.tool==="select"?(base.locked?"not-allowed":"move"):"crosshair"
    });
    if(object.shadow) group.setAttribute("filter","url(#softShadow)");
    const paint=createPaint(object.fill,object.fill2,`${object.id}_${object.fill}_${object.fill2||""}`);
    const common={
      fill:paint,
      stroke:object.stroke,
      "stroke-width":object.strokeWidth,
      "vector-effect":"non-scaling-stroke",
      "stroke-linejoin":"round",
      "stroke-linecap":"round"
    };
    let shape=null;
    if(object.type==="rectangle") shape=svg("rect",{x:-object.w/2,y:-object.h/2,width:object.w,height:object.h,rx:Math.min(10,object.w*.05),...common});
    if(object.type==="ellipse") shape=svg("ellipse",{cx:0,cy:0,rx:object.w/2,ry:object.h/2,...common});
    if(object.type==="triangle") shape=svg("polygon",{points:`0,${-object.h/2} ${-object.w/2},${object.h/2} ${object.w/2},${object.h/2}`,...common});
    if(object.type==="polygon"){
      shape=svg("polygon",{points:(object.points||[]).map(p=>`${p.x*object.w},${p.y*object.h}`).join(" "),...common});
    }
    if(object.type==="line"||object.type==="freehand"){
      const points=(object.points||[]).map(p=>`${p.x*object.w},${p.y*object.h}`).join(" ");
      shape=svg("polyline",{points,fill:"none",stroke:object.stroke,"stroke-width":object.strokeWidth,"vector-effect":"non-scaling-stroke","stroke-linejoin":"round","stroke-linecap":"round"});
    }
    if(object.type==="text"){
      shape=svg("text",{x:0,y:0,fill:paint,stroke:"none","font-size":object.fontSize||object.h,"font-family":"Inter, Arial, sans-serif","font-weight":"700","text-anchor":"middle","dominant-baseline":"middle"});
      shape.textContent=object.text;
    }
    if(object.type==="group"){
      (object.children||[]).forEach((child,childIndex)=>group.append(renderChild(child,object,`${object.id}_${childIndex}`)));
    }else if(shape){
      group.append(shape);
    }
    return group;
  }

  function renderSelection(){
    selectionLayer.replaceChildren();
    const object=OVD.selected();
    if(!object||object.visible===false) return;
    const g=svg("g",{transform:`translate(${object.x} ${object.y}) rotate(${object.rotation})`});
    const box=svg("rect",{x:-object.w/2,y:-object.h/2,width:object.w,height:object.h,fill:"none",stroke:"#5b74ff","stroke-width":1.5,"stroke-dasharray":"6 4","vector-effect":"non-scaling-stroke","pointer-events":"none"});
    g.append(box);
    const handles=[
      ["nw",-object.w/2,-object.h/2],["ne",object.w/2,-object.h/2],
      ["se",object.w/2,object.h/2],["sw",-object.w/2,object.h/2]
    ];
    handles.forEach(([name,x,y])=>{
      const handle=svg("rect",{"data-handle":name,x:x-5,y:y-5,width:10,height:10,rx:2,fill:"#ffffff",stroke:"#5b74ff","stroke-width":2,"vector-effect":"non-scaling-stroke",cursor:`${name}-resize`});
      g.append(handle);
    });
    g.append(svg("line",{x1:0,y1:-object.h/2,x2:0,y2:-object.h/2-30,stroke:"#5b74ff","stroke-width":1.5,"vector-effect":"non-scaling-stroke","pointer-events":"none"}));
    g.append(svg("circle",{"data-handle":"rotate",cx:0,cy:-object.h/2-30,r:6,fill:"#ffffff",stroke:"#5b74ff","stroke-width":2,"vector-effect":"non-scaling-stroke",cursor:"grab"}));
    selectionLayer.append(g);
  }

  function renderDraft(){
    draftLayer.replaceChildren();
    if(S.draft?.kind==="shape"){
      const d=S.draft;
      const w=Math.abs(d.x2-d.x1),h=Math.abs(d.y2-d.y1);
      const x=(d.x1+d.x2)/2,y=(d.y1+d.y2)/2;
      let el=null;
      if(d.tool==="rectangle") el=svg("rect",{x:x-w/2,y:y-h/2,width:w,height:h,rx:8});
      if(d.tool==="ellipse") el=svg("ellipse",{cx:x,cy:y,rx:w/2,ry:h/2});
      if(d.tool==="triangle") el=svg("polygon",{points:`${x},${y-h/2} ${x-w/2},${y+h/2} ${x+w/2},${y+h/2}`});
      if(d.tool==="line") el=svg("line",{x1:d.x1,y1:d.y1,x2:d.x2,y2:d.y2,fill:"none"});
      if(el){
        el.setAttribute("stroke","#6d6df6");
        el.setAttribute("stroke-width","2");
        el.setAttribute("stroke-dasharray","7 5");
        el.setAttribute("fill",d.tool==="line"?"none":"rgba(109,109,246,.15)");
        draftLayer.append(el);
      }
    }
    if(S.draft?.kind==="freehand"){
      const points=S.draft.points.map(p=>`${p.x},${p.y}`).join(" ");
      draftLayer.append(svg("polyline",{points,fill:"none",stroke:"#172a43","stroke-width":4,"stroke-linecap":"round","stroke-linejoin":"round"}));
    }
    if(S.polygonPoints.length){
      const points=S.polygonPoints.map(p=>`${p.x},${p.y}`).join(" ");
      draftLayer.append(svg("polyline",{points,fill:"none",stroke:"#6d6df6","stroke-width":2,"stroke-dasharray":"6 4"}));
      S.polygonPoints.forEach((p,index)=>{
        draftLayer.append(svg("circle",{cx:p.x,cy:p.y,r:index===0?5:4,fill:index===0?"#ffffff":"#6d6df6",stroke:"#6d6df6","stroke-width":2}));
      });
    }
  }

  function renderScene(time=0){
    clearDynamicGradients();
    sceneLayer.replaceChildren();
    S.objects.forEach((object,index)=>{
      if(object.visible!==false) sceneLayer.append(objectElement(object,index,time));
    });
    renderSelection();
    renderDraft();
    $("canvasBackground").setAttribute("fill",S.canvasColor);
    artboard.classList.toggle("grid-hidden",!S.grid);
    $("emptyHint").classList.toggle("hidden",S.objects.length>0);
    updateInspector();
    updateFloatingTools();
    OVD.saveAuto();
  }

  function renderAnimationFrame(timestamp){
    if(!S.playing) return;
    const seconds=(timestamp-S.animationStart)/1000;
    renderScene(seconds);
    rafId=requestAnimationFrame(renderAnimationFrame);
  }

  function toggleAnimation(){
    S.playing=!S.playing;
    if(S.playing){
      S.animationStart=performance.now();
      $("previewAnimationBtn").textContent="Stop Preview";
      rafId=requestAnimationFrame(renderAnimationFrame);
    }else{
      cancelAnimationFrame(rafId);
      $("previewAnimationBtn").textContent="Preview Animation";
      renderScene(0);
    }
  }

  function fitCanvas(){
    requestAnimationFrame(()=>{
      const availableW=Math.max(280,viewport.clientWidth-72);
      const availableH=Math.max(220,viewport.clientHeight-72);
      setZoom(Math.min(1.2,availableW/W,availableH/H));
      viewport.scrollTo({left:0,top:0});
    });
  }

  function setZoom(value,centerPoint=null){
    const old=S.zoom;
    S.zoom=U.clamp(value,.25,3);
    frame.style.width=`${W*S.zoom}px`;
    frame.style.height=`${H*S.zoom}px`;
    $("zoomLabel").textContent=`${Math.round(S.zoom*100)}%`;
    if(centerPoint){
      const ratio=S.zoom/old;
      viewport.scrollLeft=(viewport.scrollLeft+centerPoint.x)*ratio-centerPoint.x;
      viewport.scrollTop=(viewport.scrollTop+centerPoint.y)*ratio-centerPoint.y;
    }
    updateFloatingTools();
  }

  function canvasPoint(event){
    const rect=artboard.getBoundingClientRect();
    let x=(event.clientX-rect.left)/rect.width*W;
    let y=(event.clientY-rect.top)/rect.height*H;
    x=U.clamp(x,0,W); y=U.clamp(y,0,H);
    if(S.snap){
      const step=S.gridSize||10;
      x=Math.round(x/step)*step;
      y=Math.round(y/step)*step;
    }
    return {x,y};
  }

  function localPoint(object,point){
    const angle=-object.rotation*Math.PI/180;
    const dx=point.x-object.x,dy=point.y-object.y;
    return {
      x:dx*Math.cos(angle)-dy*Math.sin(angle),
      y:dx*Math.sin(angle)+dy*Math.cos(angle)
    };
  }

  function worldPoint(object,local){
    const angle=object.rotation*Math.PI/180;
    return {
      x:object.x+local.x*Math.cos(angle)-local.y*Math.sin(angle),
      y:object.y+local.x*Math.sin(angle)+local.y*Math.cos(angle)
    };
  }

  function selectObject(id){
    S.selectedId=id;
    S.tool="select";
    updateToolButtons();
    renderScene(0);
  }

  function setTool(tool){
    if(S.tool==="polygon"&&S.polygonPoints.length){
      if(S.polygonPoints.length>=3) finishPolygon();
      else cancelPolygon();
    }
    S.tool=tool;
    S.draft=null;
    updateToolButtons();
    const messages={
      select:"Select: click an object to move, resize or rotate it.",
      rectangle:"Rectangle: drag on the canvas.",
      ellipse:"Ellipse: drag on the canvas.",
      triangle:"Triangle: drag on the canvas.",
      line:"Line: drag from one point to another.",
      polygon:"Polygon: click points, then double-click or press Enter to finish.",
      freehand:"Freehand: drag to draw. The stroke appears live.",
      text:"Text: click where the text should appear."
    };
    $("statusText").textContent=messages[tool]||"Ready.";
  }

  function updateToolButtons(){
    document.querySelectorAll(".tool[data-tool]").forEach(button=>button.classList.toggle("active",button.dataset.tool===S.tool));
  }

  function finishPolygon(){
    if(S.polygonPoints.length<3){cancelPolygon();return;}
    OVD.pushHistory();
    const n=OVD.normalizePoints(S.polygonPoints);
    const object=OVD.makeObject("polygon",n.x,n.y,n.w,n.h,{
      name:"Polygon",
      fill:"#6d6df6",
      stroke:"#2a3550",
      strokeWidth:2,
      points:n.points
    });
    S.objects.push(object);
    S.selectedId=object.id;
    S.polygonPoints=[];
    S.tool="select";
    renderScene(0);
    updateToolButtons();
    $("statusText").textContent="Polygon finished.";
  }

  function cancelPolygon(){
    S.polygonPoints=[];
    S.draft=null;
    renderDraft();
  }

  function startShape(point){
    S.draft={kind:"shape",tool:S.tool,x1:point.x,y1:point.y,x2:point.x,y2:point.y};
  }

  function completeShape(){
    const d=S.draft;
    if(!d||d.kind!=="shape") return;
    const w=Math.abs(d.x2-d.x1),h=Math.abs(d.y2-d.y1);
    if(Math.max(w,h)<4){S.draft=null;renderDraft();return;}
    OVD.pushHistory();
    let object=null;
    if(d.tool==="line"){
      const n=OVD.normalizePoints([{x:d.x1,y:d.y1},{x:d.x2,y:d.y2}]);
      object=OVD.makeObject("line",n.x,n.y,n.w,n.h,{
        name:"Line",fill:"transparent",stroke:"#24344c",strokeWidth:4,
        points:n.points
      });
    }else{
      object=OVD.makeObject(d.tool,(d.x1+d.x2)/2,(d.y1+d.y2)/2,w,h,{
        fill:"#6d6df6",fill2:"#7e55f7",stroke:"#2a3550",strokeWidth:2,shadow:false
      });
    }
    S.objects.push(object);
    S.selectedId=object.id;
    S.draft=null;
    S.tool="select";
    updateToolButtons();
    renderScene(0);
  }

  function completeFreehand(){
    const points=S.draft?.points||[];
    if(points.length<2){S.draft=null;renderDraft();return;}
    OVD.pushHistory();
    const n=OVD.normalizePoints(points);
    const object=OVD.makeObject("freehand",n.x,n.y,n.w,n.h,{
      name:"Freehand Stroke",
      fill:"transparent",
      stroke:"#172a43",
      strokeWidth:4,
      points:n.points,
      shadow:false
    });
    S.objects.push(object);
    S.selectedId=object.id;
    S.draft=null;
    S.tool="select";
    updateToolButtons();
    renderScene(0);
  }

  function beginMove(object,point){
    if(object.locked) return;
    OVD.pushHistory();
    S.action={kind:"move",id:object.id,start:point,origin:{x:object.x,y:object.y}};
  }

  function beginResize(object,handle,point){
    if(object.locked) return;
    OVD.pushHistory();
    const opposite={
      nw:{x:object.w/2,y:object.h/2},
      ne:{x:-object.w/2,y:object.h/2},
      se:{x:-object.w/2,y:-object.h/2},
      sw:{x:object.w/2,y:-object.h/2}
    }[handle];
    S.action={kind:"resize",id:object.id,handle,original:U.clone(object),opposite};
  }

  function beginRotate(object){
    if(object.locked) return;
    OVD.pushHistory();
    S.action={kind:"rotate",id:object.id};
  }

  function updateAction(point){
    const object=OVD.selected();
    if(!object||!S.action) return;
    if(S.action.kind==="move"){
      object.x=S.action.origin.x+(point.x-S.action.start.x);
      object.y=S.action.origin.y+(point.y-S.action.start.y);
      if(S.snap){
        object.x=Math.round(object.x/S.gridSize)*S.gridSize;
        object.y=Math.round(object.y/S.gridSize)*S.gridSize;
      }
    }
    if(S.action.kind==="rotate"){
      object.rotation=Math.atan2(point.y-object.y,point.x-object.x)*180/Math.PI+90;
    }
    if(S.action.kind==="resize"){
      const original=S.action.original;
      const currentLocal=localPoint(original,point);
      const opposite=S.action.opposite;
      const left=Math.min(currentLocal.x,opposite.x),right=Math.max(currentLocal.x,opposite.x);
      const top=Math.min(currentLocal.y,opposite.y),bottom=Math.max(currentLocal.y,opposite.y);
      const localCenter={x:(left+right)/2,y:(top+bottom)/2};
      const worldCenter=worldPoint(original,localCenter);
      object.x=worldCenter.x; object.y=worldCenter.y;
      object.w=Math.max(10,right-left); object.h=Math.max(10,bottom-top);
    }
    renderScene(0);
  }

  function hitObjectFromEvent(event){
    const target=event.target.closest("[data-object-id]");
    return target ? S.objects.find(o=>o.id===target.dataset.objectId) : null;
  }

  artboard.addEventListener("pointerdown",event=>{
    if(event.button!==0) return;
    pointerDown=true;
    const point=canvasPoint(event);
    lastPointer=point;
    artboard.setPointerCapture(event.pointerId);

    const handle=event.target.dataset.handle;
    if(handle){
      const object=OVD.selected();
      if(!object) return;
      if(handle==="rotate") beginRotate(object);
      else beginResize(object,handle,point);
      return;
    }

    const clickedObject=hitObjectFromEvent(event);
    if(S.tool==="select"){
      if(clickedObject){
        S.selectedId=clickedObject.id;
        renderScene(0);
        beginMove(clickedObject,point);
      }else{
        S.selectedId=null;
        renderScene(0);
      }
      return;
    }

    if(S.tool==="polygon"){
      S.polygonPoints.push(point);
      renderDraft();
      return;
    }

    if(S.tool==="text"){
      currentTextPoint=point;
      $("textInput").value="";
      openModal("textModal");
      setTimeout(()=>$("textInput").focus(),20);
      return;
    }

    if(S.tool==="freehand"){
      S.draft={kind:"freehand",points:[point]};
      renderDraft();
      return;
    }

    startShape(point);
    renderDraft();
  });

  artboard.addEventListener("pointermove",event=>{
    const point=canvasPoint(event);
    $("cursorText").textContent=`X ${Math.round(point.x)} · Y ${Math.round(H-point.y)}`;
    lastPointer=point;
    if(!pointerDown) return;
    if(S.action){updateAction(point);return;}
    if(S.draft?.kind==="shape"){
      S.draft.x2=point.x;S.draft.y2=point.y;renderDraft();
    }
    if(S.draft?.kind==="freehand"){
      const previous=S.draft.points[S.draft.points.length-1];
      if(!previous||Math.hypot(point.x-previous.x,point.y-previous.y)>2){
        S.draft.points.push(point);
        renderDraft();
      }
    }
  });

  artboard.addEventListener("pointerup",event=>{
    pointerDown=false;
    if(S.action){
      S.action=null;
      renderScene(0);
      return;
    }
    if(S.draft?.kind==="shape") completeShape();
    if(S.draft?.kind==="freehand") completeFreehand();
  });

  artboard.addEventListener("dblclick",event=>{
    if(S.tool==="polygon"){
      event.preventDefault();
      finishPolygon();
    }
  });

  viewport.addEventListener("wheel",event=>{
    if(event.ctrlKey||event.metaKey){
      event.preventDefault();
      const rect=viewport.getBoundingClientRect();
      setZoom(S.zoom*(event.deltaY<0?1.1:.9),{x:event.clientX-rect.left,y:event.clientY-rect.top});
    }
  },{passive:false});

  viewport.addEventListener("pointerdown",event=>{
    if(spacePressed||event.button===1){
      panAction={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
      viewport.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
  viewport.addEventListener("pointermove",event=>{
    if(!panAction) return;
    viewport.scrollLeft=panAction.left-(event.clientX-panAction.x);
    viewport.scrollTop=panAction.top-(event.clientY-panAction.y);
  });
  viewport.addEventListener("pointerup",()=>panAction=null);

  function updateInspector(){
    const object=OVD.selected();
    $("canvasInspector").classList.toggle("hidden",!!object);
    $("objectInspector").classList.toggle("hidden",!object);
    $("inspectorTitle").textContent=object?object.name:"Canvas";
    if(!object) return;
    $("objectTypeBadge").textContent=object.type;
    $("propName").value=object.name;
    $("propX").value=Math.round(object.x);
    $("propY").value=Math.round(H-object.y);
    $("propW").value=Math.round(object.w);
    $("propH").value=Math.round(object.h);
    $("propRotation").value=Math.round(object.rotation);
    $("rotationValue").textContent=`${Math.round(object.rotation)}°`;
    $("propFill").value=object.fill==="transparent"?"#000000":object.fill;
    $("propStroke").value=object.stroke||"#000000";
    $("propStrokeWidth").value=object.strokeWidth;
    $("strokeValue").textContent=Number(object.strokeWidth).toFixed(1);
    $("propOpacity").value=object.opacity;
    $("opacityValue").textContent=`${Math.round(object.opacity*100)}%`;
    $("propShadow").checked=!!object.shadow;
    $("propAnimation").value=object.animation?.preset||"none";
    $("propDuration").value=object.animation?.duration||4;
    $("propAmount").value=object.animation?.amount||180;
    $("propLoop").checked=object.animation?.loop!==false;
  }

  function liveProperty(id,handler){
    $(id).addEventListener("input",()=>{
      const object=OVD.selected();
      if(!object) return;
      handler(object,$(id));
      renderScene(0);
    });
    $(id).addEventListener("change",()=>OVD.pushHistory());
  }

  liveProperty("propName",(o,input)=>o.name=input.value||"Object");
  liveProperty("propX",(o,input)=>o.x=Number(input.value)||0);
  liveProperty("propY",(o,input)=>o.y=H-(Number(input.value)||0));
  liveProperty("propW",(o,input)=>o.w=Math.max(1,Number(input.value)||1));
  liveProperty("propH",(o,input)=>o.h=Math.max(1,Number(input.value)||1));
  liveProperty("propRotation",(o,input)=>{o.rotation=Number(input.value)||0;$("rotationValue").textContent=`${Math.round(o.rotation)}°`;});
  liveProperty("propFill",(o,input)=>o.fill=input.value);
  liveProperty("propStroke",(o,input)=>o.stroke=input.value);
  liveProperty("propStrokeWidth",(o,input)=>{o.strokeWidth=Number(input.value);$("strokeValue").textContent=o.strokeWidth.toFixed(1);});
  liveProperty("propOpacity",(o,input)=>{o.opacity=Number(input.value);$("opacityValue").textContent=`${Math.round(o.opacity*100)}%`;});
  liveProperty("propShadow",(o,input)=>o.shadow=input.checked);
  liveProperty("propAnimation",(o,input)=>o.animation.preset=input.value);
  liveProperty("propDuration",(o,input)=>o.animation.duration=Math.max(.2,Number(input.value)||4));
  liveProperty("propAmount",(o,input)=>o.animation.amount=Math.max(1,Number(input.value)||180));
  liveProperty("propLoop",(o,input)=>o.animation.loop=input.checked);

  function duplicateSelected(){
    const object=OVD.selected();
    if(!object) return;
    OVD.pushHistory();
    const copy=U.clone(object);
    copy.id=U.uid();
    copy.name=`${object.name} Copy`;
    copy.x+=20;copy.y+=20;
    S.objects.push(copy);
    S.selectedId=copy.id;
    renderScene(0);
  }

  function deleteSelected(){
    if(!S.selectedId) return;
    OVD.pushHistory();
    S.objects=S.objects.filter(o=>o.id!==S.selectedId);
    S.selectedId=null;
    renderScene(0);
  }

  function bringFront(){
    const object=OVD.selected();
    if(!object) return;
    OVD.pushHistory();
    S.objects=S.objects.filter(o=>o!==object);
    S.objects.push(object);
    renderScene(0);
  }
  function sendBack(){
    const object=OVD.selected();
    if(!object) return;
    OVD.pushHistory();
    S.objects=S.objects.filter(o=>o!==object);
    S.objects.unshift(object);
    renderScene(0);
  }

  function updateFloatingTools(){
    const toolbar=$("floatingTools");
    const object=OVD.selected();
    if(!object||document.body.classList.contains("focus-mode")){
      toolbar.classList.add("hidden");return;
    }
    const point=artboard.createSVGPoint();
    point.x=object.x;point.y=object.y-object.h/2-48;
    const matrix=artboard.getScreenCTM();
    if(!matrix){toolbar.classList.add("hidden");return;}
    const screen=point.matrixTransform(matrix);
    toolbar.style.left=`${screen.x}px`;
    toolbar.style.top=`${screen.y}px`;
    toolbar.style.transform="translate(-50%,-100%)";
    toolbar.classList.remove("hidden");
  }

  function openModal(id){$(id).classList.remove("hidden");}
  function closeModal(id){$(id).classList.add("hidden");}

  function renderTemplates(){
    const grid=$("templateGrid");
    grid.replaceChildren();
    OVD.templates.filter(t=>activeTemplateCategory==="all"||t.category===activeTemplateCategory).forEach(template=>{
      const button=document.createElement("button");
      button.className="template-card";
      button.dataset.template=template.id;
      button.innerHTML=`<div class="template-preview">${template.preview}</div><div class="template-info"><strong>${template.name}</strong><span>${template.description}</span></div>`;
      button.onclick=()=>{
        OVD.pushHistory();
        const items=OVD.createTemplate(template.id);
        S.objects.push(...items);
        S.selectedId=items[0]?.id||null;
        closeModal("insertModal");
        setTool("select");
        renderScene(0);
        $("statusText").textContent=`${template.name} inserted.`;
      };
      grid.append(button);
    });
  }

  function saveProject(){
    const data={
      app:"OpenGL Visual Designer",
      version:"3.0",
      author:"Safayet Ullah",
      department:"Computer Science and Engineering",
      university:"Southeast University",
      projectName:S.projectName,
      canvasColor:S.canvasColor,
      objects:S.objects
    };
    downloadBlob(JSON.stringify(data,null,2),`${safeName(S.projectName)}.json`,"application/json");
  }

  function openProject(file){
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(reader.result);
        OVD.pushHistory();
        S.projectName=data.projectName||"Untitled Design";
        S.canvasColor=data.canvasColor||"#ffffff";
        S.objects=data.objects||[];
        S.selectedId=null;
        syncStaticControls();
        renderScene(0);
      }catch(error){
        alert("This project file is invalid.");
      }
    };
    reader.readAsText(file);
  }

  function safeName(value){
    return (value||"opengl-design").trim().replace(/[^a-z0-9_-]+/gi,"_").replace(/^_+|_+$/g,"")||"opengl-design";
  }

  function downloadBlob(content,name,type){
    const blob=content instanceof Blob?content:new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;link.download=name;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function cleanSvgString(){
    const clone=artboard.cloneNode(true);
    clone.querySelector("#selectionLayer")?.remove();
    clone.querySelector("#draftLayer")?.remove();
    clone.querySelector("#gridOverlay")?.remove();
    clone.setAttribute("xmlns",SVG_NS);
    clone.setAttribute("width","900");
    clone.setAttribute("height","600");
    return new XMLSerializer().serializeToString(clone);
  }

  function exportSvg(){
    downloadBlob(cleanSvgString(),`${safeName(S.projectName)}.svg`,"image/svg+xml");
  }

  function exportPng(){
    const source=cleanSvgString();
    const blob=new Blob([source],{type:"image/svg+xml"});
    const url=URL.createObjectURL(blob);
    const image=new Image();
    image.onload=()=>{
      const canvas=document.createElement("canvas");
      canvas.width=1800;canvas.height=1200;
      const context=canvas.getContext("2d");
      context.drawImage(image,0,0,canvas.width,canvas.height);
      canvas.toBlob(pngBlob=>{
        downloadBlob(pngBlob,`${safeName(S.projectName)}.png`,"image/png");
        URL.revokeObjectURL(url);
      },"image/png");
    };
    image.src=url;
  }

  function showCode(){
    $("codeOutput").value=OVD.generateCpp();
    openModal("codeModal");
  }

  function syncStaticControls(){
    $("projectName").value=S.projectName;
    $("canvasColor").value=S.canvasColor;
    $("gridSize").value=String(S.gridSize);
    $("gridBtn").classList.toggle("active",S.grid);
    $("snapBtn").classList.toggle("active",S.snap);
  }

  document.querySelectorAll(".tool[data-tool]").forEach(button=>button.onclick=()=>setTool(button.dataset.tool));
  $("insertBtn").onclick=()=>{renderTemplates();openModal("insertModal");};
  $("emptyInsertBtn").onclick=()=>{renderTemplates();openModal("insertModal");};
  $("newBtn").onclick=()=>{
    if(S.objects.length&&!confirm("Start a new project? Unsaved work will be removed.")) return;
    OVD.pushHistory();
    S.objects=[];S.selectedId=null;S.projectName="Untitled Design";S.canvasColor="#ffffff";
    syncStaticControls();renderScene(0);fitCanvas();
  };
  $("openBtn").onclick=()=>$("projectFileInput").click();
  $("projectFileInput").onchange=event=>{
    const file=event.target.files?.[0];
    if(file) openProject(file);
    event.target.value="";
  };
  $("saveBtn").onclick=saveProject;
  $("exportBtn").onclick=()=>openModal("exportModal");
  $("generateBtn").onclick=showCode;
  $("aboutBtn").onclick=()=>openModal("aboutModal");
  $("undoBtn").onclick=()=>{if(OVD.undo()){syncStaticControls();renderScene(0);}};
  $("redoBtn").onclick=()=>{if(OVD.redo()){syncStaticControls();renderScene(0);}};
  $("fitBtn").onclick=fitCanvas;
  $("zoomInBtn").onclick=()=>setZoom(S.zoom*1.12);
  $("zoomOutBtn").onclick=()=>setZoom(S.zoom/1.12);
  $("gridBtn").onclick=()=>{S.grid=!S.grid;$("gridBtn").classList.toggle("active",S.grid);renderScene(0);};
  $("snapBtn").onclick=()=>{S.snap=!S.snap;$("snapBtn").classList.toggle("active",S.snap);};
  $("focusBtn").onclick=()=>{document.body.classList.toggle("focus-mode");setTimeout(fitCanvas,60);};
  $("duplicateBtn").onclick=duplicateSelected;
  $("deleteBtn").onclick=deleteSelected;
  $("previewAnimationBtn").onclick=toggleAnimation;
  $("collapseInspectorBtn").onclick=()=>{
    document.body.classList.add("inspector-collapsed");
    $("openInspectorBtn").classList.remove("hidden");
    setTimeout(fitCanvas,80);
  };
  $("openInspectorBtn").onclick=()=>{
    document.body.classList.remove("inspector-collapsed");
    $("openInspectorBtn").classList.add("hidden");
    setTimeout(fitCanvas,80);
  };
  $("projectName").oninput=()=>{S.projectName=$("projectName").value||"Untitled Design";OVD.saveAuto();};
  $("canvasColor").oninput=()=>{S.canvasColor=$("canvasColor").value;renderScene(0);};
  $("gridSize").onchange=()=>{S.gridSize=Number($("gridSize").value)||10;};

  $("floatingTools").addEventListener("click",event=>{
    const action=event.target.dataset.floating;
    if(action==="duplicate") duplicateSelected();
    if(action==="front") bringFront();
    if(action==="back") sendBack();
    if(action==="delete") deleteSelected();
  });

  document.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>closeModal(button.dataset.close));
  document.querySelectorAll(".modal-backdrop").forEach(backdrop=>{
    backdrop.addEventListener("pointerdown",event=>{
      if(event.target===backdrop) closeModal(backdrop.id);
    });
  });

  document.querySelectorAll("#templateTabs button").forEach(button=>button.onclick=()=>{
    activeTemplateCategory=button.dataset.category;
    document.querySelectorAll("#templateTabs button").forEach(b=>b.classList.toggle("active",b===button));
    renderTemplates();
  });

  document.querySelectorAll("[data-export]").forEach(button=>button.onclick=()=>{
    const type=button.dataset.export;
    closeModal("exportModal");
    if(type==="png") exportPng();
    if(type==="svg") exportSvg();
    if(type==="json") saveProject();
    if(type==="cpp") showCode();
  });

  $("copyCodeBtn").onclick=async()=>{
    try{
      await navigator.clipboard.writeText($("codeOutput").value);
      $("statusText").textContent="Generated code copied.";
    }catch(error){
      $("codeOutput").select();
      document.execCommand("copy");
    }
  };
  $("downloadCodeBtn").onclick=()=>downloadBlob($("codeOutput").value,`${safeName(S.projectName)}.cpp`,"text/x-c++src");

  $("confirmTextBtn").onclick=()=>{
    const value=$("textInput").value.trim();
    if(!value||!currentTextPoint) return;
    OVD.pushHistory();
    const object=OVD.makeObject("text",currentTextPoint.x,currentTextPoint.y,Math.max(90,value.length*20),42,{
      name:"Text",text:value,fontSize:34,fill:"#172a43",stroke:"#172a43",strokeWidth:0
    });
    S.objects.push(object);S.selectedId=object.id;
    closeModal("textModal");setTool("select");renderScene(0);
  };
  $("textInput").addEventListener("keydown",event=>{
    if(event.key==="Enter") $("confirmTextBtn").click();
  });

  window.addEventListener("keydown",event=>{
    const typing=["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName);
    if(event.code==="Space"&&!typing){spacePressed=true;viewport.style.cursor="grab";event.preventDefault();}
    if(typing) return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?$("redoBtn").click():$("undoBtn").click();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="y"){event.preventDefault();$("redoBtn").click();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="d"){event.preventDefault();duplicateSelected();}
    if((event.ctrlKey||event.metaKey)&&event.key==="0"){event.preventDefault();fitCanvas();}
    if((event.ctrlKey||event.metaKey)&&event.key==="1"){event.preventDefault();setZoom(1);}
    if(event.key==="Delete") deleteSelected();
    if(event.key==="Enter"&&S.tool==="polygon") finishPolygon();
    if(event.key==="Escape"){
      if(S.playing) toggleAnimation();
      cancelPolygon();S.draft=null;S.action=null;renderScene(0);
      document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(modal=>closeModal(modal.id));
    }
    if(event.key==="F11"){event.preventDefault();$("focusBtn").click();}
    const shortcuts={v:"select",r:"rectangle",o:"ellipse",t:"triangle",l:"line",p:"polygon",b:"freehand"};
    if(shortcuts[event.key.toLowerCase()]) setTool(shortcuts[event.key.toLowerCase()]);
  });
  window.addEventListener("keyup",event=>{
    if(event.code==="Space"){spacePressed=false;viewport.style.cursor="";}
  });
  window.addEventListener("resize",()=>setTimeout(fitCanvas,80));
  viewport.addEventListener("scroll",updateFloatingTools);

  OVD.loadAuto();
  syncStaticControls();
  setTool("select");
  renderTemplates();
  renderScene(0);
  setTimeout(fitCanvas,80);
})();