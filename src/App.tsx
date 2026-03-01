/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ClipboardList, 
  BarChart3, 
  Search, 
  Plus, 
  Activity, 
  Droplets, 
  Scale,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  LogOut,
  LogIn,
  UserCircle,
  LayoutGrid,
  FileText,
  Heart,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Camera,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { cn } from './lib/utils';
import { Patient, Visit, ReportSummary } from './types';
import { supabase } from './supabaseClient';

type View = 'dashboard' | 'patients-list' | 'new-patient' | 'edit-patient' | 'repeat-patient' | 'visit-entry' | 'reports' | 'patient-report';
type AuthMode = 'login' | 'signup';

interface User {
  id: string | number;
  full_name: string;
  role: 'admin' | 'staff';
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('clinic_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      return null;
    }
  });
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', full_name: '', role: 'staff' as 'admin' | 'staff' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [reportMonth, setReportMonth] = useState<string>(new Date().getMonth() + 1 + '');
  const [reportYear, setReportYear] = useState<string>(new Date().getFullYear() + '');

  // Form states
  const [newPatient, setNewPatient] = useState({
    mrn: '',
    name: '',
    age: '',
    gender: '',
    contact: '',
    patient_type: 'New' as 'New' | 'Repeat',
    conditions: [] as string[],
    region: '',
    zone: '',
    woreda: '',
    kebele: '',
    treatment_type: 'Healthy Life Style Counciling (HLC) only',
    diabetes_type: '',
    cvd_risk: '',
    cvd_treatment_type: '',
    created_at: new Date().toISOString().split('T')[0]
  });

  const [newVisit, setNewVisit] = useState({
    systolic_bp: '',
    diastolic_bp: '',
    heart_rate: '',
    temperature: '',
    respiratory_rate: '',
    spo2: '',
    blood_sugar_level: '',
    hba1c: '',
    creatinine: '',
    cholesterol: '',
    triglycerides: '',
    urinalysis: '',
    weight: '',
    notes: '',
    complications: ''
  });

  useEffect(() => {
    fetchSummary(reportMonth, reportYear);
    fetchPatients();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const userData = { 
          id: session.user.id, 
          full_name: session.user.user_metadata?.full_name || session.user.email,
          role: session.user.user_metadata?.role || 'staff'
        };
        setUser(userData as any);
        localStorage.setItem('clinic_user', JSON.stringify(userData));
        setCurrentView('dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Google login error:', err);
      setAuthError(err.message || 'Google login failed');
    }
  };

  const fetchSummary = async (month?: string, year?: string) => {
    try {
      const m = month || reportMonth;
      const y = year || reportYear;
      
      const startDate = new Date(parseInt(y), parseInt(m) - 1, 1).toISOString();
      const endDate = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59).toISOString();

      // Fetch patients for the period
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (patientsError) throw patientsError;

      // Fetch visits for the period
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('*, patients(name)')
        .gte('visit_date', startDate.split('T')[0])
        .lte('visit_date', endDate.split('T')[0])
        .order('visit_date', { ascending: false });

      if (visitsError) throw visitsError;

      const stats = {
        totalPatients: patientsData.length,
        newPatients: patientsData.filter(p => p.patient_type === 'New').length,
        repeatPatients: patientsData.filter(p => p.patient_type === 'Repeat').length,
        conditionCounts: {
          hypertension_only: patientsData.filter(p => p.conditions.includes('Hypertension') && !p.conditions.includes('Diabetes')).length,
          diabetes_only: patientsData.filter(p => p.conditions.includes('Diabetes') && !p.conditions.includes('Hypertension')).length,
          both: patientsData.filter(p => p.conditions.includes('Hypertension') && p.conditions.includes('Diabetes')).length,
        },
        genderDistribution: {
          male: patientsData.filter(p => p.gender === 'Male').length,
          female: patientsData.filter(p => p.gender === 'Female').length,
          other: patientsData.filter(p => p.gender === 'Other').length,
        },
        genderByCondition: {
          hypertension: {
            male: patientsData.filter(p => p.conditions.includes('Hypertension') && p.gender === 'Male').length,
            female: patientsData.filter(p => p.conditions.includes('Hypertension') && p.gender === 'Female').length,
            other: patientsData.filter(p => p.conditions.includes('Hypertension') && p.gender === 'Other').length,
          },
          diabetes: {
            male: patientsData.filter(p => p.conditions.includes('Diabetes') && p.gender === 'Male').length,
            female: patientsData.filter(p => p.conditions.includes('Diabetes') && p.gender === 'Female').length,
            other: patientsData.filter(p => p.conditions.includes('Diabetes') && p.gender === 'Other').length,
          }
        },
        recentVisits: (visitsData || []).map(v => ({
          ...v,
          patient_name: (v as any).patients?.name || 'Unknown'
        }))
      };

      setSummary(stats as any);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const fetchPatients = async (query = '') => {
    try {
      let supabaseQuery = supabase
        .from('patients')
        .select('*, visits(visit_date)')
        .order('name', { ascending: true });

      if (query) {
        supabaseQuery = supabaseQuery.or(`name.ilike.%${query}%,contact.ilike.%${query}%,conditions.ilike.%${query}%,mrn.ilike.%${query}%`);
      }

      const { data, error } = await supabaseQuery;
      if (error) throw error;

      const processedPatients = data.map(p => ({
        ...p,
        last_visit: p.visits && p.visits.length > 0 
          ? p.visits.sort((a: any, b: any) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime())[0].visit_date 
          : null
      }));

      setPatients(processedPatients as any);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const fetchPatientVisits = async (patientId: string | number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false });
      if (error) throw error;
      setPatientVisits(data || []);
    } catch (err) {
      console.error('Error fetching patient visits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: {
            data: {
              full_name: authForm.full_name,
              role: authForm.role,
            },
          },
        });
        if (error) throw error;
        
        // Clear password but keep email for convenience
        setAuthForm(prev => ({ ...prev, password: '' }));
        setAuthMode('login');
        showSuccess('Account created successfully! Please sign in with your credentials.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) throw error;
        if (data.user) {
          const userData = { 
            id: data.user.id, 
            full_name: data.user.user_metadata?.full_name || data.user.email,
            role: data.user.user_metadata?.role || 'staff'
          };
          setUser(userData as any);
          localStorage.setItem('clinic_user', JSON.stringify(userData));
          showSuccess('Logged in successfully!');
          setCurrentView('dashboard');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('clinic_user');
    showSuccess('Logged out successfully');
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const patientData = {
        ...newPatient,
        conditions: newPatient.conditions.join(', '),
        mrn: newPatient.mrn || Math.floor(100000 + Math.random() * 900000).toString(),
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('patients')
        .insert([patientData])
        .select()
        .single();

      if (error) throw error;

      await fetchPatients();
      // After creating patient, go to visit entry for this patient
      setSelectedPatient(data as any);
      setCurrentView('visit-entry');
      setNewPatient({ 
        mrn: '',
        name: '', 
        age: '', 
        gender: '', 
        contact: '', 
        patient_type: 'New', 
        conditions: [],
        region: '',
        zone: '',
        woreda: '',
        kebele: '',
        treatment_type: 'Healthy Life Style Counciling (HLC) only',
        diabetes_type: '',
        cvd_risk: '',
        cvd_treatment_type: '',
        created_at: new Date().toISOString().split('T')[0]
      });
      fetchSummary(reportMonth, reportYear);
      showSuccess('Patient registered successfully!');
    } catch (err: any) {
      console.error('Error creating patient:', err);
      alert('Failed to register patient: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          ...editingPatient
        })
        .eq('id', editingPatient.id);
      
      if (error) throw error;

      setCurrentView('patients-list');
      fetchPatients(searchQuery);
      fetchSummary(reportMonth, reportYear);
      setEditingPatient(null);
      showSuccess('Patient updated successfully!');
    } catch (err: any) {
      console.error('Error updating patient:', err);
      alert('Failed to update patient: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setLoading(true);
    try {
      const visitData = {
        patient_id: selectedPatient.id,
        systolic_bp: parseInt(newVisit.systolic_bp) || null,
        diastolic_bp: parseInt(newVisit.diastolic_bp) || null,
        heart_rate: parseInt(newVisit.heart_rate) || null,
        temperature: parseFloat(newVisit.temperature) || null,
        respiratory_rate: parseInt(newVisit.respiratory_rate) || null,
        spo2: parseInt(newVisit.spo2) || null,
        blood_sugar_level: parseFloat(newVisit.blood_sugar_level) || null,
        hba1c: parseFloat(newVisit.hba1c) || null,
        creatinine: parseFloat(newVisit.creatinine) || null,
        cholesterol: parseFloat(newVisit.cholesterol) || null,
        triglycerides: parseFloat(newVisit.triglycerides) || null,
        urinalysis: newVisit.urinalysis || null,
        weight: parseFloat(newVisit.weight) || null,
        notes: newVisit.notes || null,
        complications: newVisit.complications || null,
        visit_date: new Date().toISOString().split('T')[0]
      };

      const { error } = await supabase
        .from('visits')
        .insert([visitData]);

      if (error) throw error;
      
      await fetchPatients();
      setNewVisit({ 
        systolic_bp: '', 
        diastolic_bp: '', 
        heart_rate: '',
        temperature: '',
        respiratory_rate: '',
        spo2: '',
        blood_sugar_level: '', 
        hba1c: '', 
        creatinine: '',
        cholesterol: '',
        triglycerides: '',
        urinalysis: '',
        weight: '',
        notes: '',
        complications: ''
      });
      setSelectedPatient(null);
      setCurrentView('dashboard');
      fetchSummary(reportMonth, reportYear);
      showSuccess('Visit recorded successfully!');
    } catch (err: any) {
      console.error('Error creating visit:', err);
      alert('Failed to add clinical record: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDeletePatient = async (id: number) => {
    if (!id) return;

    const confirmed = window.confirm('Are you sure you want to delete this patient and all their records? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;

      await fetchPatients(searchQuery);
      await fetchSummary(reportMonth, reportYear);
      showSuccess('Patient and records deleted successfully');
    } catch (err: any) {
      console.error('Error deleting patient:', err);
      alert('Failed to delete patient: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteVisit = async (id: number) => {
    if (!id) return;

    const confirmed = window.confirm('Are you sure you want to delete this clinical record?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('visits')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchSummary(reportMonth, reportYear);
      await fetchPatients(searchQuery);
      showSuccess('Clinical record deleted successfully');
    } catch (err: any) {
      console.error('Error deleting visit:', err);
      alert('Failed to delete record: ' + (err.message || 'Unknown error'));
    }
  };

  const COLORS = {
    hypertension: '#E24444',
    diabetes: '#4A86E8',
    new: '#24978D',
    repeat: '#F2994A',
    male: '#4A86E8',
    female: '#D53F8C',
    other: '#24978D'
  };

  const conditionPieData = summary ? [
    { name: 'Hypertension', value: (summary.conditionCounts.hypertension_only || 0) + (summary.conditionCounts.both || 0) },
    { name: 'Diabetes', value: (summary.conditionCounts.diabetes_only || 0) + (summary.conditionCounts.both || 0) },
  ].filter(d => d.value > 0) : [];

  const typePieData = summary ? [
    { name: 'New', value: summary.newPatients },
    { name: 'Repeat', value: summary.repeatPatients }
  ].filter(d => d.value > 0) : [];

  const genderByConditionData = summary ? [
    {
      name: 'Hypertension',
      Male: summary.genderByCondition.hypertension.male,
      Female: summary.genderByCondition.hypertension.female,
      Other: summary.genderByCondition.hypertension.other,
    },
    {
      name: 'Diabetes',
      Male: summary.genderByCondition.diabetes.male,
      Female: summary.genderByCondition.diabetes.female,
      Other: summary.genderByCondition.diabetes.other,
    }
  ] : [];

  const [logoUrl, setLogoUrl] = useState('/api/image/logo');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
        >
          <div className="bg-[#0D4D44] p-8 text-white text-center relative group">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 p-2 shadow-lg relative overflow-hidden">
              <img 
                src={logoUrl} 
                alt="ANRS Health Bureau Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Change Logo"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>
            <h1 className="text-2xl font-bold">HealthTrack</h1>
            <p className="text-emerald-200/60 text-xs uppercase tracking-widest font-bold mt-1">Patient Follow-Up System</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLogoUpload} 
              className="hidden" 
              accept="image/*" 
            />
          </div>
          
          <div className="p-8">
            <div className="flex gap-4 mb-8">
              <button 
                onClick={() => setAuthMode('login')}
                className={cn(
                  "flex-1 py-2 font-bold text-sm transition-all border-b-2",
                  authMode === 'login' ? "border-[#0D4D44] text-[#0D4D44]" : "border-transparent text-gray-400"
                )}
              >
                Sign In
              </button>
              <button 
                onClick={() => setAuthMode('signup')}
                className={cn(
                  "flex-1 py-2 font-bold text-sm transition-all border-b-2",
                  authMode === 'signup' ? "border-[#0D4D44] text-[#0D4D44]" : "border-transparent text-gray-400"
                )}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input 
                      required
                      type="text"
                      placeholder="Dr. John Doe"
                      value={authForm.full_name}
                      onChange={e => setAuthForm({...authForm, full_name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-[#0D4D44] outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Role</label>
                    <select 
                      value={authForm.role}
                      onChange={e => setAuthForm({...authForm, role: e.target.value as 'admin' | 'staff'})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-[#0D4D44] outline-none transition-all font-medium bg-white"
                    >
                      <option value="staff">Staff Member</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                <input 
                  required
                  type="email"
                  placeholder="email@example.com"
                  value={authForm.email}
                  onChange={e => setAuthForm({...authForm, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-[#0D4D44] outline-none transition-all font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <input 
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={authForm.password}
                    onChange={e => setAuthForm({...authForm, password: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-[#0D4D44] outline-none transition-all font-medium pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0D4D44] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {authError && (
                <p className="text-rose-500 text-xs font-bold mt-2 ml-1">{authError}</p>
              )}

              <button 
                disabled={loading}
                type="submit"
                className="w-full bg-[#0D4D44] text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#1A5D54] transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 mt-4"
              >
                {loading ? "Processing..." : authMode === 'login' ? "Sign In" : "Register"}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400 font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-white border border-gray-200 text-gray-600 py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans flex">
      {/* Sidebar / Navigation */}
      <nav className="fixed top-0 left-0 h-full w-72 bg-[#0D4D44] text-white hidden md:flex flex-col z-10 shadow-xl">
        <div className="p-8 flex flex-col items-center text-center relative group">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 p-2 shadow-lg relative overflow-hidden">
            <img 
              src={logoUrl} 
              alt="ANRS Health Bureau Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Change Logo"
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLogoUpload} 
              className="hidden" 
              accept="image/*" 
            />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-xl tracking-tight">HealthTrack</span>
          </div>
          <p className="text-[10px] text-emerald-200/60 uppercase tracking-[0.2em] font-bold">Patient Follow-Up System</p>
        </div>
        
        <div className="flex-1 py-4 px-3 space-y-1">
          <NavItem 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
            icon={<LayoutGrid className="w-5 h-5" />}
            label="Dashboard"
          />
          <NavItem 
            active={currentView === 'patients-list'} 
            onClick={() => {
              setCurrentView('patients-list');
              fetchPatients();
            }}
            icon={<Users className="w-5 h-5" />}
            label="Patients"
          />
          <NavItem 
            active={currentView === 'new-patient'} 
            onClick={() => setCurrentView('new-patient')}
            icon={<UserPlus className="w-5 h-5" />}
            label="Register"
          />
          <NavItem 
            active={currentView === 'reports'} 
            onClick={() => setCurrentView('reports')}
            icon={<FileText className="w-5 h-5" />}
            label="Report Dashboard"
          />
          <NavItem 
            active={currentView === 'repeat-patient'} 
            onClick={() => setCurrentView('repeat-patient')}
            icon={<Activity className="w-5 h-5" />}
            label="Follow Up"
          />
        </div>

        <div className="p-6 mt-auto border-t border-white/10 space-y-4">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-bold text-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-400 mt-2"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 p-4 md:p-10">
        <AnimatePresence mode="wait">
          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-8 right-8 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              {successMessage}
            </motion.div>
          )}

          {currentView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-[#0D4D44]">Dashboard</h1>
                  <p className="text-gray-500 mt-1 text-lg">
                    Overview for {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][parseInt(reportMonth) - 1]} {reportYear}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <select 
                      value={reportMonth}
                      onChange={(e) => {
                        setReportMonth(e.target.value);
                        fetchSummary(e.target.value, reportYear);
                      }}
                      className="bg-transparent border-none focus:ring-0 text-sm font-bold text-[#0D4D44] outline-none cursor-pointer px-2"
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <div className="w-px h-4 bg-gray-200" />
                    <select 
                      value={reportYear}
                      onChange={(e) => {
                        setReportYear(e.target.value);
                        fetchSummary(reportMonth, e.target.value);
                      }}
                      className="bg-transparent border-none focus:ring-0 text-sm font-bold text-[#0D4D44] outline-none cursor-pointer px-2"
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={() => setCurrentView('new-patient')}
                    className="bg-[#24978D] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#24978D]/20 hover:bg-[#1E857B] transition-all"
                  >
                    Register Patient
                  </button>
                  <button 
                    onClick={() => setCurrentView('reports')}
                    className="bg-emerald-50 text-emerald-700 border-2 border-emerald-100 px-6 py-3 rounded-xl font-bold hover:bg-emerald-100 transition-all"
                  >
                    Report Dashboard
                  </button>
                  <button 
                    onClick={() => setCurrentView('repeat-patient')}
                    className="bg-white text-[#0D4D44] border-2 border-gray-100 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
                  >
                    Add Follow-Up
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <StatCard 
                  label="Total Patients" 
                  value={summary?.totalPatients || 0} 
                  icon={<Users className="w-6 h-6 text-[#24978D]" />}
                />
                <StatCard 
                  label="New Patients" 
                  value={summary?.newPatients || 0} 
                  icon={<UserPlus className="w-6 h-6 text-[#24978D]" />}
                />
                <StatCard 
                  label="Repeat Patients" 
                  value={summary?.repeatPatients || 0} 
                  icon={<Activity className="w-6 h-6 text-orange-400" />}
                />
                <StatCard 
                  label="Hypertension" 
                  value={(summary?.conditionCounts?.hypertension_only ?? 0) + (summary?.conditionCounts?.both ?? 0)} 
                  icon={<Heart className="w-6 h-6 text-rose-500" />}
                />
                <StatCard 
                  label="Diabetes" 
                  value={(summary?.conditionCounts?.diabetes_only ?? 0) + (summary?.conditionCounts?.both ?? 0)} 
                  icon={<Droplets className="w-6 h-6 text-blue-500" />}
                />
                <StatCard 
                  label="Follow-Ups" 
                  value={summary?.recentVisits?.length ?? 0} 
                  icon={<Activity className="w-6 h-6 text-[#24978D]" />}
                />
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-[#0D4D44]">Monthly Follow-up Visits</h3>
                  <button 
                    onClick={() => setCurrentView('reports')}
                    className="text-[#24978D] font-bold hover:underline"
                  >
                    View Reports
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-[0.1em] font-bold">
                      <tr>
                        <th className="px-8 py-5">Patient Name</th>
                        <th className="px-8 py-5">Visit Date</th>
                        <th className="px-8 py-5">BP (mmHg)</th>
                        <th className="px-8 py-5">Sugar (mg/dL)</th>
                        <th className="px-8 py-5">Weight (kg)</th>
                        <th className="px-8 py-5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(summary?.recentVisits || []).map((visit) => (
                        <tr key={visit.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-8 py-5 font-bold text-[#0D4D44]">{visit.patient_name}</td>
                          <td className="px-8 py-5 text-gray-500">{new Date(visit.visit_date).toLocaleDateString()}</td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-xs font-bold",
                              visit.systolic_bp > 140 || visit.diastolic_bp > 90 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                              {visit.systolic_bp}/{visit.diastolic_bp}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-xs font-bold",
                              visit.blood_sugar_level > 140 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                              {visit.blood_sugar_level}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-gray-500 font-medium">{visit.weight}</td>
                          <td className="px-8 py-5 text-center">
                                <button 
                                  onClick={() => handleDeleteVisit(visit.id)}
                                  className="p-2 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'patients-list' && (
            <motion.div 
              key="patients-list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="flex justify-between items-center">
                <h1 className="text-4xl font-bold tracking-tight text-[#0D4D44]">Patients</h1>
                <button 
                  onClick={() => setCurrentView('new-patient')}
                  className="bg-[#24978D] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#24978D]/20 hover:bg-[#1E857B] transition-all flex items-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  Register
                </button>
              </header>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-[#0D4D44]">Patient Records ({patients.length})</h3>
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input 
                      type="text"
                      placeholder="Search by name or MRN..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        fetchPatients(e.target.value);
                      }}
                      className="w-full pl-12 pr-6 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-gray-400 text-xs uppercase tracking-[0.1em] font-bold">
                      <tr>
                        <th className="px-4 py-5">MRN</th>
                        <th className="px-4 py-5">Name</th>
                        <th className="px-4 py-5">Age</th>
                        <th className="px-4 py-5">Gender</th>
                        <th className="px-4 py-5">Condition</th>
                        <th className="px-4 py-5">Type</th>
                        <th className="px-4 py-5">Treatment</th>
                        <th className="px-4 py-5">Date</th>
                        <th className="px-4 py-5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {patients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-6 text-gray-600 font-medium">{patient.mrn || 'N/A'}</td>
                          <td className="px-4 py-6 font-bold text-[#0D4D44]">{patient.name}</td>
                          <td className="px-4 py-6 text-gray-600">{patient.age}</td>
                          <td className="px-4 py-6 text-gray-600">{patient.gender}</td>
                          <td className="px-4 py-6">
                            <div className="flex flex-wrap gap-1">
                              {(patient.conditions || '').split(', ').filter(Boolean).map(c => (
                                <span key={c} className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider",
                                  c === 'Diabetes' ? "bg-blue-500" : "bg-rose-500"
                                )}>
                                  {c}
                                  {c === 'Diabetes' && patient.diabetes_type && (
                                    <span className="ml-1 opacity-80 text-[8px] lowercase">({patient.diabetes_type})</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-6">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              patient.patient_type === 'New' ? "bg-[#24978D] text-white" : "bg-gray-100 text-gray-600"
                            )}>
                              {patient.patient_type}
                            </span>
                          </td>
                          <td className="px-4 py-6 text-gray-600 text-xs font-medium">
                            {patient.treatment_type || 'N/A'}
                          </td>
                          <td className="px-4 py-6 text-gray-400 text-sm">
                            {new Date(patient.created_at).toISOString().split('T')[0]}
                          </td>
                          <td className="px-4 py-6">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => {
                                  setSelectedPatient(patient);
                                  setCurrentView('visit-entry');
                                }}
                                className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-[#0D4D44] hover:bg-gray-50 transition-all"
                              >
                                Follow Up
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingPatient(patient);
                                  setCurrentView('edit-patient');
                                }}
                                className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                                title="Edit Patient"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePatient(patient.id);
                                }}
                                className="p-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all flex items-center justify-center"
                                title="Delete Patient"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'edit-patient' && editingPatient && (
            <motion.div 
              key="edit-patient"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="mb-8">
                <h1 className="text-4xl font-black tracking-tight text-[#0D4D44]">Edit Patient</h1>
              </div>

              <form onSubmit={handleUpdatePatient} className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 space-y-10">
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-[#0D4D44]">Patient Information</h3>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">MRN (Medical Record Number) * <span className="text-xs font-normal text-gray-400">(max 6 digits)</span></label>
                    <input 
                      required
                      type="text"
                      pattern="\d*"
                      maxLength={6}
                      value={editingPatient.mrn}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setEditingPatient({...editingPatient, mrn: val});
                      }}
                      placeholder="e.g. 10023"
                      className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Full Name *</label>
                      <input 
                        required
                        type="text"
                        value={editingPatient.name}
                        onChange={e => setEditingPatient({...editingPatient, name: e.target.value})}
                        placeholder="Patient name"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Age * <span className="text-xs font-normal text-gray-400">(1-99)</span></label>
                      <input 
                        required
                        type="text"
                        pattern="\d*"
                        maxLength={2}
                        value={editingPatient.age}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 99)) {
                            setEditingPatient({...editingPatient, age: parseInt(val) || 0});
                          }
                        }}
                        placeholder="Age"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Gender *</label>
                      <select 
                        required
                        value={editingPatient.gender}
                        onChange={e => setEditingPatient({...editingPatient, gender: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="">Select gender</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Phone</label>
                      <input 
                        type="tel"
                        value={editingPatient.contact}
                        onChange={e => setEditingPatient({...editingPatient, contact: e.target.value})}
                        placeholder="Phone number"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Condition *</label>
                      <select 
                        required
                        value={editingPatient.conditions}
                        onChange={e => {
                          const val = e.target.value;
                          setEditingPatient({...editingPatient, conditions: val, diabetes_type: val.includes('Diabetes') ? editingPatient.diabetes_type : ''});
                        }}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="">Select condition</option>
                        <option>Hypertension</option>
                        <option>Diabetes</option>
                        <option>Hypertension, Diabetes</option>
                      </select>
                    </div>
                    {editingPatient.conditions.includes('Diabetes') && (
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Type of Diabetes *</label>
                        <select 
                          required
                          value={editingPatient.diabetes_type || ''}
                          onChange={e => setEditingPatient({...editingPatient, diabetes_type: e.target.value})}
                          className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                        >
                          <option value="">Select type</option>
                          <option value="Type I">Type I</option>
                          <option value="Type II">Type II</option>
                          <option value="Gestational DM">Gestational DM</option>
                        </select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">CVD Risk Category</label>
                      <select 
                        value={editingPatient.cvd_risk || ''}
                        onChange={e => setEditingPatient({...editingPatient, cvd_risk: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="">Select risk category</option>
                        <option value="Lab based ( >=20%)">Lab based ( {'>'}=20%)</option>
                        <option value="Non-Lab based (>=10%)">Non-Lab based ({'>'}=10%)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">CVD Risk by type of treatment</label>
                      <select 
                        value={editingPatient.cvd_treatment_type || ''}
                        onChange={e => setEditingPatient({...editingPatient, cvd_treatment_type: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="">Select treatment type</option>
                        <option value="With Statin">With Statin</option>
                        <option value="Without Statin">Without Statin</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Patient Type *</label>
                      <select 
                        required
                        value={editingPatient.patient_type}
                        onChange={e => setEditingPatient({...editingPatient, patient_type: e.target.value as 'New' | 'Repeat'})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="New">New Patient</option>
                        <option value="Repeat">Repeat Patient</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Type of Treatment *</label>
                      <select 
                        required
                        value={editingPatient.treatment_type || 'Healthy Life Style Counciling (HLC) only'}
                        onChange={e => setEditingPatient({...editingPatient, treatment_type: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="Healthy Life Style Counciling (HLC) only">Healthy Life Style Counciling (HLC) only</option>
                        <option value="Pharmacological Management and HLC">Pharmacological Management and HLC</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 space-y-6">
                  <h3 className="text-2xl font-bold text-[#0D4D44]">Address Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Region</label>
                      <input 
                        type="text"
                        value={editingPatient.region || ''}
                        onChange={e => setEditingPatient({...editingPatient, region: e.target.value})}
                        placeholder="Region"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Zone</label>
                      <input 
                        type="text"
                        value={editingPatient.zone || ''}
                        onChange={e => setEditingPatient({...editingPatient, zone: e.target.value})}
                        placeholder="Zone"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Woreda</label>
                      <input 
                        type="text"
                        value={editingPatient.woreda || ''}
                        onChange={e => setEditingPatient({...editingPatient, woreda: e.target.value})}
                        placeholder="Woreda"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Kebele</label>
                      <input 
                        type="text"
                        value={editingPatient.kebele || ''}
                        onChange={e => setEditingPatient({...editingPatient, kebele: e.target.value})}
                        placeholder="Kebele"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-8 flex gap-4">
                  <button 
                    disabled={loading}
                    type="submit"
                    className="bg-[#24978D] text-white px-10 py-4 rounded-xl font-bold hover:bg-[#1E857B] transition-all shadow-lg shadow-[#24978D]/20 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingPatient({
                        ...editingPatient,
                        mrn: '',
                        name: '',
                        age: '',
                        gender: '',
                        contact: '',
                        patient_type: 'New',
                        conditions: '',
                        region: '',
                        zone: '',
                        woreda: '',
                        kebele: '',
                        treatment_type: 'Healthy Life Style Counciling (HLC) only',
                        diabetes_type: '',
                        cvd_risk: '',
                        cvd_treatment_type: ''
                      });
                    }}
                    className="bg-gray-50 text-gray-600 px-10 py-4 rounded-xl font-bold border border-gray-200 hover:bg-gray-100 transition-all"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </motion.div>
          )}
          {currentView === 'new-patient' && (
            <motion.div 
              key="new-patient"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="mb-8">
                <h1 className="text-4xl font-black tracking-tight text-[#0D4D44]">Register Patient</h1>
              </div>

              <form onSubmit={handleCreatePatient} className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 space-y-10">
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-[#0D4D44]">Patient Information</h3>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">MRN (Medical Record Number) * <span className="text-xs font-normal text-gray-400">(max 6 digits)</span></label>
                    <input 
                      required
                      type="text"
                      pattern="\d*"
                      maxLength={6}
                      value={newPatient.mrn}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setNewPatient({...newPatient, mrn: val});
                      }}
                      placeholder="e.g. 10023"
                      className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Full Name *</label>
                      <input 
                        required
                        type="text"
                        value={newPatient.name}
                        onChange={e => setNewPatient({...newPatient, name: e.target.value})}
                        placeholder="Patient name"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Age * <span className="text-xs font-normal text-gray-400">(1-99)</span></label>
                      <input 
                        required
                        type="text"
                        pattern="\d*"
                        maxLength={2}
                        value={newPatient.age}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 99)) {
                            setNewPatient({...newPatient, age: val});
                          }
                        }}
                        placeholder="Age"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Gender *</label>
                      <select 
                        required
                        value={newPatient.gender}
                        onChange={e => setNewPatient({...newPatient, gender: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="">Select gender</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Phone</label>
                      <input 
                        type="tel"
                        value={newPatient.contact}
                        onChange={e => setNewPatient({...newPatient, contact: e.target.value})}
                        placeholder="Phone number"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Condition *</label>
                      <select 
                        required
                        value={newPatient.conditions[0] || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setNewPatient({...newPatient, conditions: [val], diabetes_type: val.includes('Diabetes') ? newPatient.diabetes_type : ''});
                        }}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="">Select condition</option>
                        <option>Hypertension</option>
                        <option>Diabetes</option>
                        <option>Hypertension, Diabetes</option>
                      </select>
                    </div>
                    {newPatient.conditions.some(c => c.includes('Diabetes')) && (
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Type of Diabetes *</label>
                        <select 
                          required
                          value={newPatient.diabetes_type}
                          onChange={e => setNewPatient({...newPatient, diabetes_type: e.target.value})}
                          className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                        >
                          <option value="">Select type</option>
                          <option value="Type I">Type I</option>
                          <option value="Type II">Type II</option>
                          <option value="Gestational DM">Gestational DM</option>
                        </select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">CVD Risk Category</label>
                      <select 
                        value={newPatient.cvd_risk}
                        onChange={e => setNewPatient({...newPatient, cvd_risk: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="">Select risk category</option>
                        <option value="Lab based ( >=20%)">Lab based ( {'>'}=20%)</option>
                        <option value="Non-Lab based (>=10%)">Non-Lab based ({'>'}=10%)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">CVD Risk by type of treatment</label>
                      <select 
                        value={newPatient.cvd_treatment_type}
                        onChange={e => setNewPatient({...newPatient, cvd_treatment_type: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="">Select treatment type</option>
                        <option value="With Statin">With Statin</option>
                        <option value="Without Statin">Without Statin</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Patient Type *</label>
                      <select 
                        required
                        value={newPatient.patient_type}
                        onChange={e => setNewPatient({...newPatient, patient_type: e.target.value as 'New' | 'Repeat'})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="New">New Patient</option>
                        <option value="Repeat">Repeat Patient</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Registration Date *</label>
                      <input 
                        required
                        type="date"
                        value={newPatient.created_at}
                        onChange={e => setNewPatient({...newPatient, created_at: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Type of Treatment *</label>
                      <select 
                        required
                        value={newPatient.treatment_type}
                        onChange={e => setNewPatient({...newPatient, treatment_type: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      >
                        <option value="Healthy Life Style Counciling (HLC) only">Healthy Life Style Counciling (HLC) only</option>
                        <option value="Pharmacological Management and HLC">Pharmacological Management and HLC</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 space-y-6">
                  <h3 className="text-2xl font-bold text-[#0D4D44]">Address Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Region</label>
                      <input 
                        type="text"
                        value={newPatient.region}
                        onChange={e => setNewPatient({...newPatient, region: e.target.value})}
                        placeholder="Region"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Zone</label>
                      <input 
                        type="text"
                        value={newPatient.zone}
                        onChange={e => setNewPatient({...newPatient, zone: e.target.value})}
                        placeholder="Zone"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Woreda</label>
                      <input 
                        type="text"
                        value={newPatient.woreda}
                        onChange={e => setNewPatient({...newPatient, woreda: e.target.value})}
                        placeholder="Woreda"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Kebele</label>
                      <input 
                        type="text"
                        value={newPatient.kebele}
                        onChange={e => setNewPatient({...newPatient, kebele: e.target.value})}
                        placeholder="Kebele"
                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-8 flex gap-4">
                  <button 
                    disabled={loading}
                    type="submit"
                    className="bg-[#24978D] text-white px-10 py-4 rounded-xl font-bold hover:bg-[#1E857B] transition-all shadow-lg shadow-[#24978D]/20 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save & Register Patient"}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setNewPatient({
                        mrn: '',
                        name: '',
                        age: '',
                        gender: '',
                        contact: '',
                        patient_type: 'New',
                        conditions: [],
                        region: '',
                        zone: '',
                        woreda: '',
                        kebele: '',
                        treatment_type: 'Healthy Life Style Counciling (HLC) only',
                        diabetes_type: '',
                        cvd_risk: '',
                        cvd_treatment_type: '',
                        created_at: new Date().toISOString().split('T')[0]
                      });
                    }}
                    className="bg-gray-50 text-gray-600 px-10 py-4 rounded-xl font-bold border border-gray-200 hover:bg-gray-100 transition-all"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {currentView === 'repeat-patient' && (
            <motion.div 
              key="repeat-patient"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-[#0D4D44]">Follow-up Search</h1>
                  <p className="text-gray-500 mt-1 text-lg">Select an existing patient to record a new visit.</p>
                </div>
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type="text"
                    placeholder="Search by name, MRN, or contact..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      fetchPatients(e.target.value);
                    }}
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#24978D]/20 focus:border-[#24978D] shadow-sm transition-all text-lg"
                  />
                </div>
              </header>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/50 text-gray-400 text-xs uppercase tracking-[0.1em] font-bold">
                      <tr>
                        <th className="px-8 py-5">Patient Details</th>
                        <th className="px-8 py-5">Condition</th>
                        <th className="px-8 py-5">Last Visit</th>
                        <th className="px-8 py-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {patients.map((patient) => (
                        <tr 
                          key={patient.id} 
                          className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setCurrentView('visit-entry');
                          }}
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#0D4D44] group-hover:bg-[#24978D] group-hover:text-white transition-all">
                                <UserCircle className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="font-bold text-[#0D4D44] text-lg">{patient.name}</p>
                                <p className="text-sm text-gray-400 font-medium">MRN: {patient.mrn || 'N/A'} • {patient.age}y • {patient.gender}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-wrap gap-1">
                              {(patient.conditions || '').split(', ').filter(Boolean).map(c => (
                                <span key={c} className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider",
                                  c === 'Diabetes' ? "bg-blue-500" : "bg-rose-500"
                                )}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            {patient.last_visit ? (
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-gray-700">{new Date(patient.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Last Recorded</p>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-sm italic">No visits yet</span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button className="bg-gray-50 text-[#0D4D44] px-6 py-2 rounded-xl font-bold text-sm group-hover:bg-[#24978D] group-hover:text-white transition-all flex items-center gap-2 ml-auto">
                              Follow Up
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {patients.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center gap-4 text-gray-400">
                              <Search className="w-12 h-12 opacity-20" />
                              <p className="text-lg font-medium">No patients found matching your search.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'visit-entry' && selectedPatient && (
            <motion.div 
              key="visit-entry"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <header className="flex items-center justify-between">
                <button 
                  onClick={() => setCurrentView(selectedPatient.patient_type === 'New' ? 'new-patient' : 'repeat-patient')}
                  className="flex items-center gap-2 text-gray-500 hover:text-[#0D4D44] font-bold transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to Search
                </button>
                <div className="text-right">
                  <h1 className="text-3xl font-bold text-[#0D4D44]">Record New Visit</h1>
                  <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Clinical Documentation</p>
                </div>
              </header>

              <div className="bg-[#0D4D44] rounded-3xl p-8 text-white shadow-xl shadow-[#0D4D44]/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                    <UserCircle className="w-12 h-12 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">{selectedPatient.name}</h2>
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="bg-white/10 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">MRN: {selectedPatient.mrn || 'N/A'}</span>
                      <span className="bg-white/10 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">{selectedPatient.age} Years • {selectedPatient.gender}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center text-[#0D4D44] font-black text-xs">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black uppercase tracking-widest leading-none">{user.full_name}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(selectedPatient.conditions || '').split(', ').filter(Boolean).map(c => (
                      <span key={c} className={cn(
                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        c === 'Diabetes' ? "bg-blue-500/20 border-blue-400 text-blue-300" : "bg-rose-500/20 border-rose-400 text-rose-300"
                      )}>
                        {c}
                      </span>
                    ))}
                  </div>
                  {selectedPatient.last_visit && (
                    <p className="text-emerald-200/60 text-xs font-bold uppercase tracking-widest mt-2">
                      Last Visit: {new Date(selectedPatient.last_visit).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <form onSubmit={handleCreateVisit} className="space-y-8 pb-20">
                {newVisit.diastolic_bp && parseInt(newVisit.diastolic_bp) >= 90 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-50 border border-rose-200 p-6 rounded-3xl flex items-center gap-4 text-rose-700 shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black uppercase text-xs tracking-widest mb-1">Clinical Alert</p>
                      <p className="font-bold text-lg">High Diastolic Blood Pressure Detected (≥ 90 mmHg)</p>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Primary Metrics */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8">
                    <h3 className="text-xl font-bold text-[#0D4D44] flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#24978D]">
                        <Activity className="w-5 h-5" />
                      </div>
                      Primary Health Metrics
                    </h3>
                    
                    <div className="space-y-6">
                      {selectedPatient.conditions.includes('Hypertension') && (
                        <div className="p-6 bg-rose-50/30 rounded-2xl border border-rose-100 space-y-4">
                          <p className="text-rose-600 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                            <Heart className="w-4 h-4" /> Blood Pressure
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Systolic</label>
                              <input 
                                required
                                type="number"
                                placeholder="120"
                                value={newVisit.systolic_bp}
                                onChange={e => setNewVisit({...newVisit, systolic_bp: e.target.value})}
                                className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all text-lg font-bold"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diastolic</label>
                              <input 
                                required
                                type="number"
                                placeholder="80"
                                value={newVisit.diastolic_bp}
                                onChange={e => setNewVisit({...newVisit, diastolic_bp: e.target.value})}
                                className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all text-lg font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedPatient.conditions.includes('Diabetes') && (
                        <div className="p-6 bg-blue-50/30 rounded-2xl border border-blue-100 space-y-4">
                          <p className="text-blue-600 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                            <Droplets className="w-4 h-4" /> Glucose Monitoring
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Level (mg/dL)</label>
                              <input 
                                required
                                type="number"
                                placeholder="100"
                                value={newVisit.blood_sugar_level}
                                onChange={e => setNewVisit({...newVisit, blood_sugar_level: e.target.value})}
                                className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-lg font-bold"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">HbA1c (%)</label>
                              <input 
                                type="number"
                                step="0.1"
                                placeholder="6.5"
                                value={newVisit.hba1c}
                                onChange={e => setNewVisit({...newVisit, hba1c: e.target.value})}
                                className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-lg font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Weight (kg)</label>
                          <input 
                            required
                            type="number"
                            step="0.1"
                            placeholder="70.5"
                            value={newVisit.weight}
                            onChange={e => setNewVisit({...newVisit, weight: e.target.value})}
                            className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-[#24978D] outline-none transition-all text-lg font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Heart Rate (bpm)</label>
                          <input 
                            type="number"
                            placeholder="72"
                            value={newVisit.heart_rate}
                            onChange={e => setNewVisit({...newVisit, heart_rate: e.target.value})}
                            className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-[#24978D] outline-none transition-all text-lg font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Vitals & Labs */}
                  <div className="space-y-8">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                      <h3 className="text-xl font-bold text-[#0D4D44] flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#24978D]">
                          <ClipboardList className="w-5 h-5" />
                        </div>
                        Laboratory & Vitals
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Temp (°C)</label>
                          <input 
                            type="number"
                            step="0.1"
                            placeholder="36.5"
                            value={newVisit.temperature}
                            onChange={e => setNewVisit({...newVisit, temperature: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:border-[#24978D] outline-none transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SpO₂ (%)</label>
                          <input 
                            type="number"
                            placeholder="98"
                            value={newVisit.spo2}
                            onChange={e => setNewVisit({...newVisit, spo2: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:border-[#24978D] outline-none transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Creatinine</label>
                          <input 
                            type="number"
                            step="0.01"
                            placeholder="0.9"
                            value={newVisit.creatinine}
                            onChange={e => setNewVisit({...newVisit, creatinine: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:border-[#24978D] outline-none transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cholesterol</label>
                          <input 
                            type="number"
                            placeholder="180"
                            value={newVisit.cholesterol}
                            onChange={e => setNewVisit({...newVisit, cholesterol: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:border-[#24978D] outline-none transition-all font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                      <h3 className="text-xl font-bold text-[#0D4D44] flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#24978D]">
                          <FileText className="w-5 h-5" />
                        </div>
                        Clinical Notes
                      </h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Complications</label>
                          <input 
                            type="text"
                            placeholder="e.g. Foot ulcer, Retinopathy"
                            value={newVisit.complications}
                            onChange={e => setNewVisit({...newVisit, complications: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:border-[#24978D] outline-none transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Notes</label>
                          <textarea 
                            placeholder="Additional clinical observations..."
                            value={newVisit.notes}
                            onChange={e => setNewVisit({...newVisit, notes: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-100 focus:border-[#24978D] outline-none transition-all h-24 resize-none font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setCurrentView(selectedPatient.patient_type === 'New' ? 'new-patient' : 'repeat-patient')}
                    className="flex-1 bg-gray-100 text-gray-600 py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={loading}
                    type="submit"
                    className="flex-[2] bg-[#24978D] text-white py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-[#1E857B] transition-all shadow-xl shadow-[#24978D]/20 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Clinical Record"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {currentView === 'patient-report' && selectedPatient && (
            <motion.div 
              key="patient-report"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header className="flex items-center gap-4">
                <button 
                  onClick={() => setCurrentView('patients-list')}
                  className="p-3 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-[#0D4D44] transition-all"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-[#0D4D44]">Patient Report</h1>
                  <p className="text-gray-500">Clinical history for {selectedPatient.name}</p>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-8">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold text-[#0D4D44] mb-6">Patient Profile</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between py-2 border-b border-gray-50">
                        <span className="text-gray-400 font-medium">MRN</span>
                        <span className="font-bold text-[#0D4D44]">{selectedPatient.mrn || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-50">
                        <span className="text-gray-400 font-medium">Age</span>
                        <span className="font-bold text-[#0D4D44]">{selectedPatient.age} Years</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-50">
                        <span className="text-gray-400 font-medium">Gender</span>
                        <span className="font-bold text-[#0D4D44]">{selectedPatient.gender}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-50">
                        <span className="text-gray-400 font-medium">Type</span>
                        <span className="font-bold text-[#0D4D44]">{selectedPatient.patient_type}</span>
                      </div>
                      {selectedPatient.cvd_risk && (
                        <div className="flex justify-between py-2 border-b border-gray-50">
                          <span className="text-gray-400 font-medium">CVD Risk</span>
                          <span className="font-bold text-rose-600">{selectedPatient.cvd_risk}</span>
                        </div>
                      )}
                      {selectedPatient.cvd_treatment_type && (
                        <div className="flex justify-between py-2 border-b border-gray-50">
                          <span className="text-gray-400 font-medium">CVD Treatment</span>
                          <span className="font-bold text-emerald-600">{selectedPatient.cvd_treatment_type}</span>
                        </div>
                      )}
                      <div className="pt-4">
                        <p className="text-gray-400 font-medium mb-3">Conditions</p>
                        <div className="flex flex-wrap gap-2">
                          {(selectedPatient.conditions || '').split(', ').filter(Boolean).map(c => (
                            <span key={c} className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider",
                              c === 'Diabetes' ? "bg-blue-500" : "bg-rose-500"
                            )}>
                              {c}
                              {c === 'Diabetes' && selectedPatient.diabetes_type && (
                                <span className="ml-1 opacity-80 text-[8px] lowercase">({selectedPatient.diabetes_type})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-8 border-b border-gray-100">
                      <h3 className="text-xl font-bold text-[#0D4D44]">Visit History</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-[0.1em] font-bold">
                          <tr>
                            <th className="px-8 py-5">Date</th>
                            <th className="px-8 py-5">BP</th>
                            <th className="px-8 py-5">Sugar</th>
                            <th className="px-8 py-5">Weight</th>
                            <th className="px-8 py-5">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {patientVisits.length > 0 ? (
                            patientVisits.map((visit) => (
                              <tr key={visit.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-8 py-5 text-gray-500 font-medium">{new Date(visit.visit_date).toLocaleDateString()}</td>
                                <td className="px-8 py-5">
                                  <span className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-bold",
                                    visit.systolic_bp > 140 || visit.diastolic_bp > 90 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                  )}>
                                    {visit.systolic_bp}/{visit.diastolic_bp}
                                  </span>
                                </td>
                                <td className="px-8 py-5">
                                  <span className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-bold",
                                    visit.blood_sugar_level > 140 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                  )}>
                                    {visit.blood_sugar_level}
                                  </span>
                                </td>
                                <td className="px-8 py-5 text-gray-500 font-medium">{visit.weight}kg</td>
                                <td className="px-8 py-5 text-gray-400 text-sm">{visit.notes || '-'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-8 py-10 text-center text-gray-400">No visits recorded yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <header className="flex justify-between items-start">
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-[#0D4D44]">Report Dashboard</h1>
                  <p className="text-gray-500 mt-1 text-lg">
                    Analytics for {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][parseInt(reportMonth) - 1]} {reportYear}
                  </p>
                </div>
                <div className="flex gap-3">
                  <select 
                    value={reportMonth}
                    onChange={(e) => {
                      setReportMonth(e.target.value);
                      fetchSummary(e.target.value, reportYear);
                    }}
                    className="bg-white px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select 
                    value={reportYear}
                    onChange={(e) => {
                      setReportYear(e.target.value);
                      fetchSummary(reportMonth, e.target.value);
                    }}
                    className="bg-white px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Visits</p>
                  <p className="text-3xl font-black text-[#0D4D44]">{summary?.recentVisits?.length || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">New Patients</p>
                  <p className="text-3xl font-black text-[#24978D]">{summary?.newPatients || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Repeat Patients</p>
                  <p className="text-3xl font-black text-orange-400">{summary?.repeatPatients || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Registered</p>
                  <p className="text-3xl font-black text-[#0D4D44]">{summary?.totalPatients || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h3 className="text-2xl font-bold text-[#0D4D44] mb-8">Patients by Condition</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={conditionPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value, cx, cy, midAngle, innerRadius, outerRadius, fill }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = 25 + innerRadius + (outerRadius - innerRadius);
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text x={x} y={y} fill={fill} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-sm font-bold">
                                {`${name}: ${value}`}
                              </text>
                            );
                          }}
                        >
                          {conditionPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Hypertension' ? COLORS.hypertension : COLORS.diabetes} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h3 className="text-2xl font-bold text-[#0D4D44] mb-8">New vs Repeat Patients</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value, cx, cy, midAngle, innerRadius, outerRadius, fill }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = 25 + innerRadius + (outerRadius - innerRadius);
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text x={x} y={y} fill={fill} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-sm font-bold">
                                {`${name}: ${value}`}
                              </text>
                            );
                          }}
                        >
                          {typePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'New' ? COLORS.new : COLORS.repeat} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 lg:col-span-2">
                  <h3 className="text-2xl font-bold text-[#0D4D44] mb-8">Gender Distribution by Condition</h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={genderByConditionData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 14 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 14 }} />
                        <Tooltip cursor={{ fill: '#f8f9fa' }} />
                        <Legend verticalAlign="bottom" align="center" iconType="rect" wrapperStyle={{ paddingTop: '40px' }} />
                        <Bar dataKey="Male" fill={COLORS.male} radius={[4, 4, 0, 0]} barSize={60} />
                        <Bar dataKey="Female" fill={COLORS.female} radius={[4, 4, 0, 0]} barSize={60} />
                        <Bar dataKey="Other" fill={COLORS.other} radius={[4, 4, 0, 0]} barSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 lg:col-span-2">
                  <h3 className="text-2xl font-bold text-[#0D4D44] mb-8">Follow-up Visits for {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][parseInt(reportMonth) - 1]}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-[0.1em] font-bold">
                        <tr>
                          <th className="px-8 py-5">Patient Name</th>
                          <th className="px-8 py-5">Visit Date</th>
                          <th className="px-8 py-5">BP (mmHg)</th>
                          <th className="px-8 py-5">Sugar (mg/dL)</th>
                          <th className="px-8 py-5">Weight (kg)</th>
                          <th className="px-8 py-5">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(summary?.recentVisits || []).length > 0 ? (
                          (summary?.recentVisits || []).map((visit) => (
                            <tr key={visit.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-8 py-5 font-bold text-[#0D4D44]">{visit.patient_name}</td>
                              <td className="px-8 py-5 text-gray-500">{new Date(visit.visit_date).toLocaleDateString()}</td>
                              <td className="px-8 py-5">
                                <span className={cn(
                                  "px-3 py-1 rounded-lg text-xs font-bold",
                                  visit.systolic_bp > 140 || visit.diastolic_bp > 90 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                )}>
                                  {visit.systolic_bp}/{visit.diastolic_bp}
                                </span>
                              </td>
                              <td className="px-8 py-5">
                                <span className={cn(
                                  "px-3 py-1 rounded-lg text-xs font-bold",
                                  visit.blood_sugar_level > 140 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                )}>
                                  {visit.blood_sugar_level}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-gray-500 font-medium">{visit.weight}</td>
                              <td className="px-8 py-5 text-gray-400 text-sm truncate max-w-[200px]">{visit.notes || '-'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-8 py-10 text-center text-gray-400 font-medium">
                              No visits recorded for this month.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all font-bold text-sm",
        active 
          ? "bg-[#1A5D54] text-white border-l-4 border-emerald-400 shadow-lg" 
          : "text-emerald-100/60 hover:bg-white/5 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string, value: number | string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-md transition-all">
      <div>
        <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-2">{label}</p>
        <p className="text-4xl font-black text-[#0D4D44]">{value}</p>
      </div>
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
    </div>
  );
}

function ConditionCheckbox({ label, checked, onChange }: { label: string, checked: boolean, onChange: (checked: boolean) => void }) {
  return (
    <label className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all",
      checked ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
    )}>
      <input 
        type="checkbox" 
        className="hidden" 
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <div className={cn(
        "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
        checked ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
      )}>
        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>
      <span className="font-semibold">{label}</span>
    </label>
  );
}

function SummaryItem({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

function ConditionStat({ label, count, color }: { label: string, count: number, color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold mb-1">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, (count / 10) * 100)}%` }} />
      </div>
    </div>
  );
}
