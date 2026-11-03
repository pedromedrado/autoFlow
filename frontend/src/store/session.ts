import {create} from 'zustand';export const useUi=create<{mobileOpen:boolean;toggle:()=>void}>(set=>({mobileOpen:false,toggle:()=>set(s=>({mobileOpen:!s.mobileOpen}))}));
