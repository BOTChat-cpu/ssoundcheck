import {conversationRead} from '../../../../../../lib/order-conversations';
export const dynamic='force-dynamic';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){return conversationRead(req,(await ctx.params).id,'customer')}
