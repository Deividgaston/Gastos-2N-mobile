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

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    setMonth(date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'));
  };

  const fetchMonthData = async () => {
    const parts = month.split('-');
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 1);

    try {
      if (user) {
        const qExpenses = query(
          collection(db, `users/${user.uid}/entries`),
          where('date', '>=', Timestamp.fromDate(start)),
          where('date', '<', Timestamp.fromDate(end)),
          orderBy('date', 'desc')
        );
        const qKms = query(
          collection(db, `users/${user.uid}/kms`),
          where('date', '>=', Timestamp.fromDate(start)),
          where('date', '<', Timestamp.fromDate(end))
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
          date: dateJs || new Date(data.date)
        });
      }
      setEditingEntry(null);
      fetchMonthData();
    } catch (e) {
      console.error(e);
      alert('Error updating: ' + (e as any).message);
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

  const getLogoBase64 = async () => {
    try {
      const resp = await fetch('logo.png');
      const blob = await resp.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const i18n = translations[lang].summary;

  const buildPdf = async () => {
    try {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();

      // Forced English Strings
      const L = {
        title: "Expenses - Monthly Summary",
        monthLabel: "Reporting Period:",
        expSum: "Expenses summary",
        milSum: "Mileage summary",
        totalExp: "Total expenses:",
        paidMe: "Paid with my money:",
        compOwes: "Company owes me:",
        compMil: "Company mileage:",
        persMil: "Personal mileage:",
        persCost: "Personal mileage cost (km * €/L * l/100km):",
        hDate: "Date",
        hProvider: "Provider",
        hCat: "Category",
        hPaid: "Paid with",
        hNotes: "Notes",
        hAmt: "Amount",
        hType: "Type",
        hKm: "KM",
        hCons: "l/100km",
        hFuel: "€/L",
        hCost: "Personal cost"
      };

      const logoBase64 = await getLogoBase64();
      if (logoBase64) {
        // Correct aspect ratio 1.4 (28x20mm)
        doc.addImage(logoBase64, 'PNG', 14, 10, 28, 20);
      }

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28); doc.setTextColor(30, 41, 59); // slate-800
      doc.text(L.title, 46, 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11); doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`${L.monthLabel} ${month}`, 46, 30);

      // --- Summary Cards Section ---
      const cardHeight = 38;
      const cardWidth = 88;
      const cardY = 48;

      // Card Style Helper
      const drawCard = (x: number, y: number, title: string, lines: string[], accentColor: [number, number, number]) => {
        // Shadow simulation
        doc.setDrawColor(248, 250, 252); doc.setFillColor(248, 250, 252);
        (doc as any).roundedRect(x + 1, y + 1, cardWidth, cardHeight, 5, 5, "F");

        // Main Card
        doc.setDrawColor(226, 232, 240); doc.setFillColor(255, 255, 255);
        (doc as any).roundedRect(x, y, cardWidth, cardHeight, 5, 5, "FD");

        // Accent bar
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        (doc as any).roundedRect(x + 2, y + 4, 3, 10, 1, 1, "F");

        // Content
        doc.setTextColor(30, 41, 59); doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text(title, x + 8, y + 11);

        doc.setFont("helvetica", "medium"); doc.setFontSize(10); doc.setTextColor(71, 85, 105);
        lines.forEach((line, idx) => {
          doc.text(line, x + 8, y + 19 + (idx * 7));
        });
      };

      drawCard(14, cardY, L.expSum, [
        `${L.totalExp} ${stats.total.toFixed(2)} €`,
        `${L.paidMe} ${stats.personal.toFixed(2)} €`,
        `${L.compOwes} ${companyOwes.toFixed(2)} €`
      ], [37, 99, 235]); // blue-600

      drawCard(108, cardY, L.milSum, [
        `${L.compMil} ${stats.kmEmp.toFixed(1)} km`,
        `${L.persMil} ${stats.kmPer.toFixed(1)} km`,
        `${L.persCost} ${stats.kmCostPer.toFixed(2)} €`
      ], [15, 23, 42]); // slate-900

      // --- Expenses Table ---
      (doc as any).autoTable({
        startY: 100,
        head: [[L.hDate, L.hProvider, L.hCat, L.hPaid.toUpperCase(), L.hNotes, L.hAmt]],
        body: entries.map(e => [
          e.dateJs?.toISOString().slice(0, 10),
          e.provider,
          e.category,
          e.paidWith.toUpperCase(),
          e.notes || "-",
          Number(e.amount).toFixed(2)
        ]),
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
        bodyStyles: { textColor: [51, 65, 85], cellPadding: 4 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, font: "helvetica", cellPadding: 3 },
        columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } }
      });

      // --- Mileage Table ---
      const finalY = (doc as any).lastAutoTable.finalY + 12;
      (doc as any).autoTable({
        startY: finalY,
        head: [[L.hDate, L.hType, L.hKm, L.hCons, L.hFuel, L.hCost, L.hNotes]],
        body: kms.map(k => {
          const isPersonal = String(k.type).toLowerCase().includes('per');
          let cost = "-";
          if (isPersonal && k.fuelPrice) {
            cost = ((Number(k.km || k.distance) || 0) * k.fuelPrice * ((k.consumption || 6.0) / 100)).toFixed(2);
          }
          return [
            k.dateJs?.toISOString().slice(0, 10),
            String(k.type).toUpperCase(),
            (k.km || k.distance || 0).toFixed(1),
            (k.consumption || 6.0).toFixed(1),
            k.fuelPrice?.toFixed(2) || "-",
            cost,
            k.notes || "-"
          ];
        }),
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", halign: 'left' },
        bodyStyles: { textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, font: "helvetica", cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 30 },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 15, halign: 'center' }, // Consumption
          4: { cellWidth: 15, halign: 'center' }, // Fuel
          5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }, // Cost
          6: { cellWidth: 'auto' } // Notes
        }
      });

      doc.save(`Expenses_2N_${month}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Error generating PDF. Please ensure libraries are loaded.");
    }
  };

  const exportExcel = async () => {
    if (!entries.length) return alert('No data to export');
    setIsExporting('excel');
    try {
      const XLSX = (window as any).XLSX;
      if (!XLSX) throw new Error("XLSX library not loaded");

      const wb = XLSX.utils.book_new();
      const dataRows = [
        ["EXPENSES REPORT"],
        [`PERIOD: ${month}`],
        [],
        ["SUMMARY SECTION"],
        ["METRIC", "VALUE", "UNIT"],
        ["TOTAL MONTHLY EXPENSES", Number(stats.total).toFixed(2), "EUR"],
        ["PAID WITH PERSONAL FUNDS", Number(stats.personal).toFixed(2), "EUR"],
        ["COMPANY DEBT TO EMPLOYEE", Number(companyOwes).toFixed(2), "EUR"],
        ["KM COMPANY (PROFESSIONAL)", Number(stats.kmEmp).toFixed(1), "KM"],
        ["KM PERSONAL (REIMBURSABLE)", Number(stats.kmPer).toFixed(1), "KM"],
        ["PERSONAL REBATE COST", Number(stats.kmCostPer).toFixed(2), "EUR"],
        [],
        ["DETAILED EXPENSES LIST"],
        ["DATE", "VENDOR / PROVIDER", "CATEGORY", "METHOD", "NOTES", "AMOUNT"],
      ];

      entries.forEach(e => {
        dataRows.push([
          e.dateJs?.toISOString().slice(0, 10),
          e.provider.toUpperCase(),
          String(e.category).toUpperCase(),
          String(e.paidWith).toUpperCase(),
          e.notes || "-",
          e.amount
        ]);
      });

      dataRows.push([], ["DETAILED MILEAGE LOG"], ["DATE", "TRIP TYPE", "DISTANCE", "FUEL PRICE", "EST. CONS.", "NOTES"]);
      kms.forEach(k => {
        dataRows.push([
          k.dateJs?.toISOString().slice(0, 10),
          String(k.type).toUpperCase(),
          (k.km || k.distance || 0).toFixed(1),
          (k.fuelPrice || 0).toFixed(2),
          (k.consumption || 6.0).toFixed(1),
          k.notes || "-"
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);

      // --- APPLY STYLES ---
      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:F1");

      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (!ws[cellRef]) continue;

          const cellValue = String(ws[cellRef].v || "");

          // Header Styles (Sections)
          if (["EXPENSES REPORT", "SUMMARY SECTION", "DETAILED EXPENSES LIST", "DETAILED MILEAGE LOG"].includes(cellValue)) {
            ws[cellRef].s = {
              fill: { fgColor: { rgb: "000000" } },
              font: { color: { rgb: "FFFFFF" }, bold: true, sz: 14 },
              alignment: { horizontal: "center" }
            };
          }

          // Sub-headers (The column names)
          if (["METRIC", "VALUE", "UNIT", "DATE", "VENDOR / PROVIDER", "CATEGORY", "METHOD", "NOTES", "AMOUNT", "TRIP TYPE", "DISTANCE", "FUEL PRICE", "EST. CONS."].includes(cellValue)) {
            ws[cellRef].s = {
              fill: { fgColor: { rgb: "334155" } }, // slate-700
              font: { color: { rgb: "FFFFFF" }, bold: true },
              border: { bottom: { style: "thin", color: { rgb: "000000" } } }
            };
          }

          // Zebra Striping for data rows
          if (r > 13 && r % 2 === 0 && ws[cellRef].v) {
            ws[cellRef].s = { ...ws[cellRef].s, fill: { fgColor: { rgb: "F1F5F9" } } };
          }
        }
      }

      // --- AUTO-FIT COLUMNS ---
      const colWidths = dataRows.reduce((acc, row) => {
        row.forEach((cell, i) => {
          const len = cell ? String(cell).length : 5;
          if (!acc[i] || len > acc[i]) acc[i] = len;
        });
        return acc;
      }, [] as number[]);

      ws['!cols'] = colWidths.map(w => ({ wch: w + 4 })); // Add padding for better look

      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `Expenses_2N_${month}.xlsx`);
    } catch (e) {
      console.error("Excel Export Error:", e);
      alert(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsExporting(null);
    }
  };

  const exportZip = async () => {
    // Include all entries that have any type of photo reference
    const withPhotos = entries.filter(e => e.photoPath || e.photoURL);

    if (!withPhotos.length) {
      return alert(lang === 'ES' ? 'No hay fotos para descargar en este mes.' : 'No photos to download for this month.');
    }

    setIsExporting('zip');
    let successCount = 0;

    try {
      const JSZip = (window as any).JSZip;
      if (!JSZip) throw new Error("JSZip library not loaded");

      const zip = new JSZip();
      const folder = zip.folder(`Tickets_${month}`);

      console.log(`Starting ZIP export for ${withPhotos.length} photos...`);

      for (let i = 0; i < withPhotos.length; i++) {
        const e = withPhotos[i];
        try {
          let blob: Blob | null = null;
          let downloadUrl = e.photoURL || '';

          // 1. If we have photoPath, get a fresh download URL (most reliable)
          if (e.photoPath) {
            try {
              downloadUrl = await getDownloadURL(ref(storage, e.photoPath));
            } catch (err) {
              console.warn(`Could not get download URL for ${e.photoPath}`, err);
            }
          }

          if (!downloadUrl) continue;

          // 2. Fetch the actual image data
          const resp = await fetch(downloadUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          blob = await resp.blob();

          if (blob) {
            const dateStr = e.dateJs ? e.dateJs.toISOString().slice(0, 10) : (typeof e.date === 'string' ? e.date.slice(0, 10) : 'unknown');
            const fileName = `${dateStr}_${(e.provider || 'ticket').replace(/[^a-z0-9]/gi, '_')}_${i + 1}.jpg`;
            folder.file(fileName, blob);
            successCount++;
          }
        } catch (err) {
          console.error(`Error processing photo ${i + 1} (${e.provider}):`, err);
        }
      }

      if (successCount === 0) {
        throw new Error(lang === 'ES' ? "No se pudo descargar ninguna imagen (Problema de conexión o CORS)" : "Could not download any images (Connection or CORS issue)");
      }

      console.log(`ZIP ready with ${successCount} images. Generating file...`);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Tickets_2N_${month}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (successCount < withPhotos.length) {
        alert(lang === 'ES'
          ? `ZIP generado con éxito, pero faltaron ${withPhotos.length - successCount} imágenes que no se pudieron descargar.`
          : `ZIP generated, but ${withPhotos.length - successCount} images failed to download.`);
      }
    } catch (e: any) {
      console.error("ZIP Export Error:", e);
      alert(e.message || 'Error generating ZIP');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-10">
      {/* HEADER & CONTROLS */}
      <section className="premium-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-blue-600" size={20} />
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{i18n.report}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeMonth(-1)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-200 active:scale-95"
                >
                  <ChevronRight className="rotate-180" size={18} />
                </button>

                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="month"
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    className="input-premium pl-10 font-bold w-40 h-10 text-sm"
                  />
                </div>

                <button
                  onClick={() => changeMonth(1)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-200 active:scale-95"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 opacity-50 grayscale pointer-events-none">
                <div className="px-3 py-1.5 rounded-lg text-[9px] font-black bg-white text-blue-600 shadow-sm">{lang}</div>
              </div>
            </div>
          </div>

          {/* FINANCIAL SUMMARY CARD */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white md:min-w-[360px] shadow-2xl relative overflow-hidden border-b-4 border-blue-600 group transition-all hover:scale-[1.01]">
            <div className="absolute -right-8 -top-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Wallet size={140} />
            </div>
            <div className="relative z-10">
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-400 mb-1">{i18n.reimbursement}</div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-slate-400 text-[10px] font-bold">{lang === 'ES' ? 'A reembolsar' : lang === 'EN' ? 'To reimburse' : 'A reembolsar'}</span>
                <span className="text-4xl font-extrabold tabular-nums tracking-tighter">{companyOwes.toFixed(2)}€</span>
              </div>
              <div className="h-px bg-white/10 my-4"></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Pagado Pers.</div>
                  <div className="font-bold text-xs text-slate-200">+{stats.personal.toFixed(2)}€</div>
                </div>
                <div>
                  <div className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Deducir KM</div>
                  <div className="font-bold text-xs text-orange-400">-{stats.kmCostPer.toFixed(2)}€</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PERSISTENT STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label={i18n.total} value={`${stats.total.toFixed(2)}€`} icon={<Wallet size={14} />} color="blue" />
          <StatBox label={i18n.personal} value={`${stats.personal.toFixed(2)}€`} icon={<UserCheck size={14} />} color="slate" />
          <StatBox label="KM Empresa" value={`${stats.kmEmp.toFixed(1)} km`} icon={<Briefcase size={14} />} color="slate" />
          <StatBox label={i18n.km} value={`${stats.kmPer.toFixed(1)} km`} icon={<HomeIcon size={14} />} color="slate" />
        </div>
      </section>

      {/* EXPORT ACTIONS GRID */}
      <section className="grid grid-cols-3 gap-3">
        <ActionCard title="PDF" desc="Descargar" icon={<Download size={16} />} onAction={buildPdf} color="blue" compact />
        <ActionCard title="Excel" desc="Exportar" icon={<FileSpreadsheet size={16} />} onAction={exportExcel} loading={isExporting === 'excel'} color="white" compact />
        <ActionCard title="ZIP" desc="Tickets" icon={<Archive size={16} />} onAction={exportZip} loading={isExporting === 'zip'} color="navy" compact />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Editar Ticket</h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[80vh] space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Fecha</label>
                  <input
                    type="date"
                    value={editingEntry.dateJs ? editingEntry.dateJs.toISOString().slice(0, 10) : ''}
                    onChange={e => setEditingEntry({ ...editingEntry, dateJs: new Date(e.target.value) })}
                    className="input-premium font-bold text-sm py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Importe</label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={editingEntry.amount}
                    onChange={e => setEditingEntry({ ...editingEntry, amount: parseFloat(e.target.value) })}
                    className="input-premium font-black text-blue-600 text-lg py-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Proveedor</label>
                <input
                  value={editingEntry.provider}
                  onChange={e => setEditingEntry({ ...editingEntry, provider: e.target.value })}
                  className="input-premium font-bold text-sm py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Categoría</label>
                  <select
                    value={editingEntry.category}
                    onChange={e => setEditingEntry({ ...editingEntry, category: e.target.value })}
                    className="input-premium font-bold appearance-none text-sm py-2"
                  >
                    <option value="comida">Comida</option>
                    <option value="peajes">Peajes</option>
                    <option value="gasolina">Gasolina</option>
                    <option value="transporte">Transporte</option>
                    <option value="alojamiento">Alojamiento</option>
                    <option value="ocio">Ocio</option>
                    <option value="servicios">Servicios</option>
                    <option value="varios">Varios</option>
                    <option value="ingreso">Ingreso</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Pago</label>
                  <select
                    value={editingEntry.paidWith}
                    onChange={e => setEditingEntry({ ...editingEntry, paidWith: e.target.value })}
                    className="input-premium font-bold appearance-none text-sm py-2"
                  >
                    <option value="empresa">Empresa</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Notas</label>
                <textarea
                  rows={3}
                  value={editingEntry.notes || ''}
                  onChange={e => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                  className="input-premium resize-none text-sm py-2"
                ></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={updateEntry}
                className="btn-premium btn-premium-primary px-6 py-2 text-sm h-10 w-full md:w-auto"
              >
                <span>Guardar Cambios</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatBox = ({ label, value, icon, color }: any) => (
  <div className={`p-4 rounded-2xl border transition-all hover:-translate-y-1 ${color === 'blue' ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-500/20' : 'bg-white border-slate-100 text-slate-800 shadow-sm'}`}>
    <div className="flex items-center gap-2 mb-2 opacity-70">
      {icon}
      <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
    </div>
    <div className="text-2xl font-black tabular-nums">{value}</div>
  </div>
);

const ActionCard = ({ title, desc, icon, onAction, color, loading, compact }: any) => {
  const isDark = color === 'blue' || color === 'navy';
  return (
    <button
      onClick={onAction}
      disabled={loading}
      className={`p-3 rounded-2xl flex items-center gap-3 text-left transition-all active:scale-95 group w-full shadow-lg ${loading ? 'opacity-70' : ''} ${color === 'blue'
        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20'
        : color === 'navy'
          ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
          : 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-100'
        }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${color === 'blue' || color === 'navy' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600'
        }`}>
        {loading ? <Loader2 className="animate-spin" size={14} /> : icon}
      </div>
      <div className="min-w-0">
        <h3 className={`font-black text-xs truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
        {!compact && <p className={`text-[9px] font-medium leading-tight truncate ${isDark ? 'text-blue-100' : 'text-slate-400'}`}>{desc}</p>}
      </div>
    </button>
  );
};

export default Summary;
