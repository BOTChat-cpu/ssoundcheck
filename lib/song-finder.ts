export type FinderAnswers={need:string;recipient:string;occasion:string;mood:string;genre:string};
export type FinderBrief={planIndex:0|1|2;recipient:string;occasion:string;mood:string;genre:string};
export function finderBrief(answers:FinderAnswers):FinderBrief{
 return {planIndex:answers.need==='lyrics'?0:answers.need==='existing'?1:2,recipient:answers.recipient,occasion:answers.occasion,mood:answers.mood==='Пока не знаю'?'':answers.mood,genre:answers.genre==='Помогите выбрать'?'':answers.genre};
}
export const storyQuestions=[
 {label:'Кому посвящена песня?',placeholder:'Имя, кем этот человек вам приходится…'},
 {label:'Какой момент хочется сохранить?',placeholder:'Первая встреча, поездка, смешная история…'},
 {label:'Что делает этого человека особенным?',placeholder:'Привычки, характер, любимые фразы…'},
 {label:'Какие слова хочется сказать?',placeholder:'За что благодарите, что чувствуете, о чём мечтаете…'},
];
export function composeStory(answers:string[]){return storyQuestions.map((q,i)=>answers[i]?.trim()?`${q.label}\n${answers[i].trim()}`:'').filter(Boolean).join('\n\n');}
export function appendStory(existing:string,addition:string){const combined=[existing.trim(),addition.trim()].filter(Boolean).join('\n\n');return combined.length<=2000?combined:null;}
