import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'SSoundCheck — ваша история станет песней',description:'Тексты за 500 ₽, песня на ваш текст за 1 500 ₽, песня с нуля за 3 500 ₽. Музыка с помощью ИИ и вниманием к вашей идее.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}