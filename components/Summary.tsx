
import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Trip, DistanceUnit, TripType } from '../types.ts';
import { kmToMiles, formatDuration } from '../utils/geo.ts';

interface SummaryProps {
  trips: Trip[];
  preferredUnit: DistanceUnit;
}

type FilterMode = 'day' | 'month' | 'year';

const COLORS = ['#3b82f6', '#10b981'];

const Summary: React.FC<SummaryProps> = ({ trips, preferredUnit }) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const getDisplayDistance = (km: number) => {
    return preferredUnit === DistanceUnit.KM ? km : kmToMiles(km);
  };

  const currentTrips = trips.filter((trip) => {
    const tripDate = new Date(trip.startTime);
    const date = new Date(filterDate);
    if (filterMode === 'day') return tripDate.toDateString() === date.toDateString();
    if (filterMode === 'month') return tripDate.getMonth() === date.getMonth() && tripDate.getFullYear() === date.getFullYear();
    return tripDate.getFullYear() === date.getFullYear();
  });

  const stats = currentTrips.reduce((acc, trip) => {
    if (trip.type === TripType.BUSINESS) {
      acc.businessDist += trip.distance;
      acc.businessCount += 1;
    } else {
      acc.privateDist += trip.distance;
      acc.privateCount += 1;
    }
    return acc;
  }, { businessDist: 0, privateDist: 0, businessCount: 0, privateCount: 0 });

  const totalDist = stats.businessDist + stats.privateDist;
  const totalCount = stats.businessCount + stats.privateCount;

  const pieData = [
    { name: '商業', value: stats.businessDist },
    { name: '私人', value: stats.privateDist },
  ];

  const exportCSV = () => {
    if (currentTrips.length === 0) {
      alert("沒有可導出的行程");
      return;
    }

    const headers = ["日期", "起點", "終點", `距離 (${preferredUnit === DistanceUnit.KM ? 'km' : 'mi'})`, "開始時間", "結束時間", "行車時長", "類別", "備註"];
    const rows = currentTrips.map(trip => [
      new Date(trip.startTime).toLocaleDateString(),
      trip.startLocation.address || trip.startLocation.latitude + ',' + trip.startLocation.longitude,
      trip.endLocation.address || trip.endLocation.latitude + ',' + trip.endLocation.longitude,
      getDisplayDistance(trip.distance).toFixed(2),
      new Date(trip.startTime).toLocaleTimeString(),
      new Date(trip.endTime).toLocaleTimeString(),
      formatDuration(trip.durationSeconds),
      trip.type,
      trip.notes
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `DriveLog_${filterDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">數據摘要</h2>
          <p className="text-slate-500">回顧歷史數據與比例</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['day', 'month', 'year'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  filterMode === mode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
                }`}
              >
                {mode === 'day' ? '日' : mode === 'month' ? '月' : '年'}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            導出 CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-widest">總行車距離</p>
          <p className="text-3xl font-black text-slate-900">
            {getDisplayDistance(totalDist).toFixed(1)} 
            <span className="text-sm font-normal text-slate-400 ml-1">{preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}</span>
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-widest">總行程次數</p>
          <p className="text-3xl font-black text-slate-900">{totalCount} <span className="text-sm font-normal text-slate-400 ml-1">次</span></p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-widest">商業佔比</p>
          <p className="text-3xl font-black text-blue-600">{totalDist > 0 ? ((stats.businessDist / totalDist) * 100).toFixed(0) : 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 min-h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-8">用途比例 (按距離)</h3>
          {totalDist > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">
                    {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${getDisplayDistance(value).toFixed(2)} ${preferredUnit === DistanceUnit.KM ? 'km' : 'mi'}`} />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 italic">暫無數據</div>
          )}
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 min-h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-8">用途比例 (按次數)</h3>
          {totalCount > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: '商業', count: stats.businessCount }, { name: '私人', count: stats.privateCount }]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="count" radius={[12, 12, 0, 0]}>
                    <Cell fill={COLORS[0]} />
                    <Cell fill={COLORS[1]} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 italic">暫無數據</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Summary;
