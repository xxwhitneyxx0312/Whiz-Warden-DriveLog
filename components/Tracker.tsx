
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
  
  // 地址獲取狀態
  const [isFetchingStartAddr, setIsFetchingStartAddr] = useState(false);
  const [isFetchingEndAddr, setIsFetchingEndAddr] = useState(false);

  const watchId = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'IDLE' && startLoc && startTimeStamp) {
      const state = { status, startLoc, currentDistance, startTimeStamp, isManualStart, lastUpdated: Date.now() };
      localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(ACTIVE_TRIP_KEY);
    }
  }, [status, startLoc, currentDistance, startTimeStamp, isManualStart]);

  useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_TRIP_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (Date.now() - state.lastUpdated < 4 * 60 * 60 * 1000) {
          setStatus(state.status);
          setStartLoc(state.startLoc);
          setCurrentDistance(state.currentDistance);
          setStartTimeStamp(state.startTimeStamp);
          setIsManualStart(state.isManualStart);
          setLastTrackedLoc(state.startLoc);
        }
      } catch (e) { localStorage.removeItem(ACTIVE_TRIP_KEY); }
    }
    startMonitoring();
    return () => stopMonitoring();
  }, []);

  useEffect(() => {
    if (startTimeStamp && !showSaveForm) {
      timerRef.current = window.setInterval(() => {
        setDisplaySeconds(Math.floor((Date.now() - startTimeStamp) / 1000));
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
            if (speedKmh > 5) {
              handleStartTrip(newLoc);
              return 'MOVING';
            }
            return 'IDLE';
          } else {
            setLastTrackedLoc(last => {
              if (last) {
                const dist = calculateDistance(last.latitude, last.longitude, latitude, longitude);
                if (dist > 0.001) { 
                  setCurrentDistance(curr => curr + dist);
                  return newLoc;
                }
                return last;
              }
              return newLoc;
            });

            if (speedKmh < 2) {
              if (!stopTimeoutRef.current) {
                stopTimeoutRef.current = window.setTimeout(() => {
                  handleAutoStop(newLoc);
                }, 120 * 1000);
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
    setIsFetchingStartAddr(true);

    getAddressFromCoords(loc.latitude, loc.longitude).then(res => {
      setStartLoc(prev => prev ? { ...prev, address: res.address, mapsUrl: res.mapsUrl } : null);
    }).finally(() => setIsFetchingStartAddr(false));
  };

  const handleForceStart = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      handleStartTrip({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setIsManualStart(true);
    });
  };

  const handleAutoStop = (loc: TripLocation) => {
    if (currentDistance < 0.02 && !isManualStart) {
      resetTracker();
      return;
    }
    setEndLoc(loc);
    setShowSaveForm(true);
    setIsFetchingEndAddr(true);
    getAddressFromCoords(loc.latitude, loc.longitude).then(res => {
      setEndLoc(prev => prev ? { ...prev, address: res.address, mapsUrl: res.mapsUrl } : null);
    }).finally(() => setIsFetchingEndAddr(false));
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
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-6 pb-24">
      <div className="bg-slate-900 dark:bg-slate-900 rounded-2xl p-4 text-white shadow-lg border border-slate-700 flex items-start gap-4">
        <div className="bg-blue-500 p-2 rounded-lg shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <h4 className="font-bold text-xs">智能監控模式</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">時速達 5km/h 自動記錄，靜止滿 2 分鐘或手動按鈕結算。</p>
        </div>
      </div>

      {!showSaveForm ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
          <div className="mb-6">
            <h3 className="text-slate-400 dark:text-slate-500 font-bold mb-1 uppercase tracking-widest text-[10px]">
              {status === 'IDLE' ? '📡 偵測中' : '🚗 記錄中'}
            </h3>
            <div className="text-6xl font-black text-slate-900 dark:text-white tracking-tight">
              {displayDistanceValue.toFixed(2)}
              <span className="text-xl ml-1 font-normal text-slate-400 dark:text-slate-500">{preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mb-8">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">速度</p>
              <p className="text-xl font-black text-slate-700 dark:text-slate-300">{Math.round(currentSpeed)} <span className="text-xs font-normal">km/h</span></p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">時長</p>
              <p className="text-xl font-mono font-bold text-slate-700 dark:text-slate-300">{formatDuration(displaySeconds)}</p>
            </div>
          </div>

          {status === 'IDLE' ? (
            <button onClick={handleForceStart} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all">立即開始行程</button>
          ) : (
            <button onClick={() => handleAutoStop(lastTrackedLoc || startLoc!)} className="w-full py-4 text-red-500 font-bold border-2 border-red-100 dark:border-red-900/30 rounded-2xl active:bg-red-50 dark:active:bg-red-900/10 transition-all">結束行程</button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">行程結算</h2>
          
          <div className="space-y-3">
            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">用途</label>
            <div className="flex gap-3">
              {(Object.values(TripType)).map(type => (
                <button key={type} onClick={() => setTripType(type)} className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${tripType === type ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600'}`}>{type === TripType.BUSINESS ? '💼 商業' : '🏠 私人'}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">備註</label>
            <input type="text" placeholder="輸入目的地或事由..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-sm bg-slate-50 dark:bg-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-950 outline-none transition-all" />
          </div>

          <div className="bg-slate-900 rounded-2xl p-5 text-white">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4">
              <div className="text-2xl font-black">{displayDistanceValue.toFixed(2)} <span className="text-xs font-normal opacity-60">{preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}</span></div>
              <div className="text-xl font-mono text-blue-400">{formatDuration(displaySeconds)}</div>
            </div>
            <div className="space-y-3 text-[11px]">
               <div className="flex gap-3">
                 <span className="text-blue-500 font-black shrink-0">起點</span>
                 <span className={`${isFetchingStartAddr ? 'animate-pulse text-slate-500' : 'text-slate-300'} break-all`}>
                   {isFetchingStartAddr ? '正在查詢地圖...' : (startLoc?.address || '計算中...')}
                 </span>
               </div>
               <div className="flex gap-3">
                 <span className="text-red-500 font-black shrink-0">終點</span>
                 <span className={`${isFetchingEndAddr ? 'animate-pulse text-slate-500' : 'text-slate-300'} break-all`}>
                   {isFetchingEndAddr ? '正在獲取精確位置...' : (endLoc?.address || lastTrackedLoc?.address || '計算中...')}
                 </span>
               </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => { setShowSaveForm(false); resetTracker(); }} className="flex-1 text-slate-400 dark:text-slate-500 font-bold text-sm">捨棄</button>
            <button onClick={handleSave} className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all">儲存行程</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracker;
