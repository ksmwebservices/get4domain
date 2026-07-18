'use client';

import Link from 'next/link';
import { Rocket, Mail, Lock, User, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/Button';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-50/50 via-white to-white">
      <header className="pt-8 px-5">
        <div className="container-mx">
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
            <h1 className="text-2xl font-bold text-slate-900">Create Your Account</h1>
            <p className="mt-2 text-sm text-slate-600">Launch your business online in 24 hours</p>
          </div>

          <div className="card-base p-6 sm:p-8">
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" placeholder="John Doe" className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="email" placeholder="you@example.com" className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Create a password" className="w-full rounded-xl border border-slate-200 pl-10 pr-10 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {['At least 8 characters', 'One uppercase letter', 'One number'].map((req) => (
                  <div key={req} className="flex items-center gap-2 text-xs text-slate-500">
                    <Check className="h-3.5 w-3.5 text-slate-300" />
                    {req}
                  </div>
                ))}
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                <span>I agree to the <Link href="/terms" className="font-medium text-primary-600 hover:underline">Terms</Link> and <Link href="/privacy-policy" className="font-medium text-primary-600 hover:underline">Privacy Policy</Link></span>
              </label>

              <Button type="submit" size="lg" fullWidth rightIcon={<ArrowRight className="h-4 w-4" />}>Create Account</Button>
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
