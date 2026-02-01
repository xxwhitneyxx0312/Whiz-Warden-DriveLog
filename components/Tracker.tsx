
import React, { useState, useEffect, useRef } from 'react';
import { Trip, TripType, DistanceUnit, TripLocation } from '../types';
import { calculateDistance, formatDuration, kmToMiles } from '../utils/geo';
import { getAddressFromCoords } from '../services/geminiService';

const ACTIVE_TRIP_KEY = 'drive_log_active_trip_state';

interface TrackerProps {
  onSaveTrip: (trip: Trip) => void;
  preferredUnit: DistanceUnit;
}

type AutoStatus = 'IDLE' | 'MOVING' | 'STOPPED_WAITING';

interface ActiveTripState {
  status: AutoStatus;
  startLoc: TripLocation;
  currentDistance: number;
  pendingStartTime: number;
  elapsedSeconds: number;
  isManualStart: boolean;
  lastUpdated: number;
}

const Tracker: React.FC<TrackerProps> = ({ onSaveTrip, preferredUnit }) => {
  const [status, setStatus] = useState<AutoStatus>('IDLE');
  const [currentDistance, setCurrentDistance] = useState(0); 
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0); 
  
  const [startLoc, setStartLoc] = useState<TripLocation | null>(null);
  const [lastLoc, setLastLoc] = useState<TripLocation | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isManualStart, setIsManualStart] = useState(false);
  
  const [pendingStartTime, setPendingStartTime] = useState<number | null>(null);
  const [tripType, setTripType] = useState<TripType>(TripType.BUSINESS);
  const [notes, setNotes] = useState('');
  const [finalEndLoc, setFinalEndLoc] = useState<TripLocation | null>(null);

  const watchId = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const persistenceIntervalRef = useRef<number | null>(null);

  const START_SPEED_THRESHOLD = 8;
  const STOP_MINUTES_THRESHOLD = 2;
  const MIN_TRIP_DISTANCE = 0.2;

  // Persistence: Save state every 5 seconds
  useEffect(() => {
    if (status !== 'IDLE' && startLoc && pendingStartTime) {
      persistenceIntervalRef.current = window.setInterval(() => {
        const state: ActiveTripState = {
          status,
          startLoc,
          currentDistance,
          pendingStartTime,
          elapsedSeconds,
          isManualStart,
          lastUpdated: Date.now()
        };
        localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(state));
      }, 5000);
    } else {
      if (persistenceIntervalRef.current) clearInterval(persistenceIntervalRef.current);
      localStorage.removeItem(ACTIVE_TRIP_KEY);
    }
    return () => {
      if (persistenceIntervalRef.current) clearInterval(persistenceIntervalRef.current);
    };
  }, [status, startLoc, currentDistance, pendingStartTime, elapsedSeconds, isManualStart]);

  // Recovery: Check for orphaned trips on mount
  useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_TRIP_KEY);
    if (saved) {
      const state: ActiveTripState = JSON.parse(saved);
      // Only recover if the trip was active in the last 2 hours
      if (Date.now() - state.lastUpdated < 2 * 60 * 60 * 1000) {
        setStatus(state.status);
        setStartLoc(state.startLoc);
        setCurrentDistance(state.currentDistance);
        setPendingStartTime(state.pendingStartTime);
        setElapsedSeconds(state.elapsedSeconds + Math.floor((Date.now() - state.lastUpdated) / 1000));
        setIsManualStart(state.isManualStart);
        
        // Resume timer
        timerRef.current = window.setInterval(() => {
          setElapsedSeconds((s) => s + 1);
        }, 1000);
      } else {
        localStorage.removeItem(ACTIVE_TRIP_KEY);
      }
    }

    startMonitoring();
    requestWakeLock();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopMonitoring();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, []);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock unavailable');
    }
  };

  const startMonitoring = () => {
    if (!navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const newLoc = { latitude, longitude };
        const speedKmh = (speed || 0) * 3.6;
        setCurrentSpeed(speedKmh);

        if (status === 'IDLE') {
          if (speedKmh > START_SPEED_THRESHOLD) {
            handleStartTrip(newLoc);
          }
          setLastLoc(newLoc);
        } else {
          if (lastLoc) {
            const d = calculateDistance(lastLoc.latitude, lastLoc.longitude, latitude, longitude);
            if (d > 0.003) {
              setCurrentDistance((curr) => curr + d);
              setStatus('MOVING');
              if (stopTimeoutRef.current) {
                clearTimeout(stopTimeoutRef.current);
                stopTimeoutRef.current = null;
              }
            } else if (status === 'MOVING') {
              setStatus('STOPPED_WAITING');
              stopTimeoutRef.current = window.setTimeout(() => {
                handleAutoStop(newLoc);
              }, STOP_MINUTES_THRESHOLD * 60 * 1000);
            }
          }
          setLastLoc(newLoc);
        }
      },
      (err) => console.error('GPS:', err),
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const stopMonitoring = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (timerRef.current !== null) clearInterval(timerRef.current);
    if (stopTimeoutRef.current !== null) clearTimeout(stopTimeoutRef.current);
  };

  const handleStartTrip = async (loc: TripLocation) => {
    setStatus('MOVING');
    setPendingStartTime(Date.now());
    setCurrentDistance(0);
    setElapsedSeconds(0);
    const { address, mapsUrl } = await getAddressFromCoords(loc.latitude, loc.longitude);
    setStartLoc({ ...loc, address, mapsUrl });
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  };

  const handleForceStart = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      handleStartTrip(loc);
      setIsManualStart(true);
    });
  };

  const handleAutoStop = async (loc: TripLocation) => {
    if (currentDistance < MIN_TRIP_DISTANCE && !isManualStart) {
      resetTracker();
      return;
    }
    if (timerRef.current !== null) clearInterval(timerRef.current);
    const { address, mapsUrl } = await getAddressFromCoords(loc.latitude, loc.longitude);
    setFinalEndLoc({ ...loc, address, mapsUrl });
    setShowSaveForm(true);
  };

  const resetTracker = () => {
    setStatus('IDLE');
    setIsManualStart(false);
    setStartLoc(null);
    setCurrentDistance(0);
    setElapsedSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.removeItem(ACTIVE_TRIP_KEY);
  };

  const handleSave = () => {
    if (!pendingStartTime || !startLoc || !finalEndLoc) return;
    const newTrip: Trip = {
      id: crypto.randomUUID(),
      startTime: pendingStartTime,
      endTime: Date.now() - (status === 'STOPPED_WAITING' ? STOP_MINUTES_THRESHOLD * 60 * 1000 : 0),
      startLocation: startLoc,
      endLocation: finalEndLoc,
      distance: currentDistance,
      unit: preferredUnit,
      type: tripType,
      notes,
      durationSeconds: elapsedSeconds - (status === 'STOPPED_WAITING' ? STOP_MINUTES_THRESHOLD * 60 : 0),
    };
    onSaveTrip(newTrip);
    setShowSaveForm(false);
    resetTracker();
  };

  const displayDistance = preferredUnit === DistanceUnit.KM ? currentDistance : kmToMiles(currentDistance);

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-6">
      {/* Waze User Advice Card */}
      <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg border border-slate-700 flex items-start gap-4">
        <div className="bg-blue-500 p-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.483V4a2 2 0 012.724-1.857L11 5l6-3 5.447 2.724A2 2 0 0123 6.517V18a2 2 0 01-2.724 1.857L15 17l-6 3z" />
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-sm">配合 Waze 使用建議</h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            系統已開啟<b>「中斷自動恢復」</b>。若您在 Waze 導航時 App 被系統關閉，只需切換回本頁面即可自動補回里程。
            <br/><span className="text-blue-400 font-bold">最佳做法：</span>使用 Android 的「分割畫面」功能，同時開啟 Waze 與 DriveLog。
          </p>
        </div>
      </div>

      {!showSaveForm ? (
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className={`absolute -inset-4 rounded-full opacity-20 ${
              status === 'IDLE' ? 'bg-blue-400' : 'bg-green-400 animate-pulse'
            }`}></div>
            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center border-4 bg-white ${
              status === 'IDLE' ? 'border-blue-500 shadow-inner' : 'border-green-500 shadow-lg shadow-green-100'
            }`}>
              <span className="text-3xl">
                {status === 'IDLE' ? '📡' : '🚗'}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-slate-400 font-semibold mb-1 uppercase tracking-widest text-[10px]">
              {status === 'IDLE' ? '等待出發偵測中' : '行車資料正在同步記錄'}
            </h3>
            <div className="text-5xl font-black text-slate-900 tracking-tight">
              {displayDistance.toFixed(2)}
              <span className="text-xl ml-1 font-normal text-slate-500">
                {preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mb-8">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">目前時速</p>
              <p className="text-xl font-black text-slate-700">{Math.round(currentSpeed)} <span className="text-xs font-normal">km/h</span></p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">記錄時長</p>
              <p className="text-xl font-mono font-bold text-slate-700">{formatDuration(elapsedSeconds)}</p>
            </div>
          </div>

          {status === 'IDLE' ? (
            <button 
              onClick={handleForceStart}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              立即開始 (手動覆蓋)
            </button>
          ) : (
            <div className="w-full space-y-4">
              <div className="bg-green-50 text-green-700 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-green-100">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                動態記錄運作中
              </div>
              <button 
                onClick={() => handleAutoStop(lastLoc!)}
                className="w-full py-4 text-red-500 font-bold border-2 border-red-50 text-sm rounded-2xl hover:bg-red-50 transition-colors"
              >
                結束並結算行程
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-900">行程摘要</h2>
            <div className="bg-slate-100 p-1.5 rounded-lg flex gap-1">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Verified</span>
               <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">Log</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">選擇行程用途</label>
            <div className="flex gap-4">
              <button
                onClick={() => setTripType(TripType.BUSINESS)}
                className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                  tripType === TripType.BUSINESS
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-100 text-slate-400'
                }`}
              >
                💼 商業用途
              </button>
              <button
                onClick={() => setTripType(TripType.PRIVATE)}
                className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                  tripType === TripType.PRIVATE
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-100 text-slate-400'
                }`}
              >
                🏠 私人用途
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">行程備註</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="輸入地點、目的或客戶名稱..."
              className="w-full p-4 rounded-2xl border border-slate-100 focus:ring-4 focus:ring-blue-50 outline-none min-h-[80px] text-sm bg-slate-50/50"
            />
          </div>

          <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-bold">總里程</p>
                <p className="text-xl font-black">{displayDistance.toFixed(2)} {preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold">總時長</p>
                <p className="text-xl font-mono font-bold text-blue-400">{formatDuration(elapsedSeconds)}</p>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                  <p className="text-[11px] font-medium text-slate-300 truncate">起點: {startLoc?.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                  <p className="text-[11px] font-medium text-slate-300 truncate">終點: {finalEndLoc?.address}</p>
                </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => { setShowSaveForm(false); resetTracker(); }}
              className="flex-1 py-4 text-slate-400 font-bold hover:text-red-500 transition-colors text-sm"
            >
              不儲存行程
            </button>
            <button
              onClick={handleSave}
              className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
            >
              確認儲存行程
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracker;
