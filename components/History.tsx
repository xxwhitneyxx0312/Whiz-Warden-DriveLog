
import React, { useState } from 'react';
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredTrips = trips.filter((trip) => {
    const tripDate = new Date(trip.startTime);
    const filterDate = new Date(selectedDate);

    if (viewMode === 'day') {
      return tripDate.toDateString() === filterDate.toDateString();
    } else if (viewMode === 'month') {
      return (
        tripDate.getMonth() === filterDate.getMonth() &&
        tripDate.getFullYear() === filterDate.getFullYear()
      );
    } else {
      return tripDate.getFullYear() === filterDate.getFullYear();
    }
  }).sort((a, b) => b.startTime - a.startTime);

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
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === mode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
              }`}
            >
              {mode === 'day' ? '日' : mode === 'month' ? '月' : '年'}
            </button>
          ))}
        </div>
      </div>

      <input
        type={viewMode === 'day' ? 'date' : viewMode === 'month' ? 'month' : 'number'}
        value={viewMode === 'year' ? new Date(selectedDate).getFullYear() : selectedDate.slice(0, viewMode === 'month' ? 7 : 10)}
        onChange={(e) => {
          if (viewMode === 'year') {
            const date = new Date(selectedDate);
            date.setFullYear(parseInt(e.target.value) || new Date().getFullYear());
            setSelectedDate(date.toISOString().split('T')[0]);
          } else {
            setSelectedDate(e.target.value + (viewMode === 'month' ? '-01' : ''));
          }
        }}
        className="w-full sm:w-auto p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="space-y-4">
        {filteredTrips.length === 0 ? (
          <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
            <p>沒有找到行程記錄</p>
          </div>
        ) : (
          filteredTrips.map((trip) => (
            <div key={trip.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    trip.type === TripType.BUSINESS ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {trip.type}
                  </span>
                  <span className="text-sm text-slate-400">
                    {new Date(trip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button 
                  onClick={() => onDeleteTrip(trip.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors sm:opacity-0 group-hover:opacity-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                    <div className="flex items-center gap-1 min-w-0">
                      <p className="text-sm text-slate-600 font-medium truncate">{trip.startLocation.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                    <div className="flex items-center gap-1 min-w-0">
                      <p className="text-sm text-slate-600 font-medium truncate">{trip.endLocation.address}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-2xl font-bold text-slate-800">
                    {getDisplayDistance(trip.distance).toFixed(1)} 
                    <span className="text-sm font-normal text-slate-400 ml-1">
                      {preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">{formatDuration(trip.durationSeconds)}</p>
                </div>
              </div>
              
              {trip.notes && (
                <p className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                  備註: {trip.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default History;
