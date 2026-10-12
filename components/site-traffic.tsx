'use client';
import {useEffect} from 'react';
export function SiteTraffic(){
 useEffect(()=>{
  let interacted=false,visibleAt=document.visibilityState==='visible'?performance.now():null,visibleMs=0,browserSent=false,activeSent=false,pending=false,stopped=false;
  const elapsed=()=>visibleMs+(visibleAt===null?0:performance.now()-visibleAt);
  async function report(){if(stopped||pending||document.visibilityState!=='visible'||elapsed()<2000)return;
   const automated=navigator.webdriver===true,state=automated?'automated':interacted?'active':'browser';
   if((state==='active'&&activeSent)||(state!=='active'&&browserSent))return;
   pending=true;
   try{const r=await fetch('/api/traffic',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({state}),keepalive:true});if(r.ok){browserSent=true;if(state==='active')activeSent=true}}
   catch{/* Counting never blocks the site. */}finally{pending=false}
  }
  const interact=(e:Event)=>{if(e.isTrusted&&document.visibilityState==='visible'){interacted=true;void report()}};
  const visibility=()=>{if(visibleAt!==null)visibleMs+=performance.now()-visibleAt;visibleAt=document.visibilityState==='visible'?performance.now():null;void report()};
  const events=['pointerdown','keydown','wheel','touchmove'];events.forEach(name=>window.addEventListener(name,interact,{passive:true}));document.addEventListener('visibilitychange',visibility);
  const timer=setInterval(()=>void report(),2500);
  return()=>{stopped=true;clearInterval(timer);events.forEach(name=>window.removeEventListener(name,interact));document.removeEventListener('visibilitychange',visibility)};
 },[]);
 return null;
}
