from PIL import Image, ImageDraw
import math
import os
S=os.environ.get('COVER_TMP','/tmp')+'/'
w,h=256,256
def tri(cols,vert=True):
    im=Image.new('RGB',(w,h));d=ImageDraw.Draw(im)
    for i,c in enumerate(cols):
        if vert: d.rectangle([i*w/len(cols),0,(i+1)*w/len(cols),h],fill=c)
        else: d.rectangle([0,i*h/len(cols),w,(i+1)*h/len(cols)],fill=c)
    return im
def br():
    im=Image.new('RGB',(w,h),'#1aa23a');d=ImageDraw.Draw(im)
    d.polygon([(w/2,18),(w-18,h/2),(w/2,h-18),(18,h/2)],fill='#ffd21f');d.ellipse([78,78,178,178],fill='#1b3f9a');return im
def jp():
    im=Image.new('RGB',(w,h),'white');ImageDraw.Draw(im).ellipse([56,56,200,200],fill='#e0102a');return im
def us():
    im=Image.new('RGB',(w,h),'white');d=ImageDraw.Draw(im)
    for i in range(0,13,2): d.rectangle([0,i*h/13,w,(i+1)*h/13],fill='#d22030')
    d.rectangle([0,0,w*.45,h*7/13],fill='#27348b');return im
def cross(bg,fg,x=0.36):
    im=Image.new('RGB',(w,h),bg);d=ImageDraw.Draw(im);d.rectangle([w*x-20,0,w*x+20,h],fill=fg);d.rectangle([0,h/2-20,w,h/2+20],fill=fg);return im
def uk():
    im=Image.new('RGB',(w,h),'#1b2f84');d=ImageDraw.Draw(im)
    d.line([0,0,w,h],fill='white',width=44);d.line([0,h,w,0],fill='white',width=44)
    d.line([0,0,w,h],fill='#d22030',width=16);d.line([0,h,w,0],fill='#d22030',width=16)
    d.rectangle([w/2-34,0,w/2+34,h],fill='white');d.rectangle([0,h/2-34,w,h/2+34],fill='white')
    d.rectangle([w/2-20,0,w/2+20,h],fill='#d22030');d.rectangle([0,h/2-20,w,h/2+20],fill='#d22030');return im
def ca():
    im=tri(['#d52b1e','white','#d52b1e']);d=ImageDraw.Draw(im);d.regular_polygon((128,128,52),6,fill='#d52b1e');return im
flags=[tri(['#1f4fb5','white','#e2262d']),br(),tri(['#000','#dd0000','#ffce00'],False),jp(),tri(['#1a9a45','white','#d52b2b']),uk(),us(),cross('#c8102e','white'),tri(['#ff9933','white','#138808'],False),ca(),tri(['#0055a4','white','#ef4135']),tri(['#009246','white','#ce2b37']),cross('#005eb8','#fcd116')]
strip=Image.new('RGB',(w*len(flags),h))
for i,f in enumerate(flags): strip.paste(f,(i*w,0))
strip.save(S+'flagstrip.png');print(strip.size)
