import sharp,{type OverlayOptions} from 'sharp';
import {join} from 'node:path';
import type {GiftCertificate} from './certificates';
const width=2970,height=2100;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export async function certificatePng(c:GiftCertificate){
 const bg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#101627"/><stop offset="1" stop-color="#201b30"/></linearGradient><radialGradient id="glow"><stop stop-color="#81764b" stop-opacity=".2"/><stop offset="1" stop-color="#81764b" stop-opacity="0"/></radialGradient></defs><rect width="2970" height="2100" fill="url(#bg)"/><ellipse cx="1485" cy="1000" rx="1200" ry="1050" fill="url(#glow)"/><rect x="75" y="75" width="2820" height="1950" rx="20" fill="none" stroke="#c8af76" stroke-width="3"/><rect x="103" y="103" width="2764" height="1894" rx="13" fill="none" stroke="#c8af76" stroke-opacity=".35"/><path d="M350 1635H2320" stroke="#c8af76" stroke-opacity=".45"/><g fill="none" stroke="#c8af76"><circle cx="2540" cy="1715" r="145" stroke-width="3"/><circle cx="2540" cy="1715" r="127" stroke-dasharray="3 10"/><circle cx="2540" cy="1715" r="101" stroke-opacity=".4"/></g><g stroke="#c8af76" stroke-width="9" stroke-linecap="round">${[36,62,88,110,88,62,36].map((h,i)=>`<path d="M${2468+i*24} ${1715-h/2}v${h}"/>`).join('')}</g><path d="M1460 260V160m25 120V135m25 125V160" stroke="#d5bd87" stroke-width="8" stroke-linecap="round"/></svg>`);
 const layers:OverlayOptions[]=[];
 async function text(value:string,x:number,y:number,w:number,h:number,size:number,color:string){if(!value)return;let image=sharp({text:{text:`<span foreground="${color}">${escape(value)}</span>`,font:'DejaVu Sans '+size,fontfile:join(process.cwd(),'public/certificate-fonts/DejaVuSans-subset.ttf'),width:w,align:'centre',wrap:'word-char',rgba:true}});let {data,info}=await image.png().toBuffer({resolveWithObject:true});if(info.height>h){const resized=await sharp(data).resize({height:h,width:w,fit:'inside'}).png().toBuffer({resolveWithObject:true});data=resized.data;info=resized.info}layers.push({input:data,left:Math.round(x+(w-info.width)/2),top:Math.round(y+(h-info.height)/2)})}
 await text('SSoundCheck',300,290,2370,90,64,'#d5bd87');
 await text('ПОДАРОЧНЫЙ СЕРТИФИКАТ',250,440,2470,120,74,'#f7f3e9');
 await text('Подарите историю, которая станет песней',300,580,2370,75,34,'#b8b1a6');
 await text('ПОЛУЧАТЕЛЬ',300,720,2370,60,25,'#b8b1a6');
 await text(c.recipient,300,800,2370,180,82,'#f7f3e9');
 await text(c.service,380,1030,2210,125,58,'#d5bd87');
 await text(c.message,400,1230,2170,235,38,'#e6e0d6');
 await text('С теплом, '+c.sender,400,1510,1920,85,34,'#d5bd87');
 await text(c.code,320,1680,2000,85,38,'#f7f3e9');
 await text('Выдан '+new Date(c.created_at).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}),320,1790,2000,60,25,'#b8b1a6');
 await text('SSOUNDCHECK',2370,1790,340,40,20,'#d5bd87');
 await text('Для использования свяжитесь с нами на ssoundcheck.ru и назовите номер.',300,1900,2370,60,25,'#b8b1a6');
 if(c.status!=='issued')await text(c.status==='cancelled'?'ОТМЕНЁН':'ИСПОЛЬЗОВАН',420,1100,2130,140,85,'#edafaa');
 return sharp(bg).composite(layers).png().toBuffer();
}
export async function certificatePdf(png:Buffer){const {data:jpeg,info}=await sharp(png).jpeg({quality:94}).toBuffer({resolveWithObject:true});const content=Buffer.from('q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ');const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,Buffer.from('\nendstream')]),Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`),content,Buffer.from('\nendstream')])];const parts=[Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n','binary')],offsets=[0];let length=parts[0].length;objects.forEach((o,i)=>{offsets.push(length);const p=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),o,Buffer.from('\nendobj\n')]);parts.push(p);length+=p.length});parts.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));return Buffer.concat(parts)}
