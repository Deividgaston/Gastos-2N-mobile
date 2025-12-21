
import React, { useState, useEffect } from 'react';
import { User, KmEntry } from '../types';

interface MileageProps {
  user: User | null;
}

const Mileage: React.FC<MileageProps> = ({ user }) => {
  const [kms, setKms] = useState<KmEntry[]>([]);
  const [lastOdometer, setLastOdometer] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    km: '',
    type: 'empresa',
    fuelPrice: '',
    notes: '',
  });
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchKms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchKms = async () => {
    if (user) {
      // Fixed window.firebase by casting to any
      const db = (window as any).firebase.firestore();
      const snap = await db.collection(`users/${user.uid}/kms`)
        .orderBy('date', 'desc')
        .limit(20)
        .get();
      const list: KmEntry[] = [];
      snap.forEach((doc: any) => {
        const data = doc.data();
        list.push({ ...data, id: doc.id, dateJs: data.date.toDate() });
      });
      setKms(list);
      updateOdometer(list);
    } else {
      const local = JSON.parse(localStorage.getItem('kms_local') || '[]');
      const list = local.slice(-20).reverse().map((e: any) => ({ ...e, dateJs: new Date(e.date) }));
      setKms(list);
      updateOdometer(list);
    }
  };

  const updateOdometer = (list: KmEntry[]) => {
    let last: number | null = null;
    list.forEach(e => {
      if (e.totalKm) last = Number(e.totalKm);
    });
    setLastOdometer(last);
  };

  const saveKm = async () => {
    const distance = Number(formData.km);
    if (!distance || distance <= 0) return alert('Introduce KM válidos');
    
    const totalKm = lastOdometer !== null ? lastOdometer + distance : distance;
    const entry = {
      ...formData,
      km: distance,
      totalKm,
      fuelPrice: formData.fuelPrice ? Number(formData.fuelPrice) : null,
    };

    setStatus('Guardando...');
    try {
      if (user) {
        // Fixed window.firebase by casting to any
        const db = (window as any).firebase.firestore();
        await db.collection(`users/${user.uid}/kms`).add({
          ...entry,
          date: new Date(formData.date),
          createdAt: (window as any).firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const local = JSON.parse(localStorage.getItem('kms_local') || '[]');
        local.push(entry);
        localStorage.setItem('kms_local', JSON.stringify(local));
      }
      setFormData({ ...formData, km: '', notes: '' });
      setStatus('Guardado ✅');
      fetchKms();
    } catch (e) {
      setStatus('Error');
    }
  };

  const deleteKm = async (item: KmEntry) => {
    if (!confirm('¿Borrar este registro?')) return;
    try {
      if (user && item.id) {
        // Fixed window.firebase by casting to any
        const db = (window as any).firebase.firestore();
        await db.collection(`users/${user.uid}/kms`).doc(item.id).delete();
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

  const calculatedOdometer = formData.km ? (lastOdometer || 0) + Number(formData.km) : (lastOdometer || '');

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* FORM SECTION */}
      <div className="lg:col-span-5 space-y-6">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <i className="fa-solid fa-plus-circle"></i>
            </div>
            Nuevo registro
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Distancia (km)</label>
                <input 
                  type="number" 
                  placeholder="0.0"
                  value={formData.km}
                  onChange={e => setFormData({...formData, km: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tipo</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="empresa">Empresa</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Combustible (€/L)</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="1.65"
                  value={formData.fuelPrice}
                  onChange={e => setFormData({...formData, fuelPrice: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Notas</label>
              <textarea 
                rows={2}
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Motivo del viaje..."
              ></textarea>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 text-white flex items-center justify-between">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Odómetro Total</div>
              <div className="text-2xl font-black">{calculatedOdometer} <span className="text-xs font-normal">km</span></div>
            </div>

            <button 
              onClick={saveKm}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] mt-2"
            >
              Guardar KM
            </button>
            <div className="text-center h-4 text-xs font-semibold text-blue-600 uppercase tracking-tighter">{status}</div>
          </div>
        </section>

        {/* SUMMARY CARD */}
        <section className="bg-slate-800 rounded-2xl shadow-sm p-6 text-white overflow-hidden relative">
          <i className="fa-solid fa-road absolute -right-4 -bottom-4 text-white/5 text-8xl"></i>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Resumen acumulado</h3>
          <div className="space-y-3 relative z-10">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="text-slate-400 text-sm">Empresa</span>
              <span className="font-bold">{kms.filter(k=>k.type==='empresa').reduce((a,b)=>a+(b.km||b.distance||0),0).toFixed(1)} km</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="text-slate-400 text-sm">Personal</span>
              <span className="font-bold">{kms.filter(k=>k.type==='personal').reduce((a,b)=>a+(b.km||b.distance||0),0).toFixed(1)} km</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-white font-bold">Total</span>
              <span className="text-xl font-black text-blue-400">{kms.reduce((a,b)=>a+(b.km||b.distance||0),0).toFixed(1)} km</span>
            </div>
          </div>
        </section>
      </div>

      {/* LIST SECTION */}
      <div className="lg:col-span-7 space-y-6">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Registros de KM</h2>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Últimos 20</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
            {kms.length > 0 ? kms.map((item, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${item.type === 'personal' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                    {item.type === 'personal' ? 'P' : 'E'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{item.dateJs?.toISOString().slice(0,10)} • {(item.km || item.distance || 0).toFixed(1)} km</div>
                    <div className="text-xs text-slate-400 max-w-[300px] truncate">{item.notes || 'Sin notas'}</div>
                    <div className="text-[10px] text-slate-300 font-bold mt-1 uppercase tracking-tighter">
                      Comb: {item.fuelPrice?.toFixed(2) || '-'}€/L • Odo: {item.totalKm || '-'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => deleteKm(item)}
                  className="opacity-0 group-hover:opacity-100 w-10 h-10 rounded-full hover:bg-red-50 text-red-500 flex items-center justify-center transition-all"
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            )) : (
              <div className="p-12 text-center text-slate-400">
                <i className="fa-solid fa-car-rear text-4xl mb-3 block opacity-20"></i>
                <p>Sin registros de KM todavía.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Mileage;
