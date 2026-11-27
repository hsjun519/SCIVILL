import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = {
 title:'SCIVILL · 함께 만드는 다음 도전',
 description:'대회 탐색부터 팀원 모집, 프로젝트 협업까지, 싸이빌의 다음 도전을 연결합니다.',
 robots:{index:false,follow:false}
};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="ko"><body>{children}</body></html>;
}
