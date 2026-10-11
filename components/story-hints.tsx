'use client';
import {useRef,useState} from 'react';
import {Sparkles,Plus} from 'lucide-react';
import {composeStory,storyQuestions} from '../lib/song-finder';
export function StoryHints({onAdd,disabled}:{onAdd:(text:string)=>boolean;disabled:boolean}){
 const [answers,setAnswers]=useState(['','','','']),[added,setAdded]=useState(false),[error,setError]=useState('');const box=useRef<HTMLDetailsElement>(null);
 function apply(){setError('');const text=composeStory(answers);if(!text)return;if(!onAdd(text)){setError('В истории уже много текста. Сократите её, чтобы добавить ответы: максимум 2000 символов.');return;}setAnswers(['','','','']);setAdded(true);if(box.current)box.current.open=false;}
 return <details className="story-hints" ref={box}><summary><Sparkles size={15}/><span>{added?'Добавить ещё деталей':'Помогите мне рассказать историю'}</span><span className="story-hints-toggle">+</span></summary><div className="story-hints-content"><p>Достаточно пары тёплых деталей. Ответьте на вопросы, которые вам близки — мы добавим ответы к вашей истории.</p>{storyQuestions.map((q,i)=><label key={q.label}>{q.label}<textarea rows={2} maxLength={300} value={answers[i]} placeholder={q.placeholder} disabled={disabled} onChange={e=>{setAnswers(answers.map((a,j)=>j===i?e.target.value:a));setAdded(false);setError('')}}/></label>)}<button type="button" className="button secondary" disabled={disabled||!answers.some(a=>a.trim())} onClick={apply}><Plus size={15}/>Добавить в историю</button>{error&&<p className="form-status" role="alert">{error}</p>}</div>{added&&<span className="sr-only" role="status">Ответы добавлены в историю.</span>}</details>;
}
