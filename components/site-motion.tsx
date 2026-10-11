'use client';
import {useEffect,useLayoutEffect} from 'react';

export function SiteMotion(){
 useLayoutEffect(()=>{
  const navigation=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
  if(navigation?.type!=='reload')return;
  const previous=history.scrollRestoration;
  history.scrollRestoration='manual';
  const top=()=>window.scrollTo({top:0,left:0,behavior:'instant'});
  top();const frame=requestAnimationFrame(top);
  window.addEventListener('pageshow',top);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('pageshow',top);history.scrollRestoration=previous};
 },[]);
 useEffect(()=>{
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(!('IntersectionObserver' in window))return;
  let reveal:IntersectionObserver|undefined,ambient:IntersectionObserver|undefined;
  const targets=Array.from(document.querySelectorAll<HTMLElement>('.section-heading,.song-card,.occasion-card,.plan,.process-card,.certificate-offer,.about-section,.final-cta'));
  const pictures=Array.from(document.querySelectorAll<HTMLElement>('.hero,.process-picture'));
  function clear(){reveal?.disconnect();ambient?.disconnect();targets.forEach(el=>el.removeAttribute('data-reveal'));pictures.forEach(el=>el.classList.remove('motion-visible'));document.documentElement.classList.remove('motion-paused');}
  function setup(){clear();if(preference.matches)return;
   reveal=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.setAttribute('data-reveal','shown');reveal?.unobserve(entry.target)}})},{threshold:0.06});
   targets.forEach(el=>{el.setAttribute('data-reveal',el.getBoundingClientRect().top<window.innerHeight?'shown':'pending');reveal!.observe(el)});
   ambient=new IntersectionObserver(entries=>{entries.forEach(entry=>entry.target.classList.toggle('motion-visible',entry.isIntersecting))});pictures.forEach(el=>ambient!.observe(el));
  }
  function visibility(){document.documentElement.classList.toggle('motion-paused',document.hidden)}
  function focus(e:FocusEvent){const target=e.target as HTMLElement;target.closest('[data-reveal]')?.setAttribute('data-reveal','shown')}
  setup();visibility();preference.addEventListener('change',setup);document.addEventListener('visibilitychange',visibility);document.addEventListener('focusin',focus);
  return()=>{clear();preference.removeEventListener('change',setup);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('focusin',focus)};
 },[]);
 return null;
}
