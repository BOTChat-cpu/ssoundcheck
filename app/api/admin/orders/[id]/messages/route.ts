import {conversationGet,conversationPost} from '../../../../../../lib/order-conversations';
export const dynamic='force-dynamic';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){return conversationGet(req,(await ctx.params).id,'studio')}
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){return conversationPost(req,(await ctx.params).id,'studio')}
