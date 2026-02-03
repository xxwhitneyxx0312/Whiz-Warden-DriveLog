
import React from 'react';
import { DistanceUnit, UserSettings, AppTheme } from '../types';

interface SettingsProps {
  settings: UserSettings;
  onUpdate: (settings: UserSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">系統設定</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">個人化您的行車記錄偏好</p>
      </div>

      {/* 主題設定 */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.05 7.05l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
          顯示模式
        </label>
        <div className="flex gap-4">
          <button
            onClick={() => onUpdate({ ...settings, theme: AppTheme.LIGHT })}
            className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
              settings.theme === AppTheme.LIGHT
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                : 'border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600'
            }`}
          >
            日間模式
          </button>
          <button
            onClick={() => onUpdate({ ...settings, theme: AppTheme.DARK })}
            className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
              settings.theme === AppTheme.DARK
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                : 'border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600'
            }`}
          >
            夜間模式
          </button>
        </div>
      </div>

      {/* 單位設定 */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
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
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                : 'border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600'
            }`}
          >
            公里 (km)
          </button>
          <button
            onClick={() => onUpdate({ ...settings, preferredUnit: DistanceUnit.MILES })}
            className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
              settings.preferredUnit === DistanceUnit.MILES
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                : 'border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600'
            }`}
          >
            英里 (miles)
          </button>
        </div>
      </div>

      {/* 教學區 */}
      <div className="bg-slate-900 dark:bg-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-amber-400 p-2 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-bold">關於「背景記錄」提示</h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-400 leading-relaxed">
          由於瀏覽器限制，建議在車內接上電源並保持螢幕常亮，以獲得最精確的 GPS 追蹤效果。
        </p>
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
          className="w-full py-4 text-red-500 font-bold text-sm bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
        >
          清除所有本地數據
        </button>
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-4 font-medium uppercase tracking-widest">
          DriveLog v1.3.0 • Dark Mode Enabled
        </p>
      </div>
    </div>
  );
};

export default Settings;
