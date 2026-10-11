'use client';
import {Heart,HandHeart,Users,Cake,Music2,Sparkles,ArrowUpRight} from 'lucide-react';
export type OccasionIdea={title:string;recipient:string;occasion:string};
const ideas=[
{title:'Для мамы',recipient:'Маме',occasion:'Благодарность маме',description:'Сказать спасибо за любовь и сохранить тёплые воспоминания.',icon:HandHeart},
{title:'Для любимого человека',recipient:'Любимому человеку',occasion:'Признание в любви',description:'Рассказать вашу историю и выразить то, что трудно сказать словами.',icon:Heart},
{title:'На свадьбу',recipient:'Молодожёнам',occasion:'Свадьба',description:'Первый танец, поздравление или песня о встрече двух людей.',icon:Users},
{title:'На день рождения',recipient:'',occasion:'День рождения',description:'Личное поздравление с именем, воспоминаниями и пожеланиями.',icon:Cake},
{title:'Для себя',recipient:'Для себя',occasion:'Личная история',description:'Свои чувства, мечта или идея, которую хочется превратить в музыку.',icon:Music2},
{title:'Другое',recipient:'',occasion:'',description:'Любой повод, любой человек или ваша собственная задумка.',icon:Sparkles}
];
export function OccasionCards({onChoose}:{onChoose:(idea:OccasionIdea)=>void}){return <section className="section occasion-section" id="song-ideas"><div className="section-heading"><div><p className="eyebrow">ПЕСНЯ ДЛЯ ВАШЕГО МОМЕНТА</p><h2>Для кого будет<br/>ваша песня?</h2></div><p>Выберите идею и расскажите свою историю.<br/>Текст, настроение и звучание задаёте вы.</p></div><div className="occasion-grid">{ideas.map(({icon:Icon,description,...idea})=><button type="button" className="occasion-card" key={idea.title} onClick={()=>onChoose(idea)} aria-label={idea.title+' — заполнить заявку'}><span className="occasion-icon"><Icon size={25}/></span><span className="occasion-title">{idea.title}</span><span className="occasion-description">{description}</span><span className="occasion-action">Рассказать идею <ArrowUpRight size={17}/></span></button>)}</div><p className="occasion-help">Карточка открывает заявку. Все ответы и выбранную услугу можно изменить.</p></section>}
