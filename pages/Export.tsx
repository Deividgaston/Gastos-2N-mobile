
import React, { useState, useEffect } from 'react';
import { User, ExpenseEntry, KmEntry } from '../types';

interface ExportProps {
  user: User | null;
}

const Export: React.FC<ExportProps> = ({ user }) => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [kms, setKms] = useState<KmEntry[]>([]);
  const [status, setStatus] = useState('');

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

    setStatus('Cargando...');
    try {
      if (user) {
        // Fixed window.firebase by casting to any
        const db = (window as any).firebase.firestore();
        const expenseSnap = await db.collection(`users/${user.uid}/entries`)
          .where('date', '>=', start)
          .where('date', '<', end)
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
      } else {
        const eLocal = JSON.parse(localStorage.getItem('entries_local') || '[]');
        const kLocal = JSON.parse(localStorage.getItem('kms_local') || '[]');
        setEntries(eLocal.filter((e:any) => new Date(e.date) >= start && new Date(e.date) < end).map((e:any) => ({...e, dateJs: new Date(e.date)})));
        setKms(kLocal.filter((k:any) => new Date(k.date) >= start && new Date(k.date) < end).map((k:any) => ({...k, dateJs: new Date(k.date)})));
      }
      setStatus('');
    } catch (e) {
      setStatus('Error');
    }
  };

  const deleteEntry = async (id: string, isLocal: boolean, idx?: number) => {
    if (!confirm('¿Borrar gasto?')) return;
    if (user && !isLocal) {
      // Fixed window.firebase by casting to any
      await (window as any).firebase.firestore().collection(`users/${user.uid}/entries`).doc(id).delete();
    } else {
       const local = JSON.parse(localStorage.getItem('entries_local') || '[]');
       local.splice(idx, 1);
       localStorage.setItem('entries_local', JSON.stringify(local));
    }
    fetchMonthData();
  };

  const totals = {
    gastos: entries.reduce((a, b) => a + (b.amount || 0), 0),
    personal: entries.filter(e => e.paidWith === 'personal').reduce((a, b) => a + (b.amount || 0), 0),
    kmPer: kms.filter(k => k.type.toLowerCase().includes('per')).reduce((a, b) => a + (b.km || b.distance || 0), 0)
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* FILTERS & TOTALS */}
      <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 md:flex items-end justify-between gap-8 border-b border-slate-100">
          <div className="space-y-4 mb-6 md:mb-0">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Exportar mes</h2>
              <p className="text-sm text-slate-500">Revisa tus registros antes de generar el reporte.</p>
            </div>
            <div className="inline-block">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-1">Periodo</label>
              <input 
                type="month" 
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-md flex-1 min-w-[160px]">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Total Gastos</div>
              <div className="text-2xl font-black">{totals.gastos.toFixed(2)}€</div>
            </div>
            <div className="bg-slate-100 rounded-2xl p-5 text-slate-800 flex-1 min-w-[160px]">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pagado Personal</div>
              <div className="text-2xl font-black">{totals.personal.toFixed(2)}€</div>
            </div>
            <div className="bg-slate-100 rounded-2xl p-5 text-slate-800 flex-1 min-w-[160px]">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">KM Personales</div>
              <div className="text-2xl font-black">{totals.kmPer.toFixed(1)} km</div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <h3 className="text-lg font-bold text-slate-800">Registros del mes</h3>
          <div className="border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Proveedor</th>
                    <th className="px-6 py-4">Categoría</th>
                    <th className="px-6 py-4">Pago</th>
                    <th className="px-6 py-4 text-right">Importe</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.length > 0 ? entries.map((e, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">{e.dateJs?.toISOString().slice(0,10)}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{e.provider || '-'}</td>
                      <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold uppercase">{e.category}</span></td>
                      <td className="px-6 py-4 text-slate-500">{e.paidWith}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900">{e.amount.toFixed(2)}€</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => deleteEntry(e.id || '', e._src==='local', e._localIndex)}
                          className="text-red-300 hover:text-red-500"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No hay registros para este mes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* EXPORT ACTIONS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl mb-4">
            <i className="fa-solid fa-file-excel"></i>
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Excel de Gastos</h4>
          <p className="text-xs text-slate-500 mb-6">Usa la plantilla oficial de 2N para generar tu reporte de gastos.</p>
          <button className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-all">
            Descargar Gastos
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-2xl mb-4">
            <i className="fa-solid fa-car-side"></i>
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Excel de KM</h4>
          <p className="text-xs text-slate-500 mb-6">Genera el listado de kilometraje personal con coste calculado.</p>
          <button className="mt-auto w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-sm transition-all">
            Descargar Kilometraje
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-2xl mb-4">
            <i className="fa-solid fa-images"></i>
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Tickets</h4>
          <p className="text-xs text-slate-500 mb-6">Descarga todas las fotos de los tickets adjuntos de este mes.</p>
          <button className="mt-auto w-full py-3 bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-800 rounded-xl font-bold transition-all">
            Bajar Fotos
          </button>
        </div>
      </section>
    </div>
  );
};

export default Export;
