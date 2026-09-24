'use client';

import Link from 'next/link';
import { Footprints, Instagram, Twitter, Facebook, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <Footprints className="h-7 w-7 text-primary" />
              <span className="font-display text-xl font-bold">Step N Rock</span>
            </Link>
            <p className="text-sm text-background/70 max-w-xs">
              Premium footwear and apparel for every step. Crafted with passion, designed for movement.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Instagram, label: 'Instagram' },
                { icon: Twitter, label: 'Twitter' },
                { icon: Facebook, label: 'Facebook' },
                { icon: Youtube, label: 'YouTube' },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-background/10 hover:bg-primary transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider">Shop</h4>
            <ul className="space-y-2.5 text-sm text-background/70">
              <li><Link href="/shop/sneakers" className="hover:text-primary transition-colors">Sneakers</Link></li>
              <li><Link href="/shop/running" className="hover:text-primary transition-colors">Running Shoes</Link></li>
              <li><Link href="/shop/formal" className="hover:text-primary transition-colors">Formal Shoes</Link></li>
              <li><Link href="/shop/sandals" className="hover:text-primary transition-colors">Sandals</Link></li>
              <li><Link href="/shop/women" className="hover:text-primary transition-colors">Women&apos;s</Link></li>
              <li><Link href="/shop/apparel" className="hover:text-primary transition-colors">Apparel</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2.5 text-sm text-background/70">
              <li><Link href="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
              <li><a href="#" className="hover:text-primary transition-colors">Shipping & Returns</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Size Guide</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Track Order</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">FAQs</a></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider">Newsletter</h4>
            <p className="text-sm text-background/70">Get 10% off your first order and stay updated on new arrivals.</p>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <Input
                type="email"
                placeholder="Your email"
                className="bg-background/10 border-background/20 text-background placeholder:text-background/50"
              />
              <Button type="submit" size="default" className="shrink-0">Subscribe</Button>
            </form>
            <div className="space-y-2 pt-2 text-sm text-background/70">
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> support@stepnrock.com</p>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> +91 93600 11107</p>
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Rahaat Plaza, 1st Floor, Vadapalani, Chennai</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-background/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-background/60">
            &copy; {new Date().getFullYear()} Step N Rock. Vadapalani, Chennai.
          </p>
          <div className="flex gap-4 text-xs text-background/60">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
