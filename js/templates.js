(function(){
  const rect=(x,y,w,h,fill,extra={})=>({type:'rect',x,y,w,h,fill,...extra});
  const ellipse=(x,y,w,h,fill,extra={})=>({type:'ellipse',x,y,w,h,fill,...extra});
  const triangle=(x,y,w,h,fill,extra={})=>({type:'triangle',x,y,w,h,fill,...extra});
  const polygon=(x,y,w,h,points,fill,extra={})=>({type:'polygon',x,y,w,h,points,fill,...extra});
  const line=(x,y,w,h,stroke,extra={})=>({type:'line',x,y,w,h,stroke,fill:stroke,...extra});
  const text=(x,y,w,h,value,fill,extra={})=>({type:'text',x,y,w,h,text:value,fill,...extra});
  const group=(name,w,h,children,extra={})=>({
    type:'group',name,x:500,y:325,w,h,baseW:w,baseH:h,rotation:0,fill:extra.fill||'#5f67e8',stroke:extra.stroke||'#26384f',strokeWidth:extra.strokeWidth??1,
    opacity:1,shadow:extra.shadow??true,shadowBlur:extra.shadowBlur??14,shadowY:extra.shadowY??7,children,animation:{preset:'none',duration:4,amount:160,loop:true,delay:0},...extra
  });
  const clone=v=>JSON.parse(JSON.stringify(v));

  function addCloud(children,x,y,s=1,opacity=.95){
    children.push(ellipse(x-38*s,y+4*s,72*s,32*s,'#ffffff',{fill2:'#eaf4ff',opacity,strokeWidth:0}));
    children.push(ellipse(x,y-6*s,82*s,48*s,'#ffffff',{fill2:'#eef7ff',opacity,strokeWidth:0}));
    children.push(ellipse(x+40*s,y+5*s,70*s,30*s,'#ffffff',{fill2:'#eaf4ff',opacity,strokeWidth:0}));
    children.push(rect(x,y+14*s,136*s,22*s,'#ffffff',{fill2:'#eef7ff',opacity,strokeWidth:0}));
  }
  function addMountain(children,x,y,w,h,base,top,opacity=1){
    children.push(polygon(x,y,w,h,[[-.5,.5],[-.23,.12],[-.08,.28],[.13,-.38],[.28,-.04],[.5,.5]],base,{fill2:top,opacity,strokeWidth:0}));
  }
  function addWindow(children,x,y,w,h,frame='#24384d',glass1='#71c5ec',glass2='#d8f3ff',rows=2,cols=2){
    children.push(rect(x,y,w,h,frame,{fill2:'#142435',stroke:'#0e1b28',strokeWidth:1.5}));
    children.push(rect(x,y,w-8,h-8,glass1,{fill2:glass2,strokeWidth:0}));
    for(let c=1;c<cols;c++) children.push(rect(x-w/2+(w*c/cols),y,2,h-8,'#f2fbff',{opacity:.86,strokeWidth:0}));
    for(let r=1;r<rows;r++) children.push(rect(x,y-h/2+(h*r/rows),w-8,2,'#f2fbff',{opacity:.86,strokeWidth:0}));
    children.push(polygon(x-w*.10,y-h*.09,w*.55,h*.55,[[-.5,.3],[.1,-.5],[.5,-.3],[-.1,.5]],'#ffffff',{opacity:.16,strokeWidth:0}));
  }
  function addStoneBase(children,x,y,w,h){
    children.push(rect(x,y,w,h,'#7c817f',{fill2:'#aeb4b0',stroke:'#5d6362',strokeWidth:1}));
    const rows=Math.max(1,Math.round(h/15)),cols=Math.max(2,Math.round(w/38));
    for(let r=0;r<rows;r++){
      const yy=y-h/2+(r+.5)*h/rows;
      for(let c=0;c<cols;c++){
        const xx=x-w/2+(c+.5)*w/cols+(r%2?10:0);
        children.push(rect(xx,yy,w/cols-4,h/rows-4,r%2?'#a9afa9':'#929993',{stroke:'#6b716e',strokeWidth:.7,opacity:.85}));
      }
    }
  }
  function addFoliage(children,x,y,scale=1,palette=['#2f7f42','#46984d','#68ad51','#89c85f']){
    const blobs=[[-32,4,58,48,0],[-8,-20,67,55,1],[25,-11,61,50,2],[38,18,54,43,0],[5,19,76,55,1],[-33,-23,46,40,3],[3,-48,47,41,2]];
    blobs.forEach(([dx,dy,w,h,ci],i)=>children.push(ellipse(x+dx*scale,y+dy*scale,w*scale,h*scale,palette[ci%palette.length],{fill2:palette[(ci+1)%palette.length],stroke:'#215d34',strokeWidth:.7,opacity:.98}))); 
  }
  function addTree(children,x,y,scale=1,variant='round'){
    children.push(ellipse(x,y+85*scale,90*scale,13*scale,'#15331e',{opacity:.13,strokeWidth:0}));
    children.push(polygon(x,y+46*scale,38*scale,100*scale,[[-.18,-.5],[.20,-.5],[.50,.5],[-.45,.5]],'#74492c',{fill2:'#3f2517',stroke:'#3c2518',strokeWidth:1.2}));
    children.push(line(x-4*scale,y+5*scale,55*scale,-65*scale,'#5b351e',{strokeWidth:8*scale}));
    children.push(line(x+6*scale,y+2*scale,-47*scale,-70*scale,'#5b351e',{strokeWidth:7*scale}));
    if(variant==='pine'){
      children.push(triangle(x,y+13*scale,110*scale,125*scale,'#25633a',{fill2:'#3c9855',stroke:'#17472b',strokeWidth:1}));
      children.push(triangle(x,y-28*scale,92*scale,115*scale,'#2c7442',{fill2:'#55a45e',stroke:'#17472b',strokeWidth:1}));
      children.push(triangle(x,y-64*scale,70*scale,95*scale,'#3a8a4d',{fill2:'#74b967',stroke:'#17472b',strokeWidth:1}));
    }else addFoliage(children,x,y-24*scale,scale);
  }
  function addBush(children,x,y,scale=1,palette=['#3d8d43','#5da54b','#80ba59']){
    children.push(ellipse(x-20*scale,y,45*scale,33*scale,palette[0],{fill2:palette[1],stroke:'#2f6d36',strokeWidth:.7}));
    children.push(ellipse(x+17*scale,y-4*scale,50*scale,39*scale,palette[1],{fill2:palette[2],stroke:'#2f6d36',strokeWidth:.7}));
    children.push(ellipse(x,y-14*scale,52*scale,38*scale,palette[2],{fill2:palette[1],stroke:'#2f6d36',strokeWidth:.7}));
  }
  function addFlowers(children,x,y,scale=1,colors=['#ff7aa8','#ffcf65','#ffffff']){
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2,rr=(i%3)*10*scale+8*scale;
      const cx=x+Math.cos(a)*rr,cy=y+Math.sin(a)*rr*.45;
      children.push(ellipse(cx,cy,7*scale,7*scale,colors[i%colors.length],{strokeWidth:0}));
      children.push(ellipse(cx,cy,2*scale,2*scale,'#f4b942',{strokeWidth:0}));
    }
  }
  function addFence(children,x,y,w,scale=1,color='#f8f5ea'){
    const count=Math.max(3,Math.floor(w/(32*scale)));
    for(let i=0;i<count;i++){
      const px=x-w/2+(i+.5)*w/count;
      children.push(rect(px,y,13*scale,54*scale,color,{fill2:'#dcd9ce',stroke:'#9aa0a2',strokeWidth:.8}));
      children.push(triangle(px,y-31*scale,13*scale,16*scale,color,{stroke:'#9aa0a2',strokeWidth:.8}));
    }
    children.push(rect(x,y-9*scale,w,8*scale,color,{fill2:'#e5e2d8',stroke:'#9aa0a2',strokeWidth:.8}));
    children.push(rect(x,y+13*scale,w,8*scale,color,{fill2:'#e5e2d8',stroke:'#9aa0a2',strokeWidth:.8}));
  }
  function addRoad(children,y,w=1000){
    children.push(rect(0,y,w,115,'#3f4754',{fill2:'#252c35',strokeWidth:0}));
    children.push(rect(0,y-58,w,8,'#b7bec6',{fill2:'#e8edf2',strokeWidth:0}));
    children.push(rect(0,y-70,w,24,'#d9dde1',{fill2:'#f4f5f7',strokeWidth:0}));
    for(let x=-430;x<=430;x+=120) children.push(rect(x,y+5,65,6,'#f3f5f7',{strokeWidth:0}));
  }
  function addStreetLampChildren(children,x,y,scale=1){
    children.push(rect(x,y,9*scale,105*scale,'#1a2635',{fill2:'#34455a',stroke:'#0e1824',strokeWidth:.8}));
    children.push(rect(x,y-53*scale,28*scale,5*scale,'#24354a',{strokeWidth:0}));
    children.push(line(x+12*scale,y-52*scale,24*scale,-18*scale,'#24354a',{strokeWidth:5*scale}));
    children.push(ellipse(x+25*scale,y-69*scale,27*scale,14*scale,'#ffe7a2',{fill2:'#fff8db',stroke:'#27364a',strokeWidth:1}));
    children.push(ellipse(x+25*scale,y-69*scale,40*scale,22*scale,'#ffd66b',{opacity:.12,strokeWidth:0}));
  }
  function addBird(children,x,y,scale=1){
    children.push(line(x-10*scale,y,20*scale,-8*scale,'#172636',{strokeWidth:2.4*scale}));
    children.push(line(x+10*scale,y,-20*scale,-8*scale,'#172636',{strokeWidth:2.4*scale}));
  }

  function buildHouseCore(modern=true){
    const c=[];
    if(modern){
      c.push(rect(-55,28,340,280,'#efe7dc',{fill2:'#c9d4de',stroke:'#35475d',strokeWidth:2,theme:true}));
      c.push(rect(-193,32,72,272,'#315eab',{fill2:'#173a7c',stroke:'#25394f',strokeWidth:2,theme:true}));
      c.push(polygon(-40,-126,440,110,[[-.5,.25],[-.39,-.28],[.5,-.28],[.42,.25]],'#263950',{fill2:'#111e30',stroke:'#111b2a',strokeWidth:2}));
      c.push(rect(65,-5,165,118,'#dce8ef',{fill2:'#ffffff',stroke:'#536579',strokeWidth:1.5}));
      addWindow(c,66,-9,150,103,'#32475d','#67bce7','#d5f4ff',2,3);
      c.push(rect(-174,44,62,124,'#26364b',{fill2:'#132238',stroke:'#101a27',strokeWidth:1.5}));
      addWindow(c,-174,14,33,47,'#26364b','#6ebada','#d9f4ff',1,1);
      c.push(rect(63,102,270,20,'#f3f4f5',{fill2:'#c8d0d8',stroke:'#6f7d8c',strokeWidth:1}));
      c.push(rect(-174,120,105,15,'#c4ccd5',{fill2:'#929da8',stroke:'#687482',strokeWidth:1}));
      c.push(rect(160,120,72,16,'#9faab7',{fill2:'#cbd3db',stroke:'#6d7885',strokeWidth:1}));
    }else{
      c.push(rect(-25,35,330,270,'#ecd9ba',{fill2:'#f8ead2',stroke:'#665648',strokeWidth:2,theme:true}));
      c.push(polygon(-55,-120,430,180,[[-.5,.35],[0,-.5],[.5,.35]],'#23384a',{fill2:'#102435',stroke:'#0a1723',strokeWidth:2}));
      c.push(rect(155,72,220,190,'#e2caaa',{fill2:'#f0dfc5',stroke:'#665648',strokeWidth:2,theme:true}));
      c.push(polygon(155,-25,250,110,[[-.5,.35],[.45,.35],[.23,-.35],[-.45,-.35]],'#263c50',{fill2:'#122536',stroke:'#0d1b27',strokeWidth:2}));
      addWindow(c,-105,-28,62,78,'#293c4f','#66b9dc','#d7f4ff',2,2);
      addWindow(c,15,-28,62,78,'#293c4f','#66b9dc','#d7f4ff',2,2);
      addWindow(c,-85,85,94,78,'#293c4f','#66b9dc','#d7f4ff',2,3);
      c.push(ellipse(-45,-91,43,43,'#d9ecf5',{stroke:'#314759',strokeWidth:5}));
      c.push(line(-45,-91,0,37,'#314759',{strokeWidth:3}));
      c.push(line(-45,-91,37,0,'#314759',{strokeWidth:3}));
      c.push(rect(30,100,62,115,'#5b341f',{fill2:'#321d12',stroke:'#24150d',strokeWidth:2}));
      c.push(rect(30,100,42,92,'#70432a',{fill2:'#3f2518',stroke:'#2a190f',strokeWidth:1}));
      c.push(rect(158,95,150,110,'#6e3c22',{fill2:'#3d2419',stroke:'#24150d',strokeWidth:2}));
      for(let i=-45;i<=45;i+=30)c.push(line(158,95,130,i,'#412416',{strokeWidth:1.2}));
      c.push(rect(28,45,100,13,'#f3f0e9',{fill2:'#d4d2cb',stroke:'#77746c',strokeWidth:1}));
      c.push(triangle(28,22,108,62,'#253b4f',{fill2:'#142535',stroke:'#0e1a26',strokeWidth:1.5}));
      c.push(rect(-10,79,10,84,'#f1eee6',{fill2:'#d2d1cb',stroke:'#77746c',strokeWidth:1}));
      c.push(rect(66,79,10,84,'#f1eee6',{fill2:'#d2d1cb',stroke:'#77746c',strokeWidth:1}));
      addStoneBase(c,-25,158,330,45); addStoneBase(c,155,158,220,45);
      c.push(rect(90,-164,36,72,'#76503a',{fill2:'#422b20',stroke:'#2a1b14',strokeWidth:1.5}));
      for(let y=-185;y<-140;y+=14)c.push(line(90,y,35,0,'#2e1d16',{strokeWidth:1}));
    }
    return c;
  }
  function modernHouseAsset(){return group('Modern Smart House',430,340,buildHouseCore(true),{fill:'#315eab',shadow:true});}
  function classicHouseAsset(){return group('Detailed Family House',500,390,buildHouseCore(false),{fill:'#ecd9ba',shadow:true});}

  function sedanAsset(){
    const c=[];
    c.push(ellipse(0,72,300,23,'#0c1a2a',{opacity:.13,strokeWidth:0}));
    c.push(polygon(0,14,360,125,[[-.49,.18],[-.39,-.03],[-.20,-.20],[.16,-.20],[.31,-.04],[.45,.05],[.49,.22],[.40,.34],[-.45,.34]],'#374552',{fill2:'#141d26',stroke:'#101821',strokeWidth:2,theme:true}));
    c.push(polygon(-25,-17,240,74,[[-.48,.05],[-.30,-.38],[.20,-.38],[.48,.20],[-.42,.20]],'#76bfe2',{fill2:'#d9f3ff',stroke:'#e5f8ff',strokeWidth:1.4}));
    c.push(line(-25,-10,0,65,'#1c2a39',{strokeWidth:4}));
    c.push(line(55,-10,0,63,'#1c2a39',{strokeWidth:4}));
    c.push(rect(-130,21,34,10,'#e3f5ff',{fill2:'#f9ffff',stroke:'#8598a9',strokeWidth:1}));
    c.push(rect(144,28,30,9,'#ff6967',{fill2:'#9e2221',stroke:'#701918',strokeWidth:1}));
    c.push(ellipse(-108,56,69,69,'#111820',{fill2:'#05080c',stroke:'#05080c',strokeWidth:1.5}));
    c.push(ellipse(108,56,69,69,'#111820',{fill2:'#05080c',stroke:'#05080c',strokeWidth:1.5}));
    c.push(ellipse(-108,56,38,38,'#c9d2dc',{fill2:'#606f7e',stroke:'#2c3741',strokeWidth:1}));
    c.push(ellipse(108,56,38,38,'#c9d2dc',{fill2:'#606f7e',stroke:'#2c3741',strokeWidth:1}));
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,dx=Math.cos(a)*12,dy=Math.sin(a)*12;
      c.push(line(-108,56,dx*2,dy*2,'#303a45',{strokeWidth:3}));
      c.push(line(108,56,dx*2,dy*2,'#303a45',{strokeWidth:3}));
    }
    c.push(rect(-18,23,30,4,'#758391',{opacity:.55,strokeWidth:0}));
    c.push(rect(52,23,30,4,'#758391',{opacity:.55,strokeWidth:0}));
    return group('Professional Sedan',390,170,c,{fill:'#374552',shadow:true});
  }
  function busAsset(animated=false){
    const c=[];
    c.push(ellipse(0,78,380,22,'#102033',{opacity:.13,strokeWidth:0}));
    c.push(rect(0,14,410,125,'#f1f2f3',{fill2:'#c9d1d9',stroke:'#46576a',strokeWidth:2}));
    c.push(rect(-8,-4,386,72,'#9dd8f0',{fill2:'#dff6ff',stroke:'#557083',strokeWidth:1.5}));
    c.push(rect(0,47,410,28,'#2f8bd5',{fill2:'#1164aa',strokeWidth:0,theme:true}));
    for(let x=-155;x<=115;x+=54)c.push(rect(x,-4,44,61,'#7dc7e6',{fill2:'#d8f3ff',stroke:'#3c5569',strokeWidth:1}));
    c.push(rect(158,10,54,78,'#415464',{fill2:'#1c2a36',stroke:'#18242f',strokeWidth:1}));
    c.push(rect(167,-4,34,51,'#9bd9f1',{fill2:'#e8faff',strokeWidth:0}));
    c.push(rect(-190,42,20,24,'#f1d36e',{fill2:'#fff5bb',stroke:'#7b6a31',strokeWidth:1}));
    c.push(ellipse(-130,66,66,66,'#121920',{fill2:'#05080d',stroke:'#05080d',strokeWidth:1.5}));
    c.push(ellipse(135,66,66,66,'#121920',{fill2:'#05080d',stroke:'#05080d',strokeWidth:1.5}));
    c.push(ellipse(-130,66,35,35,'#c7d0d8',{fill2:'#596a78',stroke:'#26323c',strokeWidth:1}));
    c.push(ellipse(135,66,35,35,'#c7d0d8',{fill2:'#596a78',stroke:'#26323c',strokeWidth:1}));
    const g=group('Modern City Bus',450,190,c,{fill:'#2f8bd5',shadow:true});
    if(animated)g.animation={preset:'slide',duration:8,amount:1150,loop:true,delay:0};
    return g;
  }
  function treeAsset(){const c=[];addTree(c,0,-5,1.65);return group('Professional Tree',260,340,c,{fill:'#4a9d4e',shadow:true});}
  function cloudAsset(){const c=[];addCloud(c,0,0,1.45);return group('Soft Cloud',250,120,c,{fill:'#ffffff',shadow:false});}
  function streetLampAsset(){const c=[];addStreetLampChildren(c,0,0,1.45);return group('Street Lamp',100,220,c,{fill:'#25364a',shadow:true});}
  function trafficSignalAsset(){
    const c=[];c.push(rect(0,47,12,130,'#172335',{fill2:'#35465c',stroke:'#0e1824',strokeWidth:1}));c.push(rect(0,-28,48,104,'#162233',{fill2:'#09121e',stroke:'#0a111a',strokeWidth:2}));
    c.push(ellipse(0,-58,22,22,'#ef4d55',{fill2:'#9c1d24',stroke:'#431014',strokeWidth:1}));c.push(ellipse(0,-29,22,22,'#f0c744',{fill2:'#9a771d',stroke:'#46360f',strokeWidth:1}));c.push(ellipse(0,0,22,22,'#2fd06f',{fill2:'#14783e',stroke:'#0d4727',strokeWidth:1}));
    c.push(rect(0,115,58,10,'#26374c',{fill2:'#111d2b',strokeWidth:0}));return group('Traffic Signal',90,240,c,{fill:'#25364a',shadow:true});
  }
  function officeTowerAsset(){
    const c=[];c.push(rect(0,5,230,330,'#d8e0e7',{fill2:'#8095aa',stroke:'#34495f',strokeWidth:2}));c.push(rect(-72,5,46,330,'#304a66',{fill2:'#182d42',strokeWidth:0}));c.push(rect(72,5,46,330,'#304a66',{fill2:'#182d42',strokeWidth:0}));c.push(rect(0,-177,250,22,'#40556b',{fill2:'#23374b',strokeWidth:0}));
    for(let y=-130;y<=120;y+=48)for(let x=-38;x<=38;x+=76)addWindow(c,x,y,55,31,'#31475c','#5db8e4','#d8f5ff',1,1);
    c.push(rect(0,143,72,42,'#1f3348',{fill2:'#102134',stroke:'#0b1723',strokeWidth:1}));return group('Office Tower',280,390,c,{fill:'#506b83',shadow:true});
  }
  function humanAsset(){
    const c=[];c.push(ellipse(0,133,100,14,'#17263b',{opacity:.13,strokeWidth:0}));c.push(ellipse(0,-115,62,70,'#d8a17d',{fill2:'#f3c6a1',stroke:'#6f4a34',strokeWidth:1}));
    c.push(ellipse(-7,-137,64,36,'#3e281e',{fill2:'#17100d',strokeWidth:0}));c.push(polygon(0,-25,150,195,[[-.30,-.5],[.30,-.5],[.47,.15],[.27,.50],[-.27,.50],[-.47,.15]],'#263a67',{fill2:'#101d38',stroke:'#111d2c',strokeWidth:1.5,theme:true}));
    c.push(triangle(0,-63,58,96,'#f7f9fc',{fill2:'#dfe5ed',stroke:'#c0c7d0',strokeWidth:.8}));c.push(triangle(0,-48,18,75,'#9a2736',{fill2:'#5e1520',strokeWidth:0}));
    c.push(polygon(-77,3,60,190,[[-.1,-.5],[.25,-.46],[.48,.47],[.05,.5]],'#263a67',{fill2:'#101d38',stroke:'#111d2c',strokeWidth:1.2,theme:true}));c.push(polygon(77,3,60,190,[[-.25,-.46],[.1,-.5],[-.05,.5],[-.48,.47]],'#263a67',{fill2:'#101d38',stroke:'#111d2c',strokeWidth:1.2,theme:true}));
    c.push(polygon(-30,102,58,175,[[-.38,-.5],[.22,-.5],[.46,.5],[-.28,.5]],'#18253d',{fill2:'#0d1728',stroke:'#0a111c',strokeWidth:1}));c.push(polygon(30,102,58,175,[[-.22,-.5],[.38,-.5],[.28,.5],[-.46,.5]],'#18253d',{fill2:'#0d1728',stroke:'#0a111c',strokeWidth:1}));c.push(ellipse(-39,189,72,24,'#5a341f',{fill2:'#2f1b12',stroke:'#21130d',strokeWidth:1}));c.push(ellipse(39,189,72,24,'#5a341f',{fill2:'#2f1b12',stroke:'#21130d',strokeWidth:1}));
    return group('Professional Person',230,440,c,{fill:'#263a67',shadow:true});
  }
  function robotAsset(){
    const c=[];c.push(ellipse(0,150,140,18,'#14253a',{opacity:.14,strokeWidth:0}));c.push(rect(0,-112,150,103,'#edf3fa',{fill2:'#aebdd0',stroke:'#4d647d',strokeWidth:2}));c.push(rect(0,-112,118,73,'#12233d',{fill2:'#020813',stroke:'#05101c',strokeWidth:1.5}));c.push(ellipse(-30,-115,20,31,'#55e7ff',{fill2:'#2d85ff',strokeWidth:0}));c.push(ellipse(30,-115,20,31,'#55e7ff',{fill2:'#2d85ff',strokeWidth:0}));c.push(line(0,-95,40,0,'#52ddff',{strokeWidth:4}));
    c.push(polygon(0,-8,185,155,[[-.38,-.5],[.38,-.5],[.5,.10],[.30,.50],[-.30,.50],[-.5,.10]],'#e9f0f7',{fill2:'#91a9c5',stroke:'#425a74',strokeWidth:2,theme:true}));c.push(ellipse(0,-15,50,50,'#2f91ff',{fill2:'#66e2ff',stroke:'#2a5f9d',strokeWidth:2}));c.push(ellipse(0,-15,22,22,'#e9fcff',{strokeWidth:0}));
    c.push(ellipse(-103,-20,47,47,'#cbd8e8',{fill2:'#7893b1',stroke:'#425a74',strokeWidth:1.5}));c.push(ellipse(103,-20,47,47,'#cbd8e8',{fill2:'#7893b1',stroke:'#425a74',strokeWidth:1.5}));c.push(rect(-127,47,50,145,'#e9f0f7',{fill2:'#8fa8c4',stroke:'#425a74',strokeWidth:1.5,rotation:8}));c.push(rect(127,47,50,145,'#e9f0f7',{fill2:'#8fa8c4',stroke:'#425a74',strokeWidth:1.5,rotation:-8}));c.push(ellipse(-137,120,60,45,'#dfe8f2',{fill2:'#6f8fac',stroke:'#425a74',strokeWidth:1.5}));c.push(ellipse(137,120,60,45,'#dfe8f2',{fill2:'#6f8fac',stroke:'#425a74',strokeWidth:1.5}));
    c.push(polygon(-45,120,75,170,[[-.28,-.5],[.32,-.5],[.46,.5],[-.35,.5]],'#dfe8f2',{fill2:'#7e9ab8',stroke:'#425a74',strokeWidth:1.5}));c.push(polygon(45,120,75,170,[[-.32,-.5],[.28,-.5],[.35,.5],[-.46,.5]],'#dfe8f2',{fill2:'#7e9ab8',stroke:'#425a74',strokeWidth:1.5}));c.push(ellipse(-56,206,105,46,'#e8eef5',{fill2:'#6f8fac',stroke:'#425a74',strokeWidth:1.5}));c.push(ellipse(56,206,105,46,'#e8eef5',{fill2:'#6f8fac',stroke:'#425a74',strokeWidth:1.5}));
    return group('Service Robot',320,500,c,{fill:'#e9f0f7',shadow:true});
  }

  function modernHomeScene(){
    const c=[];
    c.push(rect(0,-135,1000,380,'#85c9ef',{fill2:'#d9f2ff',strokeWidth:0}));c.push(ellipse(-375,-260,70,70,'#ffd766',{fill2:'#fff1a5',strokeWidth:0}));addCloud(c,-270,-230,.8);addCloud(c,255,-245,.9);addCloud(c,0,-195,.55,.8);
    addMountain(c,-270,-25,520,260,'#91b9c8','#cfe2e8',.85);addMountain(c,150,-10,630,300,'#6fa68b','#bdd6b9',.86);addMountain(c,370,25,470,230,'#4d8866','#93c294',.8);
    c.push(rect(0,115,1000,270,'#6fae46',{fill2:'#b2d56f',strokeWidth:0}));c.push(polygon(0,205,380,275,[[-.12,-.5],[.18,-.5],[.5,.5],[-.5,.5]],'#d6c3a7',{fill2:'#f2e7d8',stroke:'#b4a48e',strokeWidth:1}));c.push(polygon(245,210,300,260,[[-.5,-.5],[.25,-.5],[.5,.5],[-.12,.5]],'#a5a7aa',{fill2:'#d5d6d7',stroke:'#878a8d',strokeWidth:1}));
    const house=buildHouseCore(false);house.forEach(ch=>{ch.x=(ch.x||0)-25;ch.y=(ch.y||0)+10;c.push(ch);});
    addTree(c,-360,45,1.15);addTree(c,345,80,.78,'pine');addBush(c,-145,170,.9);addFlowers(c,-145,160,.8);addBush(c,345,175,.8);addFlowers(c,345,168,.7,['#ffd966','#fff','#ff8b9d']);addFence(c,-310,245,315,.8);addFence(c,360,245,230,.8);addRoad(c,292,1000);
    return [group('Professional Home Scene',1000,650,c,{fill:'#ecd9ba',shadow:false})];
  }
  function smartHomeScene(){
    const c=[];c.push(rect(0,-140,1000,370,'#87c9ee',{fill2:'#e5f6ff',strokeWidth:0}));addCloud(c,-280,-220,.8);addCloud(c,275,-230,.9);c.push(rect(0,110,1000,280,'#7eb251',{fill2:'#c0da80',strokeWidth:0}));
    for(let x=-460;x<=460;x+=115)c.push(rect(x,-20,70,190,'#b4cedd',{fill2:'#dbe8ef',opacity:.32,strokeWidth:0}));
    const h=buildHouseCore(true);h.forEach(ch=>{ch.x=(ch.x||0)-35;ch.y=(ch.y||0)+35;c.push(ch);});
    c.push(rect(280,80,190,120,'#dbe4eb',{fill2:'#f7f9fb',stroke:'#40536a',strokeWidth:1.5}));c.push(rect(280,80,160,90,'#3e4e60',{fill2:'#192837',stroke:'#182330',strokeWidth:1.5}));for(let y=45;y<=110;y+=18)c.push(line(280,y,150,0,'#101a25',{strokeWidth:1}));
    c.push(polygon(-25,215,225,180,[[-.35,-.5],[.28,-.5],[.5,.5],[-.5,.5]],'#dfe3e7',{fill2:'#f8f9fa',stroke:'#b8bec5',strokeWidth:1}));c.push(rect(250,220,330,155,'#b7bdc4',{fill2:'#e5e8eb',strokeWidth:0}));addTree(c,375,60,.88);addBush(c,-275,180,.9);addBush(c,365,195,.65);addStreetLampChildren(c,450,185,.72);addRoad(c,295,1000);
    return [group('Smart Home Scene',1000,650,c,{fill:'#315eab',shadow:false})];
  }
  function cityScene(){
    const c=[];c.push(rect(0,-140,1000,380,'#83c8ef',{fill2:'#e1f5ff',strokeWidth:0}));c.push(ellipse(-390,-260,65,65,'#ffd563',{fill2:'#fff1a6',strokeWidth:0}));addCloud(c,-285,-220,.8);addCloud(c,285,-245,.85);addCloud(c,40,-200,.6,.8);
    // background skyline
    const back=[[-455,-30,80,220],[-365,-55,95,175],[-260,-20,75,245],[-160,-65,100,155],[-40,-30,80,225],[70,-55,95,175],[185,-15,70,255],[300,-60,90,165],[420,-35,80,215]];
    back.forEach(([x,y,w,h],i)=>{c.push(rect(x,y,w,h,i%2?'#7aa9c5':'#6b9cb9',{fill2:'#c2dce9',opacity:.45,strokeWidth:0}));for(let wy=y-h/2+25;wy<y+h/2-15;wy+=35)for(let wx=x-w/2+18;wx<x+w/2-10;wx+=24)c.push(rect(wx,wy,8,12,'#d5e8f1',{opacity:.30,strokeWidth:0}));});
    function building(x,baseY,w,h,body,body2,roof='#6d7783',cols=4,rows=6){
      c.push(rect(x,baseY-h/2,w,h,body,{fill2:body2,stroke:'#536273',strokeWidth:1.2}));c.push(rect(x,baseY-h-7,w+12,14,roof,{fill2:'#424e5a',strokeWidth:0}));
      for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){
        const wx=x-w/2+18+col*(w-36)/(cols-1),wy=baseY-h+28+r*(h-52)/(rows-1);
        c.push(rect(wx,wy,14,20,'#6ea8c9',{fill2:'#d5effa',stroke:'#405b6b',strokeWidth:.7}));
      }
    }
    building(-430,155,135,230,'#d8bd9f','#f1dfc8','#bb9c7a',3,5);building(-235,155,165,380,'#416b91','#9fb6c9','#4e6071',4,8);building(-65,155,130,245,'#d9d1c8','#f0e8df','#b7aca1',3,5);building(75,155,120,210,'#b75d52','#df998c','#93443b',3,4);building(215,155,135,290,'#5c6672','#aab4bf','#46515c',3,6);building(380,155,130,350,'#687f91','#b4c5d2','#c15045',3,7);building(485,155,110,250,'#e0c5aa','#f3dfc8','#b35c4c',3,5);
    c.push(rect(0,180,1000,75,'#d1d5d9',{fill2:'#eff1f2',strokeWidth:0}));for(let x=-430;x<=430;x+=120)addStreetLampChildren(c,x,155,.55);for(let x=-380;x<=420;x+=160)addTree(c,x,105,.55,x%320===0?'pine':'round');
    c.push(rect(80,132,110,10,'#725237',{fill2:'#3a281b',strokeWidth:0}));c.push(rect(80,148,90,7,'#725237',{strokeWidth:0}));c.push(rect(45,155,8,58,'#38485b',{strokeWidth:0}));c.push(rect(115,155,8,58,'#38485b',{strokeWidth:0}));
    c.push(rect(300,120,10,78,'#304359',{strokeWidth:0}));c.push(rect(300,76,40,55,'#d7eef8',{fill2:'#7dc4e5',stroke:'#31485d',strokeWidth:1}));c.push(rect(300,75,25,25,'#2b8fd7',{fill2:'#76c6eb',strokeWidth:0}));
    addRoad(c,285,1000);addBird(c,225,-215,.9);addBird(c,285,-190,.7);addBird(c,340,-225,.65);
    const background=group('Professional City Scene',1000,650,c,{fill:'#6d7b88',shadow:false});
    const bus=busAsset(true);bus.x=850;bus.y=515;bus.w=360;bus.h=152;bus.animation={preset:'slide',duration:9,amount:760,loop:true,delay:0};
    return [background,bus];
  }
  function villageScene(){
    const c=[];c.push(rect(0,-150,1000,360,'#8fd0f0',{fill2:'#e6f7ff',strokeWidth:0}));c.push(ellipse(-365,-250,70,70,'#ffd466',{fill2:'#fff0a0',strokeWidth:0}));addCloud(c,-220,-225,.7);addCloud(c,265,-240,.85);addMountain(c,-200,-20,680,260,'#7da78a','#bdd3b5',.8);addMountain(c,280,-10,600,250,'#4d8761','#94be89',.85);c.push(rect(0,110,1000,300,'#66a842',{fill2:'#b6d46f',strokeWidth:0}));c.push(polygon(0,205,230,300,[[-.22,-.5],[.22,-.5],[.5,.5],[-.5,.5]],'#c4a77b',{fill2:'#ead7b5',strokeWidth:0}));
    // hut
    c.push(rect(-120,65,250,180,'#c78443',{fill2:'#e3b66d',stroke:'#664020',strokeWidth:1.5}));c.push(polygon(-120,-47,330,150,[[-.5,.30],[0,-.5],[.5,.30]],'#8c642c',{fill2:'#d1a956',stroke:'#5e431f',strokeWidth:1.5}));for(let y=-78;y<-25;y+=10)c.push(line(-120,y,250,0,'#63471f',{strokeWidth:1}));addWindow(c,-185,45,58,65,'#50361e','#65b8d8','#d6f3ff',2,2);addWindow(c,-55,45,58,65,'#50361e','#65b8d8','#d6f3ff',2,2);c.push(rect(-120,90,60,110,'#5b381f',{fill2:'#302015',stroke:'#24160e',strokeWidth:1}));
    addTree(c,-365,80,1.1);addTree(c,330,85,.9);addTree(c,440,105,.65,'pine');addFence(c,-320,230,260,.7);addFence(c,340,230,270,.7);addBush(c,-245,160,.8);addFlowers(c,-245,155,.7);addBush(c,235,170,.8);c.push(ellipse(350,185,270,65,'#5eb4cf',{fill2:'#bfeaf4',strokeWidth:0,opacity:.85}));c.push(polygon(360,178,120,35,[[-.5,0],[.5,0],[.30,.5],[-.28,.5]],'#704021',{fill2:'#3a2215',stroke:'#2b180e',strokeWidth:1}));
    addRoad(c,295,1000);return [group('Village Landscape Scene',1000,650,c,{fill:'#c78443',shadow:false})];
  }
  function parkScene(){
    const c=[];c.push(rect(0,-145,1000,370,'#88cbef',{fill2:'#e0f5ff',strokeWidth:0}));addCloud(c,-280,-225,.75);addCloud(c,250,-230,.85);c.push(rect(0,105,1000,300,'#65aa48',{fill2:'#b8d778',strokeWidth:0}));c.push(polygon(0,190,330,300,[[-.18,-.5],[.18,-.5],[.5,.5],[-.5,.5]],'#d6c4a4',{fill2:'#f3e7d5',strokeWidth:0}));
    for(const [x,s] of [[-390,.9],[-245,.7],[260,.75],[410,.9]])addTree(c,x,75,s);for(const [x,y] of [[-160,155],[165,150]]){c.push(rect(x,y,110,12,'#775438',{fill2:'#3f2b1c',strokeWidth:0}));c.push(rect(x,y+18,95,8,'#775438',{strokeWidth:0}));c.push(rect(x-38,y+38,8,55,'#3a4b5d',{strokeWidth:0}));c.push(rect(x+38,y+38,8,55,'#3a4b5d',{strokeWidth:0}));}
    // fountain
    c.push(ellipse(0,120,200,55,'#aab5bf',{fill2:'#e8edf1',stroke:'#697581',strokeWidth:1}));c.push(ellipse(0,112,170,38,'#62b5d2',{fill2:'#c9edf6',stroke:'#467f92',strokeWidth:1}));c.push(rect(0,60,42,95,'#aab5bf',{fill2:'#e8edf1',stroke:'#697581',strokeWidth:1}));c.push(ellipse(0,15,105,35,'#b6c0c9',{fill2:'#f1f4f6',stroke:'#697581',strokeWidth:1}));c.push(ellipse(0,8,82,24,'#6ec1dc',{fill2:'#d8f3fa',strokeWidth:0}));c.push(line(0,-20,0,58,'#71cbe5',{strokeWidth:5}));
    addStreetLampChildren(c,-315,155,.72);addStreetLampChildren(c,315,155,.72);for(let x=-430;x<=430;x+=95){addBush(c,x,215,.45);addFlowers(c,x,208,.36);}addRoad(c,300,1000);return [group('Professional Park Scene',1000,650,c,{fill:'#65aa48',shadow:false})];
  }
  function schoolScene(){
    const c=[];c.push(rect(0,-150,1000,360,'#8acdf0',{fill2:'#e6f7ff',strokeWidth:0}));addCloud(c,-270,-230,.7);addCloud(c,265,-235,.85);c.push(rect(0,105,1000,300,'#6eaa48',{fill2:'#b8d47a',strokeWidth:0}));c.push(rect(0,30,650,300,'#e5d3b5',{fill2:'#fff1d6',stroke:'#776856',strokeWidth:1.5}));c.push(rect(0,-126,680,30,'#9f4639',{fill2:'#6d2822',strokeWidth:0}));c.push(rect(-250,0,150,330,'#d6b787',{fill2:'#f4dfba',stroke:'#776856',strokeWidth:1.5}));c.push(rect(250,0,150,330,'#d6b787',{fill2:'#f4dfba',stroke:'#776856',strokeWidth:1.5}));
    for(let y=-70;y<=65;y+=67)for(let x=-270;x<=270;x+=90)addWindow(c,x,y,58,42,'#3c5163','#69bddd','#d9f5ff',2,2);c.push(rect(0,102,86,140,'#56331f',{fill2:'#2c1b12',stroke:'#20130d',strokeWidth:1.5}));c.push(rect(0,-94,260,46,'#173c72',{fill2:'#2b619c',strokeWidth:0}));c.push(text(0,-93,210,30,'SOUTHEAST SCHOOL','#ffffff',{fontSize:22,strokeWidth:0}));
    c.push(rect(390,40,10,220,'#35485c',{strokeWidth:0}));c.push(polygon(450,-55,110,60,[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],'#1eaa59',{strokeWidth:0}));c.push(ellipse(405,-55,45,45,'#d9363e',{strokeWidth:0}));addTree(c,-420,90,.78);addTree(c,420,120,.6);c.push(polygon(0,220,180,240,[[-.28,-.5],[.28,-.5],[.5,.5],[-.5,.5]],'#d4c1a0',{fill2:'#f1e4d2',strokeWidth:0}));addRoad(c,295,1000);return [group('School Campus Scene',1000,650,c,{fill:'#e5d3b5',shadow:false})];
  }
  function robotLabScene(){
    const c=[];c.push(rect(0,0,1000,650,'#dfe9f3',{fill2:'#f8fbfe',strokeWidth:0}));c.push(rect(0,-205,1000,120,'#b8c8d7',{fill2:'#e7eef4',strokeWidth:0}));c.push(rect(0,215,1000,220,'#7f8c99',{fill2:'#c5ccd2',strokeWidth:0}));for(let x=-420;x<=420;x+=140)c.push(line(x,215,0,220,'#697580',{strokeWidth:1}));for(let y=130;y<=310;y+=60)c.push(line(0,y,1000,0,'#697580',{strokeWidth:1}));
    c.push(rect(-300,-10,240,180,'#25384c',{fill2:'#101d2c',stroke:'#0c1621',strokeWidth:1.5}));c.push(rect(-300,-25,205,120,'#5dc0e8',{fill2:'#d8f5ff',stroke:'#2f566c',strokeWidth:1}));c.push(line(-300,-25,165,0,'#ffffff',{strokeWidth:2,opacity:.6}));c.push(line(-300,-25,0,90,'#ffffff',{strokeWidth:2,opacity:.6}));c.push(rect(-300,110,290,20,'#526274',{fill2:'#2b3847',strokeWidth:0}));
    c.push(rect(290,-20,280,190,'#31475c',{fill2:'#17293a',stroke:'#0d1b28',strokeWidth:1.5}));for(let y=-70;y<=35;y+=52)for(let x=210;x<=370;x+=80)c.push(rect(x,y,52,34,'#58bde7',{fill2:'#cef3ff',stroke:'#2f566c',strokeWidth:1}));c.push(rect(290,115,340,25,'#526274',{fill2:'#2b3847',strokeWidth:0}));
    for(let x=-420;x<=420;x+=210)c.push(ellipse(x,-250,120,22,'#fff5c8',{fill2:'#ffffff',stroke:'#7c8792',strokeWidth:1}));const robot=robotAsset();robot.x=500;robot.y=350;robot.w=230;robot.h=360;return [group('Robot Laboratory',1000,650,c,{fill:'#dfe9f3',shadow:false}),robot];
  }

  const assets=[
    {id:'homeScene',name:'Home Scene',category:'scene',factory:modernHomeScene},
    {id:'smartHomeScene',name:'Smart Home Scene',category:'scene',factory:smartHomeScene},
    {id:'cityScene',name:'Modern City Scene',category:'scene',factory:cityScene},
    {id:'villageScene',name:'Village Scene',category:'scene',factory:villageScene},
    {id:'parkScene',name:'Park Scene',category:'scene',factory:parkScene},
    {id:'schoolScene',name:'School Campus',category:'scene',factory:schoolScene},
    {id:'robotLabScene',name:'Robot Laboratory',category:'scene',factory:robotLabScene},
    {id:'classicHouse',name:'Detailed House',category:'architecture',factory:()=>[classicHouseAsset()]},
    {id:'modernHouse',name:'Modern Smart House',category:'architecture',factory:()=>[modernHouseAsset()]},
    {id:'officeTower',name:'Office Tower',category:'architecture',factory:()=>[officeTowerAsset()]},
    {id:'sedan',name:'Professional Sedan',category:'vehicle',factory:()=>[sedanAsset()]},
    {id:'bus',name:'City Bus',category:'vehicle',factory:()=>[busAsset(false)]},
    {id:'human',name:'Professional Person',category:'people',factory:()=>[humanAsset()]},
    {id:'robot',name:'Service Robot',category:'technology',factory:()=>[robotAsset()]},
    {id:'tree',name:'Professional Tree',category:'nature',factory:()=>[treeAsset()]},
    {id:'cloud',name:'Soft Cloud',category:'nature',factory:()=>[cloudAsset()]},
    {id:'streetLamp',name:'Street Lamp',category:'street',factory:()=>[streetLampAsset()]},
    {id:'trafficSignal',name:'Traffic Signal',category:'street',factory:()=>[trafficSignalAsset()]}
  ];

  window.OVDTemplates={assets,clone,group,rect,ellipse,triangle,polygon,line,text};
})();
