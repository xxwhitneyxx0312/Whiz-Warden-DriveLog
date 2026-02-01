
import React, { useState, useEffect } from 'react';
import Tracker from './components/Tracker.tsx';
import History from './components/History.tsx';
import Summary from './components/Summary.tsx';
import Settings from './components/Settings.tsx';
import { Trip, DistanceUnit, UserSettings } from './types.ts';

const STORAGE_KEY = 'drive_log_trips';
const SETTINGS_KEY = 'drive_log_settings';

const App: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    preferredUnit: DistanceUnit.KM,
  });
  const [activeTab, setActiveTab] = useState<'track' | 'history' | 'summary' | 'settings'>('track');

  useEffect(() => {
    const savedTrips = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    
    if (savedTrips) {
      try {
        setTrips(JSON.parse(savedTrips));
      } catch (e) {
        console.error("Failed to parse trips", e);
      }
    }
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const handleSaveTrip = (trip: Trip) => {
    const updatedTrips = [trip, ...trips];
    setTrips(updatedTrips);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTrips));
    setActiveTab('history');
  };

  const handleDeleteTrip = (id: string) => {
    if (confirm("確定要刪除此行程嗎？")) {
      const updatedTrips = trips.filter(t => t.id !== id);
      setTrips(updatedTrips);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTrips));
    }
  };

  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  return (
    <div className="min-h-screen pb-24 flex flex-col">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black text-blue-600 tracking-tight">DRIVE<span className="text-slate-900">LOG</span></h1>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">
            My Driving Tracker
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {activeTab === 'track' && (
          <Tracker onSaveTrip={handleSaveTrip} preferredUnit={settings.preferredUnit} />
        )}
        {activeTab === 'history' && (
          <History trips={trips} preferredUnit={settings.preferredUnit} onDeleteTrip={handleDeleteTrip} />
        )}
        {activeTab === 'summary' && (
          <Summary trips={trips} preferredUnit={settings.preferredUnit} />
        )}
        {activeTab === 'settings' && (
          <Settings settings={settings} onUpdate={handleUpdateSettings} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 flex justify-around items-center p-2 pb-6 shadow-2xl">
        <NavItem 
          active={activeTab === 'track'} 
          onClick={() => setActiveTab('track')}
          label="追蹤"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <NavItem 
          active={activeTab === 'history'} 
          onClick={() => setActiveTab('history')}
          label="記錄"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <NavItem 
          active={activeTab === 'summary'} 
          onClick={() => setActiveTab('summary')}
          label="摘要"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
        <NavItem 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')}
          label="設定"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
      </nav>
    </div>
  );
};

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ active, onClick, label, icon }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center p-2 rounded-xl transition-all ${
      active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    <div className={`p-2 rounded-xl mb-1 ${active ? 'bg-blue-50' : 'bg-transparent'}`}>
      {icon}
    </div>
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

export default App;
