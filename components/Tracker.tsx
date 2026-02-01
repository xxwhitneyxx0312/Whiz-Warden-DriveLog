
import React, { useState, useEffect, useRef } from 'react';
import { Trip, TripType, DistanceUnit, TripLocation } from '../types.ts';
import { calculateDistance, formatDuration, kmToMiles } from '../utils/geo.ts';
import { getAddressFromCoords } from '../services/geminiService.ts';

const ACTIVE_TRIP_KEY = 'drive_log_active_trip_state';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

interface TrackerProps {
  onSaveTrip: (trip: Trip) => void;
  preferredUnit: DistanceUnit;
}

type AutoStatus = 'IDLE' | 'MOVING' | 'STOPPED_WAITING';

interface ActiveTripState {
  status: AutoStatus;
  startLoc: TripLocation;
  currentDistance: number;
  startTimeStamp: number;
  isManualStart: boolean;
  lastUpdated: number;
}

const Tracker: React.FC<TrackerProps> = ({ onSaveTrip, preferredUnit }) => {
  const [status, setStatus] = useState<AutoStatus>('IDLE');
  const [currentDistance, setCurrentDistance] = useState(0); 
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0); 
  
  const [startLoc, setStartLoc] = useState<TripLocation | null>(null);
  const [lastTrackedLoc, setLastTrackedLoc] = useState<TripLocation | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isManualStart, setIsManualStart] = useState(false);
  
  const [startTimeStamp, setStartTimeStamp] = useState<number | null>(null);
  const [tripType, setTripType] = useState<TripType>(TripType.BUSINESS);
  const [notes, setNotes] = useState('');
  const [endLoc, setEndLoc] = useState<TripLocation | null>(null);

  const watchId = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);

  // 1. 持久化處理
  useEffect(() => {
    if (status !== 'IDLE' && startLoc && startTimeStamp) {
      const state: ActiveTripState = {
        status,
        startLoc,
        currentDistance,
        startTimeStamp,
        isManualStart,
        lastUpdated: Date.now()
      };
      localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(ACTIVE_TRIP_KEY);
    }
  }, [status, startLoc, currentDistance, startTimeStamp, isManualStart]);

  // 2. 初始化與恢復
  useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_TRIP_KEY);
    if (saved) {
      try {
        const state: ActiveTripState = JSON.parse(saved);
        if (Date.now() - state.lastUpdated < 4 * 60 * 60 * 1000) {
          setStatus(state.status);
          setStartLoc(state.startLoc);
          setCurrentDistance(state.currentDistance);
          setStartTimeStamp(state.startTimeStamp);
          setIsManualStart(state.isManualStart);
          setLastTrackedLoc(state.startLoc);
        }
      } catch (e) {
        localStorage.removeItem(ACTIVE_TRIP_KEY);
      }
    }
    startMonitoring();
    return () => stopMonitoring();
  }, []);

  // 3. 穩定計時器 (基於絕對時間)
  useEffect(() => {
    if (startTimeStamp && !showSaveForm) {
      timerRef.current = window.setInterval(() => {
        const diff = Math.floor((Date.now() - startTimeStamp) / 1000);
        setDisplaySeconds(diff);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimeStamp, showSaveForm]);

  const startMonitoring = () => {
    if (!navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const speedKmh = (speed || 0) * 3.6;
        setCurrentSpeed(speedKmh);
        const newLoc = { latitude, longitude };

        setStatus(prev => {
          if (prev === 'IDLE') {
            // 用戶要求：超過 5km/h 開始記錄
            if (speedKmh > 5) {
              handleStartTrip(newLoc);
              return 'MOVING';
            }
            return 'IDLE';
          } else {
            // 處理里程累積
            setLastTrackedLoc(last => {
              if (last) {
                const dist = calculateDistance(last.latitude, last.longitude, latitude, longitude);
                // 過濾 GPS 抖動 (位移需大於 5 米才計算，防止紅燈停下時座標跳動增加里程)
                if (dist > 0.005) {
                  setCurrentDistance(curr => curr + dist);
                  return newLoc;
                }
                return last;
              }
              return newLoc;
            });

            // 處理自動停止 (2 分鐘怠速)
            if (speedKmh < 2) {
              if (!stopTimeoutRef.current) {
                stopTimeoutRef.current = window.setTimeout(() => {
                  handleAutoStop(newLoc);
                }, 2 * 60 * 1000); // 2 分鐘
              }
              return 'STOPPED_WAITING';
            } else {
              if (stopTimeoutRef.current) {
                clearTimeout(stopTimeoutRef.current);
                stopTimeoutRef.current = null;
              }
              return 'MOVING';
            }
          }
        });
      },
      (err) => console.error("GPS Watch Error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  const stopMonitoring = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (timerRef.current !== null) clearInterval(timerRef.current);
    if (stopTimeoutRef.current !== null) clearTimeout(stopTimeoutRef.current);
  };

  const handleStartTrip = (loc: TripLocation) => {
    const now = Date.now();
    setStartTimeStamp(now);
    setCurrentDistance(0);
    setDisplaySeconds(0);
    setStartLoc(loc);
    setLastTrackedLoc(loc);
    setStatus('MOVING');

    // 異步獲取地址，不阻塞
    getAddressFromCoords(loc.latitude, loc.longitude).then(res => {
      setStartLoc(prev => prev ? { ...prev, address: res.address, mapsUrl: res.mapsUrl } : null);
    });
  };

  const handleForceStart = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      handleStartTrip(loc);
      setIsManualStart(true);
    });
  };

  const handleAutoStop = (loc: TripLocation) => {
    // 停車滿兩分鐘或手動按結束
    if (currentDistance < 0.05 && !isManualStart) {
      resetTracker();
      return;
    }
    setEndLoc(loc);
    setShowSaveForm(true);
    getAddressFromCoords(loc.latitude, loc.longitude).then(res => {
      setEndLoc(prev => prev ? { ...prev, address: res.address, mapsUrl: res.mapsUrl } : null);
    });
  };

  const resetTracker = () => {
    setStatus('IDLE');
    setIsManualStart(false);
    setStartLoc(null);
    setEndLoc(null);
    setCurrentDistance(0);
    setDisplaySeconds(0);
    setStartTimeStamp(null);
    localStorage.removeItem(ACTIVE_TRIP_KEY);
  };

  const handleSave = () => {
    if (!startTimeStamp || !startLoc) return;
    
    // 獲取最後一個位置作為終點 (如果 endLoc 還沒透過自動停止抓到)
    const finalEndLoc = endLoc || lastTrackedLoc || startLoc;

    const newTrip: Trip = {
      id: generateId(),
      startTime: startTimeStamp,
      endTime: Date.now(),
      startLocation: {
        ...startLoc,
        address: startLoc.address || `座標: ${startLoc.latitude.toFixed(4)}, ${startLoc.longitude.toFixed(4)}`
      },
      endLocation: {
        ...finalEndLoc,
        address: finalEndLoc.address || `座標: ${finalEndLoc.latitude.toFixed(4)}, ${finalEndLoc.longitude.toFixed(4)}`
      },
      distance: currentDistance,
      unit: preferredUnit,
      type: tripType,
      notes,
      durationSeconds: displaySeconds,
    };
    
    onSaveTrip(newTrip);
    setShowSaveForm(false);
    resetTracker();
  };

  const displayDistanceValue = preferredUnit === DistanceUnit.KM ? currentDistance : kmToMiles(currentDistance);

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-6">
      {/* 頂部導引 */}
      <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg border border-slate-700 flex items-start gap-4">
        <div className="bg-blue-500 p-2 rounded-lg shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-xs">加拿大行車優化模式</h4>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
            系統已開啟「中斷自動恢復」。時速達 5km/h 自動記錄，停等紅燈不會結束，靜止滿 2 分鐘才會自動結算。
          </p>
        </div>
      </div>

      {!showSaveForm ? (
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className={`absolute -inset-4 rounded-full opacity-10 transition-all duration-1000 ${
              status === 'IDLE' ? 'bg-blue-400 scale-90' : 'bg-green-400 animate-pulse scale-110'
            }`}></div>
            <div className={`relative w-28 h-28 rounded-full flex items-center justify-center border-4 transition-all duration-500 bg-white ${
              status === 'IDLE' ? 'border-blue-100 shadow-inner' : 'border-green-500 shadow-xl shadow-green-100'
            }`}>
              <span className="text-4xl">{status === 'IDLE' ? '📡' : '🚗'}</span>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-slate-400 font-bold mb-1 uppercase tracking-widest text-[10px]">
              {status === 'IDLE' ? '等待出發' : '記錄中...'}
            </h3>
            <div className="text-6xl font-black text-slate-900 tracking-tight">
              {displayDistanceValue.toFixed(2)}
              <span className="text-xl ml-1 font-normal text-slate-400">
                {preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mb-8">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">目前時速</p>
              <p className="text-xl font-black text-slate-700">{Math.round(currentSpeed)} <span className="text-xs font-normal text-slate-400">km/h</span></p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">時長</p>
              <p className="text-xl font-mono font-bold text-slate-700">{formatDuration(displaySeconds)}</p>
            </div>
          </div>

          {status === 'IDLE' ? (
            <button 
              onClick={handleForceStart}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 transition-all active:scale-95"
            >
              立即開始行程
            </button>
          ) : (
            <button 
              onClick={() => handleAutoStop(lastTrackedLoc || startLoc!)}
              className="w-full py-4 text-red-500 font-bold border-2 border-red-100 rounded-2xl hover:bg-red-50 transition-colors"
            >
              結束並結算
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-6 animate-in fade-in zoom-in duration-300">
          <h2 className="text-2xl font-bold text-slate-900">行程摘要</h2>
          
          <div className="space-y-3">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">用途</label>
            <div className="flex gap-3">
              {(Object.values(TripType)).map(type => (
                <button
                  key={type}
                  onClick={() => setTripType(type)}
                  className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${
                    tripType === type ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400'
                  }`}
                >
                  {type === TripType.BUSINESS ? '💼 商業' : '🏠 私人'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">備註</label>
            <input
              type="text"
              placeholder="輸入地點或目的..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-100 text-sm bg-slate-50 focus:bg-white outline-none transition-all"
            />
          </div>

          <div className="bg-slate-900 rounded-2xl p-5 text-white">
            <div className="flex justify-between items-end mb-4">
              <div className="text-2xl font-black">{displayDistanceValue.toFixed(2)} <span className="text-xs font-normal opacity-60">{preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}</span></div>
              <div className="text-xl font-mono text-blue-400">{formatDuration(displaySeconds)}</div>
            </div>
            <div className="space-y-2 border-t border-slate-800 pt-4 text-[11px] text-slate-400">
               <div className="flex gap-2">
                 <span className="text-blue-500 font-bold">起</span>
                 <span className="truncate">{startLoc?.address || '獲取位置中...'}</span>
               </div>
               <div className="flex gap-2">
                 <span className="text-red-500 font-bold">終</span>
                 <span className="truncate">{endLoc?.address || lastTrackedLoc?.address || '計算中...'}</span>
               </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => { setShowSaveForm(false); resetTracker(); }} className="flex-1 text-slate-400 font-bold text-sm">捨棄</button>
            <button onClick={handleSave} className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all">儲存行程</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracker;
