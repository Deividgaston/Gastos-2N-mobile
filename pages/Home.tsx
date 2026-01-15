
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, getDocs, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db, storage } from '../firebase-init';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ExpenseEntry, User } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { Camera, Plus, History, Clock, Tag, CreditCard, ChevronRight, Loader2, Image as ImageIcon } from 'lucide-react';
import { resizeImage } from '../utils/image-utils';
import { translations, Language } from '../utils/translations';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

interface HomeProps {
  user: User | null;
  lang: Language;
}

const Home: React.FC<HomeProps> = ({ user, lang }) => {
  const t = translations[lang].home;
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [formData, setFormData] = useState<ExpenseEntry>({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    provider: '',
    category: 'varios',
    paidWith: 'empresa',
    notes: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [resizedBlob, setResizedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    fetchRecentEntries();
  }, [user]);

  const fetchRecentEntries = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    if (user) {
      try {
        const q = query(
          collection(db, `users/${user.uid}/entries`),
          where('date', '>=', Timestamp.fromDate(startOfMonth)),
          where('date', '<', Timestamp.fromDate(endOfMonth)),
          orderBy('date', 'desc')
        );
        const snap = await getDocs(q);
        const list: ExpenseEntry[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          list.push({ ...data, id: doc.id, dateJs: (data.date as Timestamp).toDate() } as ExpenseEntry);
        });
        setEntries(list);
      } catch (err) {
        console.error("Error fetching entries:", err);
      }
    } else {
      const local = JSON.parse(localStorage.getItem('entries_local') || '[]');
      const filtered = local
        .filter((e: any) => {
          const d = new Date(e.date);
          return d >= startOfMonth && d < endOfMonth;
        })
        .reverse()
        .map((e: any) => ({ ...e, dateJs: new Date(e.date) }));
      setEntries(filtered);
    }
  };

  const handleScan = (fromCamera: boolean) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (fromCamera) input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setFormData(prev => ({ ...prev, date: new Date().toISOString().slice(0, 10) }));
      setShowReviewModal(true);

      setIsProcessing(true);
      try {
        const resized = await resizeImage(file);
        setResizedBlob(resized);

        const ab = await resized.arrayBuffer();
        const b64 = btoa(new Uint8Array(ab).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { text: 'Extrae proveedor, fecha (YYYY-MM-DD), categoría (comida, peajes, gasolina, transporte, alojamiento, ocio, servicios, varios o ingreso) e importe total EUR de este ticket.' },
              { inlineData: { mimeType: file.type, data: b64 } }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                provider: { type: Type.STRING },
                date: { type: Type.STRING },
                category: { type: Type.STRING },
                amount: { type: Type.NUMBER }
              },
              required: ["provider", "date", "category", "amount"]
            }
          }
        });

        const result = response.text;
        if (result) {
          const parsed = JSON.parse(result);
          setFormData(prev => ({
            ...prev,
            provider: parsed.provider || prev.provider,
            date: parsed.date || prev.date,
            amount: parsed.amount || prev.amount,
            category: parsed.category || prev.category
          }));
        }
      } catch (e) {
        console.error("Gemini OCR Error:", e);
      } finally {
        setIsProcessing(false);
      }
    };
    input.click();
  };

  const saveEntry = async () => {
    setIsSaving(true);
    try {
      let photoPath = '';
      let photoURL = '';

      if (user && resizedBlob) {
        const fileName = `tickets/${user.uid}/${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, resizedBlob);
        photoURL = await getDownloadURL(storageRef);
        photoPath = fileName;
      }

      if (user) {
        await addDoc(collection(db, `users/${user.uid}/entries`), {
          ...formData,
          date: new Date(formData.date),
          createdAt: serverTimestamp(),
          photoPath,
          photoURL,
        });
      } else {
        const local = JSON.parse(localStorage.getItem('entries_local') || '[]');
        local.push({ ...formData, photoURL: previewUrl });
        localStorage.setItem('entries_local', JSON.stringify(local));
      }
      setShowReviewModal(false);
      setResizedBlob(null);
      fetchRecentEntries();
      alert('OK ✅');
    } catch (e: any) {
      console.error(e);
      alert('Error al guardar: ' + (e.message || 'Desconocido'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* QUICK ACTIONS */}
      <section className="premium-card p-6 md:p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{translations[lang].home.scan}</h2>
          <p className="text-sm font-medium text-slate-400">{translations[lang].home.scanDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleScan(true)}
            className="group relative overflow-hidden flex flex-col items-center justify-center gap-3 p-5 bg-slate-900 text-white rounded-2xl shadow-xl transition-all active:scale-95 border-b-4 border-blue-600"
          >
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-blue-500/20">
              <Camera size={20} />
            </div>
            <div className="text-center">
              <span className="font-bold text-sm block">{t.scan}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Cámara</span>
            </div>
          </button>

          <button
            onClick={() => {
              setPreviewUrl('');
              setFormData({ date: new Date().toISOString().slice(0, 10), amount: 0, provider: '', category: 'varios', paidWith: 'empresa', notes: '' });
              setShowReviewModal(true);
            }}
            className="group flex flex-col items-center justify-center gap-3 p-5 bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 text-slate-800 rounded-2xl transition-all active:scale-95"
          >
            <div className="w-10 h-10 bg-slate-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 text-blue-600 shadow-sm">
              <Plus size={20} />
            </div>
            <div className="text-center">
              <span className="font-bold text-sm block">{t.manual}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">Sin IA</span>
            </div>
          </button>
        </div>
      </section>

      {/* RECENT LIST */}
      <section className="premium-card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
              <History size={14} />
            </div>
            <h2 className="text-base font-bold text-slate-800">{t.recent}</h2>
          </div>
          <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">{t.last5}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {entries.length > 0 ? entries.map((e, idx) => (
            <div key={idx} className="p-4 hover:bg-slate-50/80 transition-all flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent transition-all duration-300">
                  <i className={`fa-solid ${getCategoryIcon(e.category)} text-sm`}></i>
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors uppercase tracking-tight">{e.provider || '...'}</div>
                  <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    <Clock size={9} />
                    {e.dateJs?.toISOString().slice(0, 10)}
                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                    <Tag size={9} className="ml-1" />
                    {e.category}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-black text-slate-900 text-base">{e.amount.toFixed(2)}€</div>
                  <div className="flex items-center justify-end gap-1 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                    <CreditCard size={8} />
                    {e.paidWith}
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200 text-slate-300">
                <Plus size={24} />
              </div>
              <p className="font-bold text-slate-400 text-sm">{t.empty}</p>
            </div>
          )}
        </div>
      </section>

      {/* REVIEW MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-h-[85vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-500">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
              <h2 className="text-lg font-black text-slate-800">{t.modalTitle}</h2>
              <button onClick={() => setShowReviewModal(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                <Plus className="rotate-45" size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {isProcessing && (
                <div className="bg-blue-600 rounded-xl p-4 flex flex-col items-center gap-3 shadow-lg shadow-blue-500/20 text-white animate-pulse">
                  <Loader2 className="animate-spin" size={24} />
                  <div className="text-center">
                    <span className="block font-bold text-sm">{t.processing}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{t.iaWarning}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t.date}</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="input-premium font-bold text-sm py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t.amount}</label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                    className="input-premium font-black text-blue-600 text-lg py-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t.provider}</label>
                <input
                  value={formData.provider}
                  onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                  className="input-premium font-bold text-sm py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t.category}</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
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
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t.payment}</label>
                  <select
                    value={formData.paidWith}
                    onChange={(e) => setFormData(prev => ({ ...prev, paidWith: e.target.value }))}
                    className="input-premium font-bold appearance-none text-sm py-2"
                  >
                    <option value="empresa">Empresa</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t.notes}</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="input-premium resize-none text-sm py-2"
                  ></textarea>
                </div>
                {previewUrl && (
                  <div className="w-full sm:w-24 h-32 sm:h-24 flex-shrink-0">
                    <img src={previewUrl} className="w-full h-full object-cover rounded-xl border border-slate-100 shadow-md rotate-2 group-hover:rotate-0 transition-all duration-500" alt="preview" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => handleScan(false)}
                className="flex items-center gap-2 font-bold text-slate-500 hover:text-slate-800 transition-colors text-xs"
              >
                <Camera size={16} />
                <span>{t.redo}</span>
              </button>
              <button
                onClick={saveEntry}
                disabled={isProcessing || isSaving}
                className="btn-premium btn-premium-primary px-8 py-3 text-sm h-10"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <span>{t.save}</span>}
                {!isSaving && <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getCategoryIcon = (cat: string) => {
  const map: Record<string, string> = {
    comida: 'fa-utensils',
    peajes: 'fa-road',
    gasolina: 'fa-gas-pump',
    transporte: 'fa-taxi',
    alojamiento: 'fa-hotel',
    ocio: 'fa-mask',
    servicios: 'fa-wrench',
    ingreso: 'fa-money-bill-trend-up',
    varios: 'fa-ellipsis'
  };
  return map[cat] || 'fa-tag';
};

export default Home;


