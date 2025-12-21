import React, { useState, useEffect } from 'react';
import * as JSZip from 'jszip';
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
        const db = (window as any).firebase.firestore();

        const expenseSnap = await db
          .collection(`users/${user.uid}/entries`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .get();

        const kmSnap = await db
          .collection(`users/${user.uid}/kms`)
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

        setEntries(
          eLocal
            .filter((e: any) => new Date(e.date) >= start && new Date(e.date) < end)
            .map((e: any) => ({ ...e, dateJs: new Date(e.date), _src: 'local', _localIndex: e._localIndex }))
        );

        setKms(
          kLocal
            .filter((k: any) => new Date(k.date) >= start && new Date(k.date) < end)
            .map((k: any) => ({ ...k, dateJs: new Date(k.date) }))
        );
      }
      setStatus('');
    } catch (e) {
      console.error(e);
      setStatus('Error');
    }
  };

  const deleteEntry = async (id: string, isLocal: boolean, idx?: number) => {
    if (!confirm('¿Borrar gasto?')) return;
    if (user && !isLocal) {
      await (window as any).firebase
        .firestore()
        .collection(`users/${user.uid}/entries`)
        .doc(id)
        .delete();
    } else {
      const local = JSON.parse(localStorage.getItem('entries_local') || '[]');
      if (typeof idx === 'number') {
        local.splice(idx, 1);
      }
      localStorage.setItem('entries_local', JSON.stringify(local));
    }
    fetchMonthData();
  };

  const totals = {
    gastos: entries.reduce((a, b) => a + (Number(b.amount) || 0), 0),
    personal: entries
      .filter((e) => (e.paidWith || '').toLowerCase() === 'personal')
      .reduce((a, b) => a + (Number(b.amount) || 0), 0),
    kmPer: kms
      .filter((k) => (k.type || '').toLowerCase().includes('per'))
      .reduce((a, b) => a + (Number(b.km || b.distance) || 0), 0),
  };

  function formatEuro(v: number) {
    return (v || 0).toFixed(2);
  }

  /* =================== EXPORT EXCEL GASTOS (2N TEMPLATE) =================== */
  const exportExcelGastos = async () => {
    if (!entries.length) {
      alert('No hay gastos en este mes.');
      return;
    }

    try {
      setStatus('Generando Excel de gastos…');

      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        alert('No se encuentra XLSX (SheetJS). Revisa index.html.');
        setStatus('');
        return;
      }

      const templateUrl = `${import.meta.env.BASE_URL}plantilla-2n.xlsx`;
      const resp = await fetch(templateUrl, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`No se puede cargar plantilla-2n.xlsx (HTTP ${resp.status})`);

      const data = await resp.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });

      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      const PRENOM = 'david';
      const NOM = 'gaston';
      const COST_CENTER = 'iberia team';

      function setHeaderCell(ref: string, val: string) {
        if (!ws[ref]) ws[ref] = {};
        ws[ref].v = val;
        ws[ref].t = 's';
      }

      setHeaderCell('B2', NOM);
      setHeaderCell('B3', PRENOM);
      setHeaderCell('D3', COST_CENTER);

      const startRow = 7;

      entries.forEach((e, idx) => {
        const r = startRow + idx;

        const d: Date = e.dateJs instanceof Date ? e.dateJs : new Date((e as any).dateJs || (e as any).date);
        const iso = d.toISOString().slice(0, 10);
        const [yyyy, mm, dd] = iso.split('-');

        function setCell(col: string, val: any, typeOverride?: string) {
          const cellRef = col + String(r);
          if (!ws[cellRef]) ws[cellRef] = {};
          ws[cellRef].v = val;
          if (typeOverride) ws[cellRef].t = typeOverride;
          else ws[cellRef].t = typeof val === 'number' ? 'n' : 's';
        }

        const dateText = `${dd}/${mm}/${yyyy}`;
        setCell('A', dateText);

        let bVal = e.provider || '';
        if (e.notes) {
          const base = (e.provider || '').trim();
          bVal = base ? `${base} - ${e.notes}` : e.notes;
        }
        setCell('B', bVal);

        const amount = Number(e.amount || 0);
        const cat = String(e.category || '').toLowerCase();

        let colAmount = 'J';
        if (cat === 'peajes') colAmount = 'C';
        else if (cat === 'alojamiento') colAmount = 'D';
        else if (cat === 'gasolina') colAmount = 'E';
        else if (cat === 'transporte') colAmount = 'G';
        else if (cat === 'comida') colAmount = 'I';
        else colAmount = 'J';

        setCell(colAmount, amount);
        setCell('K', amount);
      });

      const filename = `expenses-2n-${month || 'month'}.xlsx`;
      XLSX.writeFile(wb, filename);

      setStatus('Excel de gastos generado ✅');
    } catch (e: any) {
      console.error(e);
      alert('Error al generar el Excel: ' + (e?.message || e));
      setStatus('Error al generar el Excel de gastos.');
    }
  };

  /* =================== EXPORT EXCEL PERSONAL MILEAGE (ENGLISH) =================== */
  const exportExcelKmPersonal = async () => {
    const kmsPer = kms.filter((k) => (k.type || '').toLowerCase().includes('per'));
    if (!kmsPer.length) {
      alert('No hay KM personales en este mes.');
      return;
    }

    try {
      setStatus('Generando Excel de KM personales…');

      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        alert('No se encuentra XLSX (SheetJS). Revisa index.html.');
        setStatus('');
        return;
      }

      const rows = kmsPer.map((k) => {
        const d: Date = k.dateJs instanceof Date ? k.dateJs : new Date((k as any).dateJs || (k as any).date);
        const dateISO = d.toISOString().slice(0, 10);

        const kmVal = Number(k.km || k.distance || 0) || 0;
        const fuel = k.fuelPrice != null && k.fuelPrice !== '' ? Number(k.fuelPrice) : NaN;
        const cost = !isNaN(fuel) && fuel > 0 ? (kmVal * fuel * 6) / 100 : 0;

        return {
          Date: dateISO,
          KM: kmVal,
          '€/L': !isNaN(fuel) && fuel > 0 ? fuel : '',
          'Personal mileage cost (km×€/L×6/100)': cost,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Personal_Mileage');

      XLSX.writeFile(wb, `personal-mileage-${month || 'month'}.xlsx`);
      setStatus('Excel de KM personales generado ✅');
    } catch (e: any) {
      console.error(e);
      alert('Error al generar el Excel de KM personales: ' + (e?.message || e));
      setStatus('Error al generar Excel de KM personales.');
    }
  };

  /* =================== DOWNLOAD TICKET PHOTOS (ZIP) =================== */
  const exportFotosTickets = async () => {
    const entriesWithPhoto = entries.filter((e: any) => e?.photoURL);
    if (!entriesWithPhoto.length) {
      alert('No hay tickets con foto en este mes.');
      return;
    }

    try {
      setStatus(`Preparando ZIP (${entriesWithPhoto.length})…`);

      const zip = new (JSZip as any)();

      const safe = (s: string) => String(s || '').replace(/[^a-z0-9-_]/gi, '_').toLowerCase();

      for (let i = 0; i < entriesWithPhoto.length; i++) {
        const e: any = entriesWithPhoto[i];
        const url = e.photoURL;
        if (!url) continue;

        const d: Date = e.dateJs instanceof Date ? e.dateJs : new Date(e.dateJs || e.date);
        const iso = d.toISOString().slice(0, 10);

        const prov = safe(e.provider || 'ticket');

        const urlNoQuery = String(url).split('?')[0];
        const extMatch = urlNoQuery.match(/\.([a-z0-9]{3,4})$/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';

        const fname = `ticket_${iso}_${prov}_${i + 1}.${ext}`;

        setStatus(`Descargando ${i + 1}/${entriesWithPhoto.length}…`);

        const resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) throw new Error(`No se pudo descargar ${fname} (HTTP ${resp.status})`);

        const blob = await resp.blob();
        zip.file(fname, blob);
      }

      setStatus('Generando ZIP…');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const urlZip = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = urlZip;
      a.download = `tickets_${month || 'month'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(urlZip), 2000);

      setStatus('ZIP descargado ✅');
    } catch (e: any) {
      console.error(e);
      alert('Error al descargar tickets: ' + (e?.message || e));
      setStatus('Error al descargar tickets.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* FILTERS & TOTALS */}
      <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 md:flex items-end justify-between gap-8 border-b border-slate-100">
          <div className="space-y-4 mb-6 md:mb-0">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Exportar mes</h2>
              <p className="text-sm text-slate-500">{status || 'Revisa tus registros antes de generar el reporte.'}</p>
            </div>
            <div className="inline-block">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-1">Periodo</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-md flex-1 min-w-[160px]">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Total Gastos</div>
              <div className="text-2xl font-black">{formatEuro(totals.gastos)}€</div>
            </div>
            <div className="bg-slate-100 rounded-2xl p-5 text-slate-800 flex-1 min-w-[160px]">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pagado Personal</div>
              <div className="text-2xl font-black">{formatEuro(totals.personal)}€</div>
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
                  {entries.length > 0 ? (
                    entries.map((e: any, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">
                          {e.dateJs?.toISOString().slice(0, 10)}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800">{e.provider || '-'}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold uppercase">{e.category}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{e.paidWith}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">{Number(e.amount || 0).toFixed(2)}€</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => deleteEntry(e.id || '', e._src === 'local', e._localIndex)} className="text-red-300 hover:text-red-500">
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                        No hay registros para este mes.
                      </td>
                    </tr>
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
          <button
            onClick={exportExcelGastos}
            className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-all"
            type="button"
          >
            Descargar Gastos
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-2xl mb-4">
            <i className="fa-solid fa-car-side"></i>
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Excel de KM</h4>
          <p className="text-xs text-slate-500 mb-6">Genera el listado de kilometraje personal con coste calculado.</p>
          <button
            onClick={exportExcelKmPersonal}
            className="mt-auto w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-sm transition-all"
            type="button"
          >
            Descargar Kilometraje
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-2xl mb-4">
            <i className="fa-solid fa-images"></i>
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Tickets</h4>
          <p className="text-xs text-slate-500 mb-6">Descarga todas las fotos de los tickets adjuntos de este mes.</p>
          <button
            onClick={exportFotosTickets}
            className="mt-auto w-full py-3 bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-800 rounded-xl font-bold transition-all"
            type="button"
          >
            Bajar Fotos
          </button>
        </div>
      </section>
    </div>
  );
};

export default Export;
