
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, getDocs, deleteDoc, updateDoc, doc, serverTimestamp, Timestamp, where, limit } from 'firebase/firestore';
import { db } from '../firebase-init';
import { User, KmEntry } from '../types';
import { Car, PlusCircle, Trash2, Edit3, Gauge, Fuel, Info, ChevronRight, TrendingUp, History, X } from 'lucide-react';
import { translations, Language } from '../utils/translations';

interface MileageProps {
  user: User | null;
  lang: Language;
}

const Mileage: React.FC<MileageProps> = ({ user, lang }) => {
  const t = translations[lang].mileage;
  const [kms, setKms] = useState<KmEntry[]>([]);
  const [lastOdometer, setLastOdometer] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    km: '',
    type: 'empresa',
    fuelPrice: '',
    consumption: '6.0',
    notes: '',
  });
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchKms();
  }, [user, month]);

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    setMonth(date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'));
  };

  const fetchKms = async () => {
    const [y, m] = month.split('-').map(Number);
    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 1);

    if (user) {
      try {
        // 1. Fetch filtered KMs for the list/stats
        const q = query(
          collection(db, `users/${user.uid}/kms`),
          where('date', '>=', Timestamp.fromDate(startOfMonth)),
          where('date', '<', Timestamp.fromDate(endOfMonth)),
          orderBy('date', 'desc')
        );
        const snap = await getDocs(q);
        const list: KmEntry[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({ ...data, id: docSnap.id, dateJs: (data.date as Timestamp).toDate() } as KmEntry);
        });
        setKms(list);

        // 2. Fetch absolutely LATEST entry for odometer (ignoring month)
        const qLatest = query(
          collection(db, `users/${user.uid}/kms`),
          orderBy('date', 'desc'),
          limit(1)
        );
        const latestSnap = await getDocs(qLatest);
        if (!latestSnap.empty) {
          const latestData = latestSnap.docs[0].data();
          setLastOdometer(Number(latestData.totalKm) || 0);
        } else {
          setLastOdometer(0);
        }
      } catch (err) {
        console.error("Error fetching kms:", err);
      }
    } else {
      const local = JSON.parse(localStorage.getItem('kms_local') || '[]');
      const filtered = local
        .filter((k: any) => {
          const d = new Date(k.date);
          return d >= startOfMonth && d < endOfMonth;
        })
        .reverse()
        .map((e: any) => ({ ...e, dateJs: new Date(e.date) }));
      setKms(filtered);

      const absoluteLatest = [...local].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      setLastOdometer(absoluteLatest ? Number(absoluteLatest.totalKm) : 0);
    }
  };

  const updateOdometer = (list: KmEntry[]) => {
    let last: number | null = null;
    list.forEach(e => {
      if (e.totalKm) last = Number(e.totalKm);
    });
    setLastOdometer(last);
  };

  const [editingKm, setEditingKm] = useState<KmEntry | null>(null);

  const saveKm = async () => {
    const distance = Number(formData.km);
    if (!distance || distance <= 0) return alert('KM?');

    const totalKm = lastOdometer !== null ? lastOdometer + distance : distance;
    const entry = {
      ...formData,
      km: distance,
      totalKm,
      fuelPrice: formData.fuelPrice ? Number(formData.fuelPrice) : null,
      consumption: Number(formData.consumption) || 6.0,
    };

    setStatus('...');
    try {
      if (user) {
        await addDoc(collection(db, `users/${user.uid}/kms`), {
          ...entry,
          date: new Date(formData.date),
          createdAt: serverTimestamp()
        });
      } else {
        const local = JSON.parse(localStorage.getItem('kms_local') || '[]');
        local.push(entry);
        localStorage.setItem('kms_local', JSON.stringify(local));
      }
      setFormData({ ...formData, km: '', notes: '' });
      setStatus('OK ✅');
      fetchKms();
    } catch (e) {
      setStatus('ERR');
    }
  };

  const updateKmEntry = async () => {
    if (!editingKm) return;
    try {
      const updatedData = {
        date: new Date(editingKm.dateJs || editingKm.date),
        type: editingKm.type,
        km: Number(editingKm.km || editingKm.distance),
        fuelPrice: editingKm.fuelPrice ? Number(editingKm.fuelPrice) : null,
        consumption: Number(editingKm.consumption) || 6.0,
        notes: editingKm.notes || ''
      };

      if (user && editingKm.id) {
        await updateDoc(doc(db, `users/${user.uid}/kms`, editingKm.id), updatedData);
      } else {
        const local = JSON.parse(localStorage.getItem('kms_local') || '[]');
        // Minimal local update logic: find by old props or just simplistic approach (local is fallback)
        // For simplicity in this demo, local editing might be limited or we match by index if we had it.
        // Assuming user is mostly online/auth. 
        // We'll skip complex local ID matching for now to prioritize online.
      }
      setEditingKm(null);
      fetchKms();
    } catch (e) {
      console.error(e);
      alert('Error updating');
    }
  };

  const deleteKm = async (item: KmEntry) => {
    if (!confirm('?')) return;
    try {
      if (user && item.id) {
        await deleteDoc(doc(db, `users/${user.uid}/kms`, item.id));
      } else {
        const local = JSON.parse(localStorage.getItem('kms_local') || '[]');
        const filtered = local.filter((l: any) => l.date !== item.date || l.km !== item.km);
        localStorage.setItem('kms_local', JSON.stringify(filtered));
      }
      fetchKms();
    } catch (e) {
      alert('Error');
    }
  };

  const calculatedOdometer = formData.km ? (lastOdometer || 0) + Number(formData.km) : (lastOdometer || 0);

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
      {/* FORM SECTION */}
      <div className="lg:col-span-5 space-y-6">
        <section className="premium-card p-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <PlusCircle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">{t.formTitle}</h2>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t.title}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="input-premium font-bold text-sm py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.distance}</label>
                <input
                  type="number"
                  placeholder="0.0"
                  value={formData.km}
                  onChange={e => setFormData({ ...formData, km: e.target.value })}
                  className="input-premium font-black text-base text-blue-600 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.type}</label>
                <div className="relative">
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="input-premium font-bold appearance-none text-sm py-2"
                  >
                    <option value="empresa">{t.company}</option>
                    <option value="personal">{t.personal}</option>
                  </select>
                  <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.fuel}</label>
                <div className="relative">
                  <Fuel size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1.65"
                    value={formData.fuelPrice}
                    onChange={e => setFormData({ ...formData, fuelPrice: e.target.value })}
                    className="input-premium pl-9 font-bold text-sm py-2"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.consumption}</label>
                <div className="relative">
                  <TrendingUp size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.1"
                    value={formData.consumption}
                    onChange={e => setFormData({ ...formData, consumption: e.target.value })}
                    className="input-premium pl-9 font-bold text-sm py-2"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.history}</label>
                <textarea
                  rows={1}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="input-premium resize-none text-sm py-2"
                ></textarea>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden shadow-xl border-b-4 border-blue-600">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Gauge size={60} />
              </div>
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">{t.odometer}</div>
                  <div className="text-2xl font-black tabular-nums">{calculatedOdometer.toLocaleString()} <span className="text-[10px] font-medium opacity-40">km</span></div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <TrendingUp size={16} className="text-blue-400" />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={saveKm}
                className="btn-premium btn-premium-primary w-full py-3 text-base h-12"
              >
                <span>{t.save}</span>
                <ChevronRight size={18} />
              </button>
              <div className="text-center h-4 text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">{status}</div>
            </div>
          </div>
        </section>

        {/* SUMMARY CARD */}
        <section className="bg-slate-800 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden group">
          <Car size={80} className="absolute -right-4 -bottom-4 text-white/5 transform group-hover:-rotate-12 transition-transform duration-700" />
          <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Info size={10} className="text-blue-400" />
            {t.statsTitle}
          </h3>
          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-end border-b border-white/5 pb-3">
              <div>
                <span className="text-slate-400 text-[10px] font-bold block mb-1">{t.company}</span>
              </div>
              <span className="text-lg font-black">{kms.filter(k => k.type === 'empresa').reduce((a, b) => a + (Number(b.km || b.distance) || 0), 0).toFixed(1)} <span className="text-[9px] opacity-40">km</span></span>
            </div>
            <div className="flex justify-between items-end border-b border-white/5 pb-3">
              <div>
                <span className="text-slate-400 text-[10px] font-bold block mb-1">{t.personal}</span>
              </div>
              <span className="text-lg font-black text-orange-400">{kms.filter(k => k.type === 'personal').reduce((a, b) => a + (Number(b.km || b.distance) || 0), 0).toFixed(1)} <span className="text-[9px] opacity-40">km</span></span>
            </div>
          </div>
        </section>
      </div>

      {/* LIST SECTION */}
      <div className="lg:col-span-7 space-y-8">
        <section className="premium-card overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  onClick={() => changeMonth(-1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                >
                  <ChevronRight className="rotate-180" size={14} />
                </button>

                <input
                  type="month"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-bold text-slate-700 w-24 text-center focus:outline-none"
                />

                <button
                  onClick={() => changeMonth(1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <span className="hidden sm:block text-[10px] font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">{t.history}</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[850px] overflow-y-auto">
            {kms.length > 0 ? kms.map((item, idx) => (
              <div key={idx} className="p-6 hover:bg-slate-50 transition-all flex items-center justify-between group">
                <div className="flex items-start gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black shadow-sm ${String(item.type).toLowerCase().includes('per') ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                    {String(item.type).toLowerCase().includes('per') ? 'PER' : 'EMP'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      {item.dateJs?.toISOString().slice(0, 10)}
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                      <span className="text-blue-600">{(item.km || item.distance || 0).toFixed(1)} km</span>
                    </div>
                    <div className="text-xs font-medium text-slate-400 mt-0.5 line-clamp-2 italic">"{item.notes || '...'}"</div>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Fuel size={10} className="text-slate-300" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.fuelPrice?.toFixed(2) || '-'}€/L</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Gauge size={10} className="text-slate-300" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Odo: {item.totalKm?.toLocaleString() || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteKm(item)}
                  className="opacity-0 group-hover:opacity-100 w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300 scale-90 group-hover:scale-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )) : (
              <div className="p-20 text-center">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-dashed border-slate-200 text-slate-200">
                  <Car size={40} />
                </div>
                <p className="font-bold text-slate-300">{t.empty}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Mileage;


