
import React from 'react';
import { DistanceUnit, UserSettings } from '../types';

interface SettingsProps {
  settings: UserSettings;
  onUpdate: (settings: UserSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">系統設定</h2>
        <p className="text-slate-500 text-sm">個人化您的行車記錄偏好</p>
      </div>

      {/* 單位設定 */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          距離計量單位
        </label>
        <div className="flex gap-4">
          <button
            onClick={() => onUpdate({ ...settings, preferredUnit: DistanceUnit.KM })}
            className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
              settings.preferredUnit === DistanceUnit.KM
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-100 text-slate-400'
            }`}
          >
            公里 (km)
          </button>
          <button
            onClick={() => onUpdate({ ...settings, preferredUnit: DistanceUnit.MILES })}
            className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
              settings.preferredUnit === DistanceUnit.MILES
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-100 text-slate-400'
            }`}
          >
            英里 (miles)
          </button>
        </div>
      </div>

      {/* 為什麼不是 Always Allow? 教學區 */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-400 p-2 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-bold">關於「始終允許」位置</h3>
        </div>
        
        <p className="text-xs text-slate-400 leading-relaxed">
          由於瀏覽器隱私安全限制，網頁版應用程式 (PWA) 無法直接獲取作業系統的「始終允許」權限。若要達到 100% 背景穩定記錄，通常需要將 App 打包上架至 App Store。
        </p>

        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">目前的優化建議：</h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-[11px]">
              <span className="text-amber-400">●</span>
              <span><b>iOS 用戶：</b> 請勿手動鎖屏。建議在車內接上電源，並讓本畫面保持在前台運行。</span>
            </li>
            <li className="flex items-start gap-2 text-[11px]">
              <span className="text-amber-400">●</span>
              <span><b>Android 用戶：</b> 在手機設定中找到瀏覽器，將「位置」設為「一律允許」，並關閉「電池優化」。</span>
            </li>
            <li className="flex items-start gap-2 text-[11px]">
              <span className="text-amber-400">●</span>
              <span><b>使用 Waze 時：</b> 建議使用「分割畫面」功能，確保 DriveLog 的網頁沒有被系統完全掛起。</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 資料管理 */}
      <div className="pt-4">
        <button 
          onClick={() => {
            if(confirm("確定要清除所有行程記錄嗎？這項操作無法復原。")) {
              localStorage.removeItem('drive_log_trips');
              window.location.reload();
            }
          }}
          className="w-full py-4 text-red-500 font-bold text-sm bg-red-50 rounded-2xl hover:bg-red-100 transition-colors"
        >
          清除所有本地數據
        </button>
        <p className="text-center text-[10px] text-slate-400 mt-4 font-medium uppercase tracking-widest">
          DriveLog v1.2.0 • Local Persistence Active
        </p>
      </div>
    </div>
  );
};

export default Settings;
