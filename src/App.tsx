import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { 
  Book as BookIcon, 
  Users, 
  Shield, 
  LogOut, 
  LayoutDashboard, 
  Search, 
  Plus, 
  Trash2, 
  Scan, 
  History, 
  MessageSquare,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Send,
  XCircle,
  CreditCard,
  ArrowLeft,
  Upload,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { User, Book, Borrowing, SecurityLog, BookProposal } from './types';

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('bibio_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('bibio_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bibio_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <BookIcon className="text-white w-6 h-6" />
        </div>
        <span className="text-xl font-bold tracking-tight text-gray-900">MY BIBIO</span>
      </div>

      {user && (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
            {user.role === 'admin' && (
              <>
                <Link to="/admin" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
                <Link to="/admin/books" className="hover:text-indigo-600 transition-colors">Livres</Link>
                <Link to="/admin/students" className="hover:text-indigo-600 transition-colors">Étudiants</Link>
                <Link to="/admin/proposals" className="hover:text-indigo-600 transition-colors">Propositions</Link>
                <Link to="/admin/requests" className="hover:text-indigo-600 transition-colors">Demandes</Link>
                <Link to="/admin/messages" className="hover:text-indigo-600 transition-colors">Messages</Link>
                <Link to="/security" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
                  <Shield className="w-4 h-4" /> Sécurité
                </Link>
              </>
            )}
            {user.role === 'student' && (
              <>
                <Link to="/student" className="hover:text-indigo-600 transition-colors">Mes Emprunts</Link>
                <Link to="/student/catalog" className="hover:text-indigo-600 transition-colors">Catalogue</Link>
                <Link to="/student/propose" className="hover:text-indigo-600 transition-colors">Proposer</Link>
              </>
            )}
          </div>
          
          <div className="h-6 w-px bg-gray-200" />
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
            <button 
              onClick={() => { logout(); navigate('/'); }}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

// --- Pages ---

function LoginPage() {
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text.substring(0, 50)}`);
        }
        await res.json();
        console.log("Backend connection established");
      } catch (err: any) {
        console.error("Backend unreachable:", err);
        toast.error(`Impossible de contacter le serveur: ${err.message || 'Erreur inconnue'}`);
      }
    };
    checkHealth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = role === 'admin' ? '/api/auth/admin/login' : '/api/auth/student/login';
      const body = role === 'admin' ? { email: identifier, password } : { rfid_card: identifier, password };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (data.success) {
        login(data.user);
        navigate(role === 'admin' ? '/admin' : '/student');
        toast.success(`Bienvenue, ${data.user.name}`);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center bg-gray-50 p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Connexion</h1>
          <p className="text-gray-500">Accédez à votre espace bibliothèque</p>
        </div>

        <div className="flex p-1 bg-gray-100 rounded-xl mb-8">
          <button 
            onClick={() => setRole('student')}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
              role === 'student' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Étudiant
          </button>
          <button 
            onClick={() => setRole('admin')}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
              role === 'admin' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Personnel
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {role === 'admin' ? 'Email professionnel' : 'Numéro de carte RFID'}
            </label>
            <input 
              type={role === 'admin' ? 'email' : 'text'}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
              placeholder={role === 'admin' ? 'admin@bibio.univ' : 'Ex: 123456789'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {role === 'student' && (
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-gray-500 text-sm mb-4">Vous n'avez pas encore de carte ?</p>
            <Link 
              to="/request-card"
              className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
            >
              <CreditCard className="w-5 h-5" />
              Demander une carte bibliothèque
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// --- Admin Sub-pages ---

function AdminDashboard() {
  const [stats, setStats] = useState({ books: 0, students: 0, borrowings: 0, alerts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [books, students, borrowings, logs] = await Promise.all([
          fetch('/api/books').then(r => r.json()),
          fetch('/api/students').then(r => r.json()),
          fetch('/api/borrowings').then(r => r.json()),
          fetch('/api/security/logs').then(r => r.json())
        ]);
        
        const safeArr = (data: any) => Array.isArray(data) ? data : [];
        
        setStats({
          books: safeArr(books).length,
          students: safeArr(students).length,
          borrowings: safeArr(borrowings).filter((b: any) => !b.returned).length,
          alerts: safeArr(logs).filter((l: any) => l.status !== 'authorized').length
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const exportData = async () => {
    try {
      const [borrowings, students, logs, proposals] = await Promise.all([
        fetch('/api/borrowings').then(r => r.json()),
        fetch('/api/students').then(r => r.json()),
        fetch('/api/security/logs').then(r => r.json()),
        fetch('/api/proposals').then(r => r.json())
      ]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(borrowings), "Emprunts");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(students), "Étudiants");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logs), "Logs Sécurité");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(proposals), "Propositions");
      XLSX.writeFile(wb, "MY_BIBIO_Export_Complet.xlsx");
      toast.success("Export complet réussi !");
    } catch (err) {
      toast.error("Erreur lors de l'export");
    }
  };

  const exportDailyReport = async () => {
    try {
      const res = await fetch('/api/admin/daily-report');
      const data = await res.json();
      
      const wb = XLSX.utils.book_new();
      
      // On prépare les données pour qu'elles soient lisibles
      const borrowings = data.borrowings.map((b: any) => ({
        'Heure': new Date(b.borrow_date).toLocaleTimeString(),
        'Étudiant': b.student_name,
        'Livre': b.book_title,
        'Code Exemplaire': b.item_code,
        'Date de retour prévue': new Date(b.return_date).toLocaleDateString()
      }));

      const returns = data.returns.map((r: any) => ({
        'Heure': new Date(r.returned_at).toLocaleTimeString(),
        'Étudiant': r.student_name,
        'Livre': r.book_title,
        'Code Exemplaire': r.item_code
      }));

      const security = data.securityLogs.map((l: any) => ({
        'Heure': new Date(l.detection_time).toLocaleTimeString(),
        'Livre': l.book_title || 'Inconnu',
        'Statut': l.status
      }));

      const proposals = data.proposals.map((p: any) => ({
        'Heure': new Date(p.created_at).toLocaleTimeString(),
        'Étudiant': p.student_name,
        'Livre': p.title,
        'Auteur': p.author,
        'Statut': p.status
      }));

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(borrowings), "Emprunts du jour");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(returns), "Retours du jour");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(security), "Sécurité du jour");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(proposals), "Propositions du jour");
      
      XLSX.writeFile(wb, `Rapport_Journalier_${data.date}.xlsx`);
      toast.success("Rapport journalier généré !");
    } catch (err) {
      toast.error("Erreur lors de la génération du rapport");
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord Admin</h1>
          <p className="text-gray-500">Vue d'ensemble de la bibliothèque</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportDailyReport}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <FileDown className="w-4 h-4" /> Rapport du Jour
          </button>
          <button 
            onClick={exportData}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <FileDown className="w-4 h-4" /> Export Complet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard icon={<BookIcon />} label="Total Livres" value={stats.books} color="bg-blue-500" />
        <StatCard icon={<Users />} label="Étudiants" value={stats.students} color="bg-purple-500" />
        <StatCard icon={<History />} label="Emprunts Actifs" value={stats.borrowings} color="bg-orange-500" />
        <StatCard icon={<Shield />} label="Alertes Sécurité" value={stats.alerts} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <QuickActionCard 
          title="Nouvel Emprunt" 
          description="Scanner livre + carte étudiant"
          icon={<Scan className="w-8 h-8" />}
          link="/admin/borrow"
          color="indigo"
        />
        <QuickActionCard 
          title="Retour de Livre" 
          description="Scanner le livre pour le rendre disponible"
          icon={<History className="w-8 h-8" />}
          link="/admin/return"
          color="emerald"
        />
        <QuickActionCard 
          title="Demandes de Cartes" 
          description="Valider les nouvelles inscriptions"
          icon={<CreditCard className="w-8 h-8" />}
          link="/admin/requests"
          color="blue"
        />
        <QuickActionCard 
          title="Messages Étudiants" 
          description="Répondre aux questions des étudiants"
          icon={<MessageSquare className="w-8 h-8" />}
          link="/admin/messages"
          color="purple"
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={cn("p-3 rounded-xl text-white", color)}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function QuickActionCard({ title, description, icon, link, color }: { title: string, description: string, icon: React.ReactNode, link: string, color: string }) {
  return (
    <Link to={link} className="group">
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-6">
        <div className={cn("p-4 rounded-2xl transition-all group-hover:scale-110", `bg-${color}-50 text-${color}-600`)}>
          {icon}
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">{title}</h3>
          <p className="text-gray-500">{description}</p>
        </div>
        <ChevronRight className="ml-auto text-gray-300 group-hover:text-gray-600 transition-colors" />
      </div>
    </Link>
  );
}

function AdminBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBook, setExpandedBook] = useState<number | null>(null);

  const fetchBooks = async () => {
    const res = await fetch('/api/books');
    const data = await res.json();
    setBooks(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const fetchItems = async (bookId: number) => {
    if (expandedBook === bookId) {
      setExpandedBook(null);
      return;
    }
    const res = await fetch(`/api/books/${bookId}/items`);
    const items = await res.json();
    setBooks(books.map(b => b.id === bookId ? { ...b, items } : b));
    setExpandedBook(bookId);
  };

  useEffect(() => { fetchBooks(); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Catalogue des Livres</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Livre</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Code-barres</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Stock</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {books.map(book => (
              <React.Fragment key={book.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => fetchItems(book.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {expandedBook === book.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <div>
                        <p className="font-semibold text-gray-900">{book.title}</p>
                        <p className="text-sm text-gray-500">{book.author}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">{book.barcode}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {book.available_quantity} / {book.total_quantity}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      book.available_quantity > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {book.available_quantity > 0 ? 'Disponible' : 'Épuisé'}
                    </span>
                  </td>
                </tr>
                {expandedBook === book.id && book.items && (
                  <tr className="bg-gray-50/30">
                    <td colSpan={4} className="px-12 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {book.items.map(item => (
                          <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Exemplaire</p>
                            <p className="font-mono text-sm font-bold text-indigo-600">{item.unique_code}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                item.status === 'available' ? "bg-green-500" : "bg-orange-500"
                              )} />
                              <span className="text-xs text-gray-600 capitalize">{item.status === 'available' ? 'En rayon' : 'Emprunté'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminBorrow() {
  const [rfid, setRfid] = useState('');
  const [barcode, setBarcode] = useState('');
  const rfidRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Auto-calculate date: Today + 30 days
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 30);
  const returnDate = defaultDate.toISOString().split('T')[0];

  const handleBorrow = async () => {
    const res = await fetch('/api/borrow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rfid_card: rfid, barcode, return_date: returnDate })
    });
    const data = await res.json();
    if (data.success) {
      toast.success(`Emprunt réussi pour ${rfid} !`);
      setRfid('');
      setBarcode('');
      rfidRef.current?.focus();
    } else {
      toast.error(data.message);
      // Reset only barcode to allow re-scanning book if student is OK
      setBarcode('');
      barcodeRef.current?.focus();
    }
  };

  // Auto-submit when both fields are filled
  useEffect(() => {
    if (rfid.length >= 4 && barcode.length >= 4) {
      const timer = setTimeout(() => {
        handleBorrow();
      }, 500); // Small delay to ensure scan is complete
      return () => clearTimeout(timer);
    }
  }, [rfid, barcode]);

  // Focus management
  useEffect(() => {
    if (rfid && !barcode) {
      barcodeRef.current?.focus();
    }
  }, [rfid]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-xl overflow-hidden relative">
        {/* Progress indicator */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500" 
            style={{ width: rfid ? (barcode ? '100%' : '50%') : '0%' }}
          />
        </div>

        <h1 className="text-2xl font-bold mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scan className="w-6 h-6 text-indigo-600" /> Mode Scan Automatique
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">30 Jours</span>
        </h1>

        <div className="space-y-8">
          <div className={cn(
            "p-6 rounded-2xl border-2 transition-all",
            rfid ? "border-green-200 bg-green-50" : "border-indigo-100 bg-white shadow-sm"
          )}>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">1. Scanner Carte Étudiant</label>
            <input 
              ref={rfidRef}
              required
              autoFocus
              value={rfid}
              onChange={e => setRfid(e.target.value)}
              className="w-full bg-transparent text-2xl font-mono font-bold text-indigo-600 outline-none placeholder:text-gray-300"
              placeholder="--- --- ---"
            />
            {rfid && <p className="text-xs text-green-600 mt-2 font-bold flex items-center gap-1">✓ Carte détectée</p>}
          </div>

          <div className={cn(
            "p-6 rounded-2xl border-2 transition-all",
            !rfid ? "opacity-40 grayscale pointer-events-none border-gray-100" : 
            barcode ? "border-green-200 bg-green-50" : "border-indigo-100 bg-white shadow-sm"
          )}>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">2. Scanner Livre</label>
            <input 
              ref={barcodeRef}
              required
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              className="w-full bg-transparent text-2xl font-mono font-bold text-indigo-600 outline-none placeholder:text-gray-300"
              placeholder="--- --- ---"
            />
            {barcode && <p className="text-xs text-green-600 mt-2 font-bold flex items-center gap-1">✓ Livre détecté</p>}
          </div>

          <div className="pt-4 text-center">
            <p className="text-sm text-gray-400">
              Le système validera l'emprunt automatiquement après le deuxième scan.<br/>
              Date de retour prévue : <span className="font-bold text-gray-600">{new Date(returnDate).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        {/* Hidden button for accessibility/fallback */}
        <button className="sr-only">Confirmer</button>
      </div>
    </div>
  );
}

function AdminReturn() {
  const [barcode, setBarcode] = useState('');
  const navigate = useNavigate();

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode })
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Livre retourné !");
      navigate('/admin');
    } else {
      toast.error(data.message);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-xl">
        <h1 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <History className="w-6 h-6 text-emerald-600" /> Retour de Livre
        </h1>
        <form onSubmit={handleReturn} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scanner Livre</label>
            <input 
              required
              autoFocus
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Scannez le livre à retourner..."
            />
          </div>
          <button className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
            Valider le Retour
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Student Pages ---

function StudentDashboard() {
  const { user } = useAuth();
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBorrowings = async () => {
      if (!user) return;
      const res = await fetch(`/api/student/${user.id}/borrowings`);
      const data = await res.json();
      setBorrowings(Array.isArray(data) ? data : []);
      setLoading(false);
    };
    fetchBorrowings();
  }, [user]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mes Emprunts</h1>
        <p className="text-gray-500">Gérez vos livres en cours</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {borrowings.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center">
            <BookIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Vous n'avez aucun livre emprunté pour le moment.</p>
            <Link to="/student/catalog" className="text-indigo-600 font-semibold mt-2 inline-block">Consulter le catalogue</Link>
          </div>
        ) : (
          borrowings.map(b => (
            <motion.div 
              key={b.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4 gap-4">
                <div className="flex gap-3">
                  <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 h-fit">
                    {b.book_image ? (
                      <img 
                        src={b.book_image} 
                        alt={b.book_title} 
                        className="w-10 h-14 object-cover rounded shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <BookIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1">{b.book_title}</h3>
                    <p className="text-sm text-gray-500">{b.book_author}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md whitespace-nowrap">
                  À rendre le {new Date(b.return_date).toLocaleDateString()}
                </span>
              </div>
              <div className="h-px bg-gray-100 mb-4" />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Emprunté le : {new Date(b.borrow_date).toLocaleDateString()}</span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function StudentCatalog() {
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/books')
      .then(r => r.json())
      .then(data => setBooks(Array.isArray(data) ? data : []));
  }, []);

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(search.toLowerCase()) || 
    b.author.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catalogue</h1>
          <p className="text-gray-500">Découvrez nos ouvrages disponibles</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Rechercher un livre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-12 pr-6 py-3 rounded-xl border border-gray-200 w-full md:w-80 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredBooks.map(book => (
          <div key={book.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
            <div className="aspect-[3/4] bg-gray-100 rounded-xl mb-4 overflow-hidden flex items-center justify-center text-gray-300">
              {book.image_url ? (
                <img 
                  src={book.image_url} 
                  alt={book.title} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <BookIcon className="w-12 h-12" />
              )}
            </div>
            <h3 className="font-bold text-gray-900 mb-1 line-clamp-2">{book.title}</h3>
            <p className="text-sm text-gray-500 mb-2">{book.author}</p>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-medium text-gray-400">Stock: {book.available_quantity}/{book.total_quantity}</span>
              <span className={cn(
                "text-[10px] font-bold px-2 py-1 rounded-md",
                book.available_quantity > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {book.available_quantity > 0 ? 'Disponible' : 'Épuisé'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Security Scanner ---

function SecurityScanner() {
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<{ authorized: boolean; message?: string } | null>(null);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const alarmAudio = React.useRef<HTMLAudioElement | null>(null);

  const fetchLogs = async () => {
    const res = await fetch('/api/security/logs');
    const data = await res.json();
    setLogs(Array.isArray(data) ? data : []);
  };

  useEffect(() => { 
    fetchLogs();
    // Use a more reliable sound source or handle errors
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3');
    audio.addEventListener('error', (e) => {
      console.warn("Audio failed to load, security scanner will use visual alerts only.", e);
      alarmAudio.current = null;
    });
    alarmAudio.current = audio;
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/security/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode })
    });
    const data = await res.json();
    setStatus(data);
    setBarcode('');
    fetchLogs();

    if (data.alarm) {
      alarmAudio.current?.play().catch(() => {
        // Autoplay policy might block the sound if no user interaction yet
        console.warn("Audio play blocked by browser policy");
      });
      toast.error(data.message, { duration: 5000 });
    } else {
      toast.success("Passage autorisé");
    }

    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">SCANNER DE SORTIE</h1>
            <p className="text-gray-400 font-mono">SCANNAGE PAR EXEMPLAIRE UNIQUE (ex: BARCODE-001)</p>
          </div>
          <Link 
            to="/admin" 
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-xl transition-all border border-gray-700"
          >
            <LayoutDashboard className="w-5 h-5" /> Retour Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <div className={cn(
            "aspect-square rounded-3xl border-8 flex flex-col items-center justify-center transition-all duration-500",
            status === null ? "border-gray-800 bg-gray-800/50" :
            status.authorized ? "border-emerald-500 bg-emerald-500/10" : "border-red-500 bg-red-500/10 animate-pulse"
          )}>
            <AnimatePresence mode="wait">
              {status === null ? (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <Scan className="w-32 h-32 text-gray-700 mb-6 mx-auto" />
                  <p className="text-2xl font-bold text-gray-600">EN ATTENTE DE SCAN</p>
                </motion.div>
              ) : status.authorized ? (
                <motion.div 
                  key="authorized"
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                  className="text-center"
                >
                  <CheckCircle2 className="w-48 h-48 text-emerald-500 mb-6 mx-auto" />
                  <p className="text-4xl font-black text-emerald-500">ACCÈS AUTORISÉ</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="denied"
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                  className="text-center"
                >
                  <AlertTriangle className="w-48 h-48 text-red-500 mb-6 mx-auto" />
                  <p className="text-4xl font-black text-red-500">ALERTE VOL !</p>
                  <p className="text-xl text-red-400 mt-4">{status.message}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <form onSubmit={handleScan} className="mt-8">
            <input 
              autoFocus
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl px-6 py-4 text-2xl font-mono focus:border-indigo-500 outline-none transition-all"
              placeholder="Scanner le livre ici..."
            />
          </form>
        </div>
      </div>

        <div className="bg-gray-800/50 rounded-3xl border border-gray-800 p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <History className="text-indigo-400" /> Historique des Incidents
          </h2>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
            {logs.map(log => (
              <div key={log.id} className={cn(
                "p-4 rounded-xl border flex items-center justify-between",
                log.status === 'authorized' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
              )}>
                <div>
                  <p className="font-bold text-sm">
                    {log.book_title || "Livre Inconnu"}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    {log.book_barcode || "???"} • {new Date(log.detection_time).toLocaleTimeString()}
                  </p>
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                  log.status === 'authorized' ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
                )}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Chatbot ---

function StudentChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string, content: string, timestamp?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [input, setInput] = useState('');

  const faqOptions = [
    "Comment emprunter un livre ?",
    "Quelle est la durée d'emprunt ?",
    "Que faire si je perds ma carte ?",
    "Comment retourner un livre ?"
  ];

  useEffect(() => {
    if (isOpen && user) {
      fetch(`/api/chat/${user.id}`)
        .then(res => res.json())
        .then(data => setMessages(data.map((m: any) => ({ 
          role: m.role, 
          content: m.content, 
          timestamp: m.timestamp 
        }))))
        .catch(err => console.error("Error loading chat:", err));
    }
  }, [isOpen, user]);

  const saveMessage = async (content: string, role: string) => {
    if (!user) return;
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, content, role })
      });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  };

  const handleManualSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    
    const content = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content }]);
    await saveMessage(content, 'user');
  };

  const handleAIQuestion = async (question: string) => {
    if (!user) return;
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    await saveMessage(question, 'user');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: question,
        config: {
          systemInstruction: "Tu es l'assistant intelligent de la bibliothèque MY BIBIO. Réponds de manière concise, polie et utile."
        }
      });
      const aiText = response.text || "Désolé, je ne peux pas répondre pour le moment.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
      await saveMessage(aiText, 'assistant');
    } catch (err) {
      const errorMsg = "Une erreur est survenue lors de la connexion à l'IA.";
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      await saveMessage(errorMsg, 'assistant');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isOpen && user) {
      interval = setInterval(() => {
        fetch(`/api/chat/${user.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.length > messages.length) {
              setMessages(data.map((m: any) => ({ 
                role: m.role, 
                content: m.content, 
                timestamp: m.timestamp 
              })));
            }
          });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isOpen, user, messages.length]);

  return (
    <div className="fixed bottom-8 right-8 z-[60]">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 md:w-96 mb-4 overflow-hidden flex flex-col h-[500px]"
          >
            <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <span className="font-bold">Assistant BIBIO</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
                <ChevronRight className="w-5 h-5 rotate-90" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 && (
                <div className="bg-white p-4 rounded-xl shadow-sm italic text-gray-500 text-sm">
                  Bonjour ! Posez-moi une question ou cliquez sur "Autre" pour parler à un responsable.
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn(
                  "max-w-[85%] p-3 rounded-2xl text-sm",
                  m.role === 'user' ? "bg-indigo-600 text-white ml-auto rounded-tr-none" : 
                  m.role === 'admin' ? "bg-emerald-600 text-white mr-auto rounded-tl-none border-2 border-emerald-400" :
                  "bg-white text-gray-800 shadow-sm rounded-tl-none"
                )}>
                  {m.role === 'admin' && <p className="text-[10px] font-bold text-emerald-100 uppercase mb-1">Responsable</p>}
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ))}
              {loading && <div className="text-xs text-gray-400 animate-pulse italic">L'IA réfléchit...</div>}
            </div>

            <div className="p-4 bg-white border-t border-gray-100">
              {isManual ? (
                <form onSubmit={handleManualSend} className="flex gap-2">
                  <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Votre message..."
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button type="submit" className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700">
                    <Send className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsManual(false)}
                    className="text-gray-400 hover:text-gray-600 p-2"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Questions fréquentes</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {faqOptions.map(q => (
                      <button 
                        key={q}
                        onClick={() => handleAIQuestion(q)}
                        disabled={loading}
                        className="text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 px-3 py-2 rounded-lg transition-all text-left"
                      >
                        {q}
                      </button>
                    ))}
                    <button 
                      onClick={() => setIsManual(true)}
                      className="text-xs bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg font-bold hover:bg-indigo-100"
                    >
                      Autre...
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:scale-110 transition-all font-bold flex items-center gap-2"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="hidden md:inline">Assistant BIBIO</span>
      </button>
    </div>
  );
}

function CardRequestPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    studentId: '',
    cardType: '',
    status: '',
    certif_url: '',
    photo_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showSndl, setShowSndl] = useState(false);
  const [showIqraa, setShowIqraa] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'certif_url' | 'photo_url') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Le fichier est trop volumineux (max 2Mo)");
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        setFormData(prev => ({ ...prev, [field]: base64 }));
        toast.success("Fichier chargé avec succès");
      } catch (err) {
        toast.error("Erreur lors du chargement du fichier");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.certif_url || !formData.photo_url) {
      toast.error("Veuillez télécharger les deux documents requis.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/card-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 5000);
        setFormData({
          firstName: '', lastName: '', email: '', phone: '',
          studentId: '', cardType: '', status: '', 
          certif_url: '', photo_url: ''
        });
      } else {
        toast.error("Erreur lors de l'envoi de la demande");
      }
    } catch (err) {
      toast.error("Erreur technique");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-8 font-dm-sans overflow-x-hidden pt-20">
      {/* Background with Blur */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center" 
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=2000&auto=format&fit=crop')` }}
      >
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[600px] bg-white rounded-lg shadow-2xl p-8 sm:p-12 overflow-hidden"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-8 right-8 h-[3px] bg-gradient-to-r from-transparent via-blue-600 to-transparent"></div>

        <div className="text-right mb-4">
          <img src="https://mosta-sup.com/wp-content/uploads/2021/05/cropped-logo_mosta.png" alt="Logo Université" className="w-16 h-16 ml-auto object-contain" />
        </div>

        <div className="mb-10 text-center sm:text-left">
          <p className="text-[0.65rem] font-bold tracking-[0.2em] uppercase text-blue-600 mb-2">OBTENEZ VOTRE CARTE</p>
          <h1 className="text-4xl font-playfair font-normal text-slate-900 leading-tight mb-2">Remplissez vos informations.</h1>
          <p className="text-sm text-slate-500 font-light leading-relaxed">Envoyez votre demande et un e-mail vous sera envoyé après traitement.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-b border-blue-100 pb-1 mb-4">
            <p className="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-blue-600">Informations Personnelles</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="relative group">
              <label className="block text-[0.72rem] font-medium tracking-widest uppercase text-slate-400 group-focus-within:text-blue-600 transition-colors mb-1">Prénom</label>
              <input 
                required
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
                className="w-full bg-transparent border-b-2 border-slate-100 py-2 text-slate-800 outline-none focus:border-blue-600 transition-all"
              />
            </div>
            <div className="relative group">
              <label className="block text-[0.72rem] font-medium tracking-widest uppercase text-slate-400 group-focus-within:text-blue-600 transition-colors mb-1">Nom</label>
              <input 
                required
                value={formData.lastName}
                onChange={e => setFormData({...formData, lastName: e.target.value})}
                className="w-full bg-transparent border-b-2 border-slate-100 py-2 text-slate-800 outline-none focus:border-blue-600 transition-all font-dm-sans"
              />
            </div>
          </div>

          <div className="relative group">
            <label className="block text-[0.72rem] font-medium tracking-widest uppercase text-slate-400 group-focus-within:text-blue-600 transition-colors mb-1">Adresse E-mail</label>
            <input 
              required
              type="email"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full bg-transparent border-b-2 border-slate-100 py-2 text-slate-800 outline-none focus:border-blue-600 transition-all font-dm-sans"
              placeholder="nom@exemple.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="relative group">
              <label className="block text-[0.72rem] font-medium tracking-widest uppercase text-slate-400 group-focus-within:text-blue-600 transition-colors mb-1">Numéro de Téléphone</label>
              <input 
                required
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-transparent border-b-2 border-slate-100 py-2 text-slate-800 outline-none focus:border-blue-600 transition-all"
                placeholder="0XXXXXXXXX"
              />
            </div>
            <div className="relative group">
              <label className="block text-[0.72rem] font-medium tracking-widest uppercase text-slate-400 group-focus-within:text-blue-600 transition-colors mb-1">
                ID Étudiant 
                {formData.status === 'prof' && <span className="text-[0.6rem] normal-case ml-2 text-slate-400">(optionnel)</span>}
              </label>
              <input 
                required={formData.status !== 'prof'}
                value={formData.studentId}
                onChange={e => setFormData({...formData, studentId: e.target.value})}
                className="w-full bg-transparent border-b-2 border-slate-100 py-2 text-slate-800 outline-none focus:border-blue-600 transition-all disabled:opacity-30"
                placeholder="ex: 37000000"
                disabled={formData.status === 'prof'}
              />
            </div>
          </div>

          <div className="border-b border-blue-100 pb-1 mb-4 mt-8">
            <p className="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-blue-600">Détails Académiques</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="relative group">
              <label className="block text-[0.72rem] font-medium tracking-widest uppercase text-slate-400 group-focus-within:text-blue-600 transition-colors mb-1">Type de Carte</label>
              <select 
                required
                value={formData.cardType}
                onChange={e => setFormData({...formData, cardType: e.target.value})}
                className="w-full bg-transparent border-b-2 border-slate-100 py-2 text-slate-800 outline-none focus:border-blue-600 transition-all cursor-pointer appearance-none"
              >
                <option value="" disabled>Choisissez le type</option>
                <option value="simple">Carte Simple</option>
                <option value="sndl">Carte Simple + SNDL</option>
                <option value="iqraa">Carte Simple + Iqraa</option>
                <option value="both">Carte Simple + SNDL + Iqraa</option>
              </select>
            </div>
            <div className="relative group">
              <label className="block text-[0.72rem] font-medium tracking-widest uppercase text-slate-400 group-focus-within:text-blue-600 transition-colors mb-1">Statut Académique</label>
              <select 
                required
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
                className="w-full bg-transparent border-b-2 border-slate-100 py-2 text-slate-800 outline-none focus:border-blue-600 transition-all cursor-pointer appearance-none"
              >
                <option value="" disabled>Choisissez votre statut</option>
                <option value="student">Étudiant</option>
                <option value="prof">Professeur</option>
                <option value="phd">Doctorant</option>
              </select>
            </div>
          </div>

          <div className="border-b border-blue-100 pb-1 mb-4 mt-8">
            <p className="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-blue-600">Documents Requis</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider">Certificat de scolarité</label>
              <div className="relative group">
                <div className={cn(
                  "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all",
                  formData.certif_url ? "border-emerald-200 bg-emerald-50" : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
                )}>
                  <input 
                    type="file" 
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'certif_url')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {formData.certif_url ? (
                    <div className="flex flex-col items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-6 h-6" />
                      <span className="text-[0.65rem] font-bold uppercase">Chargé</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <Upload className="w-6 h-6" />
                      <span className="text-[0.65rem] font-bold uppercase">Téléverser</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider">Photo d'identité</label>
              <div className="relative group">
                <div className={cn(
                  "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all",
                  formData.photo_url ? "border-emerald-200 bg-emerald-50" : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
                )}>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'photo_url')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {formData.photo_url ? (
                    <div className="flex flex-col items-center gap-1">
                      <img src={formData.photo_url} alt="Preview" className="w-8 h-8 rounded-full object-cover border border-emerald-500" />
                      <span className="text-[0.65rem] font-bold text-emerald-600 uppercase">Chargée</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <ImageIcon className="w-6 h-6" />
                      <span className="text-[0.65rem] font-bold uppercase">Téléverser</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-8 bg-blue-600 text-white py-4 rounded font-medium text-[0.82rem] tracking-[0.14em] uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-200/50 flex items-center justify-center gap-2"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Envoyer la Demande'}
          </button>

          {success && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded text-emerald-600 text-[0.85rem] text-center font-bold"
            >
              ✦ Votre demande a été envoyée. Nous vous contacterons bientôt.
            </motion.div>
          )}
        </form>

        <button 
          onClick={() => navigate('/')}
          className="mt-6 w-full flex items-center justify-center gap-2 text-[0.7rem] uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Retour à la Connexion
        </button>
      </motion.div>

      {/* Floating Info Bubbles */}
      <div className="fixed left-4 sm:left-12 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-6 hidden lg:flex">
        <button 
          onClick={() => setShowSndl(true)}
          className="bg-white p-4 rounded-2xl rounded-bl-sm shadow-xl border border-blue-100 w-48 text-left hover:-translate-y-1 transition-all group"
        >
          <img src="https://www.sndl.cerist.dz/images/logo_sndl_deg.jpg" alt="Logo SNDL" className="h-12 object-contain mb-2" />
          <p className="font-playfair font-bold text-slate-800 leading-tight">C'est quoi SNDL ?</p>
          <p className="text-[0.65rem] text-slate-400 mt-1 uppercase tracking-widest group-hover:text-blue-600 transition-colors">En savoir plus →</p>
        </button>

        <button 
          onClick={() => setShowIqraa(true)}
          className="bg-white p-4 rounded-2xl rounded-bl-sm shadow-xl border border-blue-100 w-48 text-left hover:-translate-y-1 transition-all group"
        >
          <img src="https://mosta-sup.com/wp-content/uploads/2021/05/cropped-logo_mosta.png" alt="Logo Iqraa" className="h-12 object-contain mb-2 flex items-center justify-center" />
          <p className="font-playfair font-bold text-slate-800 leading-tight">C'est quoi Iqraa ?</p>
          <p className="text-[0.65rem] text-slate-400 mt-1 uppercase tracking-widest group-hover:text-blue-600 transition-colors">En savoir plus →</p>
        </button>
      </div>

      <AnimatePresence>
        {(showSndl || showIqraa) && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
          >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setShowSndl(false); setShowIqraa(false); }}></div>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-xl shadow-2xl p-8 sm:p-12 relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => { setShowSndl(false); setShowIqraa(false); }}
                className="absolute top-6 left-6 flex items-center gap-2 text-xs font-bold uppercase text-blue-600 tracking-widest hover:translate-x-[-4px] transition-all font-dm-sans"
              >
                <ArrowLeft className="w-4 h-4" /> Retour au Formulaire
              </button>

              <div className="mt-8">
                {showSndl ? (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <img src="https://www.sndl.cerist.dz/images/logo_sndl_deg.jpg" alt="SNDL" className="h-16 object-contain" />
                      <div>
                        <p className="text-[0.6rem] font-bold text-blue-600 uppercase tracking-[0.2em] mb-1">Service Bibliothèque</p>
                        <h2 className="text-3xl font-playfair font-bold text-slate-900">SNDL</h2>
                      </div>
                    </div>
                    <p className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-widest border-b border-blue-50 pb-2 mb-6">Système National de Documentation en Ligne</p>
                    <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                      <p>Le <strong>SNDL</strong> est le système national de documentation en ligne de l'Algérie, offrant aux étudiants et chercheurs l'accès à une vaste collection de ressources scientifiques.</p>
                      <div className="bg-blue-50/50 p-6 rounded-lg border-l-4 border-blue-600">
                        <p className="font-bold text-slate-800 text-xs uppercase tracking-widest mb-3">✦ Détails d'accès :</p>
                        <ul className="space-y-2 list-disc pl-4 text-slate-500">
                          <li>Revues scientifiques internationales (Springer, Elsevier, IEEE...)</li>
                          <li>Thèses et livres électroniques académiques</li>
                          <li>Disponible 24h/24 depuis n'importe quelle connexion</li>
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <img src="https://mosta-sup.com/wp-content/uploads/2021/05/cropped-logo_mosta.png" alt="University Logo" className="h-16" />
                      <div>
                        <p className="text-[0.6rem] font-bold text-blue-600 uppercase tracking-[0.2em] mb-1">Service Bibliothèque</p>
                        <h2 className="text-3xl font-playfair font-bold text-slate-900">Iqraa</h2>
                      </div>
                    </div>
                    <p className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-widest border-b border-blue-50 pb-2 mb-6">إقرأ — Lire, Emprunter, Explorer</p>
                    <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                      <p><strong>Iqraa</strong> est le programme d'emprunt de livres physiques et numériques de la bibliothèque universitaire conçu pour encourager la culture de la lecture.</p>
                      <div className="bg-blue-50/50 p-6 rounded-lg border-l-4 border-blue-600">
                        <p className="font-bold text-slate-800 text-xs uppercase tracking-widest mb-3">✦ Privilèges Iqraa :</p>
                        <ul className="space-y-2 list-disc pl-4 text-slate-500">
                          <li>Empruntez jusqu'à 3 livres physiques simultanément</li>
                          <li>Priorité sur les réservations de nouveautés</li>
                          <li>Accès à la bibliothèque numérique via l'application Bibio</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminCardRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocs, setSelectedDocs] = useState<{certif: string, photo: string} | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/card-requests');
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Erreur de chargement des demandes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/card-requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Demande mise à jour");
        fetchRequests();
      }
    } catch (err) {
      toast.error("Échec de la mise à jour");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="mb-8 flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2 uppercase">Demandes de Cartes</h1>
           <p className="text-gray-500">Gérez les inscriptions et les accès spéciaux (SNDL/Iqraa)</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm font-bold text-indigo-600">
          {requests.filter(r => r.request_status === 'pending').length} en attente
        </div>
      </div>

      <AnimatePresence>
        {selectedDocs && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
              <button 
                onClick={() => setSelectedDocs(null)}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
              <h2 className="text-xl font-bold mb-6">Documents de la demande</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">CERTIFICAT DE SCOLARITÉ</p>
                  <img src={selectedDocs.certif} alt="Certificat" className="w-full rounded-xl border border-gray-100 shadow-inner" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">PHOTO D'IDENTITÉ</p>
                  <img src={selectedDocs.photo} alt="Identité" className="w-full rounded-xl border border-gray-100 shadow-inner" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center p-20">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Candidat</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Type Demandé</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Documents</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{r.firstName} {r.lastName}</p>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      {r.status === 'student' ? 'Étudiant' : r.status === 'prof' ? 'Professeur' : 'Doctorant'} 
                      {r.studentId && ` • ID: ${r.studentId}`}
                    </p>
                    <p className="text-xs text-indigo-500 font-medium">{r.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                      r.cardType === 'simple' ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-600"
                    )}>
                      {r.cardType === 'simple' ? 'Standard' : 
                       r.cardType === 'sndl' ? 'Standard + SNDL' : 
                       r.cardType === 'iqraa' ? 'Standard + Iqraa' : 
                       'Standard + SNDL + Iqraa'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {r.certif_url && r.photo_url ? (
                      <button 
                        onClick={() => setSelectedDocs({ certif: r.certif_url, photo: r.photo_url })}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
                      >
                        <FileText className="w-4 h-4" /> Voir PJ
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300 italic italic">Aucune PJ</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <span className={cn(
                        "w-2 h-2 rounded-full",
                        r.request_status === 'pending' ? "bg-orange-500" :
                        r.request_status === 'approved' ? "bg-green-500" : "bg-red-500"
                      )} />
                      <span className="text-xs font-bold capitalize text-gray-600">
                        {r.request_status === 'pending' ? 'En attente' : r.request_status === 'approved' ? 'Approuvée' : 'Rejetée'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {r.request_status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleStatusChange(r.id, 'approved')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-50"
                            title="Approuver"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleStatusChange(r.id, 'rejected')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-50"
                            title="Rejeter"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 && (
            <div className="p-20 text-center text-gray-400 italic">
              Aucune demande reçue
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminMessages() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');

  const loadSessions = () => {
    fetch('/api/admin/chat-sessions')
      .then(res => res.json())
      .then(data => setSessions(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: any;
    if (selectedSession) {
      const fetchMessages = () => {
        fetch(`/api/chat/${selectedSession.id}`)
          .then(res => res.json())
          .then(data => setMessages(Array.isArray(data) ? data : []));
      };
      fetchMessages();
      interval = setInterval(fetchMessages, 5000);
    }
    return () => clearInterval(interval);
  }, [selectedSession]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !selectedSession) return;

    const content = reply;
    setReply('');
    
    // Optimistic update
    const tempMsg = { student_id: selectedSession.id, content, role: 'admin', timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);

    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        student_id: selectedSession.id, 
        content, 
        role: 'admin' 
      })
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Messages des Étudiants</h1>
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Session List */}
        <div className="w-80 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-y-auto">
          {sessions.map(s => (
            <button 
              key={s.id}
              onClick={() => setSelectedSession(s)}
              className={cn(
                "w-full p-4 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors",
                selectedSession?.id === s.id && "bg-indigo-50 border-indigo-100"
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <p className="font-bold text-gray-900">{s.name}</p>
                <div className="bg-indigo-100 text-indigo-600 p-1 rounded-lg">
                  <MessageSquare className="w-3 h-3" />
                </div>
              </div>
              <p className="text-sm text-gray-500 truncate">{s.last_content}</p>
              <p className="text-[10px] text-gray-400 mt-2">{new Date(s.last_message).toLocaleString()}</p>
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400">Aucun message pour le moment</p>
            </div>
          )}
        </div>

        {/* Message View */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          {selectedSession ? (
            <>
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{selectedSession.name}</p>
                  <p className="text-xs text-gray-500">Fil de discussion en direct</p>
                </div>
                <button 
                  onClick={() => setSelectedSession(null)}
                  className="text-gray-400 hover:text-gray-900"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {messages.map((m, i) => (
                  <div key={i} className={cn(
                    "max-w-[70%] p-4 rounded-2xl text-sm shadow-sm",
                    m.role === 'admin' ? "bg-indigo-600 text-white ml-auto rounded-tr-none" : 
                    m.role === 'assistant' ? "bg-gray-100 text-gray-500 italic mr-auto rounded-tl-none text-xs border border-gray-200" :
                    "bg-white text-gray-900 mr-auto rounded-tl-none"
                  )}>
                    <p>{m.content}</p>
                    <p className={cn(
                      "text-[10px] mt-2",
                      m.role === 'admin' ? "text-indigo-200" : "text-gray-400"
                    )}>
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleReply} className="p-4 bg-white border-t border-gray-100 flex gap-3">
                <input 
                  type="text" 
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Écrire votre réponse..."
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <button 
                  type="submit" 
                  disabled={!reply.trim()}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> <span>Envoyer</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12 text-center bg-gray-50/50">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="font-medium">Sélectionnez une discussion</p>
              <p className="text-sm max-w-xs">Cliquez sur un étudiant à gauche pour voir les messages et lui répondre.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 font-sans">
          <Routes>
            <Route path="/" element={<LoginPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="books" element={<AdminBooks />} />
              <Route path="borrow" element={<AdminBorrow />} />
              <Route path="return" element={<AdminReturn />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="proposals" element={<AdminProposals />} />
              <Route path="requests" element={<AdminCardRequests />} />
              <Route path="messages" element={<AdminMessages />} />
            </Route>

            <Route path="/request-card" element={<CardRequestPage />} />

            {/* Student Routes */}
            <Route path="/student" element={<ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>}>
              <Route index element={<StudentDashboard />} />
              <Route path="catalog" element={<StudentCatalog />} />
              <Route path="propose" element={<StudentPropose />} />
            </Route>

            {/* Security Interface */}
            <Route path="/security" element={<ProtectedRoute role="admin"><SecurityScanner /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </div>
      </Router>
    </AuthProvider>
  );
}

function ProtectedRoute({ children, role }: { children: React.ReactNode, role: 'admin' | 'student' }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} />;
  return <>{children}</>;
}

function AdminLayout() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="books" element={<AdminBooks />} />
        <Route path="borrow" element={<AdminBorrow />} />
        <Route path="return" element={<AdminReturn />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="proposals" element={<AdminProposals />} />
        <Route path="requests" element={<AdminCardRequests />} />
        <Route path="messages" element={<AdminMessages />} />
      </Routes>
    </>
  );
}

function StudentLayout() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route index element={<StudentDashboard />} />
        <Route path="catalog" element={<StudentCatalog />} />
        <Route path="propose" element={<StudentPropose />} />
      </Routes>
      <StudentChat />
    </>
  );
}

function AdminStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [newStudent, setNewStudent] = useState({ name: '', rfid_card: '', password: '' });

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students');
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch students:", err);
      setStudents([]);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Erreur serveur inconnue" }));
        throw new Error(errorData.message || "Erreur lors de la communication avec le serveur");
      }

      const data = await res.json();
      if (data.success) {
        toast.success("Étudiant enregistré !");
        setNewStudent({ name: '', rfid_card: '', password: '' });
        fetchStudents();
      } else {
        toast.error(data.message || "Erreur lors de la création");
      }
    } catch (err: any) {
      console.error("Student creation failed:", err);
      toast.error(err.message === "Failed to fetch" ? "Serveur indisponible, réessayez dans quelques secondes." : err.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Étudiants</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Users className="w-5 h-5" /> Nouvel Étudiant
          </h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
              <input required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro Carte RFID</label>
              <input required value={newStudent.rfid_card} onChange={e => setNewStudent({...newStudent, rfid_card: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input type="password" required value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-all">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Nom</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Carte RFID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-900">{s.name}</td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">{s.rfid_card}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StudentPropose() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<BookProposal[]>([]);
  const [newProposal, setNewProposal] = useState({ title: '', author: '', reason: '' });

  const fetchProposals = async () => {
    if (!user) return;
    const res = await fetch(`/api/student/${user.id}/proposals`);
    const data = await res.json();
    setProposals(data);
  };

  useEffect(() => { fetchProposals(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProposal, student_id: user.id })
      });
      const data = await res.json().catch(() => ({ success: false }));
      if (data.success) {
        toast.success("Proposition envoyée !");
        setNewProposal({ title: '', author: '', reason: '' });
        fetchProposals();
      } else {
        toast.error(`Échec : ${data.message || "Envoi impossible"}`);
      }
    } catch (err) {
      console.error("Proposal sub error:", err);
      toast.error("Erreur réseau. Vérifiez votre connexion.");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm h-fit">
          <h2 className="text-2xl font-bold mb-6">Proposer un livre</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
              <input required value={newProposal.title} onChange={e => setNewProposal({...newProposal, title: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auteur</label>
              <input required value={newProposal.author} onChange={e => setNewProposal({...newProposal, author: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pourquoi ce livre ?</label>
              <textarea value={newProposal.reason} onChange={e => setNewProposal({...newProposal, reason: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 h-32" />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-all">
              Envoyer la proposition
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold">Mes Propositions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proposals.map(p => (
              <div key={p.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{p.title}</h3>
                    <p className="text-sm text-gray-500">{p.author}</p>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    p.status === 'pending' ? "bg-orange-100 text-orange-600" :
                    p.status === 'accepted' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  )}>
                    {p.status === 'pending' ? 'En attente' : p.status === 'accepted' ? 'Accepté' : 'Refusé'}
                  </span>
                </div>
                {p.reason && <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl italic">"{p.reason}"</p>}
                <p className="text-[10px] text-gray-400 mt-4">Envoyé le {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminProposals() {
  const [proposals, setProposals] = useState<BookProposal[]>([]);

  const fetchProposals = async () => {
    const res = await fetch('/api/proposals');
    const data = await res.json();
    setProposals(data);
  };

  useEffect(() => { fetchProposals(); }, []);

  const handleAction = async (id: number, status: 'accepted' | 'rejected') => {
    const res = await fetch(`/api/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      toast.success(status === 'accepted' ? "Proposition acceptée !" : "Proposition refusée");
      fetchProposals();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Propositions des Étudiants</h1>
        <p className="text-gray-500">Gérez les demandes d'achat de nouveaux livres</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {proposals.map(p => (
          <div key={p.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                  {p.student_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">{p.student_name}</p>
                  <p className="text-[10px] text-gray-400">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <span className={cn(
                "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                p.status === 'pending' ? "bg-orange-50 text-orange-600" :
                p.status === 'accepted' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              )}>
                {p.status === 'pending' ? 'En attente' : p.status === 'accepted' ? 'Accepté' : 'Refusé'}
              </span>
            </div>

            <div className="mb-4">
              <h3 className="font-bold text-gray-900">{p.title}</h3>
              <p className="text-sm text-gray-500">{p.author}</p>
            </div>

            {p.reason && (
              <div className="mb-6 flex-grow">
                <p className="text-xs text-gray-500 mb-1 font-medium">Motivation :</p>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl italic">"{p.reason}"</p>
              </div>
            )}

            {p.status === 'pending' && (
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <button 
                  onClick={() => handleAction(p.id, 'accepted')}
                  className="flex items-center justify-center gap-2 bg-green-50 text-green-600 py-2 rounded-xl font-bold text-sm hover:bg-green-100 transition-all border border-green-100"
                >
                  <CheckCircle2 className="w-4 h-4" /> Accepter
                </button>
                <button 
                  onClick={() => handleAction(p.id, 'rejected')}
                  className="flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2 rounded-xl font-bold text-sm hover:bg-red-100 transition-all border border-red-100"
                >
                  <Trash2 className="w-4 h-4" /> Refuser
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
