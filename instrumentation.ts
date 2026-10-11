export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.DATABASE_PATH&&process.env.BETTER_AUTH_URL){
  const {startReadyEmailWorker}=await import('./lib/order-ready-emails');startReadyEmailWorker();
 }
}
