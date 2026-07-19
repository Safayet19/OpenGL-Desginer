(function(){
  const OVD=window.OVD;
  const {WIDTH:W,HEIGHT:H}=OVD.constants;
  const M=OVD.makeObject;

  const child=(type,x,y,w,h,fill,extra={})=>({
    type,x,y,w,h,fill,
    stroke:extra.stroke || fill,
    strokeWidth:extra.strokeWidth ?? 0,
    fill2:extra.fill2 || null,
    opacity:extra.opacity ?? 1,
    rotation:extra.rotation || 0,
    points:extra.points || null,
    noShadow:extra.noShadow ?? false,
    theme:extra.theme ?? false,
    radius:extra.radius || 0
  });

  function premiumHouseGroup(x=W/2,y=H/2,scale=1){
    const children=[
      child("ellipse",0,.38,.78,.08,"#0a1421",{opacity:.14,noShadow:true}),
      child("rect",0,.08,.72,.48,"#f2ede7",{fill2:"#d9e1e9",stroke:"#394b61",strokeWidth:.006,radius:.018}),
      child("rect",-0.27,.09,.18,.48,"#315fb3",{fill2:"#193d81",stroke:"#26384f",strokeWidth:.006,theme:true}),
      child("polygon",0,-.18,1,1,"#273a54",{fill2:"#16253a",stroke:"#142235",strokeWidth:.008,
        points:[[-.43,.08],[-.34,-.08],[.45,-.08],[.38,.08]]}),
      child("rect",.18,.02,.31,.22,"#84d1f2",{fill2:"#d9f4ff",stroke:"#40536b",strokeWidth:.007}),
      child("line",.18,.02,0,.22,"#ffffff",{stroke:"#ffffff",strokeWidth:.005,noShadow:true}),
      child("line",.18,.02,.31,0,"#ffffff",{stroke:"#ffffff",strokeWidth:.005,noShadow:true}),
      child("rect",-0.19,.13,.14,.31,"#25364b",{fill2:"#152234",stroke:"#101a29",strokeWidth:.007}),
      child("rect",-0.19,.07,.065,.09,"#85c2de",{fill2:"#d8f4ff",stroke:"#35495f",strokeWidth:.004}),
      child("rect",.31,.29,.16,.035,"#aab6c5",{stroke:"#718091",strokeWidth:.003}),
      child("rect",-0.19,.30,.22,.028,"#c5ced9",{stroke:"#7b8795",strokeWidth:.003})
    ];
    return M("group",x,y,350*scale,240*scale,{
      name:"Modern Architectural House",
      children,
      fill:"#315fb3",
      stroke:"#25374d",
      shadow:true,
      meta:{category:"building"}
    });
  }

  function premiumCar(x=W/2,y=H/2,scale=1,color="#a62937",animated=false){
    return M("group",x,y,175*scale,78*scale,{
      name:"Premium Sedan",
      fill:color,
      stroke:"#52131d",
      shadow:true,
      animation:animated?{preset:"slide",duration:7.5,amount:620,loop:true}:undefined,
      meta:{category:"vehicle"},
      children:[
        child("ellipse",0,.34,.86,.12,"#07101c",{opacity:.16,noShadow:true}),
        child("polygon",0,.02,1,1,color,{fill2:"#671622",stroke:"#541019",strokeWidth:.008,
          points:[[-.45,.13],[-.36,-.03],[-.20,-.12],[.18,-.12],[.31,-.02],[.43,.06],[.46,.17],[.39,.24],[-.42,.24]]}),
        child("polygon",-0.04,-.03,1,1,"#8fdafa",{fill2:"#e1f8ff",stroke:"#f4fdff",strokeWidth:.004,
          points:[[-.23,-.09],[-.08,-.09],[.02,.02],[-.15,.02]]}),
        child("polygon",.14,-.03,1,1,"#8fdafa",{fill2:"#e1f8ff",stroke:"#f4fdff",strokeWidth:.004,
          points:[[0,-.09],[.18,-.09],[.27,.02],[.06,.02]]}),
        child("rect",-.33,.07,.08,.055,"#ffd6a5",{stroke:"#8a4b1f",strokeWidth:.003}),
        child("rect",.35,.09,.065,.038,"#ff9f9a",{stroke:"#7e211e",strokeWidth:.003}),
        child("ellipse",-.23,.27,.17,.17,"#0a0f17",{stroke:"#000",strokeWidth:.008}),
        child("ellipse",.24,.27,.17,.17,"#0a0f17",{stroke:"#000",strokeWidth:.008}),
        child("ellipse",-.23,.27,.075,.075,"#dce5ed",{stroke:"#788897",strokeWidth:.003}),
        child("ellipse",.24,.27,.075,.075,"#dce5ed",{stroke:"#788897",strokeWidth:.003})
      ]
    });
  }

  function professionalTree(x=W/2,y=H/2,scale=1){
    return M("group",x,y,145*scale,220*scale,{
      name:"Landscape Tree",
      fill:"#2b8f62",
      stroke:"#174a35",
      shadow:true,
      meta:{category:"nature"},
      children:[
        child("ellipse",0,.44,.52,.08,"#08121e",{opacity:.13,noShadow:true}),
        child("polygon",0,.15,1,1,"#7b4d2c",{fill2:"#4a2b17",stroke:"#3e2515",strokeWidth:.006,
          points:[[-.08,-.14],[.08,-.14],[.12,.35],[-.11,.35]]}),
        child("ellipse",-0.14,-.12,.48,.36,"#36a66f",{fill2:"#1f7a53",stroke:"#174e39",strokeWidth:.005}),
        child("ellipse",.14,-.10,.50,.37,"#2f9867",{fill2:"#176d49",stroke:"#174e39",strokeWidth:.005}),
        child("ellipse",0,-.27,.56,.42,"#43b779",{fill2:"#21875a",stroke:"#174e39",strokeWidth:.005}),
        child("ellipse",-.03,-.08,.38,.28,"#65c992",{opacity:.45,noShadow:true})
      ]
    });
  }

  function professionalHuman(x=W/2,y=H/2,scale=1){
    return M("group",x,y,130*scale,250*scale,{
      name:"Professional Human",
      fill:"#284c84",
      stroke:"#15243a",
      shadow:true,
      meta:{category:"people"},
      children:[
        child("ellipse",0,.46,.55,.055,"#07101d",{opacity:.15,noShadow:true}),
        child("ellipse",0,-.35,.22,.15,"#dca27d",{fill2:"#f1c09b",stroke:"#6c4934",strokeWidth:.004}),
        child("polygon",0,-.04,1,1,"#284c84",{fill2:"#172f56",stroke:"#132338",strokeWidth:.006,theme:true,
          points:[[-.20,-.24],[.20,-.24],[.28,.18],[.16,.27],[-.16,.27],[-.28,.18]]}),
        child("triangle",0,-.12,.15,.22,"#f7f9fb",{stroke:"#d9dee4",strokeWidth:.003}),
        child("triangle",0,-.08,.055,.17,"#a52435",{rotation:180}),
        child("polygon",-.27,.05,1,1,"#284c84",{theme:true,stroke:"#132338",strokeWidth:.005,
          points:[[-.07,-.20],[.02,-.18],[.09,.20],[.01,.22]]}),
        child("polygon",.27,.05,1,1,"#284c84",{theme:true,stroke:"#132338",strokeWidth:.005,
          points:[[-.02,-.18],[.07,-.20],[-.01,.22],[-.09,.20]]}),
        child("polygon",-.10,.33,1,1,"#182437",{stroke:"#0d1622",strokeWidth:.005,
          points:[[-.07,-.10],[.02,-.10],[.07,.18],[-.02,.18]]}),
        child("polygon",.10,.33,1,1,"#182437",{stroke:"#0d1622",strokeWidth:.005,
          points:[[-.02,-.10],[.07,-.10],[.02,.18],[-.07,.18]]}),
        child("ellipse",-.13,.48,.19,.05,"#0c111a"),
        child("ellipse",.13,.48,.19,.05,"#0c111a")
      ]
    });
  }

  function professionalRobot(x=W/2,y=H/2,scale=1){
    return M("group",x,y,180*scale,255*scale,{
      name:"Humanoid Service Robot",
      fill:"#5675a6",
      stroke:"#26394f",
      shadow:true,
      meta:{category:"technology"},
      children:[
        child("ellipse",0,.47,.66,.06,"#07101d",{opacity:.16,noShadow:true}),
        child("rect",0,-.34,.44,.19,"#c9d4e2",{fill2:"#8598b0",stroke:"#34495f",strokeWidth:.006,radius:.025}),
        child("rect",0,-.34,.27,.06,"#17283d",{stroke:"#0c1624",strokeWidth:.003}),
        child("ellipse",-.07,-.34,.035,.025,"#50e2c5"),
        child("ellipse",.07,-.34,.035,.025,"#50e2c5"),
        child("polygon",0,-.03,1,1,"#5675a6",{fill2:"#304c77",theme:true,stroke:"#24384f",strokeWidth:.006,
          points:[[-.25,-.20],[.25,-.20],[.30,.13],[.15,.25],[-.15,.25],[-.30,.13]]}),
        child("rect",0,-.02,.25,.10,"#14263b",{stroke:"#7890ad",strokeWidth:.004}),
        child("ellipse",0,-.02,.055,.038,"#50e2c5"),
        child("ellipse",-.34,-.10,.13,.11,"#9dabbc",{stroke:"#33475e",strokeWidth:.005}),
        child("ellipse",.34,-.10,.13,.11,"#9dabbc",{stroke:"#33475e",strokeWidth:.005}),
        child("rect",-.39,.09,.11,.31,"#70839b",{rotation:6,stroke:"#33465d",strokeWidth:.005}),
        child("rect",.39,.09,.11,.31,"#70839b",{rotation:-6,stroke:"#33465d",strokeWidth:.005}),
        child("polygon",-.13,.34,1,1,"#71849d",{stroke:"#33465d",strokeWidth:.005,
          points:[[-.07,-.13],[.04,-.13],[.07,.14],[-.04,.14]]}),
        child("polygon",.13,.34,1,1,"#71849d",{stroke:"#33465d",strokeWidth:.005,
          points:[[-.04,-.13],[.07,-.13],[.04,.14],[-.07,.14]]})
      ]
    });
  }

  function cityBus(x=W/2,y=H/2,scale=1,animated=false){
    return M("group",x,y,215*scale,92*scale,{
      name:"City Bus",
      fill:"#d4b547",
      stroke:"#6f5b17",
      shadow:true,
      animation:animated?{preset:"slide",duration:8,amount:650,loop:true}:undefined,
      meta:{category:"vehicle"},
      children:[
        child("ellipse",0,.35,.90,.10,"#07101d",{opacity:.15,noShadow:true}),
        child("rect",0,.01,.88,.45,"#d4b547",{fill2:"#8f751d",stroke:"#695816",strokeWidth:.007,radius:.025}),
        child("rect",-.09,-.10,.57,.18,"#82d1ef",{fill2:"#d7f5ff",stroke:"#e6fbff",strokeWidth:.004}),
        child("line",-.18,-.10,0,.18,"#ffffff",{stroke:"#ffffff",strokeWidth:.004}),
        child("line",0,-.10,0,.18,"#ffffff",{stroke:"#ffffff",strokeWidth:.004}),
        child("line",.18,-.10,0,.18,"#ffffff",{stroke:"#ffffff",strokeWidth:.004}),
        child("rect",.36,.02,.10,.29,"#43331a",{stroke:"#241b0e",strokeWidth:.004}),
        child("ellipse",-.27,.29,.13,.13,"#10151d",{stroke:"#000",strokeWidth:.007}),
        child("ellipse",.27,.29,.13,.13,"#10151d",{stroke:"#000",strokeWidth:.007}),
        child("ellipse",-.27,.29,.052,.052,"#d5dce4"),
        child("ellipse",.27,.29,.052,.052,"#d5dce4")
      ]
    });
  }

  function flyingBird(x,y,scale=1,delay=0){
    return M("group",x,y,72*scale,34*scale,{
      name:"Flying Bird",
      fill:"#0e1725",
      stroke:"#0e1725",
      animation:{preset:"slide",duration:7.5,amount:360,loop:true,delay},
      meta:{category:"nature"},
      children:[
        child("ellipse",0,.04,.34,.17,"#111a28"),
        child("polygon",-.18,-.03,1,1,"#162235",{points:[[-.13,.04],[-.03,-.11],[.11,.03],[.02,.09]]}),
        child("polygon",.18,-.03,1,1,"#162235",{points:[[-.11,.03],[-.01,-.11],[.13,.04],[.02,.09]]}),
        child("polygon",.20,.04,1,1,"#d33a32",{points:[[.10,-.02],[.18,.01],[.10,.04]]})
      ]
    });
  }

  function homeScene(){
    const background=M("group",W/2,H/2,850,520,{
      name:"Modern Home Scene",
      fill:"#f3dce4",
      stroke:"#4d6279",
      shadow:false,
      meta:{category:"scene"},
      children:[
        child("rect",0,-.19,1,.62,"#5da7d8",{fill2:"#bde5ff"}),
        child("ellipse",.34,-.38,.12,.12,"#ffe36a"),
        child("ellipse",-.34,-.36,.24,.13,"#dde8f1"),
        child("ellipse",-.25,-.39,.19,.11,"#dde8f1"),
        child("ellipse",.36,-.35,.27,.14,"#dde8f1"),
        child("rect",0,.22,1,.28,"#3cbf54",{fill2:"#1e8f3c"}),
        child("rect",0,.44,1,.12,"#3f4652",{fill2:"#242a33"}),
        child("ellipse",0,.17,.58,.07,"#07101d",{opacity:.12}),
        child("rect",0,.02,.48,.40,"#f3d7df",{fill2:"#e7bfc9",stroke:"#9e6b78",strokeWidth:.004}),
        child("polygon",-.10,-.22,1,1,"#ad1826",{fill2:"#6b0d17",stroke:"#620b13",strokeWidth:.005,
          points:[[-.31,.10],[.14,.10],[0,-.07],[-.45,-.07]]}),
        child("polygon",.11,-.22,1,1,"#ad1826",{fill2:"#6b0d17",stroke:"#620b13",strokeWidth:.005,
          points:[[-.13,.10],[.32,.10],[.46,-.07],[.01,-.07]]}),
        child("polygon",0,-.37,1,1,"#ad1826",{fill2:"#74101a",stroke:"#620b13",strokeWidth:.006,
          points:[[-.36,.13],[0,-.12],[.36,.13]]}),
        child("polygon",.21,-.37,1,1,"#edb3c5",{points:[[-.15,.13],[.22,.13],[0,-.12]],stroke:"#9e6b78",strokeWidth:.004}),
        child("polygon",0,-.03,1,1,"#20b7e4",{fill2:"#99eaff",stroke:"#0c5878",strokeWidth:.004,
          points:[[-.07,.05],[.07,.05],[0,-.07]]}),
        child("rect",-.19,-.05,.12,.13,"#25bce8",{fill2:"#a1ecff",stroke:"#0c5878",strokeWidth:.004}),
        child("line",-.19,-.05,0,.13,"#fff",{stroke:"#fff",strokeWidth:.004}),
        child("line",-.19,-.05,.12,0,"#fff",{stroke:"#fff",strokeWidth:.004}),
        child("rect",.19,-.05,.16,.13,"#25bce8",{fill2:"#a1ecff",stroke:"#0c5878",strokeWidth:.004}),
        child("line",.19,-.05,0,.13,"#fff",{stroke:"#fff",strokeWidth:.004}),
        child("line",.19,-.05,.16,0,"#fff",{stroke:"#fff",strokeWidth:.004}),
        child("rect",-.18,.17,.12,.13,"#25bce8",{fill2:"#a1ecff",stroke:"#0c5878",strokeWidth:.004}),
        child("line",-.18,.17,0,.13,"#fff",{stroke:"#fff",strokeWidth:.004}),
        child("line",-.18,.17,.12,0,"#fff",{stroke:"#fff",strokeWidth:.004}),
        child("rect",.18,.17,.16,.13,"#25bce8",{fill2:"#a1ecff",stroke:"#0c5878",strokeWidth:.004}),
        child("line",.18,.17,0,.13,"#fff",{stroke:"#fff",strokeWidth:.004}),
        child("line",.18,.17,.16,0,"#fff",{stroke:"#fff",strokeWidth:.004}),
        child("rect",0,.15,.12,.20,"#71170f",{fill2:"#41100c",stroke:"#220706",strokeWidth:.004}),
        child("line",0,.15,0,.20,"#160404",{stroke:"#160404",strokeWidth:.004}),
        child("line",0,.15,.12,0,"#160404",{stroke:"#160404",strokeWidth:.004})
      ]
    });
    const car=premiumCar(720,505,.92,"#a82c38",true);
    return [background,car];
  }

  function cityScene(){
    const background=M("group",W/2,H/2,850,520,{
      name:"Small City Scene",
      fill:"#5eaadc",
      stroke:"#4a6178",
      shadow:false,
      meta:{category:"scene"},
      children:[
        child("rect",0,-.19,1,.62,"#4f9fd0",{fill2:"#a5dcf7"}),
        child("ellipse",.28,-.39,.18,.12,"#f4ec83"),
        child("polygon",-0.14,.13,1,1,"#375a09",{fill2:"#1c3f03",
          points:[[-.48,.20],[-.38,.08],[-.28,.10],[-.18,.03],[-.06,.10],[.06,.04],[.18,-.11],[.27,-.02],[.36,.13],[.46,.20],[-.48,.20]]}),
        child("rect",0,.43,1,.14,"#4b4e57",{fill2:"#2e3138"}),
        child("rect",-.38,-.08,.08,.43,"#eef2f6",{stroke:"#a8b7c6",strokeWidth:.004}),
        child("polygon",-.38,-.33,1,1,"#ffffff",{points:[[-.04,.12],[0,-.10],[.04,.12]],stroke:"#cad6e0",strokeWidth:.003}),
        child("line",-.41,-.08,0,.43,"#405264",{stroke:"#405264",strokeWidth:.003}),
        child("line",-.35,-.08,0,.43,"#405264",{stroke:"#405264",strokeWidth:.003}),
        child("rect",-.49,-.05,.07,.45,"#c9b51b",{fill2:"#8f7e08",stroke:"#7d6e0b",strokeWidth:.004}),
        child("polygon",-.49,-.28,1,1,"#ffffff",{points:[[-.05,.12],[-.01,-.12],[.05,.12]],stroke:"#d9e7f0",strokeWidth:.003}),
        child("rect",-.01,-.08,.22,.52,"#3b7bb8",{fill2:"#295783",stroke:"#24496d",strokeWidth:.004}),
        child("rect",.03,-.18,.13,.58,"#4d82bd",{fill2:"#315d8d",stroke:"#24496d",strokeWidth:.004}),
        child("rect",.08,-.29,.08,.42,"#4a75a4",{stroke:"#24496d",strokeWidth:.004}),
        child("rect",.14,-.35,.05,.29,"#526e91",{stroke:"#24496d",strokeWidth:.004}),
        child("rect",.20,.03,.06,.26,"#5b8ab8",{stroke:"#24496d",strokeWidth:.004}),
        child("rect",.40,.10,.07,.23,"#5c6881",{stroke:"#39445a",strokeWidth:.004}),
        child("rect",.40,.01,.13,.08,"#8cdef1",{fill2:"#e2fbff",stroke:"#dff8ff",strokeWidth:.003}),
        child("rect",.40,-.06,.17,.06,"#f0cf45",{fill2:"#b69717",stroke:"#a58618",strokeWidth:.003}),
        child("rect",.40,-.13,.12,.04,"#ead16c",{stroke:"#a58618",strokeWidth:.003}),
        child("line",.40,-.20,0,.08,"#4ccfc8",{stroke:"#4ccfc8",strokeWidth:.004}),
        child("rect",-.26,.16,.02,.14,"#111827"),
        child("rect",-.26,.07,.03,.08,"#111827"),
        child("rect",-.26,.03,.012,.03,"#2bd46f"),
        child("rect",-.26,.07,.012,.03,"#ffd449"),
        child("rect",-.26,.11,.012,.03,"#ff554f")
      ]
    });
    for(let row=-.23;row<=.26;row+=.09){
      for(let col=-.06;col<=.08;col+=.06){
        background.children.push(child("rect",col,row,.010,.05,"#ffad22"));
      }
    }
    for(let i=-.44;i<=.44;i+=.12){
      background.children.push(child("rect",i,.43,.06,.011,"#ffffff"));
    }
    const bus=cityBus(720,500,.90,true);
    const birds=[
      flyingBird(650,135,.82,0),
      flyingBird(735,115,.68,1.2),
      flyingBird(590,160,.62,2.0)
    ];
    return [background,bus,...birds];
  }

  const previews={
    home:`<svg viewBox="0 0 240 150"><defs><linearGradient id="hs" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#68b5e5"/><stop offset="1" stop-color="#b8e5fa"/></linearGradient></defs><rect width="240" height="150" fill="url(#hs)"/><rect y="93" width="240" height="57" fill="#43b64c"/><rect y="126" width="240" height="24" fill="#42464f"/><path d="M58 103V57l58-31h63l34 29v48z" fill="#f0d1da" stroke="#825260"/><path d="M52 60l62-36h70l43 36H52z" fill="#9e1724"/><path d="M68 102h145v-20H68z" fill="#a81725"/><rect x="112" y="82" width="24" height="40" fill="#62140e"/><rect x="72" y="70" width="32" height="20" fill="#3cc7ec"/><rect x="156" y="69" width="40" height="21" fill="#3cc7ec"/><circle cx="202" cy="22" r="13" fill="#ffe36c"/></svg>`,
    city:`<svg viewBox="0 0 240 150"><defs><linearGradient id="cs" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#4d9dcc"/><stop offset="1" stop-color="#a4dcf7"/></linearGradient></defs><rect width="240" height="150" fill="url(#cs)"/><path d="M0 104l45-36 37 23 48-60 42 42 68 31v46H0z" fill="#365908"/><rect x="91" y="36" width="48" height="72" fill="#3d7bb7"/><rect x="112" y="18" width="29" height="90" fill="#4c82bd"/><rect x="140" y="55" width="23" height="53" fill="#567ca6"/><rect x="31" y="44" width="22" height="64" fill="#eff3f7"/><rect y="111" width="240" height="39" fill="#484b54"/><path d="M12 130h25m15 0h25m15 0h25m15 0h25m15 0h25" stroke="#fff" stroke-width="4"/><rect x="154" y="116" width="53" height="19" rx="4" fill="#d6ba52"/><circle cx="166" cy="137" r="6" fill="#111827"/><circle cx="194" cy="137" r="6" fill="#111827"/></svg>`,
    house:`<svg viewBox="0 0 240 150"><rect width="240" height="150" fill="#0c1829"/><ellipse cx="120" cy="124" rx="76" ry="10" fill="#07101d" opacity=".35"/><rect x="62" y="60" width="126" height="65" rx="3" fill="#e8edf2"/><rect x="62" y="60" width="34" height="65" fill="#315fb3"/><path d="M52 65l39-30h118l-16 27H91L62 75z" fill="#263a54"/><rect x="117" y="70" width="48" height="29" fill="#8fd7f4"/><rect x="76" y="79" width="20" height="46" fill="#26364a"/></svg>`,
    car:`<svg viewBox="0 0 240 150"><rect width="240" height="150" fill="#0c1829"/><ellipse cx="120" cy="120" rx="76" ry="9" fill="#07101d" opacity=".4"/><path d="M37 100l18-24 34-12 22-20h48l29 24 24 11 7 27H35z" fill="#a62937"/><path d="M89 65l26-18h40l22 19z" fill="#9ce3fa"/><circle cx="77" cy="108" r="18" fill="#0c1119"/><circle cx="177" cy="108" r="18" fill="#0c1119"/><circle cx="77" cy="108" r="8" fill="#dce5ed"/><circle cx="177" cy="108" r="8" fill="#dce5ed"/></svg>`,
    bus:`<svg viewBox="0 0 240 150"><rect width="240" height="150" fill="#0c1829"/><ellipse cx="120" cy="122" rx="85" ry="9" fill="#07101d" opacity=".4"/><rect x="27" y="46" width="186" height="69" rx="12" fill="#cdb044"/><rect x="45" y="57" width="111" height="30" fill="#9ae2f7"/><rect x="171" y="56" width="22" height="50" fill="#45351b"/><circle cx="71" cy="115" r="16" fill="#10151d"/><circle cx="173" cy="115" r="16" fill="#10151d"/></svg>`,
    human:`<svg viewBox="0 0 240 150"><rect width="240" height="150" fill="#0c1829"/><ellipse cx="120" cy="132" rx="34" ry="7" fill="#07101d" opacity=".4"/><circle cx="120" cy="29" r="18" fill="#dfaa84"/><path d="M84 56l36-17 36 17 12 57-22 5-8-42v58h-16V76l-8 42-22-5z" fill="#284c84"/><path d="M110 45h20l-10 30z" fill="#fff"/><path d="M116 62h8l-4 23z" fill="#a52435"/></svg>`,
    robot:`<svg viewBox="0 0 240 150"><rect width="240" height="150" fill="#0c1829"/><ellipse cx="120" cy="134" rx="44" ry="7" fill="#07101d" opacity=".4"/><rect x="91" y="19" width="58" height="32" rx="8" fill="#c9d4e2"/><rect x="105" y="31" width="30" height="7" rx="3" fill="#50e2c5"/><path d="M78 61h84l-10 52H88z" fill="#5675a6"/><circle cx="69" cy="72" r="12" fill="#99a9bc"/><circle cx="171" cy="72" r="12" fill="#99a9bc"/><path d="M70 84l-12 43M170 84l12 43M102 111l-8 30M138 111l8 30" stroke="#71849d" stroke-width="13" stroke-linecap="round"/></svg>`,
    tree:`<svg viewBox="0 0 240 150"><rect width="240" height="150" fill="#0c1829"/><ellipse cx="120" cy="131" rx="50" ry="8" fill="#07101d" opacity=".4"/><path d="M108 77h23l8 54h-37z" fill="#704527"/><circle cx="86" cy="66" r="38" fill="#3caf76"/><circle cx="151" cy="64" r="40" fill="#2e9867"/><circle cx="119" cy="39" r="48" fill="#46b97c"/></svg>`
  };

  OVD.templates=[
    {id:"homeScene",name:"Modern Home Scene",category:"scene",description:"Complete house, road, garden and animated car.",preview:previews.home,create:homeScene},
    {id:"cityScene",name:"Small City Scene",category:"scene",description:"Crisp skyline, highway, animated bus and flying birds.",preview:previews.city,create:cityScene},
    {id:"modernHouse",name:"Architectural House",category:"building",description:"A clean, modular modern house.",preview:previews.house,create:()=>[premiumHouseGroup()]},
    {id:"premiumCar",name:"Premium Sedan",category:"vehicle",description:"Detailed vector car with editable colours.",preview:previews.car,create:()=>[premiumCar()]},
    {id:"cityBus",name:"City Bus",category:"vehicle",description:"Professional transit bus.",preview:previews.bus,create:()=>[cityBus()]},
    {id:"professionalHuman",name:"Professional Human",category:"people",description:"Well-proportioned business figure.",preview:previews.human,create:()=>[professionalHuman()]},
    {id:"serviceRobot",name:"Service Robot",category:"technology",description:"Clean humanoid robot design.",preview:previews.robot,create:()=>[professionalRobot()]},
    {id:"landscapeTree",name:"Landscape Tree",category:"nature",description:"Layered vector tree with natural depth.",preview:previews.tree,create:()=>[professionalTree()]}
  ];

  OVD.createTemplate=function(id){
    const template=OVD.templates.find(t=>t.id===id);
    return template ? template.create() : [];
  };
})();