export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.DATABASE_PATH&&process.env.BETTER_AUTH_URL){
  const {startChannelWorker}=await import('./lib/telegram-channel');startChannelWorker();
  const {startReadyEmailWorker}=await import('./lib/order-ready-emails');startReadyEmailWorker();
 }
}
