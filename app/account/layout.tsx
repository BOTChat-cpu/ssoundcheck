import type {Metadata} from 'next';
import './account.css';
export const metadata:Metadata={title:'Личный кабинет — SSoundCheck',robots:{index:false,follow:false}};
export default function AccountLayout({children}:{children:React.ReactNode}){return children;}
