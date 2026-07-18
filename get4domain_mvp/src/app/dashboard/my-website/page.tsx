'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, Copy, Share2, CheckCircle2, Loader2, Save, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const industryModules: Record<string, string[]> = {
  travel: ['Tour Packages', 'Fleet Management', 'Booking Forms', 'Trip Gallery', 'Driver Tracking'],
  restaurant: ['Digital Menu', 'Table Reservations', 'Online Orders', 'Food Gallery', 'Reviews'],
  healthcare: ['Doctor Profiles', 'Appointments', 'Services', 'Emergency Contact', 'Departments'],
  education: ['Course Catalog', 'Admissions', 'Faculty Profiles', 'Events', 'Gallery'],
  realestate: ['Property Listings', 'Agent Profiles', 'EMI Calculator', 'Site Visits', 'Projects'],
  retail: ['Product Catalog', 'Offers', 'Store Locator', 'Customer Reviews', 'Brands'],
  beauty: ['Service Menu', 'Appointments', 'Gallery', 'Stylist Profiles', 'Gift Cards'],
  fitness: ['Class Schedule', 'Memberships', 'Trainer Profiles', 'Gallery', 'BMI Calculator'],
  construction: ['Project Portfolio', 'Services', 'Quote Request', 'Team', 'Gallery'],
  professional: ['Services', 'Team Profiles', 'Case Studies', 'Blog', 'Consultation Booking'],
  events: ['Event Gallery', 'Packages', 'Booking Form', 'Client Showcase', 'Venue'],
  finance: ['Products', 'Calculators', 'Team', 'Blog', 'Lead Forms'],
  automobile: ['Vehicle Listings', 'Test Drive', 'EMI Calculator', 'Service Center', 'Offers'],
  logistics: ['Routes', 'Fleet Info', 'Freight Enquiry', 'Tracking', 'Areas Served'],
  hotel: ['Room Listings', 'Amenities', 'Booking', 'Gallery', 'Offers'],
  diagnostics: ['Test Packages', 'Home Collection', 'Reports', 'Health Packages', 'Locations'],
  photography: ['Portfolio', 'Packages', 'Booking', 'Client Work', 'Video Showreel'],
  technology: ['Services', 'Case Studies', 'Tech Stack', 'Team', 'Blog'],
  agriculture: ['Products', 'Farm Story', 'Bulk Orders', 'Certifications', 'Seasonal'],
  coaching: ['Courses', 'Faculty', 'Results', 'Batch Schedule', 'Admissions'],
};

interface VendorCms {
  businessName: string | null;
  tagline: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
}

export default function MyWebsitePage() {
  const { user } = useAuth();
  const [cms, setCms] = useState<VendorCms>({ businessName: '', tagline: '', phone: '', whatsapp: '', email: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [domainRequested, setDomainRequested] = useState(false);
  const [error, setError] = useState('');

  const subdomainUrl = user?.subdomain ? `https://${user.subdomain}.get4domain.com` : '';
  const modules = industryModules[user?.industry ?? ''] ?? [];

  useEffect(() => {
    if (!user) return;
    api.getVendorCMS(user.id)
      .then((res) => {
        if (res.data) {
          setCms({
            businessName: res.data.businessName ?? user.businessName ?? '',
            tagline: res.data.tagline ?? '',
            phone: res.data.phone ?? '',
            whatsapp: res.data.whatsapp ?? '',
            email: res.data.email ?? user.email ?? '',
            address: res.data.address ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.updateVendorCMS(user.id, cms);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function requestDomainMapping() {
    if (!customDomain.trim()) return;
    try {
      await api.createTicket({
        category: 'Website Changes',
        subject: 'Custom domain mapping request',
        message: `Please map my custom domain "${customDomain}" to my Get4Domain website.`,
      });
      setDomainRequested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(subdomainUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Website</h2>
        <p className="mt-1 text-sm text-slate-500">Manage your website details and active modules.</p>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {/* Website URL */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {subdomainUrl ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm font-mono text-slate-700">
              <Globe className="h-4 w-4 text-primary-500" />{subdomainUrl.replace('https://', '')}
            </div>
            <div className="flex items-center gap-2">
              <a href={subdomainUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Visit</Button>
              </a>
              <Button size="sm" variant="ghost" leftIcon={copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />} onClick={copyUrl}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(subdomainUrl)}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" leftIcon={<Share2 className="h-3.5 w-3.5" />}>Share</Button>
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Your website subdomain hasn't been set up yet — contact us to get started.</p>
        )}
      </div>

      {/* Active modules */}
      {modules.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Active Modules</h3>
          <div className="flex flex-wrap gap-2">
            {modules.map((m) => (
              <span key={m} className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700">
                <CheckCircle2 className="h-3 w-3" />{m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CMS form */}
      <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Website Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Business Name</label>
            <input value={cms.businessName ?? ''} onChange={(e) => setCms({ ...cms, businessName: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tagline</label>
            <input value={cms.tagline ?? ''} onChange={(e) => setCms({ ...cms, tagline: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Phone</label>
            <input value={cms.phone ?? ''} onChange={(e) => setCms({ ...cms, phone: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">WhatsApp</label>
            <input value={cms.whatsapp ?? ''} onChange={(e) => setCms({ ...cms, whatsapp: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Email</label>
            <input value={cms.email ?? ''} onChange={(e) => setCms({ ...cms, email: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Address</label>
            <input value={cms.address ?? ''} onChange={(e) => setCms({ ...cms, address: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>Save Changes</Button>
          {saved && <span className="text-xs font-medium text-success-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Saved</span>}
        </div>
      </form>

      {/* Custom domain */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Custom Domain</h3>
        {domainRequested ? (
          <p className="text-sm text-success-700 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Request sent — our team will set up DNS and confirm with you.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="your-domain.com"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              <Button size="sm" onClick={requestDomainMapping} disabled={!customDomain.trim()}>Request Mapping</Button>
            </div>
            {customDomain && (
              <p className="text-xs text-slate-500">
                Once approved, point your domain's DNS: CNAME record → <code className="rounded bg-slate-100 px-1.5 py-0.5">get4domain.com</code>
              </p>
            )}
          </>
        )}
      </div>

      <Link href="/dashboard/support">
        <Button variant="outline" fullWidth rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Request Other Website Changes</Button>
      </Link>
    </div>
  );
}
