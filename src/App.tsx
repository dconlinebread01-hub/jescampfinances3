import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, where, addDoc, serverTimestamp, getDocs, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { FinancialDocument, DocumentType, OperationType, FirestoreErrorInfo } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  FileUp, 
  History, 
  FileText, 
  LogOut, 
  Menu, 
  X, 
  Search, 
  Download, 
  Printer,
  Plus,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Filter,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ArrowRight,
  Users,
  UserPlus,
  Shield
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { extractDocumentData } from './services/geminiService';
import { generateDocumentPDF, generateMonthlyStatementPDF } from './services/pdfService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Logo } from './components/Logo';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Auth Context ---
const ADMIN_EMAIL = "dconlinebread01@gmail.com";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isWhitelisted: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  isWhitelisted: false, 
  isAdmin: false 
});

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const isPrimaryAdmin = u.email === ADMIN_EMAIL;
        
        // Check whitelist
        try {
          const whitelistDoc = await getDoc(doc(db, 'whitelist', u.email || ''));
          const whitelisted = whitelistDoc.exists() || isPrimaryAdmin;
          setIsWhitelisted(whitelisted);

          // Check user role
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          const userData = userDoc.data();
          setIsAdmin(isPrimaryAdmin || userData?.role === 'admin');
        } catch (error) {
          console.error("Error checking whitelist/role:", error);
          setIsWhitelisted(isPrimaryAdmin);
          setIsAdmin(isPrimaryAdmin);
        }
      } else {
        setUser(null);
        setIsWhitelisted(false);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isWhitelisted, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Components ---
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      try {
        const parsed = JSON.parse(e.error.message);
        setError(parsed.error || 'An unexpected error occurred.');
      } catch {
        setError(e.error.message || 'An unexpected error occurred.');
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-card shadow-xl max-w-md w-full border border-slate-100">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertCircle size={32} />
          <h2 className="text-xl font-bold">Something went wrong</h2>
        </div>
        <p className="text-slate-600 mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="w-full bg-red-600 text-white py-3 rounded-button font-semibold hover:bg-red-700 transition-colors"
        >
          Reload Application
        </button>
      </div>
    </div>
    );
  }

  return <>{children}</>;
};

// --- Components ---
const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  documentName 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  documentName: string;
}) => {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText.toLowerCase() === 'delete';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-red-500" size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Confirm Deletion</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Are you sure you want to delete <span className="text-slate-900 font-bold">{documentName}</span>? 
                This action is permanent and cannot be undone.
              </p>

              <div className="space-y-4">
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Type "DELETE" to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE here..."
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-red-500 focus:ring-0 transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 rounded-2xl font-black text-sm text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    disabled={!isConfirmed}
                    onClick={onConfirm}
                    className="flex-1 py-4 rounded-2xl font-black text-sm bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Sidebar = ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (o: boolean) => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useContext(AuthContext);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Upload GRN', icon: FileUp, path: '/upload-grn' },
    { name: 'Upload Return', icon: FileUp, path: '/upload-return' },
    { name: 'Records History', icon: History, path: '/records' },
    { name: 'Monthly Statement', icon: FileText, path: '/statement' },
  ];

  if (isAdmin) {
    navItems.push({ name: 'Manage Staff', icon: Users, path: '/manage-staff' });
  }

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside className={cn(
        "fixed top-0 left-0 h-full w-72 bg-slate-900 border-r border-slate-800 z-50 transition-all duration-500 transform lg:translate-x-0 shadow-2xl overflow-hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Decorative background element */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="p-8 flex flex-col h-full relative">
          <div className="mb-12">
            <h2 className="text-xl font-black text-white tracking-tighter leading-tight">
              Jes'Camp <br/>
              <span className="text-primary">Gifts & Decorations</span>
            </h2>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 group relative",
                  location.pathname === item.path 
                    ? "bg-primary text-white shadow-xl shadow-primary/30" 
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon size={20} className={cn(
                  "transition-transform duration-300 group-hover:scale-110",
                  location.pathname === item.path ? "text-white" : "text-slate-500 group-hover:text-primary"
                )} />
                <span className="tracking-wide">{item.name}</span>
                {location.pathname === item.path && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-8 border-t border-slate-800/50">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all group border border-transparent hover:border-red-500/20"
            >
              <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
              <span className="tracking-wide">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

// --- Pages ---
const Login = () => {
  const { user, loading } = useContext(AuthContext);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        setError('Please allow popups for this site to sign in with Google.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google Sign-In. Please add it in the Firebase Console.');
      } else {
        setError('An error occurred during sign in. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left Pane: Atmospheric Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 items-center justify-center overflow-hidden">
        {/* Layered Gradients for Atmosphere */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_30%,#3a1510_0%,transparent_60%)] opacity-40" />
          <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_10%_80%,#6D28D9_0%,transparent_50%)] opacity-30" />
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[100px]" />
        </div>

        {/* Floating Decorative Elements */}
        <motion.div 
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ 
            y: [0, 20, 0],
            rotate: [0, -5, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" 
        />

        <div className="relative z-10 text-center px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Logo size="xl" className="mx-auto mb-8 scale-150" />
            <h2 className="text-5xl font-black text-white tracking-tighter mb-4 italic">
              Jes'Camp <span className="text-secondary">Finance</span>
            </h2>
            <p className="text-slate-400 text-lg font-medium max-w-md mx-auto leading-relaxed">
              Precision document automation for Kenya's leading gift and decoration specialists.
            </p>
          </motion.div>
        </div>

        {/* Vertical Rail Text */}
        <div className="absolute left-8 bottom-12 hidden xl:block">
          <p className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 opacity-50">
            ESTABLISHED 2024 • NAIROBI, KENYA
          </p>
        </div>
      </div>

      {/* Right Pane: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24 relative">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="lg:hidden mb-12">
              <Logo size="lg" />
            </div>

            <header className="mb-12">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">Welcome Back</h1>
              <p className="text-slate-500 font-medium">Sign in to access your financial dashboard and manage records.</p>
            </header>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600"
              >
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p className="text-sm font-bold leading-tight">{error}</p>
              </motion.div>
            )}

            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className={cn(
                "w-full group relative flex items-center justify-center gap-4 py-5 rounded-2xl font-black tracking-wide transition-all duration-300 shadow-2xl shadow-slate-200",
                isLoggingIn 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : "bg-slate-900 text-white hover:bg-black hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {isLoggingIn ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center p-1 group-hover:scale-110 transition-transform">
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-full h-full" />
                  </div>
                  SIGN IN WITH GOOGLE
                </>
              )}
            </button>

            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-black">Finance Portal v1.2</p>
                <div className="flex gap-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">System Online</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-300 font-medium leading-relaxed">
                By signing in, you agree to the internal data handling policies of Jes'Camp Gifts & Decorations LTD.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [docs, setDocs] = useState<FinancialDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    
    const q = query(
      collection(db, 'documents'),
      where('date', '>=', start.toISOString()),
      where('date', '<=', end.toISOString()),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialDocument));
      setDocs(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'documents'));

    return unsubscribe;
  }, []);

  const stats = {
    totalInvoices: docs.filter(d => d.type === DocumentType.INVOICE).length,
    totalCreditNotes: docs.filter(d => d.type === DocumentType.CREDIT_NOTE).length,
    netRevenue: docs.reduce((acc, d) => acc + (d.type === DocumentType.INVOICE ? d.orderTotal : -d.orderTotal), 0),
    totalVAT: docs.reduce((acc, d) => acc + (d.type === DocumentType.INVOICE ? d.vat : -d.vat), 0),
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Dashboard</h1>
        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[11px]">Overview for {format(new Date(), 'MMMM yyyy')}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Net Revenue', value: stats.netRevenue, color: 'text-primary', icon: DollarSign, bg: 'bg-primary/10', isCurrency: true },
          { label: 'Invoices Issued', value: stats.totalInvoices, color: 'text-blue-600', icon: TrendingUp, bg: 'bg-blue-600/10' },
          { label: 'Credit Notes', value: stats.totalCreditNotes, color: 'text-secondary', icon: TrendingDown, bg: 'bg-secondary/10' },
          { label: 'Total VAT', value: stats.totalVAT, color: 'text-emerald-600', icon: ShieldCheck, bg: 'bg-emerald-600/10', isCurrency: true },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-8 rounded-[2rem] relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
            <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 opacity-5 transition-transform duration-500 group-hover:scale-150", stat.bg.replace('/10', ''))} />
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-inner", stat.bg, stat.color)}>
              <stat.icon size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
            <p className={cn("text-2xl font-black tracking-tight", stat.color)}>
              {stat.isCurrency ? `KSh ${stat.value.toLocaleString()}` : stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Recent Transactions</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Latest financial activities</p>
          </div>
          <Link to="/records" className="text-primary text-sm font-black uppercase tracking-widest hover:text-primary-dark transition-colors flex items-center gap-2 group">
            View All
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] uppercase text-slate-400 font-black tracking-[0.2em]">
              <tr>
                <th className="px-8 py-6">Date</th>
                <th className="px-8 py-6">Store</th>
                <th className="px-8 py-6">Type</th>
                <th className="px-8 py-6 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {docs.slice(0, 5).map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6 text-sm font-bold text-slate-500">{format(new Date(doc.date), 'dd MMM yyyy')}</td>
                  <td className="px-8 py-6 text-sm font-black text-slate-900">{doc.storeName}</td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                      doc.type === DocumentType.INVOICE ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                    )}>
                      {doc.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-sm font-black text-right font-mono text-slate-900">
                    KSh {doc.orderTotal.toLocaleString()}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">No transactions recorded this month.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const UploadDocument = ({ type }: { type: DocumentType }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  const handleExtract = async () => {
    if (!preview) return;
    setExtracting(true);
    try {
      const base64 = preview.split(',')[1];
      const data = await extractDocumentData(base64, file?.type || 'image/jpeg', type);
      setExtractedData(data);
    } catch (error) {
      console.error(error);
      alert("Failed to extract data. Please try again.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData || !auth.currentUser) return;
    setSaving(true);
    try {
      const docData: Omit<FinancialDocument, 'id'> = {
        ...extractedData,
        type,
        createdBy: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'documents'), docData);
      
      // Automatic download after save
      const pdf = generateDocumentPDF(docData as FinancialDocument);
      const month = format(new Date(docData.date), 'MMMM').toUpperCase();
      const fileName = type === DocumentType.CREDIT_NOTE 
        ? `${docData.storeName} CREDIT NOTE ${month}`
        : `${docData.storeName} ${docData.documentNumber || docData.lpoNumber}`;
      pdf.save(`${fileName.trim()}.pdf`);

      navigate('/records');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'documents');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          {type === DocumentType.INVOICE ? 'Upload Goods Received Note' : 'Upload Goods Return Note'}
        </h1>
        <p className="text-slate-500">Extract data and generate {type === DocumentType.INVOICE ? 'Invoice' : 'Credit Note'}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-6">
          <div className={cn(
            "border-2 border-dashed rounded-card p-10 text-center transition-all",
            preview ? "border-primary-light bg-primary-light/30" : "border-slate-200 hover:border-primary-light"
          )}>
            {preview ? (
              <div className="space-y-4">
                {file?.type.startsWith('image/') ? (
                  <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-button shadow-sm" />
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center bg-slate-50 rounded-button border border-slate-100">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                      <FileText size={32} />
                    </div>
                    <p className="font-bold text-slate-900">{file?.name}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{(file?.size || 0) / 1024 > 1024 ? `${((file?.size || 0) / (1024 * 1024)).toFixed(2)} MB` : `${((file?.size || 0) / 1024).toFixed(2)} KB`}</p>
                  </div>
                )}
                <button onClick={() => {setFile(null); setPreview(null); setExtractedData(null);}} className="text-red-500 text-sm font-bold hover:underline">Remove Document</button>
              </div>
            ) : (
              <label className="cursor-pointer space-y-4 block">
                <div className="w-16 h-16 bg-primary-light text-primary rounded-button flex items-center justify-center mx-auto">
                  <Plus size={32} />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">Click to upload</p>
                  <p className="text-sm text-slate-500">or drag and drop source document (Image or PDF)</p>
                </div>
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <button 
            disabled={!preview || extracting}
            onClick={handleExtract}
            className="w-full bg-primary text-white py-4 rounded-button font-bold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary-light transition-all"
          >
            {extracting ? <Loader2 className="animate-spin" /> : <Search size={20} />}
            {extracting ? 'Extracting Data...' : 'Extract Document Data'}
          </button>
        </div>

        {/* Extracted Data Section */}
        <div className="bg-white rounded-card border border-slate-100 shadow-sm p-8 space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Review Data</h2>
          
          {!extractedData ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <AlertCircle size={48} strokeWidth={1} />
              <p>No data extracted yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</label>
                  <input 
                    type="date" 
                    value={extractedData.date} 
                    onChange={e => setExtractedData({...extractedData, date: e.target.value})}
                    className="w-full mt-1 p-3 bg-slate-50 border-none rounded-button text-sm font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{type === DocumentType.INVOICE ? 'LPO Number' : 'Return Order No'}</label>
                  <input 
                    type="text" 
                    value={extractedData.lpoNumber} 
                    onChange={e => setExtractedData({...extractedData, lpoNumber: e.target.value})}
                    className="w-full mt-1 p-3 bg-slate-50 border-none rounded-button text-sm font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{type === DocumentType.INVOICE ? 'Delivery Note / Invoice No' : 'Return Number'}</label>
                  <input 
                    type="text" 
                    value={extractedData.documentNumber} 
                    onChange={e => setExtractedData({...extractedData, documentNumber: e.target.value})}
                    className="w-full mt-1 p-3 bg-slate-50 border-none rounded-button text-sm font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Store Name</label>
                  <input 
                    type="text" 
                    value={extractedData.storeName} 
                    onChange={e => setExtractedData({...extractedData, storeName: e.target.value})}
                    className="w-full mt-1 p-3 bg-slate-50 border-none rounded-button text-sm font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-50 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-bold font-mono">KSh {extractedData.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">VAT (16%)</span>
                  <span className="font-bold font-mono">KSh {extractedData.vat.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg border-t border-slate-50 pt-3">
                  <span className="font-bold text-slate-900">Order Total</span>
                  <span className="font-black text-primary font-mono">KSh {extractedData.orderTotal.toLocaleString()}</span>
                </div>
              </div>

              <button 
                disabled={saving}
                onClick={handleSave}
                className="w-full bg-slate-900 text-white py-4 rounded-button font-bold hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                {saving ? 'Saving...' : `Generate & Save ${type === DocumentType.INVOICE ? 'Invoice' : 'Credit Note'}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Records = () => {
  const [docs, setDocs] = useState<FinancialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; doc: FinancialDocument | null }>({
    isOpen: false,
    doc: null
  });

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialDocument));
      setDocs(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'documents'));
    return unsubscribe;
  }, []);

  const filteredDocs = docs.filter(doc => {
    const matchesSearch = 
      doc.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.lpoNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || doc.type === filterType;
    return matchesSearch && matchesType;
  });

  const handlePrint = (doc: FinancialDocument) => {
    const pdf = generateDocumentPDF(doc);
    pdf.autoPrint();
    window.open(pdf.output('bloburl'), '_blank');
  };

  const handleDownload = (doc: FinancialDocument) => {
    const pdf = generateDocumentPDF(doc);
    const month = format(new Date(doc.date), 'MMMM').toUpperCase();
    const fileName = doc.type === DocumentType.CREDIT_NOTE 
      ? `${doc.storeName} CREDIT NOTE ${month}`
      : `${doc.storeName} ${doc.documentNumber || doc.lpoNumber}`;
    pdf.save(`${fileName.trim()}.pdf`);
  };

  const handleDelete = async () => {
    if (!deleteModal.doc?.id) return;
    
    try {
      await deleteDoc(doc(db, 'documents', deleteModal.doc.id));
      setDeleteModal({ isOpen: false, doc: null });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `documents/${deleteModal.doc.id}`);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, doc: null })}
        onConfirm={handleDelete}
        documentName={deleteModal.doc ? `${deleteModal.doc.type.replace('_', ' ')}: ${deleteModal.doc.lpoNumber}` : ''}
      />
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Records History</h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[11px]">Manage and view all generated documents</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search store or LPO..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold text-sm"
            />
          </div>
          <select 
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full md:w-auto px-6 py-4 bg-white border-none rounded-2xl shadow-sm text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value={DocumentType.INVOICE}>Invoices</option>
            <option value={DocumentType.CREDIT_NOTE}>Credit Notes</option>
          </select>
        </div>
      </header>

      <div className="glass-card rounded-[2.5rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] uppercase text-slate-400 font-black tracking-[0.2em]">
              <tr>
                <th className="px-8 py-6">Date</th>
                <th className="px-8 py-6">LPO / Return No</th>
                <th className="px-8 py-6">Store Name</th>
                <th className="px-8 py-6">Type</th>
                <th className="px-8 py-6 text-right">Total Amount</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6 text-sm font-bold text-slate-500">{format(new Date(doc.date), 'dd MMM yyyy')}</td>
                  <td className="px-8 py-6 text-sm font-mono font-bold text-slate-400">{doc.lpoNumber}</td>
                  <td className="px-8 py-6 text-sm font-black text-slate-900">{doc.storeName}</td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                      doc.type === DocumentType.INVOICE ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                    )}>
                      {doc.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-sm font-black text-right font-mono text-slate-900">
                    KSh {doc.orderTotal.toLocaleString()}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handlePrint(doc)}
                        className="p-3 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                        title="Print"
                      >
                        <Printer size={16} />
                      </button>
                      <button 
                        onClick={() => handleDownload(doc)}
                        className="p-3 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                        title="Download PDF"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteModal({ isOpen: true, doc })}
                        className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                        title="Delete Record"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest">No records found matching your criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MonthlyStatement = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [docs, setDocs] = useState<FinancialDocument[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStatementData = async () => {
    setLoading(true);
    const start = startOfMonth(parseISO(`${selectedMonth}-01`));
    const end = endOfMonth(parseISO(`${selectedMonth}-01`));
    
    const q = query(
      collection(db, 'documents'),
      where('date', '>=', start.toISOString()),
      where('date', '<=', end.toISOString()),
      orderBy('date', 'asc')
    );

    try {
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialDocument));
      setDocs(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatementData();
  }, [selectedMonth]);

  const totals = {
    subtotal: docs.reduce((acc, d) => acc + (d.type === DocumentType.INVOICE ? d.subtotal : -d.subtotal), 0),
    vat: docs.reduce((acc, d) => acc + (d.type === DocumentType.INVOICE ? d.vat : -d.vat), 0),
    total: docs.reduce((acc, d) => acc + (d.type === DocumentType.INVOICE ? d.orderTotal : -d.orderTotal), 0),
  };

  const handlePrint = () => {
    const pdf = generateMonthlyStatementPDF(format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy'), docs, totals);
    pdf.autoPrint();
    window.open(pdf.output('bloburl'), '_blank');
  };

  const handleDownload = () => {
    const pdf = generateMonthlyStatementPDF(format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy'), docs, totals);
    pdf.save(`Statement_${selectedMonth}.pdf`);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Monthly Statement</h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[11px]">Generate financial summaries for any month</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="flex-1 md:flex-none px-6 py-4 bg-white border-none rounded-2xl shadow-sm text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={handlePrint}
              disabled={docs.length === 0}
              className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-white text-slate-900 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
            >
              <Printer size={16} />
              Print
            </button>
            <button 
              onClick={handleDownload}
              disabled={docs.length === 0}
              className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-primary text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-dark disabled:opacity-50 shadow-xl shadow-primary/30 transition-all"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: 'Total Subtotal', value: totals.subtotal, color: 'text-slate-900', bg: 'bg-slate-400/10' },
              { label: 'Total VAT', value: totals.vat, color: 'text-emerald-600', bg: 'bg-emerald-600/10' },
              { label: 'Net Amount (Total)', value: totals.total, color: 'text-white', bg: 'bg-primary', isPrimary: true },
            ].map((stat, i) => (
              <div key={i} className={cn(
                "p-8 rounded-[2rem] relative overflow-hidden group transition-all duration-300 shadow-sm",
                stat.isPrimary ? "bg-primary shadow-xl shadow-primary/30 hover:scale-[1.02]" : "glass-card hover:bg-white/90"
              )}>
                <div className={cn("absolute top-0 left-0 w-1.5 h-full", stat.isPrimary ? "bg-white/20" : stat.bg.replace('/10', ''))} />
                <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-3", stat.isPrimary ? "text-white/60" : "text-slate-400")}>{stat.label}</p>
                <p className={cn("text-3xl font-black tracking-tight font-mono", stat.color)}>KSh {stat.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-[2.5rem] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] uppercase text-slate-400 font-black tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-6">Date</th>
                    <th className="px-8 py-6">LPO / Return No</th>
                    <th className="px-8 py-6">Store Name</th>
                    <th className="px-8 py-6">Type</th>
                    <th className="px-8 py-6 text-right">Subtotal</th>
                    <th className="px-8 py-6 text-right">VAT</th>
                    <th className="px-8 py-6 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {docs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6 text-sm font-bold text-slate-500">{format(new Date(doc.date), 'dd MMM yyyy')}</td>
                      <td className="px-8 py-6 text-sm font-mono font-bold text-slate-400">{doc.lpoNumber}</td>
                      <td className="px-8 py-6 text-sm font-black text-slate-900">{doc.storeName}</td>
                      <td className="px-8 py-6">
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                          doc.type === DocumentType.INVOICE ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                        )}>
                          {doc.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-right text-slate-500">KSh {doc.subtotal.toLocaleString()}</td>
                      <td className="px-8 py-6 text-sm font-bold text-right text-emerald-600">KSh {doc.vat.toLocaleString()}</td>
                      <td className="px-8 py-6 text-sm font-black text-right text-slate-900">KSh {doc.orderTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                  {docs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest">No documents found for the selected month.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ManageStaff = () => {
  const [emails, setEmails] = useState<{ email: string; addedAt: string }[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const q = query(collection(db, 'whitelist'), orderBy('addedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ email: doc.id, ...doc.data() } as any));
      setEmails(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'whitelist'));
    return unsubscribe;
  }, []);

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || adding) return;
    setAdding(true);
    try {
      await setDoc(doc(db, 'whitelist', newEmail.toLowerCase().trim()), {
        email: newEmail.toLowerCase().trim(),
        addedAt: new Date().toISOString(),
        addedBy: user?.uid
      });
      setNewEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `whitelist/${newEmail}`);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    try {
      await deleteDoc(doc(db, 'whitelist', email));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `whitelist/${email}`);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic">Manage Staff</h1>
        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[11px] mt-2">Authorize team members to access the system</p>
      </header>

      <div className="glass-card rounded-[2.5rem] p-8">
        <form onSubmit={handleAddEmail} className="flex gap-4">
          <div className="flex-1 relative">
            <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter staff email address..."
              required
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="bg-primary text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-dark disabled:opacity-50 shadow-xl shadow-primary/30 transition-all"
          >
            {adding ? <Loader2 className="animate-spin" /> : 'Add Staff'}
          </button>
        </form>
      </div>

      <div className="glass-card rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Authorized Staff</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Total: {emails.length} members</p>
        </div>
        <div className="divide-y divide-slate-50">
          {emails.map((item) => (
            <div key={item.email} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{item.email}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Added {format(new Date(item.addedAt), 'MMM dd, yyyy')}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveEmail(item.email)}
                className="p-3 rounded-xl bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all"
                title="Remove Access"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {emails.length === 0 && (
            <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">
              No staff members authorized yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Layout ---
const AppLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading, isWhitelisted, isAdmin } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <main className="lg:ml-72 min-h-screen">
        <header className="glass-card h-20 flex items-center justify-between px-8 lg:px-12 sticky top-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-3 -ml-3 text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-900 tracking-tighter">
              {location.pathname === '/' ? 'Dashboard' : 
               location.pathname === '/records' ? 'Financial Records' : 
               'Monthly Statement'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] -mt-1">
              Jes'Camp Gifts & Decorations
            </p>
          </div>

          <div className="flex items-center gap-6 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-900 leading-none mb-1">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{user.email}</p>
            </div>
            <div className="relative group">
              <div className="w-12 h-12 rounded-2xl bg-brand-gradient p-[2px] shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
                <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center overflow-hidden">
                  <span className="text-lg font-black text-primary">
                    {user.displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || user.email?.[0].toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full shadow-sm" />
            </div>
          </div>
        </header>

        <div className="p-8 lg:p-12 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/upload-grn" element={<UploadDocument type={DocumentType.INVOICE} />} />
                <Route path="/upload-return" element={<UploadDocument type={DocumentType.CREDIT_NOTE} />} />
                <Route path="/records" element={<Records />} />
                <Route path="/statement" element={<MonthlyStatement />} />
                {isAdmin && <Route path="/manage-staff" element={<ManageStaff />} />}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </Router>
      </ErrorBoundary>
    </AuthProvider>
  );
}
