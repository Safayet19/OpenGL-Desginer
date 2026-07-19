(() => {
  'use strict';

  const W = 1000;
  const H = 650;
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const $ = (id) => document.getElementById(id);
  const canvas = $('designCanvas');
  const ctx = canvas.getContext('2d');
  const viewport = $('canvasViewport');
  const frame = $('canvasFrame');
  const spacer = $('canvasSpacer');

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = () => `obj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const rad = (degrees) => degrees * Math.PI / 180;
  const formatFloat = (value) => `${(Number(value) || 0).toFixed(2)}f`;
  const hexToRgb = (input) => {
    const color = String(input || '#000000').trim();
    const rgbMatch = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgbMatch) {
      return [
        clamp(Number(rgbMatch[1]) || 0, 0, 255),
        clamp(Number(rgbMatch[2]) || 0, 0, 255),
        clamp(Number(rgbMatch[3]) || 0, 0, 255),
      ];
    }
    if (color === 'transparent') return [0, 0, 0];
    const safe = color.startsWith('#') ? color.slice(1) : color;
    const value = safe.length === 3 ? safe.split('').map((c) => c + c).join('') : safe.padEnd(6, '0').slice(0, 6);
    const parsed = [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
    return parsed.map((channel) => Number.isFinite(channel) ? channel : 0);
  };
  const colorForCode = (fill) => {
    const color = typeof fill === 'string' ? fill : (fill?.from || fill?.inner || fill?.colors?.[0] || '#000000');
    const [r, g, b] = hexToRgb(color);
    return `${(r / 255).toFixed(3)}f, ${(g / 255).toFixed(3)}f, ${(b / 255).toFixed(3)}f`;
  };

  const state = {
    projectName: 'Untitled Design',
    canvasColor: '#f7f9fc',
    objects: [],
    selectedId: null,
    tool: 'select',
    zoom: 1,
    grid: true,
    snap: true,
    gridSize: 20,
    drawing: null,
    pointerAction: null,
    polygonPoints: [],
    textPoint: null,
    history: [],
    future: [],
    playing: false,
    animationStart: 0,
    animationFrame: 0,
    mouse: { x: 0, y: 0 },
    inspectorTab: 'properties',
    codeModalMode: 'full',
  };

  function LG(from, to, direction = 'vertical') {
    return { type: 'linear', from, to, direction };
  }

  function RG(inner, outer) {
    return { type: 'radial', inner, outer };
  }

  const P = {
    rect(x, y, w, h, fill, options = {}) { return { type: 'rect', x, y, w, h, fill, ...options }; },
    roundRect(x, y, w, h, fill, radius = .02, options = {}) { return { type: 'roundRect', x, y, w, h, fill, radius, ...options }; },
    ellipse(x, y, w, h, fill, options = {}) { return { type: 'ellipse', x, y, w, h, fill, ...options }; },
    polygon(x, y, w, h, points, fill, options = {}) { return { type: 'polygon', x, y, w, h, points, fill, ...options }; },
    line(x, y, w, h, stroke, sw = .004, options = {}) { return { type: 'line', x, y, w, h, stroke, sw, ...options }; },
    text(x, y, w, h, text, fill, options = {}) { return { type: 'text', x, y, w, h, text, fill, ...options }; },
  };

  function makeObject(type, x, y, w, h, options = {}) {
    return {
      id: uid(),
      type,
      name: options.name || type[0].toUpperCase() + type.slice(1),
      x,
      y,
      w: Math.max(2, Math.abs(w || 100)),
      h: Math.max(2, Math.abs(h || 100)),
      rotation: options.rotation || 0,
      fill: options.fill || '#7c83f6',
      fill2: options.fill2 || null,
      stroke: options.stroke || '#34435c',
      strokeWidth: options.strokeWidth ?? 2,
      opacity: options.opacity ?? 1,
      shadow: options.shadow ?? false,
      points: options.points || null,
      text: options.text || 'Text',
      fontSize: options.fontSize || 34,
      children: options.children || null,
      category: options.category || 'shape',
      visible: options.visible ?? true,
      locked: options.locked ?? false,
      animation: {
        preset: 'none',
        duration: 5,
        amount: 180,
        loop: true,
        delay: 0,
        ...(options.animation || {}),
      },
    };
  }

  function makeGroup(name, x, y, w, h, children, options = {}) {
    return makeObject('group', x, y, w, h, {
      name,
      children,
      fill: options.fill || '#5e64e8',
      stroke: options.stroke || '#28364d',
      strokeWidth: options.strokeWidth ?? 1,
      shadow: options.shadow ?? false,
      category: options.category || 'scene',
      animation: options.animation,
    });
  }

  function selectedObject() {
    return state.objects.find((object) => object.id === state.selectedId) || null;
  }

  function snapshot() {
    return {
      projectName: state.projectName,
      canvasColor: state.canvasColor,
      objects: clone(state.objects),
    };
  }

  function pushHistory() {
    state.history.push(snapshot());
    if (state.history.length > 70) state.history.shift();
    state.future = [];
  }

  function restore(snapshotValue) {
    if (!snapshotValue) return;
    state.projectName = snapshotValue.projectName || 'Untitled Design';
    state.canvasColor = snapshotValue.canvasColor || '#f7f9fc';
    state.objects = clone(snapshotValue.objects || []);
    state.selectedId = null;
    $('projectName').value = state.projectName;
    render();
  }

  function undo() {
    if (!state.history.length) return;
    state.future.push(snapshot());
    restore(state.history.pop());
    setStatus('Undo complete');
  }

  function redo() {
    if (!state.future.length) return;
    state.history.push(snapshot());
    restore(state.future.pop());
    setStatus('Redo complete');
  }

  function saveAutosave() {
    try {
      localStorage.setItem('openglVisualDesignerV4', JSON.stringify({
        projectName: state.projectName,
        canvasColor: state.canvasColor,
        objects: state.objects,
      }));
    } catch (error) {
      console.warn('Autosave unavailable', error);
    }
  }

  function loadAutosave() {
    try {
      const saved = JSON.parse(localStorage.getItem('openglVisualDesignerV4'));
      if (!saved) return;
      state.projectName = saved.projectName || 'Untitled Design';
      state.canvasColor = saved.canvasColor || '#f7f9fc';
      state.objects = saved.objects || [];
      $('projectName').value = state.projectName;
    } catch (error) {
      console.warn('Autosave could not be restored', error);
    }
  }

  function resizeCanvasBackingStore() {
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W * state.zoom}px`;
    canvas.style.height = `${H * state.zoom}px`;
    frame.style.width = `${W * state.zoom}px`;
    frame.style.height = `${H * state.zoom}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function resolveFill(fill, x, y, w, h) {
    if (!fill || typeof fill === 'string') return fill || '#000000';
    if (fill.type === 'linear') {
      let gradient;
      if (fill.direction === 'horizontal') gradient = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
      else if (fill.direction === 'diagonal') gradient = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
      else gradient = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
      gradient.addColorStop(0, fill.from);
      gradient.addColorStop(1, fill.to);
      return gradient;
    }
    if (fill.type === 'radial') {
      const gradient = ctx.createRadialGradient(x - w * .1, y - h * .15, 0, x, y, Math.max(w, h) * .55);
      gradient.addColorStop(0, fill.inner);
      gradient.addColorStop(1, fill.outer);
      return gradient;
    }
    return '#000000';
  }

  function roundedRectPath(context, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2));
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function applyShadow(shadow, scale = 1) {
    if (!shadow) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      return;
    }
    const value = typeof shadow === 'object' ? shadow : {};
    ctx.shadowColor = value.color || 'rgba(40, 58, 85, .22)';
    ctx.shadowBlur = (value.blur || 10) * scale;
    ctx.shadowOffsetX = (value.offsetX || 0) * scale;
    ctx.shadowOffsetY = (value.offsetY || 5) * scale;
  }

  function drawPrimitive(primitive, group, time = 0) {
    const gw = group.w;
    const gh = group.h;
    const x = primitive.x * gw;
    const y = primitive.y * gh;
    const w = primitive.w * gw;
    const h = primitive.h * gh;
    const opacity = primitive.opacity ?? 1;
    const strokeWidth = (primitive.sw ?? primitive.strokeWidth ?? .0025) * Math.min(gw, gh);
    const fill = primitive.theme ? group.fill : primitive.fill;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad(primitive.rotation || 0));
    ctx.globalAlpha *= opacity;
    applyShadow(primitive.shadow, Math.min(gw, gh) / 600);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (primitive.type === 'rect' || primitive.type === 'roundRect') {
      const radius = primitive.type === 'roundRect' ? (primitive.radius || .02) * Math.min(gw, gh) : 0;
      roundedRectPath(ctx, -w / 2, -h / 2, w, h, radius);
      ctx.fillStyle = resolveFill(fill, 0, 0, w, h);
      ctx.fill();
      if (primitive.stroke && strokeWidth > 0) {
        ctx.strokeStyle = primitive.stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    } else if (primitive.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      ctx.fillStyle = resolveFill(fill, 0, 0, w, h);
      ctx.fill();
      if (primitive.stroke && strokeWidth > 0) {
        ctx.strokeStyle = primitive.stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    } else if (primitive.type === 'polygon') {
      const points = primitive.points || [];
      if (points.length) {
        ctx.beginPath();
        points.forEach((point, index) => {
          const px = point[0] * w;
          const py = point[1] * h;
          if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = resolveFill(fill, 0, 0, w, h);
        ctx.fill();
        if (primitive.stroke && strokeWidth > 0) {
          ctx.strokeStyle = primitive.stroke;
          ctx.lineWidth = strokeWidth;
          ctx.stroke();
        }
      }
    } else if (primitive.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.strokeStyle = primitive.stroke || fill || '#000000';
      ctx.lineWidth = Math.max(1, strokeWidth);
      ctx.stroke();
    } else if (primitive.type === 'polyline') {
      const points = primitive.points || [];
      if (points.length) {
        ctx.beginPath();
        points.forEach((point, index) => {
          const px = point[0] * w;
          const py = point[1] * h;
          if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = primitive.stroke || fill || '#000000';
        ctx.lineWidth = Math.max(1, strokeWidth);
        ctx.stroke();
      }
    } else if (primitive.type === 'text') {
      ctx.fillStyle = resolveFill(fill, 0, 0, w, h);
      ctx.font = `${primitive.weight || 700} ${Math.max(8, h)}px ${primitive.font || 'Inter, Arial, sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(primitive.text || '', 0, 0, Math.abs(w));
    }
    ctx.restore();
  }

  function animatedObjectView(object, time) {
    const view = { ...object };
    const animation = { preset: 'none', duration: 5, amount: 180, loop: true, delay: 0, ...(object.animation || {}) };
    if (!state.playing || animation.preset === 'none') return view;
    const duration = Math.max(.2, Number(animation.duration) || 5);
    const local = Math.max(0, time - (Number(animation.delay) || 0));
    const progress = animation.loop ? (local % duration) / duration : Math.min(1, local / duration);
    const wave = Math.sin(progress * Math.PI * 2);
    if (animation.preset === 'slide') view.x += (progress - .5) * (Number(animation.amount) || 180);
    if (animation.preset === 'float') view.y += wave * (Number(animation.amount) || 35);
    if (animation.preset === 'bounce') view.y -= Math.abs(Math.sin(progress * Math.PI)) * (Number(animation.amount) || 70);
    if (animation.preset === 'rotate') view.rotation += progress * 360;
    if (animation.preset === 'pulse') {
      const factor = 1 + wave * Math.min(.35, (Number(animation.amount) || 40) / 500);
      view.w *= factor;
      view.h *= factor;
    }
    if (animation.preset === 'blink') view.opacity *= .25 + .75 * (.5 + .5 * wave);
    return view;
  }

  function drawObject(baseObject, time = 0) {
    if (baseObject.visible === false) return;
    const object = animatedObjectView(baseObject, time);
    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.rotate(rad(object.rotation || 0));
    ctx.globalAlpha = object.opacity ?? 1;
    applyShadow(object.shadow);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (object.type === 'group') {
      applyShadow(false);
      (object.children || []).forEach((child) => drawPrimitive(child, object, time));
    } else if (object.type === 'rectangle') {
      roundedRectPath(ctx, -object.w / 2, -object.h / 2, object.w, object.h, Math.min(14, object.w * .08, object.h * .08));
      ctx.fillStyle = resolveFill(object.fill2 ? LG(object.fill, object.fill2, 'diagonal') : object.fill, 0, 0, object.w, object.h);
      ctx.fill();
      if (object.strokeWidth > 0) {
        ctx.strokeStyle = object.stroke;
        ctx.lineWidth = object.strokeWidth;
        ctx.stroke();
      }
    } else if (object.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, object.w / 2, object.h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = resolveFill(object.fill2 ? LG(object.fill, object.fill2, 'diagonal') : object.fill, 0, 0, object.w, object.h);
      ctx.fill();
      if (object.strokeWidth > 0) {
        ctx.strokeStyle = object.stroke;
        ctx.lineWidth = object.strokeWidth;
        ctx.stroke();
      }
    } else if (object.type === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(0, -object.h / 2);
      ctx.lineTo(-object.w / 2, object.h / 2);
      ctx.lineTo(object.w / 2, object.h / 2);
      ctx.closePath();
      ctx.fillStyle = resolveFill(object.fill2 ? LG(object.fill, object.fill2, 'diagonal') : object.fill, 0, 0, object.w, object.h);
      ctx.fill();
      if (object.strokeWidth > 0) {
        ctx.strokeStyle = object.stroke;
        ctx.lineWidth = object.strokeWidth;
        ctx.stroke();
      }
    } else if (object.type === 'polygon') {
      const points = object.points || [];
      if (points.length) {
        ctx.beginPath();
        points.forEach((point, index) => {
          const px = point.x * object.w;
          const py = point.y * object.h;
          if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = resolveFill(object.fill, 0, 0, object.w, object.h);
        ctx.fill();
        if (object.strokeWidth > 0) {
          ctx.strokeStyle = object.stroke;
          ctx.lineWidth = object.strokeWidth;
          ctx.stroke();
        }
      }
    } else if (object.type === 'line' || object.type === 'freehand') {
      const points = object.points || [];
      if (points.length) {
        ctx.beginPath();
        points.forEach((point, index) => {
          const px = point.x * object.w;
          const py = point.y * object.h;
          if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = object.stroke;
        ctx.lineWidth = Math.max(1, object.strokeWidth);
        ctx.stroke();
      }
    } else if (object.type === 'text') {
      ctx.fillStyle = object.fill;
      ctx.font = `700 ${object.fontSize || object.h}px Inter, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(object.text || 'Text', 0, 0, object.w);
    }
    ctx.restore();
  }

  function drawGrid() {
    if (!state.grid) return;
    ctx.save();
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += state.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x + .5, 0);
      ctx.lineTo(x + .5, H);
      ctx.strokeStyle = x % (state.gridSize * 5) === 0 ? 'rgba(97,116,155,.18)' : 'rgba(97,116,155,.08)';
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += state.gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y + .5);
      ctx.lineTo(W, y + .5);
      ctx.strokeStyle = y % (state.gridSize * 5) === 0 ? 'rgba(97,116,155,.18)' : 'rgba(97,116,155,.08)';
      ctx.stroke();
    }
    ctx.restore();
  }

  function objectBounds(object) {
    if (object.type === 'line' || object.type === 'freehand' || object.type === 'polygon') {
      return { x: object.x - object.w / 2, y: object.y - object.h / 2, w: object.w, h: object.h };
    }
    return { x: object.x - object.w / 2, y: object.y - object.h / 2, w: object.w, h: object.h };
  }

  function selectionHandles(object) {
    const bounds = objectBounds(object);
    return [
      { name: 'nw', x: bounds.x, y: bounds.y },
      { name: 'ne', x: bounds.x + bounds.w, y: bounds.y },
      { name: 'se', x: bounds.x + bounds.w, y: bounds.y + bounds.h },
      { name: 'sw', x: bounds.x, y: bounds.y + bounds.h },
    ];
  }

  function drawSelection() {
    const object = selectedObject();
    if (!object || object.visible === false) return;
    const bounds = objectBounds(object);
    ctx.save();
    ctx.strokeStyle = '#5a67ee';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.setLineDash([]);
    selectionHandles(object).forEach((handle) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#5a67ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(handle.x - 5, handle.y - 5, 10, 10);
      ctx.fill();
      ctx.stroke();
    });
    const rotateX = bounds.x + bounds.w / 2;
    const rotateY = bounds.y - 27;
    ctx.beginPath();
    ctx.moveTo(rotateX, bounds.y);
    ctx.lineTo(rotateX, rotateY);
    ctx.strokeStyle = '#5a67ee';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rotateX, rotateY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#5a67ee';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawDraft() {
    if (!state.drawing && !state.polygonPoints.length) return;
    ctx.save();
    ctx.strokeStyle = '#5a67ee';
    ctx.fillStyle = 'rgba(90,103,238,.13)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    if (state.drawing?.kind === 'shape') {
      const drawing = state.drawing;
      const left = Math.min(drawing.start.x, drawing.end.x);
      const top = Math.min(drawing.start.y, drawing.end.y);
      const width = Math.abs(drawing.end.x - drawing.start.x);
      const height = Math.abs(drawing.end.y - drawing.start.y);
      if (drawing.tool === 'rectangle') {
        roundedRectPath(ctx, left, top, width, height, 10);
        ctx.fill();
        ctx.stroke();
      } else if (drawing.tool === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (drawing.tool === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(left + width / 2, top);
        ctx.lineTo(left, top + height);
        ctx.lineTo(left + width, top + height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (drawing.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(drawing.start.x, drawing.start.y);
        ctx.lineTo(drawing.end.x, drawing.end.y);
        ctx.stroke();
      }
    }
    if (state.drawing?.kind === 'freehand') {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#32466a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      state.drawing.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
    if (state.polygonPoints.length) {
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      state.polygonPoints.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      state.polygonPoints.forEach((point, index) => {
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(point.x, point.y, index === 0 ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = index === 0 ? '#ffffff' : '#5a67ee';
        ctx.fill();
        ctx.strokeStyle = '#5a67ee';
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function render(time = 0) {
    resizeCanvasBackingStore();
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = state.canvasColor;
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    state.objects.forEach((object) => drawObject(object, time));
    drawSelection();
    drawDraft();
    ctx.restore();
    updateInspector();
    updateLayers();
    updateCodePreview();
    updateStatusSummary();
    saveAutosave();
  }

  function animationLoop(timestamp) {
    if (!state.playing) return;
    const seconds = (timestamp - state.animationStart) / 1000;
    render(seconds);
    state.animationFrame = requestAnimationFrame(animationLoop);
  }

  function toggleAnimationPreview() {
    state.playing = !state.playing;
    $('previewAnimationBtn').textContent = state.playing ? 'Stop Animation' : 'Preview Animation';
    if (state.playing) {
      state.animationStart = performance.now();
      state.animationFrame = requestAnimationFrame(animationLoop);
      setStatus('Animation preview playing');
    } else {
      cancelAnimationFrame(state.animationFrame);
      render(0);
      setStatus('Animation preview stopped');
    }
  }

  function setZoom(value, keepCenter = true) {
    const previous = state.zoom;
    state.zoom = clamp(value, .35, 2.5);
    const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
    const centerY = viewport.scrollTop + viewport.clientHeight / 2;
    resizeCanvasBackingStore();
    if (keepCenter && previous > 0) {
      const ratio = state.zoom / previous;
      viewport.scrollLeft = centerX * ratio - viewport.clientWidth / 2;
      viewport.scrollTop = centerY * ratio - viewport.clientHeight / 2;
    }
    $('zoomValue').textContent = `${Math.round(state.zoom * 100)}%`;
    render();
  }

  function fitCanvas() {
    requestAnimationFrame(() => {
      const horizontalPadding = 54;
      const verticalPadding = 54;
      const zoom = Math.min(1.15, (viewport.clientWidth - horizontalPadding) / W, (viewport.clientHeight - verticalPadding) / H);
      setZoom(Math.max(.35, zoom), false);
      centerCanvas();
    });
  }

  function centerCanvas() {
    viewport.scrollLeft = Math.max(0, (spacer.scrollWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (spacer.scrollHeight - viewport.clientHeight) / 2);
  }

  function snapCoordinate(value) {
    return state.snap ? Math.round(value / state.gridSize) * state.gridSize : value;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width * W, 0, W);
    const y = clamp((event.clientY - rect.top) / rect.height * H, 0, H);
    return { x: snapCoordinate(x), y: snapCoordinate(y) };
  }

  function pointInObject(point, object) {
    if (object.visible === false) return false;
    const angle = -rad(object.rotation || 0);
    const dx = point.x - object.x;
    const dy = point.y - object.y;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (object.type === 'ellipse') {
      const nx = localX / (object.w / 2);
      const ny = localY / (object.h / 2);
      return nx * nx + ny * ny <= 1;
    }
    return Math.abs(localX) <= object.w / 2 && Math.abs(localY) <= object.h / 2;
  }

  function hitObject(point) {
    for (let index = state.objects.length - 1; index >= 0; index--) {
      const object = state.objects[index];
      if (pointInObject(point, object)) return object;
    }
    return null;
  }

  function hitHandle(point, object) {
    if (!object) return null;
    const handles = selectionHandles(object);
    for (const handle of handles) {
      if (Math.abs(point.x - handle.x) <= 10 && Math.abs(point.y - handle.y) <= 10) return handle.name;
    }
    const bounds = objectBounds(object);
    const rotateX = bounds.x + bounds.w / 2;
    const rotateY = bounds.y - 27;
    if (Math.hypot(point.x - rotateX, point.y - rotateY) <= 12) return 'rotate';
    return null;
  }

  function normalizePoints(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const width = Math.max(2, right - left);
    const height = Math.max(2, bottom - top);
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    return {
      x: centerX,
      y: centerY,
      w: width,
      h: height,
      points: points.map((point) => ({ x: (point.x - centerX) / width, y: (point.y - centerY) / height })),
    };
  }

  function setTool(tool) {
    if (state.tool === 'polygon' && state.polygonPoints.length) {
      if (state.polygonPoints.length >= 3) finishPolygon(); else cancelPolygon();
    }
    state.tool = tool;
    state.drawing = null;
    state.pointerAction = null;
    document.querySelectorAll('.tool-button').forEach((button) => button.classList.toggle('active', button.dataset.tool === tool));
    const hints = {
      select: 'Select: click an object to move, resize, recolor, or delete it.',
      rectangle: 'Rectangle: drag on the canvas to draw a rectangle.',
      ellipse: 'Ellipse: drag on the canvas to draw an ellipse.',
      triangle: 'Triangle: drag on the canvas to draw a triangle.',
      line: 'Line: drag from the starting point to the ending point.',
      polygon: 'Polygon: click points, then double-click or press Enter to finish.',
      freehand: 'Freehand: drag to draw. The stroke appears live.',
      text: 'Text: click the canvas, enter text, then insert it.',
    };
    $('toolHint').textContent = hints[tool] || 'Ready';
    setStatus(hints[tool] || 'Ready');
    render();
  }

  function addObjects(objects, status = 'Asset added') {
    if (!objects.length) return;
    pushHistory();
    state.objects.push(...objects);
    state.selectedId = objects[0].id;
    setTool('select');
    render();
    setStatus(status);
  }

  function finishPolygon() {
    if (state.polygonPoints.length < 3) {
      cancelPolygon();
      return;
    }
    pushHistory();
    const normalized = normalizePoints(state.polygonPoints);
    const object = makeObject('polygon', normalized.x, normalized.y, normalized.w, normalized.h, {
      name: 'Polygon',
      points: normalized.points,
      fill: '#7d85f7',
      stroke: '#4653c4',
      strokeWidth: 2,
      shadow: false,
    });
    state.objects.push(object);
    state.selectedId = object.id;
    state.polygonPoints = [];
    setTool('select');
    render();
    setStatus('Polygon finished');
  }

  function cancelPolygon() {
    state.polygonPoints = [];
    state.drawing = null;
    render();
  }

  function completeDrawing() {
    const drawing = state.drawing;
    if (!drawing) return;
    if (drawing.kind === 'shape') {
      const left = Math.min(drawing.start.x, drawing.end.x);
      const top = Math.min(drawing.start.y, drawing.end.y);
      const width = Math.abs(drawing.end.x - drawing.start.x);
      const height = Math.abs(drawing.end.y - drawing.start.y);
      if (Math.max(width, height) < 5) {
        state.drawing = null;
        render();
        return;
      }
      pushHistory();
      let object;
      if (drawing.tool === 'line') {
        const normalized = normalizePoints([drawing.start, drawing.end]);
        object = makeObject('line', normalized.x, normalized.y, normalized.w, normalized.h, {
          name: 'Line',
          points: normalized.points,
          stroke: '#2c466b',
          strokeWidth: 4,
          fill: '#2c466b',
        });
      } else {
        object = makeObject(drawing.tool, left + width / 2, top + height / 2, width, height, {
          fill: '#7d85f7',
          fill2: '#9f7df8',
          stroke: '#4753c5',
          strokeWidth: 2,
        });
      }
      state.objects.push(object);
      state.selectedId = object.id;
    } else if (drawing.kind === 'freehand' && drawing.points.length > 1) {
      pushHistory();
      const simplified = drawing.points.filter((point, index) => index === 0 || index === drawing.points.length - 1 || index % 2 === 0);
      const normalized = normalizePoints(simplified);
      const object = makeObject('freehand', normalized.x, normalized.y, normalized.w, normalized.h, {
        name: 'Freehand Stroke',
        points: normalized.points,
        fill: '#2d4669',
        stroke: '#2d4669',
        strokeWidth: 4,
      });
      state.objects.push(object);
      state.selectedId = object.id;
    }
    state.drawing = null;
    setTool('select');
    render();
  }

  function duplicateSelected() {
    const object = selectedObject();
    if (!object) return;
    pushHistory();
    const copy = clone(object);
    copy.id = uid();
    copy.name = `${object.name} Copy`;
    copy.x += 20;
    copy.y += 20;
    state.objects.push(copy);
    state.selectedId = copy.id;
    render();
    setStatus('Object duplicated');
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    pushHistory();
    state.objects = state.objects.filter((object) => object.id !== state.selectedId);
    state.selectedId = null;
    render();
    setStatus('Object deleted');
  }

  function bringFront() {
    const object = selectedObject();
    if (!object) return;
    pushHistory();
    state.objects = state.objects.filter((item) => item.id !== object.id);
    state.objects.push(object);
    render();
    setStatus('Object brought to front');
  }

  function sendBack() {
    const object = selectedObject();
    if (!object) return;
    pushHistory();
    state.objects = state.objects.filter((item) => item.id !== object.id);
    state.objects.unshift(object);
    render();
    setStatus('Object sent to back');
  }

  function childToObject(group, child, index) {
    const angle = rad(group.rotation || 0);
    const localX = child.x * group.w;
    const localY = child.y * group.h;
    const centerX = group.x + localX * Math.cos(angle) - localY * Math.sin(angle);
    const centerY = group.y + localX * Math.sin(angle) + localY * Math.cos(angle);
    const width = Math.max(2, Math.abs(child.w * group.w));
    const height = Math.max(2, Math.abs(child.h * group.h));
    const fill = child.theme ? group.fill : (typeof child.fill === 'string' ? child.fill : (child.fill?.from || child.fill?.inner || '#7580e9'));
    const strokeWidth = (child.sw ?? .002) * Math.min(group.w, group.h);
    const common = {
      name: `${group.name} Part ${index + 1}`,
      rotation: (group.rotation || 0) + (child.rotation || 0),
      fill,
      stroke: child.stroke || fill,
      strokeWidth,
      opacity: (group.opacity ?? 1) * (child.opacity ?? 1),
      shadow: child.shadow || false,
      category: group.category,
    };
    if (child.type === 'rect' || child.type === 'roundRect') return makeObject('rectangle', centerX, centerY, width, height, common);
    if (child.type === 'ellipse') return makeObject('ellipse', centerX, centerY, width, height, common);
    if (child.type === 'polygon') return makeObject('polygon', centerX, centerY, width, height, { ...common, points: child.points.map((point) => ({ x: point[0], y: point[1] })) });
    if (child.type === 'line') return makeObject('line', centerX, centerY, width, height, { ...common, points: [{ x: -.5, y: -.5 }, { x: .5, y: .5 }] });
    if (child.type === 'text') return makeObject('text', centerX, centerY, width, height, { ...common, text: child.text, fontSize: height });
    return null;
  }

  function ungroupSelected() {
    const group = selectedObject();
    if (!group || group.type !== 'group') return;
    pushHistory();
    const parts = (group.children || []).map((child, index) => childToObject(group, child, index)).filter(Boolean);
    const index = state.objects.findIndex((object) => object.id === group.id);
    state.objects.splice(index, 1, ...parts);
    state.selectedId = parts[0]?.id || null;
    render();
    setStatus(`${parts.length} editable parts created`);
  }

  function setStatus(text) {
    $('statusText').textContent = text;
  }

  function updateStatusSummary() {
    $('statusSummary').textContent = `Canvas: ${W} × ${H} · Objects: ${state.objects.length} · Grid: ${state.gridSize}px`;
    $('zoomValue').textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function updateInspector() {
    const object = selectedObject();
    $('propertiesEmpty').classList.toggle('hidden', !!object);
    $('propertiesForm').classList.toggle('hidden', !object);
    if (!object) return;
    $('selectedObjectTitle').textContent = object.name;
    $('selectedObjectType').textContent = object.type === 'group' ? `${object.children?.length || 0} parts` : object.type;
    $('propName').value = object.name;
    $('propX').value = Math.round(object.x);
    $('propY').value = Math.round(H - object.y);
    $('propW').value = Math.round(object.w);
    $('propH').value = Math.round(object.h);
    $('propRotation').value = Math.round(object.rotation || 0);
    $('rotationOutput').textContent = `${Math.round(object.rotation || 0)}°`;
    const fill = typeof object.fill === 'string' ? object.fill : '#6c73e7';
    $('propFill').value = fill;
    $('propStroke').value = object.stroke || '#34435c';
    $('propStrokeWidth').value = Number(object.strokeWidth || 0).toFixed(1);
    $('propOpacity').value = Number(object.opacity ?? 1).toFixed(2);
    $('propShadow').checked = !!object.shadow;
    $('propAnimation').value = object.animation?.preset || 'none';
    $('propDuration').value = object.animation?.duration || 5;
    $('propAmount').value = object.animation?.amount || 180;
    $('propLoop').checked = object.animation?.loop !== false;
    $('ungroupBtn').disabled = object.type !== 'group';
  }

  function updateLayers() {
    $('layersCount').textContent = `${state.objects.length} object${state.objects.length === 1 ? '' : 's'}`;
    const container = $('layersList');
    container.replaceChildren();
    [...state.objects].reverse().forEach((object) => {
      const row = document.createElement('div');
      row.className = `layer-row${object.id === state.selectedId ? ' active' : ''}`;
      const partInfo = object.type === 'group' ? `${object.children?.length || 0} parts` : object.type;
      row.innerHTML = `
        <span class="layer-dot"></span>
        <span class="layer-main"><strong>${escapeHtml(object.name)}</strong><span>${partInfo}</span></span>
        <span class="layer-actions">
          <button type="button" data-layer-action="visibility" title="Show or hide">${object.visible === false ? '○' : '●'}</button>
          <button type="button" data-layer-action="delete" title="Delete">×</button>
        </span>`;
      row.addEventListener('click', (event) => {
        const action = event.target.dataset.layerAction;
        if (action === 'visibility') {
          event.stopPropagation();
          pushHistory();
          object.visible = object.visible === false;
          render();
          return;
        }
        if (action === 'delete') {
          event.stopPropagation();
          pushHistory();
          state.objects = state.objects.filter((item) => item.id !== object.id);
          if (state.selectedId === object.id) state.selectedId = null;
          render();
          return;
        }
        state.selectedId = object.id;
        state.inspectorTab = 'properties';
        activateInspectorTab('properties');
        render();
      });
      container.append(row);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function activateInspectorTab(tab) {
    state.inspectorTab = tab;
    document.querySelectorAll('.inspector-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
    $('propertiesTab').classList.toggle('hidden', tab !== 'properties');
    $('layersTab').classList.toggle('hidden', tab !== 'layers');
  }

  function propertyInput(id, handler) {
    const input = $(id);
    input.addEventListener('focus', () => {
      if (!input.dataset.historyStarted) {
        pushHistory();
        input.dataset.historyStarted = '1';
      }
    });
    input.addEventListener('blur', () => delete input.dataset.historyStarted);
    input.addEventListener('input', () => {
      const object = selectedObject();
      if (!object) return;
      handler(object, input);
      render();
    });
  }

  propertyInput('propName', (object, input) => { object.name = input.value || 'Object'; });
  propertyInput('propX', (object, input) => { object.x = Number(input.value) || 0; });
  propertyInput('propY', (object, input) => { object.y = H - (Number(input.value) || 0); });
  propertyInput('propW', (object, input) => { object.w = Math.max(2, Number(input.value) || 2); });
  propertyInput('propH', (object, input) => { object.h = Math.max(2, Number(input.value) || 2); });
  propertyInput('propRotation', (object, input) => { object.rotation = Number(input.value) || 0; $('rotationOutput').textContent = `${Math.round(object.rotation)}°`; });
  propertyInput('propFill', (object, input) => { object.fill = input.value; });
  propertyInput('propStroke', (object, input) => { object.stroke = input.value; });
  propertyInput('propStrokeWidth', (object, input) => { object.strokeWidth = Math.max(0, Number(input.value) || 0); });
  propertyInput('propOpacity', (object, input) => { object.opacity = clamp(Number(input.value) || 1, .05, 1); });
  propertyInput('propShadow', (object, input) => { object.shadow = input.checked; });
  propertyInput('propAnimation', (object, input) => { object.animation.preset = input.value; });
  propertyInput('propDuration', (object, input) => { object.animation.duration = Math.max(.2, Number(input.value) || 5); });
  propertyInput('propAmount', (object, input) => { object.animation.amount = Math.max(1, Number(input.value) || 180); });
  propertyInput('propLoop', (object, input) => { object.animation.loop = input.checked; });

  // ---------- Professional primitive templates ----------

  function addCloud(children, x, y, scale = 1, opacity = .95) {
    const fill = LG('#ffffff', '#e7f0fb', 'vertical');
    children.push(P.ellipse(x - .035 * scale, y, .10 * scale, .050 * scale, fill, { opacity }));
    children.push(P.ellipse(x + .01 * scale, y - .016 * scale, .12 * scale, .072 * scale, fill, { opacity }));
    children.push(P.ellipse(x + .06 * scale, y + .002 * scale, .10 * scale, .05 * scale, fill, { opacity }));
    children.push(P.roundRect(x + .01 * scale, y + .016 * scale, .18 * scale, .036 * scale, fill, .018, { opacity }));
  }

  function addTree(children, x, y, scale = 1, variant = 'round') {
    children.push(P.ellipse(x, y + .105 * scale, .12 * scale, .026 * scale, 'rgba(36,61,35,.18)'));
    children.push(P.polygon(x, y + .025 * scale, .055 * scale, .22 * scale, [[-.25,-.5],[.28,-.5],[.48,.5],[-.46,.5]], LG('#7c4c2b','#4b2b18','horizontal'), { stroke:'#472714', sw:.003 }));
    children.push(P.line(x - .006 * scale, y - .005 * scale, -.08 * scale, -.09 * scale, '#5d351d', .009));
    children.push(P.line(x + .006 * scale, y - .01 * scale, .08 * scale, -.08 * scale, '#5d351d', .009));
    const palette = variant === 'olive' ? ['#8ab446','#679735','#4f7e2c'] : ['#73b34a','#4e963c','#347a35'];
    const blobs = [
      [-.06,-.09,.16,.15,0], [.02,-.12,.19,.17,1], [.08,-.075,.16,.15,2],
      [-.10,-.02,.17,.15,1], [-.01,-.025,.21,.18,0], [.095,.00,.16,.14,1],
      [-.05,.045,.18,.14,2], [.05,.055,.17,.14,0]
    ];
    blobs.forEach(([bx, by, bw, bh, pi]) => children.push(P.ellipse(x + bx * scale, y + by * scale, bw * scale, bh * scale, RG(palette[pi], palette[Math.min(2, pi + 1)]), { stroke:'#3f7c34', sw:.0015 })));
    children.push(P.ellipse(x - .03 * scale, y - .10 * scale, .075 * scale, .055 * scale, 'rgba(205,241,139,.30)'));
  }

  function addBush(children, x, y, scale = 1, color = '#4f9639') {
    children.push(P.ellipse(x - .025 * scale, y, .07 * scale, .055 * scale, LG('#7fbd4f', color, 'vertical')));
    children.push(P.ellipse(x + .025 * scale, y - .008 * scale, .075 * scale, .06 * scale, LG('#76b64b', '#397e35', 'vertical')));
    children.push(P.ellipse(x + .065 * scale, y + .005 * scale, .055 * scale, .045 * scale, LG('#6ca942', '#34752f', 'vertical')));
  }

  function addWindow(children, x, y, w, h, frame = '#2c3b4b', glow = false) {
    children.push(P.roundRect(x, y, w, h, frame, .006, { shadow:{ color:'rgba(35,50,72,.22)', blur:6, offsetY:3 } }));
    children.push(P.rect(x, y, w * .84, h * .80, glow ? LG('#f8cf78','#7fc6e8','vertical') : LG('#b9e4fa','#5fa9d3','diagonal'), { stroke:'#dceaf2', sw:.002 }));
    children.push(P.line(x, y, 0, h * .78, '#f5fbff', .003));
    children.push(P.line(x, y, w * .82, 0, '#f5fbff', .003));
    children.push(P.polygon(x - w * .12, y - h * .10, w * .18, h * .50, [[-.5,-.5],[-.05,-.5],[.5,.5],[.05,.5]], 'rgba(255,255,255,.26)'));
  }

  function addFlowers(children, x, y, scale = 1) {
    const colors = ['#f6ca4e','#f18b95','#e95ca7','#ffffff','#f2a63b'];
    for (let i = 0; i < 9; i++) {
      const px = x + (i - 4) * .014 * scale;
      const py = y + Math.sin(i * 1.8) * .009 * scale;
      children.push(P.ellipse(px, py, .011 * scale, .011 * scale, colors[i % colors.length]));
      children.push(P.line(px, py + .012 * scale, 0, .024 * scale, '#3f7b37', .0015));
    }
  }

  function modernHomeSceneFactory() {
    const children = [];
    children.push(P.rect(0, -.12, 1, .76, LG('#bde8ff','#e9f5fc','vertical')));
    children.push(P.ellipse(-.36,-.37,.11,.11,RG('#fff4a2','#f3bf43')));
    addCloud(children, -.31, -.31, .9);
    addCloud(children, .29, -.33, .82);
    children.push(P.polygon(-.28,.14,.65,.22,[[-.5,.40],[-.34,-.08],[-.20,.12],[-.02,-.34],[.14,.02],[.30,-.16],[.5,.36]],LG('#b9d3dd','#7eac9d','vertical')));
    children.push(P.polygon(.22,.13,.72,.24,[[-.5,.38],[-.32,.02],[-.17,.18],[.02,-.36],[.18,.08],[.36,-.12],[.5,.38]],LG('#b4cfda','#76a496','vertical')));
    children.push(P.rect(0,.26,1,.34,LG('#75b84f','#4a923f','vertical')));
    children.push(P.rect(0,.47,1,.17,LG('#515a69','#343b48','vertical')));
    children.push(P.rect(0,.37,1,.035,LG('#e6e9ec','#c7cdd4','vertical')));
    for(let i=-.44;i<=.44;i+=.12) children.push(P.roundRect(i,.47,.075,.008,'#f5f6f7',.003));

    // house shadow and body
    children.push(P.ellipse(.05,.28,.64,.055,'rgba(33,48,67,.18)'));
    children.push(P.rect(.03,.06,.49,.47,LG('#f7e7ca','#dbc49f','vertical'),{stroke:'#876f53',sw:.003,shadow:{color:'rgba(49,59,72,.24)',blur:12,offsetY:8}}));
    children.push(P.rect(.26,.15,.30,.28,LG('#ead6b6','#c7ae87','vertical'),{stroke:'#806b50',sw:.003}));
    children.push(P.polygon(-.06,-.20,.58,.22,[[-.5,.32],[0,-.5],[.5,.32],[.37,.5],[-.37,.5]],LG('#2f455a','#182b3e','vertical'),{stroke:'#172838',sw:.004}));
    children.push(P.polygon(.25,-.02,.37,.17,[[-.5,.28],[-.23,-.5],[.5,-.5],[.5,.35]],LG('#344b61','#1e3042','vertical'),{stroke:'#18293a',sw:.004}));
    // roof lines
    for(let i=-.28;i<=.26;i+=.035) children.push(P.line(i,-.16,.02,.11,'rgba(255,255,255,.10)',.0012,{rotation:28}));
    children.push(P.roundRect(.20,.18,.22,.20,LG('#775039','#4b2d20','vertical'),.008,{stroke:'#3e261d',sw:.003}));
    for(let i=-.08;i<=.08;i+=.04) children.push(P.line(.20+i,.18,0,.18,'rgba(31,18,12,.28)',.0014));
    for(let i=-.07;i<=.07;i+=.035) children.push(P.line(.20,.18+i,.20,0,'rgba(255,255,255,.08)',.0012));
    children.push(P.roundRect(-.03,.16,.095,.19,LG('#68452f','#3d261b','vertical'),.006,{stroke:'#2c1b14',sw:.003}));
    children.push(P.roundRect(-.03,.16,.060,.145,LG('#85593c','#4b2d1f','vertical'),.004,{stroke:'#301d15',sw:.002}));
    children.push(P.ellipse(.003,.17,.009,.009,'#e6bd67'));
    children.push(P.rect(-.03,.27,.15,.015,LG('#d5d2cc','#aaa69f','vertical')));
    children.push(P.rect(-.03,.30,.18,.017,LG('#d5d2cc','#a7a39b','vertical')));
    addWindow(children,-.17,.02,.12,.15,'#2b3d4e',false);
    addWindow(children,.05,.01,.115,.15,'#2b3d4e',false);
    addWindow(children,-.18,.19,.17,.14,'#2b3d4e',false);
    children.push(P.ellipse(-.05,-.07,.055,.055,LG('#dbe9ee','#9cc4d2','vertical'),{stroke:'#273d4e',sw:.004}));
    children.push(P.line(-.05,-.07,0,.05,'#273d4e',.003));
    children.push(P.line(-.05,-.07,.05,0,'#273d4e',.003));
    children.push(P.rect(-.245,.08,.012,.41,'rgba(150,112,67,.20)'));
    children.push(P.rect(.03,.295,.03,.02,'#697d8e'));
    children.push(P.polygon(-.02,.36,.18,.18,[[-.5,.5],[-.25,-.5],[.25,-.5],[.5,.5]],LG('#eadbc6','#c8b69b','vertical')));
    children.push(P.polygon(.23,.38,.27,.19,[[-.5,-.5],[.5,-.5],[.5,.5],[-.25,.5]],LG('#b8b9bb','#8f9398','vertical')));
    addTree(children,-.38,.12,.82,'round');
    addTree(children,.39,.13,.62,'olive');
    addBush(children,-.18,.29,.85); addBush(children,.36,.29,.72); addBush(children,-.31,.30,.60);
    addFlowers(children,-.24,.29,.85); addFlowers(children,.33,.29,.7);
    // fence
    for(let x=-.48;x<=-.25;x+=.035){
      children.push(P.polygon(x,.34,.018,.105,[[-.5,.5],[-.5,-.28],[0,-.5],[.5,-.28],[.5,.5]],'#f5f0e6',{stroke:'#d8d1c6',sw:.001}));
    }
    for(let x=.34;x<=.48;x+=.035){
      children.push(P.polygon(x,.34,.018,.105,[[-.5,.5],[-.5,-.28],[0,-.5],[.5,-.28],[.5,.5]],'#f5f0e6',{stroke:'#d8d1c6',sw:.001}));
    }
    children.push(P.rect(-.365,.34,.25,.016,'#f5f0e6')); children.push(P.rect(.41,.34,.16,.016,'#f5f0e6'));
    return [makeGroup('Modern Home Scene', W/2, H/2, 940, 610, children, { category:'scene' })];
  }

  function smartHomeSceneFactory() {
    const children = [];
    children.push(P.rect(0,-.12,1,.76,LG('#c7e9fb','#edf7fc','vertical')));
    addCloud(children,-.32,-.33,.78); addCloud(children,.31,-.34,.72);
    children.push(P.ellipse(-.37,-.34,.10,.10,RG('#fff2a0','#f4c454')));
    for(let i=-.47;i<=.47;i+=.09){
      const height=.12+(Math.sin(i*33)+1)*.045;
      children.push(P.rect(i,.02,.055,height,'rgba(108,152,187,.18)'));
    }
    children.push(P.rect(0,.25,1,.36,LG('#78b958','#4e9343','vertical')));
    children.push(P.rect(0,.47,1,.17,LG('#4d5666','#303744','vertical')));
    children.push(P.rect(0,.37,1,.035,LG('#eef1f4','#c8cfd6','vertical')));
    for(let i=-.44;i<=.44;i+=.12) children.push(P.roundRect(i,.47,.075,.008,'#f5f6f7',.003));
    children.push(P.ellipse(.00,.28,.68,.05,'rgba(35,51,72,.15)'));
    // modern body
    children.push(P.roundRect(-.09,.06,.54,.46,LG('#f8f8f5','#dfe6ec','vertical'),.008,{stroke:'#647385',sw:.003,shadow:{color:'rgba(34,52,78,.24)',blur:12,offsetY:8}}));
    children.push(P.rect(-.22,.04,.18,.46,LG('#b57a45','#744827','horizontal'),{stroke:'#674020',sw:.003}));
    for(let i=-.295;i<=-.145;i+=.018) children.push(P.line(i,.04,0,.44,'rgba(63,34,16,.30)',.0012));
    children.push(P.polygon(-.05,-.20,.68,.16,[[-.5,.24],[-.43,-.24],[.5,-.24],[.43,.24]],LG('#31475e','#172a3b','vertical'),{stroke:'#142536',sw:.004}));
    children.push(P.roundRect(.23,.14,.29,.24,LG('#dfe5e8','#c4cdd3','vertical'),.004,{stroke:'#667688',sw:.003}));
    children.push(P.roundRect(.23,.15,.225,.16,LG('#3d536a','#202f3f','vertical'),.004,{stroke:'#172535',sw:.003}));
    for(let i=-.08;i<=.08;i+=.032) children.push(P.line(.23,.15+i,.20,0,'rgba(255,255,255,.08)',.001));
    addWindow(children,-.10,-.02,.15,.18,'#2b3e52',false);
    addWindow(children,.10,-.02,.15,.18,'#2b3e52',false);
    children.push(P.rect(-.02,.065,.37,.012,'#8493a3'));
    children.push(P.line(-.16,.04,0,.12,'#536779',.002));
    children.push(P.line(-.04,.04,0,.12,'#536779',.002));
    children.push(P.line(.08,.04,0,.12,'#536779',.002));
    children.push(P.line(.20,.04,0,.12,'#536779',.002));
    children.push(P.roundRect(-.19,.17,.075,.19,LG('#2e455a','#162a3a','vertical'),.004,{stroke:'#132330',sw:.003}));
    children.push(P.rect(-.19,.12,.040,.09,LG('#9bd5ed','#dff7ff','vertical'),{stroke:'#d6ecf4',sw:.0015}));
    children.push(P.polygon(-.02,.36,.18,.19,[[-.5,.5],[-.27,-.5],[.27,-.5],[.5,.5]],LG('#f2f3f4','#ced2d5','vertical')));
    children.push(P.polygon(.22,.37,.28,.20,[[-.5,-.5],[.5,-.5],[.5,.5],[-.32,.5]],LG('#c6cdd3','#9ca6af','vertical')));
    addTree(children,.37,.08,.62,'round');
    addBush(children,-.37,.28,.70); addBush(children,.35,.29,.65); addBush(children,-.19,.29,.55);
    children.push(P.line(.44,.27,0,.14,'#26384a',.004));
    children.push(P.ellipse(.44,.20,.024,.012,LG('#fff2b4','#e9b94b','vertical'),{stroke:'#3e4b55',sw:.0015}));
    return [makeGroup('Smart Home Scene', W/2, H/2, 940, 610, children, { category:'scene' })];
  }

  function luxuryHomeSceneFactory() {
    const children = [];
    children.push(P.rect(0,-.12,1,.76,LG('#b8e1f7','#eef7fb','vertical')));
    children.push(P.ellipse(.35,-.37,.105,.105,RG('#fff5aa','#f3bd42')));
    addCloud(children,-.31,-.33,.75); addCloud(children,.27,-.31,.9);
    children.push(P.polygon(-.18,.13,.65,.22,[[-.5,.36],[-.29,.02],[-.13,.14],[.02,-.34],[.18,.06],[.35,-.13],[.5,.36]],LG('#b7d3df','#7ca79a','vertical')));
    children.push(P.rect(0,.25,1,.36,LG('#7abd55','#4e9443','vertical')));
    children.push(P.rect(0,.47,1,.17,LG('#4d5564','#313844','vertical')));
    for(let i=-.44;i<=.44;i+=.12) children.push(P.roundRect(i,.47,.075,.008,'#f4f5f6',.003));
    children.push(P.ellipse(.02,.28,.70,.055,'rgba(33,48,67,.16)'));
    children.push(P.roundRect(-.05,.07,.57,.46,LG('#faf9f4','#d7dee3','vertical'),.006,{stroke:'#687788',sw:.003,shadow:{color:'rgba(33,50,74,.25)',blur:13,offsetY:8}}));
    children.push(P.roundRect(-.20,.04,.20,.45,LG('#f0e7d6','#d8c4a4','vertical'),.004,{stroke:'#887357',sw:.003}));
    children.push(P.rect(.13,.01,.25,.23,LG('#c2cbd2','#a2afb8','vertical'),{stroke:'#617180',sw:.003}));
    children.push(P.polygon(-.10,-.21,.62,.18,[[-.5,.32],[-.41,-.32],[.5,-.32],[.42,.32]],LG('#30465c','#162939','vertical'),{stroke:'#142535',sw:.004}));
    children.push(P.polygon(.24,-.05,.34,.16,[[-.5,.28],[-.28,-.5],[.5,-.5],[.5,.36]],LG('#344b61','#1d3042','vertical'),{stroke:'#17283a',sw:.004}));
    addWindow(children,-.20,-.06,.12,.18,'#2c3d4d',true);
    addWindow(children,.00,-.06,.15,.18,'#2c3d4d',true);
    addWindow(children,-.19,.17,.14,.15,'#2c3d4d',true);
    children.push(P.roundRect(.21,.16,.20,.17,LG('#6f4a34','#3c261c','vertical'),.004,{stroke:'#2e1d16',sw:.003}));
    for(let i=-.06;i<=.06;i+=.03) children.push(P.line(.21+i,.16,0,.15,'rgba(20,12,8,.25)',.001));
    children.push(P.roundRect(-.02,.17,.08,.19,LG('#65412e','#342019','vertical'),.004,{stroke:'#281812',sw:.003}));
    children.push(P.rect(-.02,.28,.15,.014,'#d9d7d3'));
    children.push(P.rect(-.02,.31,.18,.016,'#c5c4c0'));
    children.push(P.polygon(-.02,.38,.18,.17,[[-.5,.5],[-.28,-.5],[.28,-.5],[.5,.5]],LG('#e8dfd2','#cfc0aa','vertical')));
    addTree(children,-.38,.10,.72,'round');
    addTree(children,.39,.10,.58,'olive');
    addBush(children,-.25,.29,.75); addBush(children,.28,.29,.70); addBush(children,-.08,.29,.55);
    addFlowers(children,-.29,.29,.75); addFlowers(children,.31,.29,.7);
    return [makeGroup('Luxury Home Scene', W/2, H/2, 940, 610, children, { category:'scene' })];
  }

  function carFactory(x = 500, y = 470, scale = 1, color = '#315b9d', animated = false) {
    const children = [];
    children.push(P.ellipse(0,.32,.88,.11,'rgba(21,31,45,.22)'));
    children.push(P.polygon(0,.03,1,.58,[[-.48,.20],[-.42,-.05],[-.27,-.20],[.17,-.20],[.31,-.08],[.43,.04],[.48,.20],[.41,.31],[-.43,.31]],LG(color,'#17345f','vertical'),{stroke:'#172d4f',sw:.009,shadow:{color:'rgba(27,45,70,.22)',blur:8,offsetY:4}}));
    children.push(P.polygon(-.05,-.08,.45,.22,[[-.5,.50],[-.28,-.50],[.18,-.50],[.50,.50]],LG('#d9f3ff','#79b6dd','vertical'),{stroke:'#eaf9ff',sw:.004}));
    children.push(P.polygon(.20,-.08,.25,.22,[[-.50,-.50],[.10,-.50],[.50,.50],[-.25,.50]],LG('#d9f3ff','#79b6dd','vertical'),{stroke:'#eaf9ff',sw:.004}));
    children.push(P.roundRect(-.37,.08,.08,.055,LG('#fff4d0','#f2b65c','vertical'),.01,{stroke:'#7c5521',sw:.003}));
    children.push(P.roundRect(.39,.10,.065,.04,LG('#ffb3a9','#d74b45','vertical'),.01,{stroke:'#8c2924',sw:.003}));
    children.push(P.ellipse(-.24,.25,.18,.18,LG('#1c2430','#06090d','vertical'),{stroke:'#020304',sw:.01}));
    children.push(P.ellipse(.25,.25,.18,.18,LG('#1c2430','#06090d','vertical'),{stroke:'#020304',sw:.01}));
    children.push(P.ellipse(-.24,.25,.085,.085,LG('#e9edf1','#8996a5','vertical'),{stroke:'#55616c',sw:.003}));
    children.push(P.ellipse(.25,.25,.085,.085,LG('#e9edf1','#8996a5','vertical'),{stroke:'#55616c',sw:.003}));
    for(let a=0;a<8;a++){
      const angle=a*Math.PI/4;
      children.push(P.line(-.24 + Math.cos(angle)*.028,.25 + Math.sin(angle)*.028,Math.cos(angle)*.05,Math.sin(angle)*.05,'#55616c',.003));
      children.push(P.line(.25 + Math.cos(angle)*.028,.25 + Math.sin(angle)*.028,Math.cos(angle)*.05,Math.sin(angle)*.05,'#55616c',.003));
    }
    return makeGroup('Premium Sedan', x, y, 210*scale, 92*scale, children, { category:'vehicle', animation:animated?{preset:'slide',duration:8,amount:720,loop:true}:undefined });
  }

  function busFactory(x = 500, y = 470, scale = 1, animated = false) {
    const children = [];
    children.push(P.ellipse(0,.34,.90,.10,'rgba(18,29,43,.22)'));
    children.push(P.roundRect(0,.01,.90,.46,LG('#f4f7f8','#c8d3da','vertical'),.035,{stroke:'#47596b',sw:.007,shadow:{color:'rgba(30,50,72,.22)',blur:9,offsetY:5}}));
    children.push(P.rect(-.08,-.10,.61,.21,LG('#d8f3ff','#70b9e5','vertical'),{stroke:'#eaf9ff',sw:.004}));
    for(let x=-.31;x<=.20;x+=.13) children.push(P.line(x,-.10,0,.20,'#536879',.003));
    children.push(P.rect(0,.13,.88,.08,LG('#4c9de0','#2d6fb5','vertical')));
    children.push(P.roundRect(.37,.03,.105,.31,LG('#435264','#253240','vertical'),.012,{stroke:'#1c2834',sw:.004}));
    children.push(P.roundRect(-.39,.02,.07,.23,LG('#9ed9f1','#4d9ac6','vertical'),.008,{stroke:'#dff4fc',sw:.003}));
    children.push(P.ellipse(-.28,.29,.14,.14,LG('#1a222d','#05080b','vertical'),{stroke:'#000',sw:.008}));
    children.push(P.ellipse(.28,.29,.14,.14,LG('#1a222d','#05080b','vertical'),{stroke:'#000',sw:.008}));
    children.push(P.ellipse(-.28,.29,.06,.06,LG('#e2e7ea','#8793a0','vertical')));
    children.push(P.ellipse(.28,.29,.06,.06,LG('#e2e7ea','#8793a0','vertical')));
    return makeGroup('City Bus', x, y, 250*scale, 108*scale, children, { category:'vehicle', animation:animated?{preset:'slide',duration:9,amount:760,loop:true}:undefined });
  }

  function birdFactory(x,y,scale=.8,delay=0) {
    const children=[];
    children.push(P.ellipse(0,.04,.30,.16,'#172234'));
    children.push(P.polygon(-.19,-.03,.42,.40,[[-.5,.18],[-.12,-.5],[.5,.12],[.05,.5]],LG('#34475d','#101b29','vertical')));
    children.push(P.polygon(.19,-.03,.42,.40,[[-.5,.12],[.12,-.5],[.5,.18],[-.05,.5]],LG('#34475d','#101b29','vertical')));
    children.push(P.polygon(.22,.04,.20,.15,[[-.5,-.5],[.5,0],[-.5,.5]],'#e14f43'));
    return makeGroup('Flying Bird',x,y,70*scale,34*scale,children,{category:'nature',animation:{preset:'slide',duration:7.5,amount:420,loop:true,delay}});
  }

  function citySceneFactory() {
    const children=[];
    children.push(P.rect(0,-.12,1,.76,LG('#bce6fb','#eaf5fb','vertical')));
    children.push(P.ellipse(-.40,-.38,.10,.10,RG('#fff2a0','#f3be45')));
    addCloud(children,-.34,-.31,.75); addCloud(children,.32,-.33,.72); addCloud(children,.05,-.36,.55,.85);
    // distant skyline
    const distant=[[-.47,.02,.055,.26],[-.40,.00,.08,.30],[-.31,.04,.06,.22],[-.24,-.01,.07,.32],[-.15,.02,.055,.26],[-.07,-.05,.07,.40],[.03,.01,.06,.28],[.12,-.02,.07,.34],[.22,.04,.055,.22],[.31,-.01,.07,.32],[.40,.03,.06,.24],[.47,-.02,.055,.34]];
    distant.forEach(([x,y,w,h],i)=>children.push(P.rect(x,y,w,h,i%2? 'rgba(111,162,197,.28)':'rgba(96,148,187,.22)')));
    children.push(P.rect(0,.25,1,.36,LG('#7bb85d','#579449','vertical')));
    children.push(P.rect(0,.47,1,.17,LG('#515a68','#333b47','vertical')));
    children.push(P.rect(0,.36,1,.045,LG('#e8ebee','#c9cfd5','vertical')));
    for(let i=-.44;i<=.44;i+=.12) children.push(P.roundRect(i,.47,.075,.008,'#f4f6f7',.003));
    // buildings
    const buildings=[
      {x:-.42,y:.08,w:.13,h:.34,body:LG('#e8d4bc','#c8ad8e','vertical'),roof:'#c5b29a',cols:3,rows:4},
      {x:-.26,y:-.02,w:.13,h:.54,body:LG('#5f93c5','#2f6191','vertical'),roof:'#3d5064',cols:4,rows:7},
      {x:-.10,y:.05,w:.14,h:.40,body:LG('#f0e7d8','#cfc1ad','vertical'),roof:'#d5c9b9',cols:3,rows:5},
      {x:.04,y:.10,w:.12,h:.31,body:LG('#bd6e5d','#8d463c','vertical'),roof:'#9f5549',cols:2,rows:4},
      {x:.19,y:.03,w:.14,h:.45,body:LG('#6a7e91','#3d5064','vertical'),roof:'#576a7d',cols:3,rows:6},
      {x:.35,y:-.01,w:.13,h:.54,body:LG('#6d8499','#41576b','vertical'),roof:'#b55d4f',cols:3,rows:7},
      {x:.47,y:.06,w:.14,h:.40,body:LG('#f0dfca','#cfb99f','vertical'),roof:'#b34f41',cols:3,rows:5},
    ];
    buildings.forEach((building,bIndex)=>{
      children.push(P.roundRect(building.x,building.y,building.w,building.h,building.body,.006,{stroke:'rgba(55,73,91,.38)',sw:.0025,shadow:{color:'rgba(46,65,88,.18)',blur:8,offsetY:4}}));
      children.push(P.rect(building.x,building.y-building.h/2+.015,building.w*1.02,.025,building.roof));
      const marginX=building.w*.18;
      const marginY=building.h*.13;
      const usableW=building.w-marginX*2;
      const usableH=building.h-marginY*2;
      for(let row=0;row<building.rows;row++){
        for(let col=0;col<building.cols;col++){
          const wx=building.x-building.w/2+marginX+(col+.5)*(usableW/building.cols);
          const wy=building.y-building.h/2+marginY+(row+.5)*(usableH/building.rows);
          children.push(P.roundRect(wx,wy,building.w*.12,building.h*.07, row%3===0?LG('#d4f0fb','#77b6d8','vertical'):LG('#9ac7df','#537d9c','vertical'),.002,{stroke:'rgba(39,59,75,.55)',sw:.0012}));
        }
      }
      if(bIndex===0){
        children.push(P.roundRect(building.x,.25,building.w*.70,.12,LG('#d55443','#f2e1d0','vertical'),.008));
        for(let s=-.025;s<=.025;s+=.025) children.push(P.polygon(building.x+s,.225,.022,.055,[[-.5,-.5],[.5,-.5],[.35,.5],[-.35,.5]],s===0?'#f8f5ef':'#d95c50'));
      }
    });
    addTree(children,-.48,.24,.38,'round'); addTree(children,.43,.24,.40,'round'); addTree(children,.34,.25,.35,'olive');
    // street lamps and bus stop
    [-.36,.42].forEach(x=>{
      children.push(P.line(x,.30,0,.20,'#283746',.004));
      children.push(P.ellipse(x,.20,.028,.018,LG('#fff1a8','#f0bd43','vertical'),{stroke:'#273746',sw:.0015}));
      children.push(P.polygon(x,.205,.05,.07,[[-.5,.5],[-.35,-.2],[0,-.5],[.35,-.2],[.5,.5]],'#263746'));
    });
    children.push(P.line(.15,.29,0,.16,'#31475b',.003));
    children.push(P.roundRect(.15,.21,.055,.055,LG('#5fa9e4','#3275bd','vertical'),.006,{stroke:'#f2f8fc',sw:.003}));
    children.push(P.roundRect(.15,.21,.028,.028,'#ffffff',.004));
    children.push(P.rect(.01,.30,.13,.02,'#6d4a31')); children.push(P.line(-.04,.31,0,.07,'#374454',.003)); children.push(P.line(.06,.31,0,.07,'#374454',.003));
    const scene=makeGroup('Modern City Scene',W/2,H/2,940,610,children,{category:'scene'});
    // Keep a scene asset as one editable group. The canvas editor can still
    // ungroup its primitive children without turning one thumbnail into a
    // collection of unrelated top-level objects.
    return [scene];
  }

  function officeBuildingFactory() {
    const children=[];
    children.push(P.ellipse(0,.44,.70,.08,'rgba(28,44,65,.18)'));
    children.push(P.roundRect(0,.02,.70,.86,LG('#e9eef2','#aebac6','vertical'),.015,{stroke:'#506173',sw:.006,shadow:{color:'rgba(34,52,75,.24)',blur:10,offsetY:6}}));
    children.push(P.rect(-.18,.01,.22,.78,LG('#344e68','#1f3449','vertical')));
    children.push(P.rect(.09,.01,.33,.78,LG('#6aa9d5','#315f88','vertical')));
    for(let row=-.31;row<=.32;row+=.13){
      children.push(P.line(.09,row,.30,0,'rgba(235,248,255,.62)',.003));
    }
    for(let col=-.04;col<=.22;col+=.087){
      children.push(P.line(col,.01,0,.75,'rgba(227,244,255,.58)',.003));
    }
    children.push(P.roundRect(-.18,.31,.12,.16,LG('#a9ddf1','#5d9fc5','vertical'),.006,{stroke:'#dff5ff',sw:.003}));
    children.push(P.rect(0,-.41,.72,.055,LG('#526578','#2e4154','vertical')));
    children.push(P.line(0,-.47,0,.14,'#394a5b',.006));
    return [makeGroup('Office Building',500,335,280,470,children,{category:'architecture'})];
  }

  function treeFactory() {
    const children=[]; addTree(children,0,.02,2.1,'round');
    return [makeGroup('Tree',500,340,240,310,children,{category:'nature'})];
  }

  function humanFactory() {
    const children=[];
    children.push(P.ellipse(0,.46,.45,.05,'rgba(26,39,57,.18)'));
    children.push(P.ellipse(0,-.37,.20,.15,LG('#f2c39d','#cf8c68','vertical'),{stroke:'#7b513b',sw:.004}));
    children.push(P.polygon(0,-.02,.70,.62,[[-.30,-.48],[.30,-.48],[.42,.28],[.20,.48],[-.20,.48],[-.42,.28]],LG('#324f82','#172b4d','vertical'),{stroke:'#17263d',sw:.006,shadow:{color:'rgba(30,45,64,.18)',blur:6,offsetY:3}}));
    children.push(P.polygon(0,-.14,.26,.35,[[-.5,-.5],[.5,-.5],[0,.5]],'#ffffff',{stroke:'#d4dae1',sw:.002}));
    children.push(P.polygon(0,-.08,.08,.26,[[-.5,-.5],[.5,-.5],[.25,.5],[-.25,.5]],'#a62334'));
    children.push(P.polygon(-.36,.05,.22,.62,[[-.20,-.5],[.50,-.42],[.34,.5],[-.5,.45]],LG('#324f82','#172b4d','vertical'),{stroke:'#17263d',sw:.004}));
    children.push(P.polygon(.36,.05,.22,.62,[[-.50,-.42],[.20,-.5],[.5,.45],[-.34,.5]],LG('#324f82','#172b4d','vertical'),{stroke:'#17263d',sw:.004}));
    children.push(P.polygon(-.13,.34,.22,.50,[[-.5,-.5],[.25,-.5],[.5,.5],[-.30,.5]],LG('#28354b','#111b29','vertical')));
    children.push(P.polygon(.13,.34,.22,.50,[[-.25,-.5],[.5,-.5],[.30,.5],[-.5,.5]],LG('#28354b','#111b29','vertical')));
    children.push(P.ellipse(-.16,.49,.25,.06,LG('#6f4328','#2c1b12','vertical')));
    children.push(P.ellipse(.16,.49,.25,.06,LG('#6f4328','#2c1b12','vertical')));
    return [makeGroup('Professional Man',500,340,150,330,children,{category:'people'})];
  }

  function robotFactory() {
    const children=[];
    children.push(P.ellipse(0,.46,.58,.055,'rgba(21,34,50,.18)'));
    children.push(P.roundRect(0,-.32,.52,.24,LG('#f8fbff','#b9c6d8','vertical'),.08,{stroke:'#52677e',sw:.006,shadow:{color:'rgba(31,49,70,.22)',blur:7,offsetY:4}}));
    children.push(P.roundRect(0,-.32,.34,.12,LG('#152a43','#071424','vertical'),.05,{stroke:'#334c66',sw:.004}));
    children.push(P.ellipse(-.08,-.32,.045,.06,RG('#8ffaff','#37c8e7')));
    children.push(P.ellipse(.08,-.32,.045,.06,RG('#8ffaff','#37c8e7')));
    children.push(P.polygon(0,-.02,.75,.62,[[-.35,-.5],[.35,-.5],[.45,.18],[.24,.5],[-.24,.5],[-.45,.18]],LG('#edf4fb','#8096b1','vertical'),{stroke:'#41576e',sw:.006,shadow:{color:'rgba(31,49,70,.18)',blur:6,offsetY:4}}));
    children.push(P.ellipse(0,-.02,.18,.15,RG('#c7fbff','#2fc4e6'),{stroke:'#4b667c',sw:.005}));
    children.push(P.ellipse(-.42,-.10,.16,.14,LG('#e7eff8','#889bb1','vertical'),{stroke:'#40566d',sw:.005}));
    children.push(P.ellipse(.42,-.10,.16,.14,LG('#e7eff8','#889bb1','vertical'),{stroke:'#40566d',sw:.005}));
    children.push(P.roundRect(-.47,.13,.13,.42,LG('#f4f8fc','#8ba0b8','vertical'),.04,{stroke:'#40566d',sw:.005,rotation:8}));
    children.push(P.roundRect(.47,.13,.13,.42,LG('#f4f8fc','#8ba0b8','vertical'),.04,{stroke:'#40566d',sw:.005,rotation:-8}));
    children.push(P.polygon(-.15,.37,.26,.38,[[-.5,-.5],[.30,-.5],[.5,.5],[-.35,.5]],LG('#e9f1f9','#8197b0','vertical'),{stroke:'#40566d',sw:.005}));
    children.push(P.polygon(.15,.37,.26,.38,[[-.30,-.5],[.5,-.5],[.35,.5],[-.5,.5]],LG('#e9f1f9','#8197b0','vertical'),{stroke:'#40566d',sw:.005}));
    children.push(P.roundRect(-.17,.49,.34,.12,LG('#f4f8fc','#718aa8','vertical'),.05,{stroke:'#40566d',sw:.005}));
    children.push(P.roundRect(.17,.49,.34,.12,LG('#f4f8fc','#718aa8','vertical'),.05,{stroke:'#40566d',sw:.005}));
    return [makeGroup('Humanoid Robot',500,340,190,300,children.filter(Boolean),{category:'technology'})];
  }

  function parkSceneFactory() {
    const children=[];
    children.push(P.rect(0,-.12,1,.76,LG('#bfe7fa','#edf7fc','vertical')));
    children.push(P.ellipse(.34,-.38,.105,.105,RG('#fff5a8','#f3c453')));
    addCloud(children,-.30,-.32,.80); addCloud(children,.22,-.34,.65);
    children.push(P.polygon(-.20,.12,.70,.21,[[-.5,.38],[-.32,-.05],[-.17,.16],[.02,-.32],[.19,.07],[.34,-.11],[.5,.38]],LG('#b5d3dc','#7aa991','vertical')));
    children.push(P.rect(0,.23,1,.42,LG('#8dcc66','#4d9a46','vertical')));
    children.push(P.polygon(0,.31,.55,.32,[[-.5,.5],[-.22,-.5],[.20,-.5],[.5,.5]],LG('#e5d5b8','#c6ad87','vertical')));
    addTree(children,-.35,.10,.78,'round'); addTree(children,.34,.08,.80,'round'); addTree(children,-.47,.15,.45,'olive'); addTree(children,.47,.17,.42,'olive');
    addBush(children,-.18,.27,.80); addBush(children,.20,.27,.80); addFlowers(children,-.20,.27,.80); addFlowers(children,.22,.27,.80);
    children.push(P.rect(0,.17,.22,.025,'#704d35')); children.push(P.line(-.08,.19,0,.10,'#3e4d5e',.004)); children.push(P.line(.08,.19,0,.10,'#3e4d5e',.004));
    children.push(P.ellipse(0,-.01,.18,.08,LG('#80dff0','#3a98bd','vertical'),{stroke:'#dff9ff',sw:.003}));
    children.push(P.ellipse(0,-.01,.08,.035,'#ecfbff'));
    return [makeGroup('Park Scene',W/2,H/2,940,610,children,{category:'scene'})];
  }

  function villageSceneFactory(){
    const children=[];
    children.push(P.rect(0,-.12,1,.76,LG('#bce5fa','#eef8fc','vertical'))); addCloud(children,-.30,-.32,.8); addCloud(children,.28,-.34,.7);
    children.push(P.ellipse(-.38,-.38,.10,.10,RG('#fff4a4','#f1c048')));
    children.push(P.polygon(0,.08,1,.28,[[-.5,.4],[-.38,.12],[-.24,.3],[-.10,-.2],[.04,.2],[.18,-.35],[.32,.14],[.5,.4]],LG('#a8cb8c','#6da06c','vertical')));
    children.push(P.rect(0,.27,1,.38,LG('#81c95b','#4e9944','vertical')));
    children.push(P.rect(0,.47,1,.17,LG('#5a6270','#343b47','vertical'))); for(let i=-.44;i<=.44;i+=.12) children.push(P.roundRect(i,.47,.075,.008,'#f5f6f7',.003));
    // cottage 1
    children.push(P.rect(-.22,.13,.27,.25,LG('#f0d5ad','#c5a477','vertical'),{stroke:'#806444',sw:.003,shadow:{color:'rgba(38,55,74,.20)',blur:8,offsetY:5}}));
    children.push(P.polygon(-.22,-.03,.34,.18,[[-.5,.5],[0,-.5],[.5,.5]],LG('#9f4a32','#6f2d20','vertical'),{stroke:'#5f281e',sw:.004}));
    addWindow(children,-.29,.12,.075,.09,'#3e4f5c'); addWindow(children,-.15,.12,.075,.09,'#3e4f5c');
    children.push(P.roundRect(-.22,.22,.065,.13,LG('#765139','#40291d','vertical'),.004,{stroke:'#2f1e16',sw:.003}));
    // cottage 2
    children.push(P.rect(.22,.16,.25,.21,LG('#ece3cc','#c9b58e','vertical'),{stroke:'#7e6a4d',sw:.003}));
    children.push(P.polygon(.22,.03,.32,.16,[[-.5,.5],[0,-.5],[.5,.5]],LG('#46596c','#27394b','vertical'),{stroke:'#1e3041',sw:.004}));
    addWindow(children,.15,.16,.065,.08,'#3b5063'); addWindow(children,.29,.16,.065,.08,'#3b5063');
    children.push(P.roundRect(.22,.23,.06,.11,LG('#6f4c34','#3c281c','vertical'),.004));
    addTree(children,-.41,.16,.60,'round'); addTree(children,.42,.14,.65,'round'); addBush(children,-.04,.29,.8); addBush(children,.05,.29,.8); addFlowers(children,0,.28,.8);
    children.push(P.polygon(0,.38,.20,.17,[[-.5,.5],[-.23,-.5],[.23,-.5],[.5,.5]],LG('#d9c8aa','#b49c78','vertical')));
    return [makeGroup('Village Scene',W/2,H/2,940,610,children,{category:'scene'})];
  }

  function streetLampFactory(){
    const children=[];
    children.push(P.ellipse(0,.46,.38,.05,'rgba(22,34,50,.18)'));
    children.push(P.roundRect(0,.10,.07,.72,LG('#425264','#172433','horizontal'),.02,{stroke:'#0f1a25',sw:.005}));
    children.push(P.line(.10,-.22,.24,0,'#273747',.035));
    children.push(P.polygon(.22,-.20,.25,.22,[[-.5,.5],[-.35,-.15],[0,-.5],[.35,-.15],[.5,.5]],LG('#344556','#152332','vertical'),{stroke:'#0f1b27',sw:.005}));
    children.push(P.ellipse(.22,-.15,.17,.10,LG('#fff8c8','#f0c04a','vertical'),{stroke:'#384757',sw:.004}));
    return [makeGroup('Street Lamp',500,330,90,300,children,{category:'street'})];
  }

  function trafficSignalFactory(){
    const children=[];
    children.push(P.ellipse(0,.47,.45,.05,'rgba(22,34,50,.18)'));
    children.push(P.roundRect(0,.17,.08,.60,LG('#455466','#172433','horizontal'),.02));
    children.push(P.roundRect(0,-.20,.30,.42,LG('#253546','#101b28','vertical'),.05,{stroke:'#0a131d',sw:.006,shadow:{color:'rgba(27,44,64,.20)',blur:6,offsetY:3}}));
    children.push(P.ellipse(0,-.32,.13,.13,RG('#ff8a82','#d9262a'),{stroke:'#111820',sw:.005}));
    children.push(P.ellipse(0,-.20,.13,.13,RG('#ffe88a','#d8aa24'),{stroke:'#111820',sw:.005}));
    children.push(P.ellipse(0,-.08,.13,.13,RG('#8cf5aa','#20b657'),{stroke:'#111820',sw:.005}));
    return [makeGroup('Traffic Signal',500,330,100,300,children,{category:'street'})];
  }


  function cloudFactory(){
    const children=[];addCloud(children,0,0,2.8,1);
    return [makeGroup('Layered Cloud',500,320,210,100,children,{category:'nature'})];
  }

  function sunFactory(){
    const children=[];
    for(let i=0;i<16;i++){const a=i*Math.PI/8;children.push(P.line(Math.cos(a)*.32,Math.sin(a)*.32,Math.cos(a)*.20,Math.sin(a)*.20,'#f4ba31',.018));}
    children.push(P.ellipse(0,0,.58,.58,RG('#fff6ac','#efb63f'),{stroke:'#e0a52d',sw:.008,shadow:{color:'rgba(244,185,54,.30)',blur:12,offsetY:0}}));
    return [makeGroup('Sun',500,320,120,120,children,{category:'nature'})];
  }

  function benchFactory(){
    const children=[];
    children.push(P.ellipse(0,.38,.78,.08,'rgba(28,42,61,.18)'));
    children.push(P.roundRect(0,-.05,.82,.18,LG('#8b5a36','#5c351f','vertical'),.025,{stroke:'#432617',sw:.006}));
    children.push(P.roundRect(0,.16,.86,.14,LG('#9c6840','#603820','vertical'),.025,{stroke:'#432617',sw:.006}));
    for(let x=-.32;x<=.32;x+=.16)children.push(P.line(x,.04,0,.26,'rgba(55,29,15,.32)',.005));
    children.push(P.line(-.30,.24,-.07,.28,'#344354',.025));
    children.push(P.line(.30,.24,.07,.28,'#344354',.025));
    return [makeGroup('Park Bench',500,350,220,120,children,{category:'street'})];
  }

  function shrubFactory(){
    const children=[];addBush(children,0,0,2.8,'#3f8735');
    return [makeGroup('Landscape Shrub',500,350,180,90,children,{category:'nature'})];
  }

  function flowerBedFactory(){
    const children=[];
    children.push(P.ellipse(0,.15,.86,.18,LG('#5f8f38','#376a2c','vertical')));
    addFlowers(children,0,0,2.6);
    return [makeGroup('Flower Bed',500,350,220,100,children,{category:'nature'})];
  }

  function roadSignFactory(){
    const children=[];
    children.push(P.ellipse(0,.47,.42,.05,'rgba(25,38,55,.17)'));
    children.push(P.roundRect(0,.18,.08,.56,LG('#68798a','#314253','horizontal'),.02,{stroke:'#263747',sw:.005}));
    children.push(P.roundRect(0,-.18,.60,.30,LG('#5ba8e8','#2f75bd','vertical'),.04,{stroke:'#f1f7fb',sw:.014,shadow:{color:'rgba(38,66,92,.22)',blur:8,offsetY:4}}));
    children.push(P.text(0,-.18,.50,.12,'BUS','#ffffff',{weight:800}));
    return [makeGroup('Bus Stop Sign',500,330,120,280,children,{category:'street'})];
  }

  function schoolFactory(){
    const children=[];
    children.push(P.ellipse(0,.44,.82,.07,'rgba(27,42,61,.18)'));
    children.push(P.roundRect(0,.08,.82,.68,LG('#f4e2c5','#d2b384','vertical'),.025,{stroke:'#846d4d',sw:.006,shadow:{color:'rgba(39,55,75,.22)',blur:10,offsetY:5}}));
    children.push(P.polygon(0,-.34,.88,.18,[[-.5,.5],[0,-.5],[.5,.5]],LG('#9b4938','#6a2b20','vertical'),{stroke:'#58231b',sw:.006}));
    children.push(P.roundRect(0,.24,.16,.30,LG('#73513b','#3f2b20','vertical'),.02,{stroke:'#312017',sw:.005}));
    for(let row=-.12;row<=.14;row+=.20)for(let col=-.28;col<=.28;col+=.19)addWindow(children,col,row,.13,.15,'#314558',false);
    children.push(P.roundRect(0,-.17,.42,.10,LG('#3a70a5','#214e7a','vertical'),.02,{stroke:'#ffffff',sw:.004}));
    children.push(P.text(0,-.17,.34,.045,'SCHOOL','#ffffff',{weight:800}));
    return [makeGroup('School Building',500,340,340,300,children,{category:'architecture'})];
  }

  function hospitalFactory(){
    const children=[];
    children.push(P.ellipse(0,.44,.82,.07,'rgba(27,42,61,.18)'));
    children.push(P.roundRect(0,.08,.82,.70,LG('#f5f8fa','#cfd9df','vertical'),.02,{stroke:'#637485',sw:.006,shadow:{color:'rgba(39,55,75,.22)',blur:10,offsetY:5}}));
    children.push(P.rect(0,-.30,.84,.10,LG('#6ea8d7','#3f78a7','vertical')));
    children.push(P.roundRect(0,.24,.16,.30,LG('#4c6074','#263849','vertical'),.02,{stroke:'#1e2f3e',sw:.005}));
    for(let row=-.10;row<=.14;row+=.18)for(let col=-.29;col<=.29;col+=.19)addWindow(children,col,row,.13,.13,'#32485b',false);
    children.push(P.ellipse(0,-.19,.20,.20,'#ffffff',{stroke:'#dfe7ec',sw:.004}));
    children.push(P.rect(0,-.19,.045,.14,'#e84d56'));children.push(P.rect(0,-.19,.14,.045,'#e84d56'));
    return [makeGroup('Hospital Building',500,340,340,310,children,{category:'architecture'})];
  }

  function modernHouseAssetFactory(){
    const packageObjects=smartHomeSceneFactory();
    const source=packageObjects[0];
    const keep=source.children.filter(child=>child.y>-0.25 && child.y<0.34 && !(child.type==='rect'&&child.w>0.9));
    return [makeGroup('Modern Smart House',500,340,430,300,clone(keep),{category:'architecture'})];
  }

  function shopFactory(){
    const children=[];
    children.push(P.ellipse(0,.45,.84,.08,'rgba(25,40,57,.18)'));
    children.push(P.roundRect(0,.06,.82,.70,LG('#f5f8fb','#c7d4df','vertical'),.018,{stroke:'#506477',sw:.006,shadow:{color:'rgba(37,54,74,.22)',blur:10,offsetY:6}}));
    children.push(P.rect(0,-.30,.84,.10,LG('#315d82','#183b5a','vertical'),{stroke:'#17324b',sw:.004}));
    children.push(P.roundRect(0,-.17,.68,.12,LG('#dff5ff','#79bde2','vertical'),.012,{stroke:'#294a63',sw:.004}));
    for(let x=-.27;x<=.27;x+=.09) children.push(P.polygon(x,-.10,.065,.11,[[-.5,-.5],[.5,-.5],[.38,.5],[-.38,.5]],x%0.18===0?'#f7c967':'#e7f7fb'));
    children.push(P.roundRect(-.23,.18,.20,.28,LG('#d8eef8','#6ca8c9','vertical'),.008,{stroke:'#2d536e',sw:.004}));
    children.push(P.line(-.23,.18,0,.26,'#eefaff',.003)); children.push(P.line(-.23,.18,.20,0,'#eefaff',.003));
    children.push(P.roundRect(.23,.22,.18,.38,LG('#765038','#3e281c','vertical'),.012,{stroke:'#2c1d15',sw:.004}));
    children.push(P.roundRect(.23,.22,.13,.27,LG('#a6d9ed','#4c91bb','vertical'),.006,{stroke:'#dff8ff',sw:.002}));
    children.push(P.ellipse(.30,.22,.012,.012,'#e6bd68'));
    children.push(P.text(0,-.30,.56,.045,'MARKET','#ffffff',{weight:800}));
    addBush(children,-.34,.40,.52,'#3f8737'); addBush(children,.39,.40,.48,'#3f8737');
    return [makeGroup('Shop / Store',500,340,340,280,children,{category:'architecture'})];
  }

  function factoryBuildingFactory(){
    const children=[];
    children.push(P.ellipse(0,.45,.88,.08,'rgba(25,40,57,.18)'));
    children.push(P.roundRect(0,.06,.86,.70,LG('#dfe7ed','#9aaab7','vertical'),.012,{stroke:'#43586b',sw:.006,shadow:{color:'rgba(34,50,70,.23)',blur:10,offsetY:6}}));
    children.push(P.rect(0,-.30,.88,.08,LG('#526a7c','#283d4d','vertical'),{stroke:'#233646',sw:.004}));
    for(let col=-.30;col<=.30;col+=.15) for(let row=-.03;row<=.22;row+=.13) addWindow(children,col,row,.09,.08,'#2d526e',false);
    children.push(P.roundRect(-.22,.28,.16,.28,LG('#4a6477','#263a4c','vertical'),.01,{stroke:'#1d2c3a',sw:.004}));
    children.push(P.roundRect(.20,.26,.20,.32,LG('#536c7d','#2b4152','vertical'),.01,{stroke:'#1d2c3a',sw:.004}));
    children.push(P.rect(-.32,-.46,.10,.30,LG('#6d7d89','#394853','vertical'),{stroke:'#263640',sw:.005}));
    children.push(P.rect(.12,-.49,.12,.36,LG('#71818b','#3e4d57','vertical'),{stroke:'#263640',sw:.005}));
    children.push(P.ellipse(-.27,-.59,.12,.07,'rgba(160,187,197,.42)')); children.push(P.ellipse(.18,-.64,.15,.08,'rgba(160,187,197,.40)'));
    children.push(P.text(0,-.35,.42,.05,'WORKS','#f4f8fb',{weight:800}));
    return [makeGroup('Factory',500,340,360,300,children,{category:'architecture'})];
  }

  function motorcycleFactory(x=500,y=470,scale=1){
    const children=[];
    children.push(P.ellipse(0,.34,.90,.10,'rgba(20,31,43,.22)'));
    children.push(P.ellipse(-.29,.20,.22,.22,LG('#202a35','#060a0f','vertical'),{stroke:'#05070a',sw:.012}));
    children.push(P.ellipse(.31,.20,.22,.22,LG('#202a35','#060a0f','vertical'),{stroke:'#05070a',sw:.012}));
    children.push(P.ellipse(-.29,.20,.08,.08,'#bfcbd4',{stroke:'#5d6e7b',sw:.003})); children.push(P.ellipse(.31,.20,.08,.08,'#bfcbd4',{stroke:'#5d6e7b',sw:.003}));
    children.push(P.polygon(0,.05,.54,.32,[[-.5,.18],[-.27,-.42],[.24,-.42],[.5,.18],[.20,.50],[-.17,.50]],LG('#e34e45','#7c1f27','vertical'),{stroke:'#3a1d29',sw:.007,shadow:{color:'rgba(35,44,57,.22)',blur:7,offsetY:3}}));
    children.push(P.polygon(.03,-.12,.25,.15,[[-.5,.5],[-.28,-.5],[.5,-.5],[.35,.5]],LG('#1f415f','#0d2338','vertical'),{stroke:'#d5effb',sw:.003}));
    children.push(P.line(-.10,.08,.29,.16,'#263847',.014)); children.push(P.line(.10,.10,.22,.14,'#263847',.014));
    children.push(P.roundRect(.28,-.12,.24,.06,'#151c24',.025,{rotation:-18})); children.push(P.line(.39,-.13,.05,-.18,'#364b5c',.012));
    children.push(P.ellipse(.30,-.08,.06,.06,RG('#fff4b2','#e1a83b'),{stroke:'#5a3d24',sw:.003}));
    return [makeGroup('Motorcycle',x,y,190*scale,100*scale,children,{category:'vehicle'})];
  }

  function bicycleFactory(x=500,y=470,scale=1){
    const children=[];
    children.push(P.ellipse(-.28,.23,.27,.27,'transparent',{stroke:'#26394b',sw:.012})); children.push(P.ellipse(.28,.23,.27,.27,'transparent',{stroke:'#26394b',sw:.012}));
    children.push(P.line(-.28,.23,0,.01,'#c14d3d',.012)); children.push(P.line(0,.01,.28,.23,'#c14d3d',.012)); children.push(P.line(-.28,.23,.28,.23,'#c14d3d',.012));
    children.push(P.line(0,.01,-.10,.23,'#c14d3d',.012)); children.push(P.line(-.10,.23,.10,.23,'#c14d3d',.012));
    children.push(P.roundRect(-.03,-.02,.15,.035,'#283847',.02,{rotation:-8})); children.push(P.line(.28,.23,.15,-.20,'#283847',.010));
    children.push(P.line(.43,.03,.09,.02,'#283847',.010)); children.push(P.roundRect(-.13,.02,.10,.03,'#263847',.018,{rotation:-6}));
    children.push(P.ellipse(-.10,.23,.06,.06,'#5e7587',{stroke:'#1d2e3d',sw:.003}));
    return [makeGroup('Bicycle',x,y,190*scale,100*scale,children,{category:'vehicle'})];
  }

  function womanFactory(){
    const children=[];
    children.push(P.ellipse(0,.46,.45,.05,'rgba(26,39,57,.18)'));
    children.push(P.ellipse(0,-.37,.20,.15,LG('#f1bd99','#c98262','vertical'),{stroke:'#754b38',sw:.004}));
    children.push(P.ellipse(0,-.44,.23,.16,LG('#5b3429','#2a1713','vertical'),{stroke:'#331b17',sw:.004}));
    children.push(P.polygon(0,-.04,.58,.55,[[-.30,-.48],[.30,-.48],[.38,.25],[.17,.48],[-.17,.48],[-.38,.25]],LG('#c44c6c','#74324d','vertical'),{stroke:'#57283b',sw:.006,shadow:{color:'rgba(30,45,64,.18)',blur:6,offsetY:3}}));
    children.push(P.polygon(-.36,.05,.18,.55,[[-.20,-.5],[.48,-.42],[.30,.5],[-.5,.45]],LG('#c44c6c','#74324d','vertical'),{stroke:'#57283b',sw:.004}));
    children.push(P.polygon(.36,.05,.18,.55,[[-.48,-.42],[.20,-.5],[.5,.45],[-.30,.5]],LG('#c44c6c','#74324d','vertical'),{stroke:'#57283b',sw:.004}));
    children.push(P.polygon(-.12,.34,.20,.50,[[-.5,-.5],[.25,-.5],[.5,.5],[-.30,.5]],LG('#354660','#172335','vertical')));
    children.push(P.polygon(.12,.34,.20,.50,[[-.25,-.5],[.5,-.5],[.30,.5],[-.5,.5]],LG('#354660','#172335','vertical')));
    children.push(P.ellipse(-.15,.49,.24,.06,LG('#795033','#332015','vertical'))); children.push(P.ellipse(.15,.49,.24,.06,LG('#795033','#332015','vertical')));
    children.push(P.ellipse(-.075,-.36,.018,.012,'#34201b')); children.push(P.ellipse(.075,-.36,.018,.012,'#34201b'));
    return [makeGroup('Professional Woman',500,340,150,330,children,{category:'people'})];
  }

  function smallCitySceneFactory(){
    const children=[];
    children.push(P.rect(0,-.12,1,.76,LG('#c7e9fb','#eef7fc','vertical')));
    children.push(P.ellipse(-.37,-.37,.10,.10,RG('#fff2a0','#f2bd42'))); addCloud(children,-.27,-.33,.75); addCloud(children,.32,-.34,.62);
    children.push(P.rect(0,.25,1,.36,LG('#7fbd62','#4d9345','vertical'))); children.push(P.rect(0,.47,1,.17,LG('#515b69','#343c48','vertical')));
    children.push(P.rect(0,.36,1,.035,'#e7eaed')); for(let i=-.44;i<=.44;i+=.12) children.push(P.roundRect(i,.47,.075,.008,'#f5f6f7',.003));
    const buildings=[[-.36,.05,.18,.38,'#e6d8c7','#b58e6c',3,5],[-.14,-.02,.18,.52,'#5d94c5','#2f5d89',3,7],[.08,.04,.18,.42,'#d88968','#9b4e3c',3,5],[.31,-.01,.19,.50,'#718aa0','#435b72',3,7]];
    buildings.forEach(([x,y,w,h,body,roof,cols,rows])=>{children.push(P.roundRect(x,y,w,h,LG(body,'#b7c2cb','vertical'),.008,{stroke:'#526476',sw:.004})); children.push(P.rect(x,y-h/2+.015,w*1.04,.025,roof)); for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const wx=x-w/2+.035+(c+.5)*(w-.07)/cols;const wy=y-h/2+.055+(r+.5)*(h-.10)/rows; children.push(P.roundRect(wx,wy,.025,.035,LG('#d8f4ff','#5a9dcb','vertical'),.002,{stroke:'rgba(33,55,73,.4)',sw:.001}));}});
    addTree(children,-.48,.25,.36,'round'); addTree(children,.47,.25,.40,'olive');
    return [makeGroup('Small City Scene',W/2,H/2,940,610,children,{category:'scene'})];
  }

  const assets = [
    { id:'modern-home-scene', name:'Modern Home Scene', category:'scene', factory:modernHomeSceneFactory, preview:'assets/reference/01_modern_home_scene.png' },
    { id:'smart-home-scene', name:'Smart Home Scene', category:'scene', factory:smartHomeSceneFactory, preview:'assets/reference/smart_home_scene.png' },
    { id:'luxury-home-scene', name:'Luxury Home Scene', category:'scene', factory:luxuryHomeSceneFactory, preview:'assets/reference/luxury_home_scene.png' },
    { id:'small-city-scene', name:'Small City Scene', category:'scene', factory:smallCitySceneFactory, preview:'assets/reference/small_city_scene.png' },
    { id:'modern-city-scene', name:'Modern City Scene', category:'scene', factory:citySceneFactory, preview:'assets/reference/05_modern_city_scene.png' },
    { id:'village-scene', name:'Village Scene', category:'scene', factory:villageSceneFactory, preview:'assets/reference/village_scene.png' },
    { id:'park-scene', name:'Park Scene', category:'scene', factory:parkSceneFactory, preview:'assets/reference/park_scene.png' },
    { id:'school-building', name:'School Building', category:'architecture', factory:schoolFactory, preview:'assets/reference/school_building.png' },
    { id:'hospital-building', name:'Hospital Building', category:'architecture', factory:hospitalFactory, preview:'assets/reference/hospital_building.png' },
    { id:'office-building', name:'Office Building', category:'architecture', factory:officeBuildingFactory, preview:'assets/reference/office_building.png' },
    { id:'shop-store', name:'Shop / Store', category:'architecture', factory:shopFactory, preview:'assets/reference/shop_store.png' },
    { id:'factory', name:'Factory', category:'architecture', factory:factoryBuildingFactory, preview:'assets/reference/factory.png' },
    { id:'sedan-car', name:'Sedan Car', category:'vehicle', factory:()=>[carFactory()], preview:'assets/reference/13_sedan_car.png' },
    { id:'city-bus', name:'City Bus', category:'vehicle', factory:()=>[busFactory()], preview:'assets/reference/city_bus.png' },
    { id:'motorcycle', name:'Motorcycle', category:'vehicle', factory:()=>[motorcycleFactory()], preview:'assets/reference/motorcycle.png' },
    { id:'bicycle', name:'Bicycle', category:'vehicle', factory:()=>[bicycleFactory()], preview:'assets/reference/bicycle.png' },
    { id:'professional-man', name:'Professional Man', category:'people', factory:humanFactory, preview:'assets/reference/professional_man.png' },
    { id:'professional-woman', name:'Professional Woman', category:'people', factory:womanFactory, preview:'assets/reference/professional_woman.png' },
    { id:'humanoid-robot', name:'Humanoid Robot', category:'technology', factory:robotFactory, preview:'assets/reference/humanoid_robot.png' },
    { id:'tree', name:'Tree', category:'nature', factory:treeFactory, preview:'assets/reference/tree.png' },
    { id:'street-lamp', name:'Street Lamp', category:'street', factory:streetLampFactory, preview:'assets/reference/street_lamp.png' },
    { id:'park-bench', name:'Park Bench', category:'street', factory:benchFactory, preview:'assets/reference/park_bench.png' },
    { id:'traffic-signal', name:'Traffic Signal', category:'street', factory:trafficSignalFactory, preview:'assets/reference/traffic_signal.png' },
  ];

  function assetBounds(objects) {
    const left = Math.min(...objects.map((object) => object.x - object.w / 2));
    const right = Math.max(...objects.map((object) => object.x + object.w / 2));
    const top = Math.min(...objects.map((object) => object.y - object.h / 2));
    const bottom = Math.max(...objects.map((object) => object.y + object.h / 2));
    return { left, right, top, bottom, w: right - left, h: bottom - top };
  }

  function renderAssetPreview(previewCanvas, asset) {
    const previewContext = previewCanvas.getContext('2d');
    const width = previewCanvas.clientWidth || 84;
    const height = previewCanvas.clientHeight || 70;
    previewCanvas.width = Math.round(width * DPR);
    previewCanvas.height = Math.round(height * DPR);
    previewContext.setTransform(DPR,0,0,DPR,0,0);
    previewContext.clearRect(0,0,width,height);
    const objects = asset.factory();
    const bounds = assetBounds(objects);
    const scale = Math.min((width - 10) / bounds.w, (height - 10) / bounds.h);
    previewContext.save();
    previewContext.translate(width / 2, height / 2);
    previewContext.scale(scale, scale);
    previewContext.translate(-(bounds.left + bounds.right) / 2, -(bounds.top + bounds.bottom) / 2);
    const originalContext = ctx;
    // draw using temporary global canvas context switch
    const previousCtx = window.__ovdPreviewCtx;
    window.__ovdPreviewCtx = previewContext;
    objects.forEach((object) => drawObjectOnContext(previewContext, object));
    window.__ovdPreviewCtx = previousCtx;
    previewContext.restore();
  }

  function drawPrimitiveOnContext(context, primitive, group) {
    const gw=group.w, gh=group.h;
    const x=primitive.x*gw, y=primitive.y*gh, w=primitive.w*gw, h=primitive.h*gh;
    const strokeWidth=(primitive.sw??.002)*Math.min(gw,gh);
    const fill=primitive.theme?group.fill:primitive.fill;
    context.save();context.translate(x,y);context.rotate(rad(primitive.rotation||0));context.globalAlpha*=primitive.opacity??1;
    context.lineJoin='round';context.lineCap='round';
    const fillStyle = (()=>{
      if(typeof fill==='string') return fill;
      if(fill?.type==='linear'){
        const gradient=fill.direction==='horizontal'?context.createLinearGradient(-w/2,0,w/2,0):fill.direction==='diagonal'?context.createLinearGradient(-w/2,-h/2,w/2,h/2):context.createLinearGradient(0,-h/2,0,h/2);
        gradient.addColorStop(0,fill.from);gradient.addColorStop(1,fill.to);return gradient;
      }
      if(fill?.type==='radial'){
        const gradient=context.createRadialGradient(-w*.1,-h*.1,0,0,0,Math.max(w,h)*.55);gradient.addColorStop(0,fill.inner);gradient.addColorStop(1,fill.outer);return gradient;
      }
      return '#000';
    })();
    if(primitive.type==='rect'||primitive.type==='roundRect'){
      roundedRectPath(context,-w/2,-h/2,w,h,primitive.type==='roundRect'?(primitive.radius||.02)*Math.min(gw,gh):0);context.fillStyle=fillStyle;context.fill();if(primitive.stroke&&strokeWidth>0){context.strokeStyle=primitive.stroke;context.lineWidth=strokeWidth;context.stroke();}
    }else if(primitive.type==='ellipse'){
      context.beginPath();context.ellipse(0,0,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2);context.fillStyle=fillStyle;context.fill();if(primitive.stroke&&strokeWidth>0){context.strokeStyle=primitive.stroke;context.lineWidth=strokeWidth;context.stroke();}
    }else if(primitive.type==='polygon'){
      const points=primitive.points||[];if(points.length){context.beginPath();points.forEach((p,i)=>{const px=p[0]*w,py=p[1]*h;i===0?context.moveTo(px,py):context.lineTo(px,py);});context.closePath();context.fillStyle=fillStyle;context.fill();if(primitive.stroke&&strokeWidth>0){context.strokeStyle=primitive.stroke;context.lineWidth=strokeWidth;context.stroke();}}
    }else if(primitive.type==='line'){
      context.beginPath();context.moveTo(-w/2,-h/2);context.lineTo(w/2,h/2);context.strokeStyle=primitive.stroke||fillStyle;context.lineWidth=Math.max(1,strokeWidth);context.stroke();
    }
    context.restore();
  }

  function drawObjectOnContext(context, object) {
    if(object.visible===false)return;
    context.save();context.translate(object.x,object.y);context.rotate(rad(object.rotation||0));context.globalAlpha=object.opacity??1;
    if(object.type==='group') (object.children||[]).forEach(child=>drawPrimitiveOnContext(context,child,object));
    else if(object.type==='rectangle'){roundedRectPath(context,-object.w/2,-object.h/2,object.w,object.h,Math.min(14,object.w*.08));context.fillStyle=typeof object.fill==='string'?object.fill:'#6c73e7';context.fill();if(object.strokeWidth>0){context.strokeStyle=object.stroke;context.lineWidth=object.strokeWidth;context.stroke();}}
    else if(object.type==='ellipse'){context.beginPath();context.ellipse(0,0,object.w/2,object.h/2,0,0,Math.PI*2);context.fillStyle=typeof object.fill==='string'?object.fill:'#6c73e7';context.fill();if(object.strokeWidth>0){context.strokeStyle=object.stroke;context.lineWidth=object.strokeWidth;context.stroke();}}
    else if(object.type==='triangle'){context.beginPath();context.moveTo(0,-object.h/2);context.lineTo(-object.w/2,object.h/2);context.lineTo(object.w/2,object.h/2);context.closePath();context.fillStyle=typeof object.fill==='string'?object.fill:'#6c73e7';context.fill();if(object.strokeWidth>0){context.strokeStyle=object.stroke;context.lineWidth=object.strokeWidth;context.stroke();}}
    else if(object.type==='polygon'){context.beginPath();(object.points||[]).forEach((point,index)=>{const px=point.x*object.w,py=point.y*object.h;index===0?context.moveTo(px,py):context.lineTo(px,py);});context.closePath();context.fillStyle=typeof object.fill==='string'?object.fill:'#6c73e7';context.fill();if(object.strokeWidth>0){context.strokeStyle=object.stroke;context.lineWidth=object.strokeWidth;context.stroke();}}
    else if(object.type==='line'||object.type==='freehand'){context.beginPath();(object.points||[]).forEach((point,index)=>{const px=point.x*object.w,py=point.y*object.h;index===0?context.moveTo(px,py):context.lineTo(px,py);});context.strokeStyle=object.stroke;context.lineWidth=Math.max(1,object.strokeWidth);context.lineCap='round';context.lineJoin='round';context.stroke();}
    else if(object.type==='text'){context.fillStyle=object.fill;context.font=`700 ${object.fontSize||object.h}px Inter, Arial, sans-serif`;context.textAlign='center';context.textBaseline='middle';context.fillText(object.text||'Text',0,0,object.w);}
    context.restore();
  }

  function renderAssetGrid() {
    const query = $('assetSearch').value.trim().toLowerCase();
    const category = $('assetCategory').value;
    const filtered = assets.filter((asset) => (category === 'all' || asset.category === category) && (!query || asset.name.toLowerCase().includes(query) || asset.category.includes(query)));
    $('assetCount').textContent = filtered.length;
    const grid = $('assetGrid');
    grid.replaceChildren();
    filtered.forEach((asset) => {
      const card = document.createElement('button');
      card.className = 'asset-card';
      card.type = 'button';
      const preview = asset.preview ? `<img class="asset-preview-image" src="${escapeHtml(asset.preview)}" alt="${escapeHtml(asset.name)} reference preview" loading="lazy">` : '<canvas class="asset-preview"></canvas>';
      card.innerHTML = `${preview}<span class="asset-card-copy"><strong>${escapeHtml(asset.name)}</strong><span>${asset.category} · editable</span></span>`;
      const image = card.querySelector('img');
      if (image) {
        image.addEventListener('error', () => {
          const fallback = document.createElement('canvas');
          fallback.className = 'asset-preview';
          image.replaceWith(fallback);
          requestAnimationFrame(() => renderAssetPreview(fallback, asset));
        }, { once: true });
      }
      card.addEventListener('click', () => addObjects(asset.factory(), `${asset.name} added`));
      grid.append(card);
      const fallbackCanvas = card.querySelector('canvas');
      if (fallbackCanvas) requestAnimationFrame(() => renderAssetPreview(fallbackCanvas, asset));
    });
  }

  // ---------- OpenGL code generation ----------

  function objectAnimationPrefix(object, index) {
    const animation = { preset:'none',duration:5,amount:180,loop:true,delay:0,...(object.animation||{}) };
    if (animation.preset === 'none') return { declarations:'', x:formatFloat(object.x), y:formatFloat(H-object.y), rotation:formatFloat(-object.rotation), scale:'1.00f', alpha:formatFloat(object.opacity??1) };
    const p=`p${index}`;
    let declarations=`    float ${p} = animationProgress(animationTime, ${formatFloat(animation.delay)}, ${formatFloat(animation.duration)}, ${animation.loop!==false?'true':'false'});\n`;
    let x=formatFloat(object.x), y=formatFloat(H-object.y), rotation=formatFloat(-object.rotation), scale='1.00f', alpha=formatFloat(object.opacity??1);
    if(animation.preset==='slide') x=`${formatFloat(object.x)} + (${p} - 0.5f) * ${formatFloat(animation.amount)}`;
    if(animation.preset==='float') y=`${formatFloat(H-object.y)} - sinf(${p} * 6.2831853f) * ${formatFloat(animation.amount)}`;
    if(animation.preset==='bounce') y=`${formatFloat(H-object.y)} + fabsf(sinf(${p} * 3.1415926f)) * ${formatFloat(animation.amount)}`;
    if(animation.preset==='rotate') rotation=`${formatFloat(-object.rotation)} - ${p} * 360.00f`;
    if(animation.preset==='pulse') scale=`1.00f + sinf(${p} * 6.2831853f) * ${formatFloat(Math.min(.35,(animation.amount||40)/500))}`;
    if(animation.preset==='blink') alpha=`${formatFloat(object.opacity??1)} * (0.25f + 0.75f * (0.50f + 0.50f * sinf(${p} * 6.2831853f)))`;
    return {declarations,x,y,rotation,scale,alpha};
  }

  function primitiveCode(primitive, group, childIndex) {
    const x=primitive.x*group.w, y=-primitive.y*group.h, w=Math.abs(primitive.w*group.w), h=Math.abs(primitive.h*group.h);
    const fill=primitive.theme?group.fill:primitive.fill;
    const color=colorForCode(fill);
    const rotation=-(primitive.rotation||0);
    let code=`        // Part ${childIndex+1}\n        glPushMatrix();\n        glTranslatef(${formatFloat(x)}, ${formatFloat(y)}, 0.00f);\n        glRotatef(${formatFloat(rotation)}, 0.00f, 0.00f, 1.00f);\n        glColor4f(${color}, ${formatFloat((primitive.opacity??1)*(group.opacity??1))});\n`;
    if(primitive.type==='rect') code+=`        drawRectangle(0.00f, 0.00f, ${formatFloat(w)}, ${formatFloat(h)});\n`;
    else if(primitive.type==='roundRect') code+=`        drawRoundedRectangle(0.00f, 0.00f, ${formatFloat(w)}, ${formatFloat(h)}, ${formatFloat((primitive.radius||.02)*Math.min(group.w,group.h))});\n`;
    else if(primitive.type==='ellipse') code+=`        drawEllipse(0.00f, 0.00f, ${formatFloat(w/2)}, ${formatFloat(h/2)});\n`;
    else if(primitive.type==='polygon'){
      code+=`        glBegin(GL_POLYGON);\n`;
      (primitive.points||[]).forEach(point=>{code+=`            glVertex2f(${formatFloat(point[0]*w)}, ${formatFloat(-point[1]*h)});\n`;});
      code+=`        glEnd();\n`;
    }else if(primitive.type==='line'){
      code+=`        glLineWidth(${formatFloat(Math.max(1,(primitive.sw||.004)*Math.min(group.w,group.h)))});\n        glBegin(GL_LINES);\n            glVertex2f(${formatFloat(-w/2)}, ${formatFloat(h/2)});\n            glVertex2f(${formatFloat(w/2)}, ${formatFloat(-h/2)});\n        glEnd();\n`;
    }else if(primitive.type==='text'){
      const text=String(primitive.text||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
      code+=`        drawText(${formatFloat(-w/2)}, 0.00f, "${text}");\n`;
    }
    code+=`        glPopMatrix();\n`;
    return code;
  }

  function objectCode(object,index) {
    const animation=objectAnimationPrefix(object,index);
    let code=animation.declarations;
    code+=`    // ${object.name}\n    glPushMatrix();\n    glTranslatef(${animation.x}, ${animation.y}, 0.00f);\n    glRotatef(${animation.rotation}, 0.00f, 0.00f, 1.00f);\n    glScalef(${animation.scale}, ${animation.scale}, 1.00f);\n`;
    if(object.type==='group'){
      (object.children||[]).forEach((primitive,childIndex)=>{code+=primitiveCode(primitive,object,childIndex);});
    }else{
      code+=`    glColor4f(${colorForCode(object.fill)}, ${animation.alpha});\n`;
      if(object.type==='rectangle') code+=`    drawRoundedRectangle(0.00f, 0.00f, ${formatFloat(object.w)}, ${formatFloat(object.h)}, ${formatFloat(Math.min(14,object.w*.08,object.h*.08))});\n`;
      else if(object.type==='ellipse') code+=`    drawEllipse(0.00f, 0.00f, ${formatFloat(object.w/2)}, ${formatFloat(object.h/2)});\n`;
      else if(object.type==='triangle') code+=`    glBegin(GL_TRIANGLES);\n        glVertex2f(0.00f, ${formatFloat(object.h/2)});\n        glVertex2f(${formatFloat(-object.w/2)}, ${formatFloat(-object.h/2)});\n        glVertex2f(${formatFloat(object.w/2)}, ${formatFloat(-object.h/2)});\n    glEnd();\n`;
      else if(object.type==='polygon'){
        code+=`    glBegin(GL_POLYGON);\n`;(object.points||[]).forEach(point=>{code+=`        glVertex2f(${formatFloat(point.x*object.w)}, ${formatFloat(-point.y*object.h)});\n`;});code+=`    glEnd();\n`;
      }else if(object.type==='line'||object.type==='freehand'){
        code+=`    glLineWidth(${formatFloat(object.strokeWidth)});\n    glBegin(${object.type==='line'?'GL_LINES':'GL_LINE_STRIP'});\n`;(object.points||[]).forEach(point=>{code+=`        glVertex2f(${formatFloat(point.x*object.w)}, ${formatFloat(-point.y*object.h)});\n`;});code+=`    glEnd();\n`;
      }else if(object.type==='text'){
        const text=String(object.text||'Text').replace(/\\/g,'\\\\').replace(/"/g,'\\"');code+=`    drawText(${formatFloat(-object.w/2)}, 0.00f, "${text}");\n`;
      }
    }
    code+=`    glPopMatrix();\n\n`;
    return code;
  }

  function generateSelectedCode() {
    const object = selectedObject();
    if (!object) {
      return '// No object selected.\n// Select a shape, group, or template on the canvas to inspect its OpenGL code.';
    }
    const type = object.type === 'group' ? `group · ${object.children?.length || 0} parts` : object.type;
    return `/* Selected object: ${object.name}\n   Type: ${type}\n   This panel intentionally shows only the selected object.\n   Use Generate Code for the complete project source. */\n\nvoid drawSelectedObject()\n{\n${objectCode(object, 0)}\n}`;
  }

  function generateFullCode() {
    const active=state.objects.filter(object=>object.visible!==false);
    const animated=active.some(object=>(object.animation?.preset||'none')!=='none');
    const [br,bg,bb]=hexToRgb(state.canvasColor);
    const sceneCode=active.map(objectCode).join('');
    return `/*
    Project: ${state.projectName}
    Generated by: OpenGL Visual Designer
    Developed by: Safayet Ullah
    Department: Computer Science and Engineering
    University: Southeast University

    Copyright © 2026 Safayet Ullah. All rights reserved.
*/

#include <Windows.h>
#include <GL/glut.h>
#include <cmath>
#include <string>

void drawRectangle(float cx, float cy, float width, float height)
{
    float halfWidth = width / 2.00f;
    float halfHeight = height / 2.00f;

    glBegin(GL_QUADS);
        glVertex2f(cx - halfWidth, cy - halfHeight);
        glVertex2f(cx + halfWidth, cy - halfHeight);
        glVertex2f(cx + halfWidth, cy + halfHeight);
        glVertex2f(cx - halfWidth, cy + halfHeight);
    glEnd();
}

void drawRoundedRectangle(float cx, float cy, float width, float height, float radius)
{
    float left = cx - width / 2.00f;
    float right = cx + width / 2.00f;
    float bottom = cy - height / 2.00f;
    float top = cy + height / 2.00f;
    float safeRadius = fminf(radius, fminf(width, height) / 2.00f);

    glBegin(GL_POLYGON);

    for (int corner = 0; corner < 4; ++corner)
    {
        float centerX = (corner == 0 || corner == 3) ? right - safeRadius : left + safeRadius;
        float centerY = (corner < 2) ? top - safeRadius : bottom + safeRadius;
        float startAngle = 90.00f * static_cast<float>(corner);

        for (int segment = 0; segment <= 8; ++segment)
        {
            float angle = (startAngle + static_cast<float>(segment) * 11.25f) * 3.1415926f / 180.00f;
            glVertex2f(centerX + cosf(angle) * safeRadius, centerY + sinf(angle) * safeRadius);
        }
    }

    glEnd();
}

void drawEllipse(float cx, float cy, float radiusX, float radiusY)
{
    glBegin(GL_TRIANGLE_FAN);
        glVertex2f(cx, cy);

        for (int index = 0; index <= 96; ++index)
        {
            float angle = 2.00f * 3.1415926f * static_cast<float>(index) / 96.00f;
            glVertex2f(cx + cosf(angle) * radiusX, cy + sinf(angle) * radiusY);
        }

    glEnd();
}

void drawText(float x, float y, const char* text)
{
    glRasterPos2f(x, y);

    for (const char* character = text; *character; ++character)
    {
        glutBitmapCharacter(GLUT_BITMAP_HELVETICA_18, *character);
    }
}

${animated?`float animationTime = 0.00f;

float animationProgress(float time, float delay, float duration, bool repeat)
{
    float localTime = time - delay;

    if (localTime <= 0.00f) return 0.00f;
    if (duration <= 0.001f) return 1.00f;

    if (repeat)
    {
        return fmodf(localTime, duration) / duration;
    }

    float progress = localTime / duration;
    if (progress < 0.00f) return 0.00f;
    if (progress > 1.00f) return 1.00f;
    return progress;
}

void timer(int value)
{
    animationTime = glutGet(GLUT_ELAPSED_TIME) / 1000.00f;
    glutPostRedisplay();
    glutTimerFunc(16, timer, 0);
}

`:''}void init()
{
    glClearColor(${(br/255).toFixed(3)}f, ${(bg/255).toFixed(3)}f, ${(bb/255).toFixed(3)}f, 1.000f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(0.00, ${W.toFixed(2)}, 0.00, ${H.toFixed(2)});
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

${sceneCode || '    // Draw or insert an object in the visual editor.\n'}
    ${animated?'glutSwapBuffers();':'glFlush();'}
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(${animated?'GLUT_DOUBLE':'GLUT_SINGLE'} | GLUT_RGB);
    glutInitWindowPosition(100, 100);
    glutInitWindowSize(${W}, ${H});
    glutCreateWindow("Safayet Ullah - OpenGL Visual Design");

    init();
    glutDisplayFunc(display);
    ${animated?'glutTimerFunc(16, timer, 0);':''}
    glutMainLoop();

    return 0;
}
`;
  }

  function updateCodePreview() {
    const object = selectedObject();
    $('codePreview').textContent = generateSelectedCode();
    $('selectedCodeLabel').textContent = object ? `${object.name} · selected object only` : 'Select an object to inspect its code';
  }

  function openCodeModal(mode = 'full') {
    state.codeModalMode = mode;
    const full = mode === 'full';
    const object = selectedObject();
    $('fullCodeOutput').value = full ? generateFullCode() : generateSelectedCode();
    $('codeModalTitle').textContent = full ? 'Complete OpenGL / GLUT C++' : 'Selected Object OpenGL Code';
    $('codeModalSubtitle').textContent = full ? 'Full project source · compile-ready output' : (object ? `${object.name} · selected object snippet` : 'Select an object first');
    $('modalCopyCodeBtn').textContent = full ? 'Copy full code' : 'Copy object code';
    $('downloadCodeBtn').textContent = full ? 'Download .cpp' : 'Download snippet';
    $('codeModal').classList.remove('hidden');
  }

  function downloadBlob(content,filename,type) {
    const blob=content instanceof Blob?content:new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=filename;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function safeFilename(value) {
    return (value||'opengl-design').trim().replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'')||'opengl-design';
  }

  function saveProject() {
    const data={
      app:'OpenGL Visual Designer',version:'5.0',developedBy:'Safayet Ullah',department:'Computer Science and Engineering',university:'Southeast University',
      projectName:state.projectName,canvasColor:state.canvasColor,objects:state.objects
    };
    downloadBlob(JSON.stringify(data,null,2),`${safeFilename(state.projectName)}.json`,'application/json');
    setStatus('Project saved');
  }

  function openProject(file) {
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(reader.result);
        pushHistory();
        state.projectName=data.projectName||'Untitled Design';
        state.canvasColor=data.canvasColor||'#f7f9fc';
        state.objects=data.objects||[];
        state.selectedId=null;
        $('projectName').value=state.projectName;
        render();
        fitCanvas();
        setStatus('Project opened');
      }catch(error){alert('This project file is invalid.');}
    };
    reader.readAsText(file);
  }

  function exportPNG() {
    const exportCanvas=document.createElement('canvas');
    exportCanvas.width=W*2;exportCanvas.height=H*2;
    const exportContext=exportCanvas.getContext('2d');
    exportContext.scale(2,2);
    exportContext.fillStyle=state.canvasColor;exportContext.fillRect(0,0,W,H);
    // Draw without grid and selection by temporarily using current context replacement logic
    state.objects.filter(object=>object.visible!==false).forEach(object=>drawObjectOnContext(exportContext,object));
    exportCanvas.toBlob(blob=>downloadBlob(blob,`${safeFilename(state.projectName)}.png`,'image/png'),'image/png');
    setStatus('PNG exported');
  }

  function copyText(text) {
    if(navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area=document.createElement('textarea');area.value=text;document.body.append(area);area.select();document.execCommand('copy');area.remove();return Promise.resolve();
  }

  // ---------- Pointer and scrolling behavior ----------

  canvas.addEventListener('pointerdown',(event)=>{
    if(event.button!==0)return;
    const point=canvasPoint(event);
    state.mouse=point;
    canvas.setPointerCapture(event.pointerId);

    const selected=selectedObject();
    const handle=hitHandle(point,selected);
    if(state.tool==='select'&&handle){
      pushHistory();
      if(handle==='rotate') state.pointerAction={kind:'rotate',id:selected.id};
      else state.pointerAction={kind:'resize',id:selected.id,handle,original:clone(selected)};
      return;
    }

    const hit=hitObject(point);
    if(state.tool==='select'){
      if(hit){
        state.selectedId=hit.id;
        render();
        if(!hit.locked){pushHistory();state.pointerAction={kind:'move',id:hit.id,start:point,origin:{x:hit.x,y:hit.y}};}
      }else{state.selectedId=null;render();}
      return;
    }

    if(state.tool==='polygon'){
      state.polygonPoints.push(point);render();return;
    }
    if(state.tool==='text'){
      state.textPoint=point;$('textInput').value='';$('textModal').classList.remove('hidden');setTimeout(()=>$('textInput').focus(),30);return;
    }
    if(state.tool==='freehand'){
      state.drawing={kind:'freehand',points:[point]};render();return;
    }
    if(['rectangle','ellipse','triangle','line'].includes(state.tool)){
      state.drawing={kind:'shape',tool:state.tool,start:point,end:point};render();
    }
  });

  canvas.addEventListener('pointermove',(event)=>{
    const point=canvasPoint(event);state.mouse=point;$('mousePosition').textContent=`Mouse: (${Math.round(point.x)}, ${Math.round(H-point.y)})`;
    if(state.pointerAction){
      const object=state.objects.find(item=>item.id===state.pointerAction.id);if(!object)return;
      if(state.pointerAction.kind==='move'){
        object.x=snapCoordinate(state.pointerAction.origin.x+(point.x-state.pointerAction.start.x));
        object.y=snapCoordinate(state.pointerAction.origin.y+(point.y-state.pointerAction.start.y));
      }else if(state.pointerAction.kind==='rotate'){
        object.rotation=Math.atan2(point.y-object.y,point.x-object.x)*180/Math.PI+90;
      }else if(state.pointerAction.kind==='resize'){
        const original=state.pointerAction.original;
        const bounds=objectBounds(original);
        let left=bounds.x,right=bounds.x+bounds.w,top=bounds.y,bottom=bounds.y+bounds.h;
        if(state.pointerAction.handle.includes('w'))left=point.x;else right=point.x;
        if(state.pointerAction.handle.includes('n'))top=point.y;else bottom=point.y;
        object.x=(left+right)/2;object.y=(top+bottom)/2;object.w=Math.max(10,Math.abs(right-left));object.h=Math.max(10,Math.abs(bottom-top));
      }
      render();return;
    }
    if(state.drawing?.kind==='shape'){state.drawing.end=point;render();}
    else if(state.drawing?.kind==='freehand'){
      const previous=state.drawing.points[state.drawing.points.length-1];
      if(!previous||Math.hypot(point.x-previous.x,point.y-previous.y)>1.5){state.drawing.points.push(point);render();}
    }
  });

  function finishPointer(event){
    if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(state.pointerAction){state.pointerAction=null;render();return;}
    if(state.drawing)completeDrawing();
  }
  canvas.addEventListener('pointerup',finishPointer);
  canvas.addEventListener('pointercancel',(event)=>{if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);state.pointerAction=null;state.drawing=null;render();});
  canvas.addEventListener('dblclick',(event)=>{if(state.tool==='polygon'){event.preventDefault();finishPolygon();}});

  viewport.addEventListener('scroll',()=>{
    if(state.drawing||state.pointerAction){state.drawing=null;state.pointerAction=null;render();setStatus('Drawing cancelled because the canvas was scrolled');}
  },{passive:true});
  viewport.addEventListener('wheel',(event)=>{
    if(event.ctrlKey||event.metaKey){event.preventDefault();setZoom(state.zoom*(event.deltaY<0?1.1:.9));}
  },{passive:false});

  // ---------- UI actions ----------

  document.querySelectorAll('.tool-button').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.tool)));
  document.querySelectorAll('.inspector-tab').forEach(button=>button.addEventListener('click',()=>activateInspectorTab(button.dataset.tab)));
  $('assetSearch').addEventListener('input',renderAssetGrid);
  $('assetCategory').addEventListener('change',renderAssetGrid);
  $('projectName').addEventListener('input',(event)=>{state.projectName=event.target.value||'Untitled Design';saveAutosave();});
  $('newBtn').addEventListener('click',()=>{if(state.objects.length&&!confirm('Create a new project? Unsaved work will be cleared.'))return;pushHistory();state.projectName='Untitled Design';state.canvasColor='#f7f9fc';state.objects=[];state.selectedId=null;$('projectName').value=state.projectName;render();fitCanvas();setStatus('New project created');});
  $('openBtn').addEventListener('click',()=>$('projectFileInput').click());
  $('projectFileInput').addEventListener('change',(event)=>{const file=event.target.files?.[0];if(file)openProject(file);event.target.value='';});
  $('saveBtn').addEventListener('click',saveProject);
  $('undoBtn').addEventListener('click',undo);
  $('redoBtn').addEventListener('click',redo);
  $('exportBtn').addEventListener('click',()=>$('exportModal').classList.remove('hidden'));
  $('generateBtn').addEventListener('click',()=>openCodeModal('full'));
  $('aboutBtn').addEventListener('click',()=>$('aboutModal').classList.remove('hidden'));
  $('fitBtn').addEventListener('click',fitCanvas);
  $('zoomInBtn').addEventListener('click',()=>setZoom(state.zoom*1.12));
  $('zoomOutBtn').addEventListener('click',()=>setZoom(state.zoom/1.12));
  $('zoomValue').addEventListener('click',()=>setZoom(1));
  $('gridBtn').addEventListener('click',()=>{state.grid=!state.grid;$('gridBtn').classList.toggle('active',state.grid);render();});
  $('snapBtn').addEventListener('click',()=>{state.snap=!state.snap;$('snapBtn').classList.toggle('active',state.snap);render();});
  $('centerBtn').addEventListener('click',centerCanvas);
  $('duplicateBtn').addEventListener('click',duplicateSelected);
  $('frontBtn').addEventListener('click',bringFront);
  $('backBtn').addEventListener('click',sendBack);
  $('ungroupBtn').addEventListener('click',ungroupSelected);
  $('deleteBtn').addEventListener('click',deleteSelected);
  $('previewAnimationBtn').addEventListener('click',toggleAnimationPreview);
  $('clearCanvasBtn').addEventListener('click',()=>{if(!state.objects.length||!confirm('Clear every object from the canvas?'))return;pushHistory();state.objects=[];state.selectedId=null;render();setStatus('Canvas cleared');});
  $('copyCodeBtn').addEventListener('click',async()=>{await copyText(generateSelectedCode());$('copyCodeBtn').textContent='Copied';setTimeout(()=>$('copyCodeBtn').textContent='Copy object',1200);setStatus('Selected object code copied');});
  $('expandCodeBtn').addEventListener('click',()=>openCodeModal('selection'));
  $('modalCopyCodeBtn').addEventListener('click',async()=>{const content=state.codeModalMode==='full'?generateFullCode():generateSelectedCode();await copyText(content);$('modalCopyCodeBtn').textContent='Copied';setTimeout(()=>$('modalCopyCodeBtn').textContent=state.codeModalMode==='full'?'Copy full code':'Copy object code',1200);});
  $('downloadCodeBtn').addEventListener('click',()=>{const full=state.codeModalMode==='full';const content=full?generateFullCode():generateSelectedCode();downloadBlob(content,`${safeFilename(state.projectName)}${full?'':'-selected-object'}.cpp`,'text/x-c++src');});
  $('confirmTextBtn').addEventListener('click',()=>{const value=$('textInput').value.trim();if(!value||!state.textPoint)return;pushHistory();const object=makeObject('text',state.textPoint.x,state.textPoint.y,Math.max(100,value.length*20),42,{name:'Text',text:value,fontSize:34,fill:'#20344f',stroke:'#20344f',strokeWidth:0});state.objects.push(object);state.selectedId=object.id;$('textModal').classList.add('hidden');setTool('select');render();});
  $('textInput').addEventListener('keydown',(event)=>{if(event.key==='Enter')$('confirmTextBtn').click();});

  document.querySelectorAll('[data-close-modal]').forEach(button=>button.addEventListener('click',()=>$(`${button.dataset.closeModal}`).classList.add('hidden')));
  document.querySelectorAll('.modal-backdrop').forEach(backdrop=>backdrop.addEventListener('pointerdown',(event)=>{if(event.target===backdrop)backdrop.classList.add('hidden');}));
  document.querySelectorAll('[data-export]').forEach(button=>button.addEventListener('click',()=>{
    $('exportModal').classList.add('hidden');
    if(button.dataset.export==='png')exportPNG();
    if(button.dataset.export==='json')saveProject();
    if(button.dataset.export==='cpp')openCodeModal();
  }));

  window.addEventListener('keydown',(event)=>{
    const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
    if(typing){if(event.key==='Escape')document.activeElement.blur();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'){event.preventDefault();duplicateSelected();}
    if((event.ctrlKey||event.metaKey)&&event.key==='0'){event.preventDefault();fitCanvas();}
    if((event.ctrlKey||event.metaKey)&&event.key==='1'){event.preventDefault();setZoom(1);}
    if(event.key==='Delete')deleteSelected();
    if(event.key==='Enter'&&state.tool==='polygon')finishPolygon();
    if(event.key==='Escape'){
      state.drawing=null;state.pointerAction=null;cancelPolygon();
      document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(modal=>modal.classList.add('hidden'));
    }
    const shortcuts={v:'select',r:'rectangle',o:'ellipse',t:'triangle',l:'line',p:'polygon',b:'freehand'};
    if(shortcuts[event.key.toLowerCase()])setTool(shortcuts[event.key.toLowerCase()]);
  });

  window.addEventListener('resize',()=>setTimeout(fitCanvas,80));

  // Initial setup
  loadAutosave();
  renderAssetGrid();
  activateInspectorTab('properties');
  setTool('select');
  render();
  setTimeout(fitCanvas,100);
})();
