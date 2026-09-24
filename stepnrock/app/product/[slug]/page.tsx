'use client';

import { useState, useEffect, use } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { Star, ShoppingBag, Heart, Truck, RotateCcw, ShieldCheck, Minus, Plus, ChevronRight, Check } from 'lucide-react';
import { formatPrice } from '@/lib/products';
import { useProducts } from '@/lib/use-products';
import { useCart } from '@/lib/cart-context';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product/ProductCard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const { products, loading } = useProducts();
  const product = products.find((p) => p.slug === params.slug);

  const { addToCart } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  // Starts null (not product.colors[0].name) so every Hook here is declared
  // unconditionally, on every render, regardless of whether `product` has resolved
  // yet — required by the Rules of Hooks now that the catalogue loads async. Set to
  // the real default the instant the product is known; imperceptible in practice.
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (product && selectedColor === null) setSelectedColor(product.colors[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  if (!product) {
    // Catalogue still loading (first paint uses the showcase fallback data — a real
    // vendor product id genuinely isn't in it yet) — render nothing rather than
    // flashing a 404 before the real fetch resolves. Once loading settles with no
    // match, it's a real not-found.
    if (loading) return null;
    notFound();
  }

  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleAddToCart = () => {
    if (!selectedSize) {
      toast.error('Please select a size first');
      return;
    }
    addToCart({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
      size: selectedSize,
      color: selectedColor ?? product.colors[0].name,
    }, quantity);
    toast.success(`${product.name} added to cart!`);
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 overflow-x-auto no-scrollbar">
          <Link href="/" className="hover:text-primary whitespace-nowrap">Home</Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <Link href="/shop" className="hover:text-primary whitespace-nowrap">Shop</Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <Link href={`/shop/${product.category}`} className="hover:text-primary whitespace-nowrap capitalize">{product.category}</Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="text-foreground font-medium whitespace-nowrap">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-secondary">
              <img
                src={product.gallery[selectedImage]}
                alt={`${product.name} - Image ${selectedImage + 1}`}
                className="w-full h-full object-cover"
              />
              {discount > 0 && (
                <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-foreground text-background text-xs font-bold">
                  -{discount}% OFF
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {product.gallery.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={cn(
                    'relative h-20 w-20 rounded-lg overflow-hidden border-2 transition-all',
                    selectedImage === idx ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                  )}
                >
                  <img src={img} alt={`${product.name} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {product.isNew && <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase">New</span>}
                {product.isBestSeller && <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase">Best Seller</span>}
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold mb-3">{product.name}</h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={idx < Math.floor(product.rating) ? 'h-4 w-4 fill-amber-500 text-amber-500' : 'h-4 w-4 text-muted-foreground/30'}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{product.rating}</span>
                <span className="text-sm text-muted-foreground">({product.reviews} reviews)</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-lg text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
              )}
              {discount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-xs font-semibold">
                  Save {formatPrice(product.originalPrice! - product.price)}
                </span>
              )}
            </div>

            <p className="text-muted-foreground leading-relaxed">{product.description}</p>

            {/* Color */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Color: <span className="text-muted-foreground font-normal">{selectedColor}</span></span>
              </div>
              <div className="flex gap-2.5">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all',
                      selectedColor === color.name ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                    )}
                    title={color.name}
                  >
                    <span className="h-6 w-6 rounded-full" style={{ backgroundColor: color.hex }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Size</span>
                <button className="text-xs text-primary hover:underline">Size Guide</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={cn(
                      'h-11 min-w-[3rem] px-3 rounded-lg border-2 text-sm font-medium transition-all',
                      selectedSize === size
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2 border-2 border-border rounded-lg p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Button onClick={handleAddToCart} size="lg" className="flex-1 h-12 text-base">
                <ShoppingBag className="h-5 w-5 mr-2" /> Add to Cart
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() => setLiked(!liked)}
              >
                <Heart className={cn('h-5 w-5', liked && 'fill-destructive text-destructive')} />
              </Button>
            </div>

            {/* Stock */}
            <div className="flex items-center gap-2 text-sm">
              {product.stock > 0 ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">In Stock</span>
                  <span className="text-muted-foreground">— {product.stock} left</span>
                </>
              ) : (
                <span className="text-destructive font-medium">Out of Stock</span>
              )}
            </div>

            {/* Trust */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t">
              {[
                { icon: Truck, title: 'Free Shipping', desc: 'Over $75' },
                { icon: RotateCcw, title: '30-Day Returns', desc: 'Easy returns' },
                { icon: ShieldCheck, title: '2-Year Warranty', desc: 'Quality guarantee' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="text-center">
                  <Icon className="h-5 w-5 mx-auto text-primary mb-1" />
                  <p className="text-xs font-semibold">{title}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>

            {/* Features */}
            <div className="pt-4 border-t">
              <h3 className="font-semibold text-sm mb-3">Key Features</h3>
              <ul className="grid grid-cols-2 gap-2">
                {product.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <section className="mt-16 md:mt-24">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
