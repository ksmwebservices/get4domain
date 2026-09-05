'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Building2, Briefcase, Eye, EyeOff, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { registerWithCredentials, getSession } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { INDUSTRIES } from '@/data/industries-list';
import { canonicalIndustryId } from '@/data/demo-site';

const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Already signed in → straight to the dashboard.
  useEffect(() => {
    const session = getSession();
    if (session) router.push(session.role === 'vendor' ? '/dashboard' : '/admin');
  }, [router]);

  // Pre-select the industry when arriving from a demo (/register?industry=retail), so a
  // visitor who already chose an industry in the demo is never asked to pick it again.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('industry');
    if (!q) return;
    const canon = canonicalIndustryId(q);
    if (INDUSTRIES.some((i) => i.id === canon)) setIndustry(canon);
  }, []);

  const passwordOk = PASSWORD_RULES.every((r) => r.test(password));
  const canSubmit =
    name.trim() && /\S+@\S+\.\S+/.test(email) && passwordOk && businessName.trim() && industry && agreed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setError('');
    setLoading(true);
    const result = await registerWithCredentials({
      name: name.trim(),
      email: email.trim(),
      password,
      businessName: businessName.trim(),
      industry,
    });
    setLoading(false);
    if (result.success && result.user) {
      refresh();
      // Land straight on the freshly-created website; fall back to the dashboard.
      router.push(result.user.subdomain ? `/site/${result.user.subdomain}` : '/dashboard');
    } else {
      setError(result.error ?? 'Could not create your account. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-50/50 via-white to-white">
      <header className="pt-8 px-5">
        <div className="container-mx">
          <Link href="/" className="inline-flex items-center" aria-label="Get4Domain home">
            <img src="/logo.png" alt="Get4Domain" className="h-10 w-auto object-contain md:h-11" />
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Create Your Account</h1>
            <p className="mt-2 text-sm text-slate-600">Launch your business online in 24 hours</p>
          </div>

          <div className="card-base p-6 sm:p-8">
            {error && (
              <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input value={name} onChange={(e) => setName(e.target.value)} type="text" autoComplete="name" placeholder="John Doe" className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} type="text" placeholder="CareWell Clinic" className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Industry</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                    <option value="">Select your industry</option>
                    {INDUSTRIES.map((it) => (
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Create a password" className="w-full rounded-xl border border-slate-200 pl-10 pr-10 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <div key={rule.label} className={`flex items-center gap-2 text-xs ${ok ? 'text-success-600' : 'text-slate-500'}`}>
                      <Check className={`h-3.5 w-3.5 ${ok ? 'text-success-500' : 'text-slate-300'}`} />
                      {rule.label}
                    </div>
                  );
                })}
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input checked={agreed} onChange={(e) => setAgreed(e.target.checked)} type="checkbox" className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                <span>I agree to the <Link href="/terms" className="font-medium text-primary-600 hover:underline">Terms</Link> and <Link href="/privacy-policy" className="font-medium text-primary-600 hover:underline">Privacy Policy</Link></span>
              </label>

              <Button type="submit" size="lg" fullWidth disabled={!canSubmit || loading} rightIcon={<ArrowRight className="h-4 w-4" />}>
                {loading ? 'Creating your site…' : 'Create Account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account? <Link href="/login" className="font-semibold text-primary-600 hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
