export const dynamic = 'force-dynamic';
import {authConfiguration} from '../../../lib/site-auth';
export async function GET(){return Response.json(authConfiguration(),{headers:{'Cache-Control':'no-store'}})}
