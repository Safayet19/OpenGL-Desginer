(function(){
  const OVD = window.OVD = window.OVD || {};
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => "o_" + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

  OVD.constants = { WIDTH:900, HEIGHT:600 };
  OVD.util = { clone, uid, clamp };

  OVD.state = {
    projectName:"Untitled Design",
    canvasColor:"#ffffff",
    objects:[],
    selectedId:null,
    tool:"select",
    zoom:1,
    grid:true,
    snap:true,
    gridSize:10,
    history:[],
    future:[],
    draft:null,
    polygonPoints:[],
    action:null,
    playing:false,
    animationStart:0,
    textPoint:null
  };

  OVD.defaultAnimation = () => ({
    preset:"none",
    duration:4,
    amount:180,
    loop:true,
    delay:0
  });

  OVD.makeObject = function(type,x,y,w,h,extra={}){
    return {
      id:uid(),
      type,
      name:extra.name || type[0].toUpperCase()+type.slice(1),
      x,
      y,
      w:Math.max(8,Math.abs(w||80)),
      h:Math.max(8,Math.abs(h||80)),
      rotation:extra.rotation || 0,
      fill:extra.fill || "#6d6df6",
      fill2:extra.fill2 || null,
      stroke:extra.stroke || "#23334b",
      strokeWidth:extra.strokeWidth ?? 2,
      opacity:extra.opacity ?? 1,
      visible:extra.visible ?? true,
      locked:extra.locked ?? false,
      shadow:extra.shadow ?? false,
      points:extra.points || null,
      text:extra.text || "Text",
      fontSize:extra.fontSize || 34,
      children:extra.children || null,
      theme:extra.theme || null,
      animation:{...OVD.defaultAnimation(),...(extra.animation||{})},
      meta:extra.meta || {}
    };
  };

  OVD.selected = () => OVD.state.objects.find(o=>o.id===OVD.state.selectedId) || null;

  OVD.snapshot = () => ({
    projectName:OVD.state.projectName,
    canvasColor:OVD.state.canvasColor,
    objects:clone(OVD.state.objects)
  });

  OVD.pushHistory = function(){
    OVD.state.history.push(OVD.snapshot());
    if(OVD.state.history.length>80) OVD.state.history.shift();
    OVD.state.future=[];
  };

  OVD.restore = function(snapshot){
    if(!snapshot) return;
    OVD.state.projectName=snapshot.projectName || "Untitled Design";
    OVD.state.canvasColor=snapshot.canvasColor || "#ffffff";
    OVD.state.objects=clone(snapshot.objects || []);
    OVD.state.selectedId=null;
  };

  OVD.undo = function(){
    if(!OVD.state.history.length) return false;
    OVD.state.future.push(OVD.snapshot());
    OVD.restore(OVD.state.history.pop());
    return true;
  };

  OVD.redo = function(){
    if(!OVD.state.future.length) return false;
    OVD.state.history.push(OVD.snapshot());
    OVD.restore(OVD.state.future.pop());
    return true;
  };

  OVD.saveAuto = function(){
    localStorage.setItem("safayetOpenGLDesignerV3",JSON.stringify({
      projectName:OVD.state.projectName,
      canvasColor:OVD.state.canvasColor,
      objects:OVD.state.objects
    }));
  };

  OVD.loadAuto = function(){
    try{
      const value=JSON.parse(localStorage.getItem("safayetOpenGLDesignerV3"));
      if(!value) return;
      OVD.state.projectName=value.projectName || "Untitled Design";
      OVD.state.canvasColor=value.canvasColor || "#ffffff";
      OVD.state.objects=value.objects || [];
    }catch(error){
      console.warn("Autosave could not be loaded.",error);
    }
  };

  OVD.normalizePoints = function(points){
    const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
    const left=Math.min(...xs), right=Math.max(...xs);
    const top=Math.min(...ys), bottom=Math.max(...ys);
    const w=Math.max(1,right-left), h=Math.max(1,bottom-top);
    const cx=(left+right)/2, cy=(top+bottom)/2;
    return {
      x:cx,y:cy,w,h,
      points:points.map(p=>({x:(p.x-cx)/w,y:(p.y-cy)/h}))
    };
  };
})();