'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
export const firebaseApp = getApps()[0] || initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export async function login() {return signInWithPopup(auth,googleProvider);}
export async function logout() {return signOut(auth);}
export async function api(path:string, init:RequestInit = {}) {
  const user=auth.currentUser;
  if(!user) throw new Error('먼저 로그인해 주세요.');
  const token=await user.getIdToken();
  const response=await fetch(path,{
    ...init,
    headers:{...(init.body?{'Content-Type':'application/json'}:{}),...init.headers,Authorization:'Bearer '+token},
    cache:'no-store'
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'요청이 실패했습니다.');
  return body;
}
