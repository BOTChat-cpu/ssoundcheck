import nodemailer from 'nodemailer';
/** @param {Record<string,string|undefined>} env */
export function smtpConfigured(env=process.env){return !!(env.AUTH_SMTP_HOST&&/^[0-9]{1,5}$/.test(env.AUTH_SMTP_PORT||'465')&&Number(env.AUTH_SMTP_PORT||465)>0&&Number(env.AUTH_SMTP_PORT||465)<=65535&&env.AUTH_SMTP_USER&&(env.AUTH_SMTP_PASSWORD||env.AUTH_SMTP_PASSWORD_BASE64)&&env.AUTH_FROM_EMAIL);}
/** @param {Record<string,string|undefined>} env */
export function createSMTPTransport(env=process.env){
 if(!smtpConfigured(env))throw Error('SMTP configuration unavailable');
 const port=Number(env.AUTH_SMTP_PORT||465);
 return nodemailer.createTransport({host:env.AUTH_SMTP_HOST,port,secure:env.AUTH_SMTP_SECURE==='true'||port===465,requireTLS:!(env.AUTH_SMTP_SECURE==='true'||port===465),auth:{user:env.AUTH_SMTP_USER,pass:env.AUTH_SMTP_PASSWORD_BASE64?Buffer.from(env.AUTH_SMTP_PASSWORD_BASE64,'base64').toString('utf8'):env.AUTH_SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
}
/** @param {{email:string,url:string}} data @param {Record<string,string|undefined>} env */
export async function sendPasswordReset(data,env=process.env){
 const message={from:env.AUTH_FROM_EMAIL,to:data.email,subject:'Восстановление пароля SSoundCheck',text:'Вы запросили восстановление пароля SSoundCheck.\n\nОткройте ссылку и задайте новый пароль:\n'+data.url+'\n\nСсылка действует 30 минут и используется один раз.\nЕсли вы не запрашивали восстановление, проигнорируйте письмо. Ваш пароль не изменится.'};
 if(smtpConfigured(env)){const transport=createSMTPTransport(env);try{await transport.sendMail(message)}finally{transport.close()}return;}
 if(!env.RESEND_API_KEY||!env.AUTH_FROM_EMAIL)throw Error('Email configuration unavailable');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({...message,to:[data.email]}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Email delivery unavailable');
}
