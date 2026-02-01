
import React, { useState, useMemo } from 'react';
import { Trip, DistanceUnit, TripType } from '../types.ts';
import { formatDuration, kmToMiles } from '../utils/geo.ts';

interface HistoryProps {
  trips: Trip[];
  preferredUnit: DistanceUnit;
  onDeleteTrip: (id: string) => void;
}

type ViewMode = 'day' | 'month' | 'year';

const History: React.FC<HistoryProps> = ({ trips, preferredUnit, onDeleteTrip }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = new Date(trip.startTime);
      const [y, m, d] = selectedDate.split('-').map(Number);

      if (viewMode === 'day') {
        return (
          tripDate.getFullYear() === y &&
          (tripDate.getMonth() + 1) === m &&
          tripDate.getDate() === d
        );
      } else if (viewMode === 'month') {
        return (
          tripDate.getFullYear() === y &&
          (tripDate.getMonth() + 1) === m
        );
      } else {
        return tripDate.getFullYear() === y;
      }
    }).sort((a, b) => b.startTime - a.startTime);
  }, [trips, selectedDate, viewMode]);

  const getDisplayDistance = (km: number) => {
    return preferredUnit === DistanceUnit.KM ? km : kmToMiles(km);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">行程記錄</h2>
        <div className="flex bg-slate-100 p-1 rounded-lg self-start">
          {(['day', 'month', 'year'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-md transition-all ${
                viewMode === mode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'
              }`}
            >
              {mode === 'day' ? '日' : mode === 'month' ? '月' : '年'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 inline-block">
        <input
          type={viewMode === 'day' ? 'date' : viewMode === 'month' ? 'month' : 'number'}
          value={viewMode === 'year' ? selectedDate.split('-')[0] : selectedDate.slice(0, viewMode === 'month' ? 7 : 10)}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            if (viewMode === 'year') {
              setSelectedDate(`${val}-01-01`);
            } else if (viewMode === 'month') {
              setSelectedDate(`${val}-01`);
            } else {
              setSelectedDate(val);
            }
          }}
          className="p-2 bg-transparent font-bold text-slate-700 outline-none"
        />
      </div>

      <div className="space-y-4">
        {filteredTrips.length === 0 ? (
          <div className="text-center py-24 text-slate-300 bg-white rounded-3xl border-2 border-dashed border-slate-50">
            <div className="mb-4 text-4xl">📭</div>
            <p className="text-sm font-medium">沒有找到行程記錄</p>
          </div>
        ) : (
          filteredTrips.map((trip) => (
            <div key={trip.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${trip.type === TripType.BUSINESS ? 'bg-blue-500' : 'bg-green-500'}`}></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                    trip.type === TripType.BUSINESS ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                  }`}>
                    {trip.type}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(trip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button 
                  onClick={() => onDeleteTrip(trip.id)}
                  className="text-slate-200 hover:text-red-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="flex justify-between items-end gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-1 w-2 h-2 rounded-full border-2 border-blue-500 shrink-0"></div>
                    <p className="text-xs text-slate-600 leading-tight line-clamp-2">{trip.startLocation.address}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="mt-1 w-2 h-2 rounded-full border-2 border-red-500 shrink-0"></div>
                    <p className="text-xs text-slate-600 leading-tight line-clamp-2">{trip.endLocation.address}</p>
                  </div>
                </div>
                
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-slate-900">
                    {getDisplayDistance(trip.distance).toFixed(1)} 
                    <span className="text-xs font-normal text-slate-400 ml-1">
                      {preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}
                    </span>
                  </p>
                  <p className="text-[10px] font-mono font-bold text-slate-400">{formatDuration(trip.durationSeconds)}</p>
                </div>
              </div>
              
              {trip.notes && (
                <div className="mt-3 pt-3 border-t border-slate-50">
                  <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                    {trip.notes}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default History;
