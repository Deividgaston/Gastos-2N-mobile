
import React, { useState, useEffect } from 'react';
import { User, ExpenseEntry, KmEntry } from '../types';

interface SummaryProps {
  user: User | null;
}

const Summary: React.FC<SummaryProps> = ({ user }) => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [kms, setKms] = useState<KmEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    fetchMonthData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, month]);

  const fetchMonthData = async () => {
    const parts = month.split('-');
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 1));

    try {
      if (user) {
        // Fixed window.firebase by casting to any
        const db = (window as any).firebase.firestore();
        const expenseSnap = await db.collection(`users/${user.uid}/entries`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .orderBy('date', 'desc')
          .get();
        const kmSnap = await db.collection(`users/${user.uid}/kms`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .get();

        const eList: ExpenseEntry[] = [];
        expenseSnap.forEach((doc: any) => {
          const data = doc.data();
          eList.push({ ...data, id: doc.id, dateJs: data.date.toDate() });
        });

        const kList: KmEntry[] = [];
        kmSnap.forEach((doc: any) => {
          const data = doc.data();
          kList.push({ ...data, id: doc.id, dateJs: data.date.toDate() });
        });

        setEntries(eList);
        setKms(kList);
        setSelectedIdx(0);
      } else {
        const eLocal = JSON.parse(localStorage.getItem('entries_local') || '[]');
        const kLocal = JSON.parse(localStorage.getItem('kms_local') || '[]');
        const filteredE = eLocal.filter((e:any) => new Date(e.date) >= start && new Date(e.date) < end).map((e:any) => ({...e, dateJs: new Date(e.date)})).sort((a:any,b:any)=>b.dateJs-a.dateJs);
        const filteredK = kLocal.filter((k:any) => new Date(k.date) >= start && new Date(k.date) < end).map((k:any) => ({...k, dateJs: new Date(k.date)}));
        setEntries(filteredE);
        setKms(filteredK);
        setSelectedIdx(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const stats = {
    total: entries.reduce((a, b) => a + (b.amount || 0), 0),
    personal: entries.filter(e => e.paidWith === 'personal').reduce((a, b) => a + (b.amount || 0), 0),
    kmEmp: kms.filter(k => !k.type.toLowerCase().includes('per')).reduce((a, b) => a + (b.km || b.distance || 0), 0),
    kmPer: kms.filter(k => k.type.toLowerCase().includes('per')).reduce((a, b) => a + (b.km || b.distance || 0), 0),
    kmCostPer: kms.filter(k => k.type.toLowerCase().includes('per')).reduce((acc, k) => {
      const fuel = k.fuelPrice || 0;
      return acc + (fuel > 0 ? (k.km || k.distance || 0) * fuel * 6 / 100 : 0);
    }, 0)
  };

  const companyOwes = stats.personal - stats.kmCostPer;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER SUMMARY */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-slate-800">Resumen mensual</h2>
            <div className="flex items-center gap-3">
              <input 
                type="month" 
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2">
                <i className="fa-solid fa-file-pdf"></i>
                Descargar PDF
              </button>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-3xl p-6 text-white md:min-w-[320px] shadow-xl border-t border-white/10">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2">Liquidación estimada</div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-400 text-xs">A devolver</span>
              <span className="text-2xl font-black">{companyOwes.toFixed(2)}€</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">Calculado como (Pagos personales) - (Coste KM personal)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Gastos Totales" value={`${stats.total.toFixed(2)}€`} icon="fa-wallet" color="blue" />
          <StatBox label="Pagado Personal" value={`${stats.personal.toFixed(2)}€`} icon="fa-user-tag" color="slate" />
          <StatBox label="KM Empresa" value={`${stats.kmEmp.toFixed(1)}km`} icon="fa-briefcase" color="slate" />
          <StatBox label="KM Personales" value={`${stats.kmPer.toFixed(1)}km`} icon="fa-house-user" color="slate" />
        </div>
      </section>

      {/* SPLIT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LIST PANEL */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-400 text-[10px] uppercase tracking-widest">
            Detalle de gastos
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {entries.length > 0 ? entries.map((e, idx) => (
              <button 
                key={idx} 
                onClick={() => setSelectedIdx(idx)}
                className={`w-full text-left p-4 hover:bg-blue-50/50 transition-colors flex items-center justify-between ${selectedIdx === idx ? 'bg-blue-50 border-r-4 border-blue-600' : ''}`}
              >
                <div className="flex items-center gap-4">
                   <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                     {idx + 1}
                   </div>
                   <div>
                     <div className="font-bold text-slate-800 text-sm truncate max-w-[180px]">{e.provider || 'Sin proveedor'}</div>
                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{e.dateJs?.toISOString().slice(0,10)} • {e.category}</div>
                   </div>
                </div>
                <div className="text-right">
                   <div className="font-black text-slate-900">{e.amount.toFixed(2)}€</div>
                   <div className={`text-[8px] font-black uppercase tracking-widest ${e.paidWith === 'personal' ? 'text-orange-500' : 'text-slate-400'}`}>{e.paidWith}</div>
                </div>
              </button>
            )) : (
              <div className="p-12 text-center text-slate-300">No hay gastos este mes</div>
            )}
          </div>
        </div>

        {/* PREVIEW PANEL */}
        <div className="lg:col-span-5 bg-slate-100 rounded-2xl shadow-inner border border-slate-200 p-4 h-[600px] flex flex-col">
          <div className="mb-4 text-center">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vista previa del ticket</span>
          </div>
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center relative group">
            {entries[selectedIdx]?.photoURL ? (
              <img src={entries[selectedIdx].photoURL} className="max-w-full max-h-full object-contain" alt="Ticket" />
            ) : (
              <div className="text-slate-300 flex flex-col items-center gap-2">
                <i className="fa-regular fa-image text-5xl"></i>
                <span className="text-xs font-bold uppercase">Sin imagen adjunta</span>
              </div>
            )}
          </div>
          {entries[selectedIdx] && (
            <div className="mt-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2">
              <div className="flex justify-between items-start">
                <div className="font-black text-slate-800">{entries[selectedIdx].provider}</div>
                <div className="font-black text-blue-600">{entries[selectedIdx].amount.toFixed(2)}€</div>
              </div>
              <p className="text-xs text-slate-500 italic">"{entries[selectedIdx].notes || 'Sin notas adicionales'}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon, color }: any) => (
  <div className={`p-4 rounded-2xl border ${color === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-900' : 'bg-white border-slate-100 text-slate-800'} shadow-sm`}>
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${color === 'blue' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
    </div>
    <div className="text-xl font-black">{value}</div>
  </div>
);

export default Summary;
