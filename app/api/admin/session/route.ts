import {adminConfigured,adminCookie,adminLogin,adminLogout,isAdmin,sameOrigin} from '../../../../lib/admin-auth';
export const dynamic='force-dynamic';
export async function GET(req:Request){return Response.json({authenticated:isAdmin(req),configured:adminConfigured()},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'Недопустимый запрос.'},{status:403});
 try{if(Number(req.headers.get('content-length'))>2048)return Response.json({error:'Запрос слишком большой.'},{status:413});const data=await req.json();const result=await adminLogin(data.password);return Response.json(result.token?{ok:true}:{error:result.error},{status:result.status,headers:result.token?{'Set-Cookie':adminCookie(result.token),'Cache-Control':'no-store'}:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Не удалось войти. Попробуйте позже.'},{status:503});}
}
export async function DELETE(req:Request){if(!sameOrigin(req))return Response.json({error:'Недопустимый запрос.'},{status:403});adminLogout(req);return Response.json({ok:true},{headers:{'Set-Cookie':adminCookie('',0),'Cache-Control':'no-store'}});}
