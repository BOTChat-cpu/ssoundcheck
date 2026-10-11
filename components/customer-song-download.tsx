'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,Share2} from 'lucide-react';

export function CustomerSongDownload({id,title}:{id:string;title:string}) {
 const url='/api/orders/'+id+'/audio?version=full&download=1';
 const [apple,setApple]=useState(false),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[shareable,setShareable]=useState(false);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{setApple(/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));return()=>controller.current?.abort()},[]);
 useEffect(()=>{controller.current?.abort();setFile(null);setShareable(false);setBusy(false);setError('')},[id,title]);
 async function prepare(){
  if(busy)return;
  const request=new AbortController();controller.current=request;setBusy(true);setError('');
  try{
   const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:request.signal});
   if(!response.ok)throw new Error(response.status===401?'Войдите в личный кабинет ещё раз.':response.status===403?'Скачивание доступно после подтверждения оплаты.':'Не удалось получить песню. Попробуйте ещё раз.');
   const blob=await response.blob();
   if(!blob.size||!['audio/mpeg','application/octet-stream'].includes(blob.type.split(';')[0]))throw new Error('Не удалось получить MP3. Попробуйте ещё раз.');
   const name=(title||'SSoundCheck-song').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').trim().slice(0,100)||'SSoundCheck-song';
   const ready=new File([blob],name+'.mp3',{type:'audio/mpeg'});
   if(request.signal.aborted)return;
   setFile(ready);setShareable(Boolean(typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[ready]})));
  }catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'Не удалось загрузить песню.')}
  finally{if(controller.current===request){controller.current=null;setBusy(false)}}
 }
 // A separate click retains the user activation required by iOS's file share sheet.
 async function save(){
  if(!file||busy)return;setError('');setBusy(true);
  try{await navigator.share({files:[file]})}
  catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError('Откройте сайт в Safari и попробуйте сохранить файл ещё раз.')}
  finally{setBusy(false)}
 }
 return <div className="customer-song-download"><a className="button secondary" href={url} download="SSoundCheck-song.mp3"><Download size={15}/>Скачать полную песню</a>{apple&&<><button type="button" className="button secondary" disabled={busy} onClick={()=>void(file&&shareable?save():prepare())}><Share2 size={15}/>{busy?'Подождите…':file&&shareable?'Сохранить MP3 в Файлы':'Подготовить MP3 для iPhone'}</button><p className="form-help">{file&&shareable?'Файл готов. Нажмите «Сохранить MP3 в Файлы», затем выберите «Сохранить в Файлы» в меню iPhone.':file?'Этот браузер не поддерживает сохранение через меню iPhone. Откройте ssoundcheck.ru в Safari, войдите в кабинет и нажмите «Скачать полную песню».':'Для iPhone: подготовьте MP3, затем сохраните его через меню «Сохранить в Файлы». Если сайт открыт внутри Telegram или другого приложения, откройте его в Safari.'}</p></>}{error&&<p className="form-status" role="alert">{error}</p>}</div>
}
