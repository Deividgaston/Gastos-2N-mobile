import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase-init';
import { UserPlus, ShieldCheck, Mail, Send, Trash2, ShieldAlert, Smartphone, Copy, X, Ban, CheckCircle2 } from 'lucide-react';

interface WhitelistedUser {
    id: string;
    email: string;
    isAdmin: boolean;
    isWhitelisted: boolean;
    createdAt?: any;
}

const Admin: React.FC = () => {
    const [emails, setEmails] = useState<WhitelistedUser[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState<{ show: boolean, email: string }>({ show: false, email: '' });

    useEffect(() => {
        const checkMobile = () => {
            console.log("Admin panel window width:", window.innerWidth);
            setIsMobile(window.innerWidth < 640);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const q = query(collection(db, 'whitelisted_users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const users: WhitelistedUser[] = [];
            snapshot.forEach((doc) => {
                users.push({ id: doc.id, ...doc.data() } as WhitelistedUser);
            });
            setEmails(users);
        }, (err) => {
            console.error("Firestore error in Admin:", err);
            if (err.code === 'permission-denied') {
                alert("Firestore Permission Denied. Please ensure you have configured the rules for 'whitelisted_users' collection.");
            }
        });

        return () => {
            window.removeEventListener('resize', checkMobile);
            unsubscribe();
        };
    }, []);

    const handleAddEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) return alert('Valid email required');
        try {
            await addDoc(collection(db, 'whitelisted_users'), {
                email: newEmail.toLowerCase().trim(),
                isAdmin: false,
                isWhitelisted: true,
                createdAt: new Date()
            });
            setNewEmail('');
        } catch (err) {
            console.error(err);
            alert('Error adding user');
        }
    };

    const handleToggleAdmin = async (user: WhitelistedUser) => {
        try {
            await updateDoc(doc(db, 'whitelisted_users', user.id), {
                isAdmin: !user.isAdmin
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleWhitelist = async (user: WhitelistedUser) => {
        try {
            await updateDoc(doc(db, 'whitelisted_users', user.id), {
                isWhitelisted: !user.isWhitelisted
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure?')) {
            await deleteDoc(doc(db, 'whitelisted_users', id));
        }
    };

    const sendWhatsAppInvite = (email: string) => {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?auth=invite`;
        const message = `¡Hola! 👋 Has sido invitado a la plataforma de Gastos 2N. 
        
Tu correo ya está autorizado: ${email}

Puedes acceder usando tu cuenta de Google o creando una con Email y Contraseña aquí:
${inviteUrl}`;

        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    };

    const openInviteModal = (email: string) => {
        setShowInviteModal({ show: true, email });
    };

    const copyInviteToClipboard = () => {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?auth=invite`;
        const textToCopy = `¡Hola! 👋 Has sido invitado a la plataforma de Gastos 2N.

Tu correo ya está autorizado: ${showInviteModal.email}

Puedes acceder usando tu cuenta de Google o creando una con Email y Contraseña aquí:
${inviteUrl}`;

        navigator.clipboard.writeText(textToCopy);
        alert('Copiado al portapapeles');
    };

    const sendEmailInvite = async (email: string) => {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?auth=email`;

        try {
            await addDoc(collection(db, 'mail'), {
                to: email,
                message: {
                    subject: 'Invitación a Gastos 2N',
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #2563eb;">¡Hola! 👋</h2>
                            <p>Has sido invitado a usar la plataforma de gestión de gastos e ingresos de **2N**.</p>
                            <p>Tu cuenta ya ha sido autorizada.</p>
                            <div style="margin: 30px 0;">
                                <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                                    Configurar mi cuenta ahora
                                </a>
                            </div>
                            <p style="font-size: 12px; color: #666;">Si el botón no funciona, copia y pega este enlace: <br/> ${inviteUrl}</p>
                        </div>
                    `
                }
            });
            alert('Invitación enviada por email correctamente (Vía Firebase)');
        } catch (err) {
            console.error(err);
            alert('Error al enviar la invitación por email');
        }
    };

    if (isMobile) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 animate-fade-in">
                <Smartphone size={48} className="text-blue-500" />
                <h2 className="text-xl font-black text-slate-800">Panel de Administración</h2>
                <p className="text-sm text-slate-500 max-w-xs">
                    El panel de administración está optimizado para pantallas grandes. Por favor, accede desde un ordenador para gestionar usuarios con mayor comodidad.
                </p>
                <div className="pt-4 border-t border-slate-100 w-full">
                    <p className="text-[10px] font-black uppercase text-slate-400">Ancho detectado: {window.innerWidth}px</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-10">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <ShieldCheck className="text-blue-600" size={32} />
                        User Administration
                    </h2>
                    <p className="text-slate-500 font-medium mt-1 uppercase text-[10px] tracking-widest">Manage whitelisted accounts & permissions</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ADD USER CARD */}
                <div className="lg:col-span-1 premium-card p-8 space-y-6 h-fit bg-slate-900 text-white">
                    <div className="flex items-center gap-3">
                        <UserPlus size={20} className="text-blue-400" />
                        <h3 className="font-bold">Authorize New User</h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Authorized users can log in. No one else can access the platform.
                    </p>
                    <div className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="email"
                                placeholder="user@example.com"
                                className="w-full bg-slate-800 border-none rounded-xl py-3 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={handleAddEmail}
                            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            Authorize Email
                        </button>
                    </div>
                </div>

                {/* USER LIST TABLE */}
                <div className="lg:col-span-2 premium-card overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Accounts ({emails.length})</span>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 italic text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4">Email Address</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {emails.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-slate-700">{u.email}</td>
                                        <td className="px-6 py-4">
                                            {u.isAdmin ? (
                                                <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter shadow-sm">Super Admin</span>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter">Standard User</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleToggleAdmin(u)}
                                                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${u.isAdmin ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-900'}`}
                                                    title="Toggle Admin Rights"
                                                >
                                                    <ShieldAlert size={16} />
                                                </button>
                                                <button
                                                    onClick={() => sendWhatsAppInvite(u.email)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                                    title="Invite via WhatsApp"
                                                >
                                                    <Send size={16} />
                                                </button>
                                                <button
                                                    onClick={() => openInviteModal(u.email)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                    title="Copy Invitation Text"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleWhitelist(u)}
                                                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${u.isWhitelisted ? 'bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'}`}
                                                    title={u.isWhitelisted ? "Inhabilitar Acceso" : "Habilitar Acceso"}
                                                >
                                                    {u.isWhitelisted ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(u.id)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                    title="Borrar Definitivamente"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* INVITE MODAL */}
            {showInviteModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Texto de Invitación</h3>
                            <button
                                onClick={() => setShowInviteModal({ show: false, email: '' })}
                                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {`¡Hola! 👋 Has sido invitado a la plataforma de Gastos 2N.\n\nTu correo ya está autorizado: ${showInviteModal.email}\n\nPuedes acceder usando tu cuenta de Google o creando una con Email y Contraseña aquí:\n${window.location.origin}${window.location.pathname}?auth=invite`}
                                </p>
                            </div>
                            <button
                                onClick={copyInviteToClipboard}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-blue-100 transition-all active:scale-95"
                            >
                                <Copy size={18} />
                                Copiar al Portapapeles
                            </button>
                            <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                                Copia este texto y mándalo por email, Teams o cualquier otra plataforma.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
