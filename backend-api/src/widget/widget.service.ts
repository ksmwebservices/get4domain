import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Vendor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { WidgetChatDto, WidgetLeadDto } from './dto/widget.dto';

@Injectable()
export class WidgetService {
  constructor(private readonly prisma: PrismaService, private readonly ai: AiService) {}

  /** Vendor-facing: return the vendor's widget key, generating one on first use. */
  async ensureKey(vendorId: string): Promise<string> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!v) throw new NotFoundException('Vendor not found');
    if (v.widgetKey) return v.widgetKey;
    const key = `wgt_${crypto.randomBytes(18).toString('hex')}`;
    await this.prisma.vendor.update({ where: { id: vendorId }, data: { widgetKey: key } });
    return key;
  }

  private async resolve(key: string): Promise<Vendor> {
    const v = key ? await this.prisma.vendor.findUnique({ where: { widgetKey: key } }) : null;
    if (!v || v.isSandbox) throw new NotFoundException('Invalid widget key');
    return v;
  }

  async config(key: string): Promise<{ businessName: string; industry: string | null }> {
    const v = await this.resolve(key);
    return { businessName: v.businessName, industry: v.industry };
  }

  /** Widget/API lead → the SAME vendor CampaignLead pipeline as native funnel leads. */
  async createLead(dto: WidgetLeadDto): Promise<{ ok: true }> {
    const v = await this.resolve(dto.key);
    await this.prisma.campaignLead.create({
      data: { vendorId: v.id, name: dto.name, phone: dto.phone, message: dto.message, source: 'widget', status: 'new' },
    });
    return { ok: true };
  }

  /** Widget chat → reuses the 2B Claude assistant, flavored with the vendor context. */
  async chat(dto: WidgetChatDto): Promise<{ reply: string }> {
    const v = await this.resolve(dto.key);
    const res = await this.ai.chat({
      message: dto.message,
      context: 'dashboard',
      vendorName: v.businessName,
      industry: v.industry ?? undefined,
      conversationHistory: dto.history,
    });
    return { reply: res.reply };
  }

  /** The embeddable script — self-contained, reads its own data-key, injects a chat
   *  bubble (assistant + lead form). Vendors paste one <script> tag. */
  embedJs(apiBase: string): string {
    return `(function(){
  var s=document.currentScript||(function(){var a=document.getElementsByTagName('script');return a[a.length-1];})();
  var KEY=s&&s.getAttribute('data-key');if(!KEY)return;var API=${JSON.stringify(apiBase)};
  var hist=[],open=false;
  var css='#g4dw-b{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#2563eb;color:#fff;border:none;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;font-size:24px;z-index:2147483000}#g4dw-p{position:fixed;bottom:88px;right:20px;width:340px;max-width:92vw;height:460px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:system-ui,Arial,sans-serif}#g4dw-h{background:#2563eb;color:#fff;padding:12px 14px;font-weight:700}#g4dw-t{display:flex;border-bottom:1px solid #eee}#g4dw-t button{flex:1;padding:8px;border:none;background:#fff;cursor:pointer;font-weight:600;color:#555}#g4dw-t button.on{color:#2563eb;box-shadow:inset 0 -2px 0 #2563eb}#g4dw-body{flex:1;overflow-y:auto;padding:12px;font-size:14px}#g4dw-foot{padding:10px;border-top:1px solid #eee}.g4dw-in{width:100%;box-sizing:border-box;padding:9px;border:1px solid #ddd;border-radius:9px;font-size:14px;margin-bottom:6px}.g4dw-btn{width:100%;padding:9px;background:#2563eb;color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer}.g4dw-msg{margin:6px 0;padding:8px 10px;border-radius:10px;max-width:85%}.g4dw-u{background:#2563eb;color:#fff;margin-left:auto}.g4dw-a{background:#f1f5f9;color:#111}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var b=document.createElement('button');b.id='g4dw-b';b.textContent='\\uD83D\\uDCAC';document.body.appendChild(b);
  var p=document.createElement('div');p.id='g4dw-p';
  p.innerHTML='<div id="g4dw-h">Chat with us</div><div id="g4dw-t"><button data-tab="chat" class="on">Chat</button><button data-tab="lead">Enquiry</button></div><div id="g4dw-body"></div><div id="g4dw-foot"></div>';
  document.body.appendChild(p);
  var tab='chat';var body=p.querySelector('#g4dw-body');var foot=p.querySelector('#g4dw-foot');
  function esc(x){return (x||'').replace(/[<>&]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;'}[c];});}
  function render(){
    if(tab==='chat'){
      body.innerHTML=hist.map(function(m){return '<div class="g4dw-msg '+(m.role==='user'?'g4dw-u':'g4dw-a')+'">'+esc(m.content)+'</div>';}).join('')||'<div class="g4dw-msg g4dw-a">Hi! How can I help?</div>';
      foot.innerHTML='<input id="g4dw-ci" class="g4dw-in" placeholder="Type a message…"><button id="g4dw-cs" class="g4dw-btn">Send</button>';
      foot.querySelector('#g4dw-cs').onclick=sendChat;
      foot.querySelector('#g4dw-ci').addEventListener('keydown',function(e){if(e.key==='Enter')sendChat();});
    } else {
      body.innerHTML='<div class="g4dw-msg g4dw-a">Leave your details and we\\'ll get back to you.</div>';
      foot.innerHTML='<input id="g4dw-n" class="g4dw-in" placeholder="Your name"><input id="g4dw-ph" class="g4dw-in" placeholder="Phone"><input id="g4dw-m" class="g4dw-in" placeholder="Message (optional)"><button id="g4dw-ls" class="g4dw-btn">Send enquiry</button>';
      foot.querySelector('#g4dw-ls').onclick=sendLead;
    }
    body.scrollTop=body.scrollHeight;
  }
  function sendChat(){var i=foot.querySelector('#g4dw-ci');var v=(i.value||'').trim();if(!v)return;hist.push({role:'user',content:v});i.value='';render();
    fetch(API+'/widget/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:KEY,message:v,history:hist.slice(-8)})}).then(function(r){return r.json();}).then(function(d){hist.push({role:'assistant',content:(d.data&&d.data.reply)||d.reply||'Sorry, please try again.'});render();}).catch(function(){hist.push({role:'assistant',content:'Network error — please try again.'});render();});}
  function sendLead(){var n=foot.querySelector('#g4dw-n').value.trim();var ph=foot.querySelector('#g4dw-ph').value.trim();var m=foot.querySelector('#g4dw-m').value.trim();if(!n||!ph){alert('Name and phone required');return;}
    fetch(API+'/widget/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:KEY,name:n,phone:ph,message:m})}).then(function(r){return r.json();}).then(function(){body.innerHTML='<div class="g4dw-msg g4dw-a">Thanks! We\\'ll be in touch shortly.</div>';foot.innerHTML='';}).catch(function(){alert('Could not send — please try again.');});}
  p.querySelectorAll('#g4dw-t button').forEach(function(btn){btn.onclick=function(){tab=btn.getAttribute('data-tab');p.querySelectorAll('#g4dw-t button').forEach(function(x){x.className=x===btn?'on':'';});render();};});
  b.onclick=function(){open=!open;p.style.display=open?'flex':'none';if(open)render();};
})();`;
  }
}
