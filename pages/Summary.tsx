import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase-init';
import { User, ExpenseEntry, KmEntry } from '../types';
import {
  Calendar,
  Wallet,
  UserCheck,
  Briefcase,
  Home as HomeIcon,
  Download,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Trash2,
  Edit3,
  FileSpreadsheet,
  Archive,
  Languages,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  BarChart3
} from 'lucide-react';
// Eliminados imports de node_modules para usar versiones de CDN (window) más estables con plugins

import { translations, Language } from '../utils/translations';

interface SummaryProps {
  user: User | null;
  lang: Language;
}

const Summary: React.FC<SummaryProps> = ({ user, lang }) => {
  const t = translations[lang].summary;
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [kms, setKms] = useState<KmEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null);

  useEffect(() => {
    fetchMonthData();
  }, [user, month]);

  const fetchMonthData = async () => {
    const parts = month.split('-');
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 1));

    try {
      if (user) {
        const qExpenses = query(
          collection(db, `users/${user.uid}/entries`),
          where('date', '>=', start),
          where('date', '<', end),
          orderBy('date', 'desc')
        );
        const qKms = query(
          collection(db, `users/${user.uid}/kms`),
          where('date', '>=', start),
          where('date', '<', end)
        );

        const [expenseSnap, kmSnap] = await Promise.all([getDocs(qExpenses), getDocs(qKms)]);

        const eList: ExpenseEntry[] = [];
        expenseSnap.forEach((docSnap) => {
          const data = docSnap.data();
          eList.push({ ...data, id: docSnap.id, dateJs: (data.date as Timestamp).toDate() } as ExpenseEntry);
        });

        const kList: KmEntry[] = [];
        kmSnap.forEach((docSnap) => {
          const data = docSnap.data();
          kList.push({ ...data, id: docSnap.id, dateJs: (data.date as Timestamp).toDate() } as KmEntry);
        });

        setEntries(eList);
        setKms(kList);
        setSelectedIdx(0);
      } else {
        const eLocal = JSON.parse(localStorage.getItem('entries_local') || '[]');
        const kLocal = JSON.parse(localStorage.getItem('kms_local') || '[]');
        const filteredE = eLocal
          .filter((e: any) => new Date(e.date) >= start && new Date(e.date) < end)
          .map((e: any, idx: number) => ({ ...e, dateJs: new Date(e.date), _src: 'local', _localIndex: idx }))
          .sort((a: any, b: any) => b.dateJs - a.dateJs);
        const filteredK = kLocal
          .filter((k: any) => new Date(k.date) >= start && new Date(k.date) < end)
          .map((k: any) => ({ ...k, dateJs: new Date(k.date) }));
        setEntries(filteredE);
        setKms(filteredK);
        setSelectedIdx(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteEntry = async (id: string, isLocal: boolean, localIdx?: number) => {
    if (!confirm(lang === 'ES' ? '¿Seguro?' : lang === 'EN' ? 'Are you sure?' : 'Tem certeza?')) return;
    try {
      if (user && !isLocal) {
        await deleteDoc(doc(db, `users/${user.uid}/entries`, id));
      } else {
        const local = JSON.parse(localStorage.getItem('entries_local') || '[]');
        if (typeof localIdx === 'number') local.splice(localIdx, 1);
        localStorage.setItem('entries_local', JSON.stringify(local));
      }
      fetchMonthData();
    } catch (e) {
      alert('Error');
    }
  };

  const updateEntry = async () => {
    if (!editingEntry || !user) return;
    try {
      if (editingEntry._src === 'local') {
        const local = JSON.parse(localStorage.getItem('entries_local') || '[]');
        local[editingEntry._localIndex!] = { ...editingEntry, dateJs: undefined };
        localStorage.setItem('entries_local', JSON.stringify(local));
      } else {
        const { id, dateJs, _src, _localIndex, ...data } = editingEntry as any;
        await updateDoc(doc(db, `users/${user.uid}/entries`, id), {
          ...data,
          date: new Date(data.date)
        });
      }
      setEditingEntry(null);
      fetchMonthData();
    } catch (e) {
      alert('Error');
    }
  };

  const stats = {
    total: entries.reduce((a, b) => a + (Number(b.amount) || 0), 0),
    personal: entries.filter(e => e.paidWith === 'personal').reduce((a, b) => a + (Number(b.amount) || 0), 0),
    kmEmp: kms.filter(k => !String(k.type).toLowerCase().includes('per')).reduce((a, b) => a + (Number(b.km || b.distance) || 0), 0),
    kmPer: kms.filter(k => String(k.type).toLowerCase().includes('per')).reduce((a, b) => a + (Number(b.km || b.distance) || 0), 0),
    kmCostPer: kms.filter(k => String(k.type).toLowerCase().includes('per')).reduce((acc, k) => {
      const fuel = k.fuelPrice || 0;
      const cons = k.consumption || 6.0;
      return acc + (fuel > 0 ? (Number(k.km || k.distance) || 0) * fuel * (cons / 100) : 0);
    }, 0)
  };

  const companyOwes = stats.personal - stats.kmCostPer;

  /* ================= EXPORTS ================= */

  const i18n = translations[lang].summary;

  const buildPdf = () => {
    try {
      // Usar la versión global si está disponible para asegurar compatibilidad con autotable
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();

      doc.setFontSize(22); doc.setTextColor(30, 41, 59);
      doc.text(`${i18n.report} - ${month}`, 14, 20);
      doc.setFontSize(10); doc.setTextColor(100, 116, 139);
      doc.text(`User: ${user?.email || 'Local'}`, 14, 28);

      (doc as any).autoTable({
        startY: 40,
        head: [[i18n.date, i18n.provider, i18n.category, i18n.pay, i18n.amount]],
        body: entries.map(e => [
          e.dateJs?.toISOString().slice(0, 10),
          e.provider,
          e.category,
          e.paidWith,
          `${Number(e.amount).toFixed(2)}€`
        ]),
        headStyles: { fillColor: [30, 41, 59] }
      });
      doc.save(`Expenses_${month}_${lang}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Error al generar PDF. Asegúrate de que las librerías están cargadas.");
    }
  };

  const exportExcel = async () => {
    if (!entries.length) return alert('Empty');
    setIsExporting('excel');
    try {
      const XLSX = (window as any).XLSX;
      if (!XLSX) throw new Error("XLSX library not loaded");

      // Ajuste de ruta para la plantilla en GitHub Pages o Local
      const baseUrl = (import.meta as any).env.BASE_URL || '/';
      const templateUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}plantilla-2n.xlsx`;

      const resp = await fetch(templateUrl);
      if (!resp.ok) throw new Error(`Template not found at ${templateUrl}`);

      const dataArr = await resp.arrayBuffer();
      const wb = XLSX.read(dataArr, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];

      entries.forEach((e, idx) => {
        const r = 7 + idx;
        const setCell = (c: string, v: any, t = 's') => { if (!ws[c + r]) ws[c + r] = {}; ws[c + r].v = v; ws[c + r].t = t; };
        setCell('A', e.dateJs?.toISOString().slice(0, 10));
        setCell('B', e.notes ? `${e.provider} - ${e.notes}` : e.provider);
        const amt = Number(e.amount);
        const cat = e.category.toLowerCase();
        let col = 'J';
        if (cat.includes('peaje')) col = 'C';
        else if (cat.includes('alojamiento')) col = 'D';
        else if (cat.includes('gasolina')) col = 'E';
        else if (cat.includes('transporte')) col = 'G';
        else if (cat.includes('comida')) col = 'I';
        setCell(col, amt, 'n'); setCell('K', amt, 'n');
      });

      XLSX.writeFile(wb, `Report_${month}_${lang}.xlsx`);
    } catch (e) {
      console.error("Excel Export Error:", e);
      alert(`Error al exportar Excel: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setIsExporting(null);
    }
  };

  const exportZip = async () => {
    const withPhotos = entries.filter(e => e.photoPath);
    if (!withPhotos.length) return alert('No hay fotos para descargar');
    setIsExporting('zip');
    try {
      const JSZip = (window as any).JSZip;
      if (!JSZip) throw new Error("JSZip library not loaded");

      const zip = new JSZip();
      for (const e of withPhotos) {
        try {
          const url = await getDownloadURL(ref(storage, e.photoPath));
          const resp = await fetch(url);
          const blob = await resp.blob();
          zip.file(`${e.dateJs?.toISOString().slice(0, 10)}_${e.provider || 'ticket'}.jpg`, blob);
        } catch (err) {
          console.warn(`Error fetching photo for ${e.provider}:`, err);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Tickets_${month}.zip`;
      link.click();
    } catch (e) {
      console.error("ZIP Export Error:", e);
      alert(`Error al generar ZIP: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-10">
      {/* HEADER & CONTROLS */}
      <section className="premium-card p-6 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-blue-600" size={24} />
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{i18n.report}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-premium pl-12 font-bold w-48" />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 opacity-50 grayscale pointer-events-none">
                <div className="px-4 py-2 rounded-xl text-[10px] font-black bg-white text-blue-600 shadow-sm">{lang}</div>
              </div>
            </div>
          </div>

          {/* FINANCIAL SUMMARY CARD */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white md:min-w-[400px] shadow-2xl relative overflow-hidden border-b-8 border-blue-600 group transition-all hover:scale-[1.02]">
            <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <Wallet size={200} />
            </div>
            <div className="relative z-10">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">{i18n.reimbursement}</div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-slate-400 text-xs font-bold">{lang === 'ES' ? 'A reembolsar' : lang === 'EN' ? 'To reimburse' : 'A reembolsar'}</span>
                <span className="text-5xl font-extrabold tabular-nums tracking-tighter">{companyOwes.toFixed(2)}€</span>
              </div>
              <div className="h-px bg-white/10 my-6"></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Pagado Pers.</div>
                  <div className="font-bold text-sm text-slate-200">+{stats.personal.toFixed(2)}€</div>
                </div>
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Deducir KM</div>
                  <div className="font-bold text-sm text-orange-400">-{stats.kmCostPer.toFixed(2)}€</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PERSISTENT STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <StatBox label={i18n.total} value={`${stats.total.toFixed(2)}€`} icon={<Wallet size={16} />} color="blue" />
          <StatBox label={i18n.personal} value={`${stats.personal.toFixed(2)}€`} icon={<UserCheck size={16} />} color="slate" />
          <StatBox label="KM Empresa" value={`${stats.kmEmp.toFixed(1)}k`} icon={<Briefcase size={16} />} color="slate" />
          <StatBox label={i18n.km} value={`${stats.kmPer.toFixed(1)}k`} icon={<HomeIcon size={16} />} color="slate" />
        </div>
      </section>

      {/* EXPORT ACTIONS GRID */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ActionCard title="Descargar PDF" desc="Reporte visual detallado para imprimir o compartir rápido." icon={<Download />} onAction={buildPdf} color="blue" />
        <ActionCard title="Exportar Excel" desc="Plantilla oficial 2N lista para contabilidad." icon={<FileSpreadsheet />} onAction={exportExcel} loading={isExporting === 'excel'} />
        <ActionCard title="Tickets (ZIP)" desc="Descargar todas las fotos capturadas este mes." icon={<Archive />} onAction={exportZip} loading={isExporting === 'zip'} />
      </section>

      {/* SPLIT VIEW - DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 premium-card overflow-hidden h-[600px] flex flex-col">
          <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
            <div className="flex items-center gap-3 font-black text-slate-800">
              <FileText className="text-slate-400" size={18} />
              <span>Detalle del Periodo</span>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase">{entries.length} registros</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {entries.map((e, idx) => (
              <div key={e.id || idx} className={`p-4 flex items-center justify-between hover:bg-slate-50 transition-all group ${selectedIdx === idx ? 'bg-blue-50/50' : ''}`}>
                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setSelectedIdx(idx)}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${selectedIdx === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-800 text-sm group-hover:text-blue-600 transition-colors uppercase">{e.provider}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{e.dateJs?.toISOString().slice(0, 10)} • {e.category}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-black text-slate-900 text-lg">{e.amount.toFixed(2)}€</div>
                    <div className={`text-[9px] font-black uppercase ${e.paidWith === 'personal' ? 'text-orange-500' : 'text-blue-400'}`}>{e.paidWith}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingEntry(e)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all sm:opacity-0 group-hover:opacity-100"><Edit3 size={14} /></button>
                    <button onClick={() => deleteEntry(e.id || '', e._src === 'local', e._localIndex)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all sm:opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="premium-card p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-center gap-2 mb-6 opacity-30">
              <ImageIcon size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Vista Previa</span>
            </div>
            <div className="flex-1 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group">
              {entries[selectedIdx]?.photoURL ? (
                <img src={entries[selectedIdx].photoURL} className="max-w-[90%] max-h-[90%] rounded-2xl object-contain shadow-2xl transition-transform group-hover:scale-105" alt="Ticket" />
              ) : (
                <div className="flex flex-col items-center gap-4 text-slate-300">
                  <ImageIcon size={64} strokeWidth={1} />
                  <span className="text-[10px] font-black uppercase">Sin documento adjunto</span>
                </div>
              )}
            </div>
            {entries[selectedIdx] && (
              <div className="mt-6 p-6 bg-slate-900 rounded-[2rem] text-white">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Observaciones</div>
                <p className="text-xs font-medium text-slate-300 italic">"{entries[selectedIdx].notes || 'Sin notas...'}"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingEntry && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg h-[80dvh] sm:h-auto rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 sm:p-10 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-slate-800">Editar Registro</h3>
              <button onClick={() => setEditingEntry(null)} className="p-2"><X className="text-slate-400" /></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">Importe</label>
                <input type="number" step="0.01" inputMode="decimal" className="input-premium font-black text-xl text-blue-600" value={editingEntry.amount} onChange={e => setEditingEntry({ ...editingEntry, amount: parseFloat(e.target.value) })} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">Proveedor</label>
                <input className="input-premium font-bold" value={editingEntry.provider} onChange={e => setEditingEntry({ ...editingEntry, provider: e.target.value })} />
              </div>
              <button onClick={updateEntry} className="w-full btn-premium btn-premium-primary py-4 mt-4">Actualizar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatBox = ({ label, value, icon, color }: any) => (
  <div className={`p-6 rounded-[2rem] border transition-all hover:-translate-y-1 ${color === 'blue' ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-500/20' : 'bg-white border-slate-100 text-slate-800 shadow-sm'}`}>
    <div className="flex items-center gap-3 mb-4 opacity-70">
      {icon}
      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
    </div>
    <div className="text-3xl font-black tabular-nums">{value}</div>
  </div>
);

const ActionCard = ({ title, desc, icon, onAction, loading, color }: any) => (
  <button
    onClick={onAction}
    disabled={loading}
    className={`p-8 rounded-[2.5rem] text-left transition-all active:scale-[0.98] group flex flex-col justify-between h-full ${color === 'blue' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'bg-white border border-slate-100 shadow-xl'}`}
  >
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 ${color === 'blue' ? 'bg-white/20' : 'bg-slate-50 text-blue-600'}`}>
      {loading ? <Loader2 className="animate-spin" /> : React.cloneElement(icon as React.ReactElement, { size: 28 })}
    </div>
    <div>
      <h4 className="text-xl font-black mb-2 tracking-tight">{title}</h4>
      <p className={`text-xs font-medium leading-relaxed ${color === 'blue' ? 'text-blue-100' : 'text-slate-500'}`}>{desc}</p>
    </div>
  </button>
);

export default Summary;
