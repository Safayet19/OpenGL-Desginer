(function(){
  const OVD=window.OVD;
  const {WIDTH:W,HEIGHT:H}=OVD.constants;

  function rgb(hex){
    const safe=(hex||"#000000").replace("#","");
    const value=safe.length===3?safe.split("").map(c=>c+c).join(""):safe;
    return [
      parseInt(value.slice(0,2),16)/255,
      parseInt(value.slice(2,4),16)/255,
      parseInt(value.slice(4,6),16)/255
    ];
  }
  const f=value=>(Number(value)||0).toFixed(2)+"f";
  const color=(hex,alpha=1)=>{
    const c=rgb(hex);
    return `glColor4f(${c[0].toFixed(3)}f, ${c[1].toFixed(3)}f, ${c[2].toFixed(3)}f, ${Number(alpha).toFixed(2)}f);`;
  };

  function childCode(child,parent){
    const cw=child.w*parent.w, ch=child.h*parent.h;
    const fill=child.theme?parent.fill:(child.fill||parent.fill);
    let code=`        glPushMatrix();\n`;
    code+=`        glTranslatef(${f(child.x*parent.w)}, ${f(-child.y*parent.h)}, 0.0f);\n`;
    code+=`        glRotatef(${f(-(child.rotation||0))}, 0.0f, 0.0f, 1.0f);\n`;
    code+=`        ${color(fill,(child.opacity??1)*(parent.opacity??1))}\n`;
    if(child.type==="rect"){
      code+=`        glBegin(GL_POLYGON);\n`;
      code+=`            glVertex2f(${f(-cw/2)}, ${f(ch/2)});\n`;
      code+=`            glVertex2f(${f(cw/2)}, ${f(ch/2)});\n`;
      code+=`            glVertex2f(${f(cw/2)}, ${f(-ch/2)});\n`;
      code+=`            glVertex2f(${f(-cw/2)}, ${f(-ch/2)});\n`;
      code+=`        glEnd();\n`;
    }else if(child.type==="ellipse"){
      code+=`        drawEllipse(${f(Math.abs(cw/2))}, ${f(Math.abs(ch/2))});\n`;
    }else if(child.type==="triangle"){
      code+=`        glBegin(GL_TRIANGLES);\n`;
      code+=`            glVertex2f(0.00f, ${f(ch/2)});\n`;
      code+=`            glVertex2f(${f(-cw/2)}, ${f(-ch/2)});\n`;
      code+=`            glVertex2f(${f(cw/2)}, ${f(-ch/2)});\n`;
      code+=`        glEnd();\n`;
    }else if(child.type==="polygon"){
      code+=`        glBegin(GL_POLYGON);\n`;
      (child.points||[]).forEach(p=>{
        code+=`            glVertex2f(${f(p[0]*parent.w)}, ${f(-p[1]*parent.h)});\n`;
      });
      code+=`        glEnd();\n`;
    }else if(child.type==="line"){
      const sc=child.stroke||fill;
      code+=`        ${color(sc,(child.opacity??1)*(parent.opacity??1))}\n`;
      code+=`        glLineWidth(${f(Math.max(1,(child.strokeWidth||.01)*Math.max(parent.w,parent.h)))});\n`;
      code+=`        glBegin(GL_LINES);\n`;
      code+=`            glVertex2f(${f(-cw/2)}, ${f(ch/2)});\n`;
      code+=`            glVertex2f(${f(cw/2)}, ${f(-ch/2)});\n`;
      code+=`        glEnd();\n`;
    }
    code+=`        glPopMatrix();\n`;
    return code;
  }

  function objectCode(object,index){
    const a={preset:"none",duration:4,amount:180,loop:true,delay:0,...(object.animation||{})};
    const p=`p${index}`;
    let prefix="";
    let xExpr=f(object.x), yExpr=f(H-object.y), rotationExpr=f(-object.rotation), scaleExpr="1.00f";
    let alphaExpr=Number(object.opacity??1).toFixed(2)+"f";
    if(a.preset!=="none"){
      prefix+=`    float ${p} = animationProgress(animationTime, ${f(a.delay||0)}, ${f(Math.max(.2,a.duration||4))}, ${a.loop!==false?"true":"false"});\n`;
      const wave=`sinf(${p} * 6.2831853f)`;
      if(a.preset==="slide") xExpr=`${f(object.x)} + (${p} - 1.0f) * ${f(a.amount||180)}`;
      if(a.preset==="float") yExpr=`${f(H-object.y)} + ${wave} * ${f(a.amount||40)}`;
      if(a.preset==="bounce") yExpr=`${f(H-object.y)} + fabsf(sinf(${p} * 3.1415926f)) * ${f(a.amount||70)}`;
      if(a.preset==="rotate") rotationExpr=`${f(-object.rotation)} - ${p} * 360.0f`;
      if(a.preset==="pulse") scaleExpr=`1.0f + ${wave} * ${((a.amount||50)/500).toFixed(3)}f`;
      if(a.preset==="blink") alphaExpr=`${Number(object.opacity??1).toFixed(2)}f * (0.25f + 0.75f * (0.5f + 0.5f * ${wave}))`;
    }

    let code=prefix;
    code+=`    // ${object.name}\n`;
    code+=`    glPushMatrix();\n`;
    code+=`    glTranslatef(${xExpr}, ${yExpr}, 0.0f);\n`;
    code+=`    glRotatef(${rotationExpr}, 0.0f, 0.0f, 1.0f);\n`;
    code+=`    glScalef(${scaleExpr}, ${scaleExpr}, 1.0f);\n`;
    { const objectColor=rgb(object.fill); code+=`    glColor4f(${objectColor[0].toFixed(3)}f, ${objectColor[1].toFixed(3)}f, ${objectColor[2].toFixed(3)}f, ${alphaExpr});\n`; }

    if(object.type==="rectangle"){
      code+=`    glBegin(GL_POLYGON);\n`;
      code+=`        glVertex2f(${f(-object.w/2)}, ${f(object.h/2)});\n`;
      code+=`        glVertex2f(${f(object.w/2)}, ${f(object.h/2)});\n`;
      code+=`        glVertex2f(${f(object.w/2)}, ${f(-object.h/2)});\n`;
      code+=`        glVertex2f(${f(-object.w/2)}, ${f(-object.h/2)});\n`;
      code+=`    glEnd();\n`;
    }else if(object.type==="ellipse"){
      code+=`    drawEllipse(${f(object.w/2)}, ${f(object.h/2)});\n`;
    }else if(object.type==="triangle"){
      code+=`    glBegin(GL_TRIANGLES);\n`;
      code+=`        glVertex2f(0.00f, ${f(object.h/2)});\n`;
      code+=`        glVertex2f(${f(-object.w/2)}, ${f(-object.h/2)});\n`;
      code+=`        glVertex2f(${f(object.w/2)}, ${f(-object.h/2)});\n`;
      code+=`    glEnd();\n`;
    }else if(object.type==="polygon"){
      code+=`    glBegin(GL_POLYGON);\n`;
      (object.points||[]).forEach(p=>{
        code+=`        glVertex2f(${f(p.x*object.w)}, ${f(-p.y*object.h)});\n`;
      });
      code+=`    glEnd();\n`;
    }else if(object.type==="line"||object.type==="freehand"){
      const c=rgb(object.stroke);
      code+=`    glColor4f(${c[0].toFixed(3)}f, ${c[1].toFixed(3)}f, ${c[2].toFixed(3)}f, ${alphaExpr});\n`;
      code+=`    glLineWidth(${f(object.strokeWidth)});\n`;
      code+=`    glBegin(${object.type==="line"?"GL_LINES":"GL_LINE_STRIP"});\n`;
      (object.points||[]).forEach(p=>{
        code+=`        glVertex2f(${f(p.x*object.w)}, ${f(-p.y*object.h)});\n`;
      });
      code+=`    glEnd();\n`;
    }else if(object.type==="text"){
      const clean=(object.text||"Text").replace(/\\/g,"\\\\").replace(/"/g,'\\"');
      code+=`    glRasterPos2f(${f(-object.w/2)}, 0.00f);\n`;
      code+=`    drawText("${clean}");\n`;
    }else if(object.type==="group"){
      code+=`    // Editable professional vector group\n`;
      (object.children||[]).forEach(child=>code+=childCode(child,object));
    }
    code+=`    glPopMatrix();\n`;
    return code;
  }

  OVD.generateCpp=function(){
    const active=OVD.state.objects.filter(o=>o.visible!==false);
    const animated=active.some(o=>(o.animation?.preset||"none")!=="none");
    const bg=rgb(OVD.state.canvasColor);
    const drawing=active.map(objectCode).join("\n");

    return `/*
    Project: ${OVD.state.projectName}
    Generated by: OpenGL Visual Designer
    Developer: Safayet Ullah
    Department: Computer Science and Engineering
    University: Southeast University

    Copyright © 2026 Safayet Ullah.
    All rights reserved.
*/

#include <Windows.h>
#include <GL/glut.h>
#include <cmath>

void drawEllipse(float radiusX, float radiusY)
{
    glBegin(GL_TRIANGLE_FAN);
    glVertex2f(0.0f, 0.0f);

    for (int i = 0; i <= 120; i++)
    {
        float angle = 2.0f * 3.1415926f * static_cast<float>(i) / 120.0f;
        glVertex2f(cosf(angle) * radiusX, sinf(angle) * radiusY);
    }

    glEnd();
}

void drawText(const char* text)
{
    for (const char* character = text; *character; ++character)
    {
        glutBitmapCharacter(GLUT_BITMAP_HELVETICA_18, *character);
    }
}

${animated?`float animationTime = 0.0f;

float animationProgress(float time, float delay, float duration, bool repeat)
{
    float localTime = time - delay;

    if (localTime <= 0.0f)
    {
        return 0.0f;
    }

    if (duration <= 0.001f)
    {
        return 1.0f;
    }

    if (repeat)
    {
        return fmodf(localTime, duration) / duration;
    }

    float progress = localTime / duration;

    if (progress < 0.0f) return 0.0f;
    if (progress > 1.0f) return 1.0f;

    return progress;
}

void timer(int value)
{
    animationTime = glutGet(GLUT_ELAPSED_TIME) / 1000.0f;
    glutPostRedisplay();
    glutTimerFunc(16, timer, 0);
}
`:``}
void init()
{
    glClearColor(${bg[0].toFixed(3)}f, ${bg[1].toFixed(3)}f, ${bg[2].toFixed(3)}f, 1.0f);

    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();

    gluOrtho2D(0.0, 900.0, 0.0, 600.0);
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);

    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

${drawing}
    ${animated?"glutSwapBuffers();":"glFlush();"}
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(${animated?"GLUT_DOUBLE":"GLUT_SINGLE"} | GLUT_RGB);

    glutInitWindowPosition(100, 100);
    glutInitWindowSize(900, 600);

    glutCreateWindow("Safayet Ullah - OpenGL Visual Design");

    init();
    glutDisplayFunc(display);
    ${animated?"glutTimerFunc(16, timer, 0);":""}

    glutMainLoop();

    return 0;
}
`;
  };
})();