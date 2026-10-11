import {z} from 'zod';
import {getSqlite} from '../db';
import {defaultContent,type SiteContent} from './site-content-defaults';
const short=z.string().trim().min(1).max(200);
const copy=z.string().trim().min(1).max(2000);
const price=z.string().trim().regex(/^\d[\d ]{0,10}$/,'Цена должна содержать только цифры и пробелы.');
export const contentSchema=z.object({
 plans:z.array(z.object({name:short,price,desc:copy,items:z.array(short).min(1).max(10),result:copy,revisions:short})).length(3),
 revisionAddon:z.object({name:short,price}),
 songs:z.array(z.object({title:short,src:z.string().regex(/^\/(?:audio\/[a-zA-Z0-9_-]+\.mp3|api\/media\/[a-f0-9-]{36}\.mp3)$/),duration:z.string().regex(/^\d{1,3}:[0-5]\d$/),theme:z.enum(['horizon','neon']),number:z.string().regex(/^\d{2}$/),genre:short,description:copy})).min(1).max(12),
 heroTitle:copy,heroLead:copy,aboutTitle:copy,aboutLead:copy,aboutCopy:copy,
 telegram:z.string().regex(/^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}$/)
});
export function getContent():SiteContent{
 const row=getSqlite().prepare('SELECT value FROM site_content WHERE id=1').get() as {value:string}|undefined;
 if(!row)return defaultContent;
 return contentSchema.parse(JSON.parse(row.value));
}
