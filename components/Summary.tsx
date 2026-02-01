
import React, { useState, useMemo } from 'react';
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
  const [filterDate, setFilterDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const getDisplayDistance = (km: number) => {
    return preferredUnit === DistanceUnit.KM ? km : kmToMiles(km);
  };

  // 使用與 History 相同的穩定過濾邏輯
  const currentTrips = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = new Date(trip.startTime);
      const parts = filterDate.split('-');
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      const d = parts[2] ? parseInt(parts[2]) : 1;

      if (filterMode === 'day') {
        return tripDate.getFullYear() === y && (tripDate.getMonth() + 1) === m && tripDate.getDate() === d;
      } else if (filterMode === 'month') {
        return tripDate.getFullYear() === y && (tripDate.getMonth() + 1) === m;
      } else {
        return tripDate.getFullYear() === y;
      }
    });
  }, [trips, filterDate, filterMode]);

  const stats = useMemo(() => {
    return currentTrips.reduce((acc, trip) => {
      if (trip.type === TripType.BUSINESS) {
        acc.businessDist += trip.distance;
        acc.businessCount += 1;
      } else {
        acc.privateDist += trip.distance;
        acc.privateCount += 1;
      }
      return acc;
    }, { businessDist: 0, privateDist: 0, businessCount: 0, privateCount: 0 });
  }, [currentTrips]);

  const totalDist = stats.businessDist + stats.privateDist;
  const totalCount = stats.businessCount + stats.privateCount;

  const pieData = [
    { name: '商業', value: stats.businessDist },
    { name: '私人', value: stats.privateDist },
  ];

  const exportCSV = () => {
    if (currentTrips.length === 0) {
      alert("目前選擇的範圍內沒有可導出的行程");
      return;
    }

    const headers = ["日期", "起點", "終點", `距離 (${preferredUnit === DistanceUnit.KM ? 'km' : 'mi'})`, "開始時間", "結束時間", "時長", "類別", "備註"];
    const rows = currentTrips.map(trip => [
      new Date(trip.startTime).toLocaleDateString(),
      trip.startLocation.address || `${trip.startLocation.latitude},${trip.startLocation.longitude}`,
      trip.endLocation.address || `${trip.endLocation.latitude},${trip.endLocation.longitude}`,
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
    link.href = url;
    link.download = `DriveLog_Export_${filterDate}.csv`;
    link.click();
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">數據摘要</h2>
          <p className="text-slate-500 text-sm">基於 {filterMode === 'day' ? '當日' : filterMode === 'month' ? '當月' : '當年'} 的行車統計</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['day', 'month', 'year'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded-md transition-all ${
                  filterMode === mode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
                }`}
              >
                {mode === 'day' ? '日' : mode === 'month' ? '月' : '年'}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            className="bg-slate-900 text-white font-bold py-2.5 px-5 rounded-xl text-sm shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            匯出 CSV
          </button>
        </div>
      </div>

      <div className="inline-block bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-2">
        <input
          type={filterMode === 'day' ? 'date' : filterMode === 'month' ? 'month' : 'number'}
          value={filterMode === 'year' ? filterDate.split('-')[0] : filterDate.slice(0, filterMode === 'month' ? 7 : 10)}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            if (filterMode === 'year') setFilterDate(`${val}-01-01`);
            else if (filterMode === 'month') setFilterDate(`${val}-01`);
            else setFilterDate(val);
          }}
          className="p-2 bg-transparent font-bold text-slate-700 outline-none"
        />
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
          <p className="text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-widest">商業里程比例</p>
          <p className="text-3xl font-black text-blue-600">{totalDist > 0 ? ((stats.businessDist / totalDist) * 100).toFixed(0) : 0}%</p>
        </div>
      </div>

      {totalCount > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 min-h-[400px]">
            <h3 className="text-lg font-bold text-slate-800 mb-8">距離比例 (商業 vs 私人)</h3>
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
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 min-h-[400px]">
            <h3 className="text-lg font-bold text-slate-800 mb-8">行程次數分布</h3>
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
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-20 text-center border border-slate-100 shadow-sm">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-slate-900 font-bold text-lg">此日期範圍內沒有行程</h3>
          <p className="text-slate-400 text-sm mt-2">請切換日期或開始一趟新的追蹤行程。</p>
        </div>
      )}
    </div>
  );
};

export default Summary;
