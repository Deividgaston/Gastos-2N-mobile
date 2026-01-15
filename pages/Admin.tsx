import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase-init';
import { UserPlus, ShieldCheck, Mail, Send, Trash2, ShieldAlert, Smartphone } from 'lucide-react';

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

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const q = query(collection(db, 'whitelisted_users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const users: WhitelistedUser[] = [];
            snapshot.forEach((doc) => {
                users.push({ id: doc.id, ...doc.data() } as WhitelistedUser);
            });
            setEmails(users);
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

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure?')) {
            await deleteDoc(doc(db, 'whitelisted_users', id));
        }
    };

    const sendWhatsAppInvite = (email: string) => {
        const appUrl = window.location.origin;
        const message = `Hola! 👋 Has sido invitado a la plataforma de Gastos 2N. 
    Tu correo ya está autorizado: ${email}
    Accede aquí: ${appUrl}
    Introduce tu correo de Google para empezar.`;

        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    };

    if (isMobile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-4">
                <Smartphone size={64} className="text-slate-300" />
                <h2 className="text-xl font-black text-slate-800">Desktop Only</h2>
                <p className="text-slate-500 text-sm">Please access the Admin Panel from a computer to manage users safely.</p>
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
                                                    onClick={() => handleDelete(u.id)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                    title="Revoke Authorization"
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
        </div>
    );
};

export default Admin;
