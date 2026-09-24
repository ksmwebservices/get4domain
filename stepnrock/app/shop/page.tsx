'use client';

import { Suspense, useState, useMemo } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { categoryMatchesSlug } from '@/lib/products';
import { useProducts, useCategories } from '@/lib/use-products';
import { SlidersHorizontal, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

// useSearchParams() requires a Suspense boundary for static export (Next 14 enforces
// this at build time; the uploaded project's original Next 13.5 dev server didn't
// surface it). Structural only — no visual change.
export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopPageContent />
    </Suspense>
  );
}

function ShopPageContent() {
  const { products } = useProducts();
  const { categories } = useCategories();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200]);
  const [sortBy, setSortBy] = useState('featured');
  const [showNewOnly, setShowNewOnly] = useState(initialFilter === 'new');
  const [showBestOnly, setShowBestOnly] = useState(initialFilter === 'bestseller');

  const filtered = useMemo(() => {
    let result = products;

    if (selectedCats.length > 0) {
      result = result.filter((p) => selectedCats.some((slug) => categoryMatchesSlug(p.category, slug)));
    }
    result = result.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);
    if (showNewOnly) result = result.filter((p) => p.isNew);
    if (showBestOnly) result = result.filter((p) => p.isBestSeller);

    switch (sortBy) {
      case 'price-asc': result = [...result].sort((a, b) => a.price - b.price); break;
      case 'price-desc': result = [...result].sort((a, b) => b.price - a.price); break;
      case 'rating': result = [...result].sort((a, b) => b.rating - a.rating); break;
      case 'newest': result = [...result].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)); break;
    }
    return result;
  }, [products, selectedCats, priceRange, sortBy, showNewOnly, showBestOnly]);

  const toggleCat = (slug: string) => {
    setSelectedCats((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    );
  };

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-3">Categories</h3>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label key={cat.slug} className="flex items-center gap-2.5 cursor-pointer group">
              <button
                onClick={() => toggleCat(cat.slug)}
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                  selectedCats.includes(cat.slug) ? 'bg-primary border-primary text-primary-foreground' : 'border-border group-hover:border-primary'
                )}
              >
                {selectedCats.includes(cat.slug) && <Check className="h-3 w-3" />}
              </button>
              <span className="text-sm">{cat.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">Price Range</h3>
        <div className="px-2">
          <Slider
            value={priceRange}
            onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
            min={0}
            max={200}
            step={10}
            className="mb-3"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">Special</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <button
              onClick={() => setShowNewOnly(!showNewOnly)}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                showNewOnly ? 'bg-primary border-primary text-primary-foreground' : 'border-border group-hover:border-primary'
              )}
            >
              {showNewOnly && <Check className="h-3 w-3" />}
            </button>
            <span className="text-sm">New Arrivals</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <button
              onClick={() => setShowBestOnly(!showBestOnly)}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                showBestOnly ? 'bg-primary border-primary text-primary-foreground' : 'border-border group-hover:border-primary'
              )}
            >
              {showBestOnly && <Check className="h-3 w-3" />}
            </button>
            <span className="text-sm">Best Sellers</span>
          </label>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setSelectedCats([]);
          setPriceRange([0, 200]);
          setShowNewOnly(false);
          setShowBestOnly(false);
        }}
      >
        Clear All Filters
      </Button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Shop All Products</h1>
        <p className="text-muted-foreground">Discover our full collection of premium footwear and apparel</p>
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-20">
            <FilterContent />
          </div>
        </aside>

        {/* Products */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-6 gap-3">
            <p className="text-sm text-muted-foreground shrink-0">
              {filtered.length} product{filtered.length !== 1 ? 's' : ''}
            </p>

            <div className="flex items-center gap-2">
              {/* Mobile Filter */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden">
                    <SlidersHorizontal className="h-4 w-4 mr-1" /> Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto">
                  <SheetClose className="absolute right-4 top-4" />
                  <h2 className="font-display text-lg font-bold mb-6 mt-2">Filters</h2>
                  <FilterContent />
                </SheetContent>
              </Sheet>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <X className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
              <Button variant="outline" onClick={() => {
                setSelectedCats([]);
                setPriceRange([0, 200]);
                setShowNewOnly(false);
                setShowBestOnly(false);
              }}>Clear Filters</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
