// 設定：視点・自動ポーズ・ジョスト入力補助・カットイン短縮をまとめて localStorage に保存する。プレイ中も変更でき、applyConfig で戦闘へ即時反映する。
export const PAUSE_MODES={events:'戦況の変化のたびにポーズ',none:'自動ポーズなし'};
export const DEFAULTS={view:'rear',pauseMode:'events',autoTiming:false,shortCutin:false,sound:true,volume:.7};
const KEY='minnezang-config',OLD_VIEW_KEY='minnezang-view';
export function loadConfig(){let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{};if(!saved.view)saved.view=localStorage.getItem(OLD_VIEW_KEY)||undefined}catch{saved={}}const c={...DEFAULTS};for(const k in DEFAULTS)if(typeof saved[k]===typeof DEFAULTS[k])c[k]=saved[k];if(!PAUSE_MODES[c.pauseMode])c.pauseMode=DEFAULTS.pauseMode;c.volume=Math.min(1,Math.max(0,c.volume));return c}
export function saveConfig(c){try{localStorage.setItem(KEY,JSON.stringify(c));return true}catch{return false}}
export function applyConfig(b,c){b.autoPause=c.pauseMode!=='none';b.autoTiming=c.autoTiming;b.shortCutin=c.shortCutin;return b}
