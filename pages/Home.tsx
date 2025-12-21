
import React, { useState, useEffect } from 'react';
import { ExpenseEntry, User } from '../types';
// Import Gemini SDK
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface HomeProps {
  user: User | null;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  // Removed showOCRModal, ocrKey, ocrStatus as per Gemini API guidelines (no API key management in UI)
  const [formData, setFormData] = useState<ExpenseEntry>({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    provider: '',
    category: 'varios',
    paidWith: 'empresa',
    notes: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    fetchRecentEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchRecentEntries = async () => {
    if (user) {
      // Fixed window.firebase by casting to any
      const db = (window as any).firebase.firestore();
      const snap = await db.collection(`users/${user.uid}/entries`)
        .orderBy('date', 'desc')
        .limit(5)
        .get();
      const list: ExpenseEntry[] = [];
      snap.forEach((doc: any) => {
        const data = doc.data();
        list.push({ ...data, id: doc.id, dateJs: data.date.toDate() });
      });
      setEntries(list);
    } else {
      const local = JSON.parse(localStorage.getItem('entries_local') || '[]');
      setEntries(local.slice(-5).reverse().map((e: any) => ({ ...e, dateJs: new Date(e.date) })));
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
      
      // Use Gemini SDK for OCR as per guidelines
      setIsProcessing(true);
      try {
        const ab = await file.arrayBuffer();
        const b64 = btoa(new Uint8Array(ab).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
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

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
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
    try {
      if (user) {
        // Fixed window.firebase by casting to any
        const db = (window as any).firebase.firestore();
        await db.collection(`users/${user.uid}/entries`).add({
          ...formData,
          date: new Date(formData.date),
          createdAt: (window as any).firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const local = JSON.parse(localStorage.getItem('entries_local') || '[]');
        local.push(formData);
        localStorage.setItem('entries_local', JSON.stringify(local));
      }
      setShowReviewModal(false);
      fetchRecentEntries();
      alert('Guardado ✅');
    } catch (e) {
      alert('Error guardando');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* QUICK ACTIONS */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Acciones rápidas</h2>
            <p className="text-sm text-slate-500">Registra un nuevo gasto de forma instantánea.</p>
          </div>
          {/* Removed Configurar OCR button as per Gemini API guidelines */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            id="scanBtn"
            onClick={() => handleScan(true)}
            className="group flex flex-col items-center justify-center gap-3 p-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-md transition-all active:scale-95"
          >
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-camera text-2xl"></i>
            </div>
            <span className="font-bold text-lg">Escanear Ticket</span>
          </button>

          <button 
            id="manualBtn"
            onClick={() => {
              setPreviewUrl('');
              setFormData({ date: new Date().toISOString().slice(0, 10), amount: 0, provider: '', category: 'varios', paidWith: 'empresa', notes: '' });
              setShowReviewModal(true);
            }}
            className="group flex flex-col items-center justify-center gap-3 p-8 bg-white border-2 border-slate-100 hover:border-blue-100 hover:bg-blue-50 text-slate-700 rounded-2xl transition-all active:scale-95"
          >
            <div className="w-14 h-14 bg-slate-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform text-blue-600">
              <i className="fa-solid fa-plus text-2xl"></i>
            </div>
            <span className="font-bold text-lg">Ingreso Manual</span>
          </button>
        </div>
      </section>

      {/* RECENT LIST */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Notas recientes</h2>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Últimos 5</span>
        </div>
        <div id="lista" className="divide-y divide-slate-100">
          {entries.length > 0 ? entries.map((e, idx) => (
            <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <i className={`fa-solid ${getCategoryIcon(e.category)}`}></i>
                </div>
                <div>
                  <div className="font-bold text-slate-800">{e.provider || 'Sin proveedor'}</div>
                  <div className="text-xs text-slate-500">{e.dateJs?.toISOString().slice(0,10)} • {e.category}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-slate-900">{e.amount.toFixed(2)}€</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{e.paidWith}</div>
              </div>
            </div>
          )) : (
            <div className="p-12 text-center text-slate-400">
              <i className="fa-regular fa-folder-open text-4xl mb-3 block"></i>
              <p>Sin apuntes aún.</p>
            </div>
          )}
        </div>
      </section>

      {/* REVIEW MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 duration-300">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-800">Revisar y guardar</h2>
              <button onClick={() => setShowReviewModal(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              {isProcessing && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 animate-pulse">
                  <div className="animate-spin text-blue-600"><i className="fa-solid fa-circle-notch"></i></div>
                  <span className="text-sm font-semibold text-blue-700">Analizando ticket con Gemini OCR...</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha</label>
                  <input 
                    id="revDate" 
                    type="date" 
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Importe (€)</label>
                  <input 
                    id="revAmount" 
                    type="number" 
                    step="0.01" 
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Proveedor</label>
                <input 
                  id="revProvider" 
                  value={formData.provider}
                  onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                  placeholder="Ej: Gasolinera Cepsa"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Categoría</label>
                  <select 
                    id="revCategory" 
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Pago</label>
                  <select 
                    id="revPaidWith" 
                    value={formData.paidWith}
                    onChange={(e) => setFormData(prev => ({ ...prev, paidWith: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="empresa">Tarjeta empresa</option>
                    <option value="personal">Mi dinero</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Notas</label>
                  <textarea 
                    id="revNotes" 
                    rows={3} 
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                    placeholder="Detalles adicionales..."
                  ></textarea>
                </div>
                {previewUrl && (
                  <div className="w-full sm:w-28 h-40 sm:h-28 flex-shrink-0">
                    <img src={previewUrl} className="w-full h-full object-cover rounded-xl border border-slate-200 shadow-sm" alt="preview" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2">
                <button 
                  onClick={() => handleScan(false)}
                  className="bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <i className="fa-solid fa-paperclip"></i>
                  <span className="hidden sm:inline">Cambiar foto</span>
                </button>
              </div>
              <button 
                id="saveReview"
                onClick={saveEntry}
                disabled={isProcessing}
                className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
              >
                Guardar registro
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Removed OCR CONFIG MODAL as per Gemini API guidelines */}
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
