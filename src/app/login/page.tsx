'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Rocket, Mail, Lock, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import Button from '@/components/ui/Button';
import { loginWithCredentials, getSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect immediately
  useEffect(() => {
    const session = getSession();
    if (session) {
      router.push(session.role === 'vendor' ? '/dashboard' : '/admin');
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    setTimeout(() => {
      const result = loginWithCredentials(email, password);
      setLoading(false);
      if (result.success && result.user) {
        router.push(result.user.role === 'vendor' ? '/dashboard' : '/admin');
      } else {
        setError(result.error ?? 'Login failed. Please try again.');
      }
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-50/50 via-white to-white">
      <header className="pt-8 px-5">
        <div className="mx-auto max-w-7xl">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 shadow-md">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              Get4<span className="text-primary-600">Domain</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
              <Shield className="h-7 w-7 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sign In to Dashboard</h1>
            <p className="mt-2 text-sm text-slate-500">
              Enter the credentials shared by Get4Domain team
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-card p-6 sm:p-8">
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl bg-error-50 border border-error-200 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-error-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-error-700 font-medium">{error}</p>
                  <p className="text-xs text-error-600 mt-0.5">
                    Contact <a href="mailto:support@get4domain.in" className="underline">support@get4domain.in</a> if you need help.
                  </p>
                </div>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-10 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" size="lg" fullWidth loading={loading}>
                Sign In
              </Button>
            </form>

            <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
              <p className="text-xs text-slate-500">
                Your login credentials are provided by Get4Domain when your account is activated.
              </p>
              <a
                href="mailto:support@get4domain.in"
                className="mt-1.5 inline-block text-xs font-semibold text-primary-600 hover:underline"
              >
                support@get4domain.in
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Not a client yet?{' '}
            <Link href="/book-demo" className="font-semibold text-primary-600 hover:underline">
              Book a Free Demo →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
