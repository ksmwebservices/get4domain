'use client';

import { useState, useMemo } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { useProducts, useCategories } from '@/lib/use-products';
import { categoryMatchesSlug } from '@/lib/products';
import { SlidersHorizontal, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';

export default function CategoryPage() {
  const [sortBy, setSortBy] = useState('featured');
  const params = useParams<{ category: string }>();
  const category = decodeURIComponent(params.category);

  // Categories are whatever the shop created in its dashboard — not a fixed list of six.
  const { products, loading, failed, reload } = useProducts();
  const { categories, loading: catsLoading } = useCategories();
  const known = categories.find((c) => c.slug === category.toLowerCase());
  if (!catsLoading && !loading && !failed && !known && !products.some((p) => categoryMatchesSlug(p.category, category))) {
    notFound();
  }
  const filtered = useMemo(() => {
    let result = products.filter((p) => categoryMatchesSlug(p.category, category));
    switch (sortBy) {
      case 'price-asc': result = [...result].sort((a, b) => a.price - b.price); break;
      case 'price-desc': result = [...result].sort((a, b) => b.price - a.price); break;
      case 'rating': result = [...result].sort((a, b) => b.rating - a.rating); break;
    }
    return result;
  }, [products, category, sortBy]);

  const meta = { title: known?.name ?? category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), description: '' };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-primary">Shop</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{meta.title}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">{meta.title}</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <p className="text-sm text-muted-foreground">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="featured">Featured</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="rating">Top Rated</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (<div key={i} className="aspect-square rounded-xl animate-shimmer" />))}
        </div>
      ) : failed ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <X className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">We couldn&apos;t load the products</p>
          <Button variant="outline" onClick={reload}>Try again</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <X className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No products in this category yet</p>
          <Button asChild variant="outline"><Link href="/shop">Browse All Products</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
