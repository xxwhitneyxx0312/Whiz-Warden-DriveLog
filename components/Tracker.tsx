
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

  useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_TRIP_KEY);
    if (saved) {
      try {
        const state: ActiveTripState = JSON.parse(saved);
        if (Date.now() - state.lastUpdated < 2 * 60 * 60 * 1000) {
          setStatus(state.status);
          setStartLoc(state.startLoc);
          setCurrentDistance(state.currentDistance);
          setPendingStartTime(state.pendingStartTime);
          setElapsedSeconds(state.elapsedSeconds + Math.floor((Date.now() - state.lastUpdated) / 1000));
          setIsManualStart(state.isManualStart);
          
          timerRef.current = window.setInterval(() => {
            setElapsedSeconds((s) => s + 1);
          }, 1000);
        }
      } catch (e) {
        localStorage.removeItem(ACTIVE_TRIP_KEY);
      }
    }

    startMonitoring();
    requestWakeLock();
    
    return () => {
      stopMonitoring();
    };
  }, []);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {}
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
      (err) => console.error(err),
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
    const result = await getAddressFromCoords(loc.latitude, loc.longitude);
    setStartLoc({ ...loc, address: result.address, mapsUrl: result.mapsUrl });
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
    const result = await getAddressFromCoords(loc.latitude, loc.longitude);
    setFinalEndLoc({ ...loc, address: result.address, mapsUrl: result.mapsUrl });
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
      id: generateId(),
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
      <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg border border-slate-700 flex items-start gap-4">
        <div className="bg-blue-500 p-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.483V4a2 2 0 012.724-1.857L11 5l6-3 5.447 2.724A2 2 0 0123 6.517V18a2 2 0 01-2.724 1.857L15 17l-6 3z" />
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-sm">配合 Waze 使用建議</h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            系統已開啟<b>「中斷自動恢復」</b>。若在導航時網頁被關閉，重新進入即可補回里程。
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
              {status === 'IDLE' ? '等待出發偵測中' : '記錄中...'}
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
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">時長</p>
              <p className="text-xl font-mono font-bold text-slate-700">{formatDuration(elapsedSeconds)}</p>
            </div>
          </div>

          {status === 'IDLE' ? (
            <button 
              onClick={handleForceStart}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              立即開始
            </button>
          ) : (
            <div className="w-full space-y-4">
              <button 
                onClick={() => handleAutoStop(lastLoc!)}
                className="w-full py-4 text-red-500 font-bold border-2 border-red-50 text-sm rounded-2xl hover:bg-red-50 transition-colors"
              >
                結束並結算
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">行程摘要</h2>
          
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">用途</label>
            <div className="flex gap-4">
              <button
                onClick={() => setTripType(TripType.BUSINESS)}
                className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                  tripType === TripType.BUSINESS ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400'
                }`}
              >
                💼 商業
              </button>
              <button
                onClick={() => setTripType(TripType.PRIVATE)}
                className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                  tripType === TripType.PRIVATE ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-100 text-slate-400'
                }`}
              >
                🏠 私人
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">備註</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-4 rounded-2xl border border-slate-100 text-sm bg-slate-50/50"
            />
          </div>

          <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-3">
            <div className="flex justify-between">
              <p className="text-xl font-black">{displayDistance.toFixed(2)} {preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}</p>
              <p className="text-xl font-mono font-bold text-blue-400">{formatDuration(elapsedSeconds)}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => { setShowSaveForm(false); resetTracker(); }} className="flex-1 text-slate-400 font-bold text-sm">捨棄</button>
            <button onClick={handleSave} className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl">儲存行程</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracker;
