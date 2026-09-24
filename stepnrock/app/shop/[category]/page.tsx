'use client';

import { useState, useMemo } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { useProducts } from '@/lib/use-products';
import { SlidersHorizontal, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';

const validSlugs = ['sneakers', 'running', 'formal', 'sandals', 'women', 'apparel'];

const categoryMeta: Record<string, { title: string; description: string }> = {
  sneakers: { title: 'Sneakers', description: 'Premium sneakers for street, court, and everyday wear. Find your perfect pair.' },
  running: { title: 'Running Shoes', description: 'Engineered for speed and comfort. From daily trainers to race-day rockets.' },
  formal: { title: 'Formal Shoes', description: 'Handcrafted leather shoes for the modern professional. Timeless elegance.' },
  sandals: { title: 'Sandals', description: 'Stay cool and comfortable. Sandals and flip flops for every summer adventure.' },
  women: { title: "Women's Collection", description: 'Stylish footwear designed for her. From heels to sandals and everything between.' },
  apparel: { title: 'Apparel', description: 'Streetwear and activewear that moves with you. Premium hoodies, tees, and more.' },
};

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const category = params.category;

  if (!validSlugs.includes(category)) {
    notFound();
  }

  const { products } = useProducts();
  const [sortBy, setSortBy] = useState('featured');

  const filtered = useMemo(() => {
    let result = products.filter((p) => p.category === category);
    switch (sortBy) {
      case 'price-asc': result = [...result].sort((a, b) => a.price - b.price); break;
      case 'price-desc': result = [...result].sort((a, b) => b.price - a.price); break;
      case 'rating': result = [...result].sort((a, b) => b.rating - a.rating); break;
    }
    return result;
  }, [products, category, sortBy]);

  const meta = categoryMeta[category];

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
        <p className="text-muted-foreground max-w-2xl">{meta.description}</p>
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

      {filtered.length === 0 ? (
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
