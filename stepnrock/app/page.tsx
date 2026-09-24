import Link from 'next/link';
import { Zap, Truck, ShieldCheck, RotateCcw, ArrowRight, Star, Sparkles, Footprints, Briefcase, Sun, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product/ProductCard';
import { categories } from '@/lib/products';
import { fetchSiteData, resolveProducts } from '@/lib/site-data';

const categoryIcons: Record<string, React.ElementType> = {
  sneakers: Footprints,
  running: Zap,
  formal: Briefcase,
  sandals: Sun,
  women: Sparkles,
  apparel: Shirt,
};

const heroImage = 'https://images.pexels.com/photos/1503010/pexels-photo-1503010.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
const storeImage = 'https://images.pexels.com/photos/5531542/pexels-photo-5531542.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
const sneakerDisplay = 'https://images.pexels.com/photos/38487263/pexels-photo-38487263.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

export default async function HomePage() {
  const site = await fetchSiteData();
  const products = resolveProducts(site);
  const featured = products.filter((p) => p.isBestSeller || p.isNew);
  const bestSellers = products.filter((p) => p.isBestSeller).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Step N Rock hero - premium sneakers"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/70 to-foreground/30" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 text-primary text-xs font-semibold mb-6 animate-reveal">
              <Sparkles className="h-3.5 w-3.5" />
              New Fall Collection 2026
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-background leading-[1.1] mb-6 text-balance animate-reveal" style={{ animationDelay: '0.1s' }}>
              Step Into <span className="text-primary">Greatness</span> With Every Pair
            </h1>
            <p className="text-lg text-background/80 mb-8 max-w-lg animate-reveal" style={{ animationDelay: '0.2s' }}>
              Discover premium footwear and apparel crafted for movement, style, and comfort. From street to sport, we&apos;ve got you covered.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 animate-reveal" style={{ animationDelay: '0.3s' }}>
              <Button asChild size="lg" className="text-base h-12">
                <Link href="/shop">Shop Collection <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base h-12 bg-background/10 backdrop-blur-sm border-background/30 text-background hover:bg-background/20 hover:text-background">
                <Link href="/shop?filter=new">New Arrivals</Link>
              </Button>
            </div>

            <div className="flex items-center gap-6 mt-10 animate-reveal" style={{ animationDelay: '0.4s' }}>
              <div>
                <p className="text-2xl font-bold text-background">50K+</p>
                <p className="text-xs text-background/60">Happy Customers</p>
              </div>
              <div className="h-10 w-px bg-background/20" />
              <div>
                <p className="text-2xl font-bold text-background">12K+</p>
                <p className="text-xs text-background/60">Products Sold</p>
              </div>
              <div className="h-10 w-px bg-background/20" />
              <div>
                <p className="flex items-center gap-1 text-2xl font-bold text-background">
                  4.8 <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                </p>
                <p className="text-xs text-background/60">Avg Rating</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: 'Free Shipping', desc: 'On orders over $75' },
              { icon: RotateCcw, title: '30-Day Returns', desc: 'No questions asked' },
              { icon: ShieldCheck, title: 'Secure Payment', desc: '256-bit SSL encryption' },
              { icon: Zap, title: 'Fast Delivery', desc: '3-5 business days' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">Shop by Category</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Find exactly what you need across our curated collections</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.slug] ?? Footprints;
              return (
                <Link
                  key={cat.slug}
                  href={`/shop/${cat.slug}`}
                  className="group flex flex-col items-center gap-3 p-6 rounded-2xl border border-border hover:border-primary hover:shadow-lg transition-all"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium">{cat.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured / New Arrivals */}
      <section className="py-16 md:py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-primary text-sm font-semibold uppercase tracking-wider">Just Dropped</span>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-1">Featured Products</h2>
            </div>
            <Button asChild variant="ghost" className="hidden sm:flex">
              <Link href="/shop">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {featured.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="text-center mt-8 sm:hidden">
            <Button asChild variant="outline">
              <Link href="/shop">View All Products <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Promo Banner */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0">
          <img src={sneakerDisplay} alt="Sneaker collection display" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 to-foreground/40" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider mb-4">
            Limited Time Offer
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-background mb-4 text-balance">
            Up to 40% Off <br className="md:hidden" /> Best Sellers
          </h2>
          <p className="text-background/80 mb-8 max-w-xl mx-auto">
            Grab your favorites before they&apos;re gone. Selected styles at unbeatable prices.
          </p>
          <Button asChild size="lg" className="h-12 text-base">
            <Link href="/shop?filter=bestseller">Shop the Sale <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
      </section>

      {/* Best Sellers */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-primary text-sm font-semibold uppercase tracking-wider">Top Picks</span>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-1">Best Sellers</h2>
            </div>
            <Button asChild variant="ghost" className="hidden sm:flex">
              <Link href="/shop?filter=bestseller">See More <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Store / About Teaser */}
      <section className="py-16 md:py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
              <img src={storeImage} alt="Step N Rock store interior" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-5">
              <span className="text-primary text-sm font-semibold uppercase tracking-wider">Our Story</span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-balance">
                Crafting Footwear Since 2015
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Step N Rock started with a simple mission: make great shoes accessible to everyone. Today, we&apos;re proud to serve over 50,000 customers worldwide with carefully curated footwear and apparel that blends style, comfort, and durability.
              </p>
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div>
                  <p className="text-2xl font-bold text-primary">10+</p>
                  <p className="text-xs text-muted-foreground">Years of Experience</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">500+</p>
                  <p className="text-xs text-muted-foreground">Products Available</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">30+</p>
                  <p className="text-xs text-muted-foreground">Countries Served</p>
                </div>
              </div>
              <Button asChild>
                <Link href="/about">Learn More About Us <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">What Our Customers Say</h2>
            <p className="text-muted-foreground">Real reviews from real Step N Rock customers</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Sarah J.', role: 'Verified Buyer', text: 'The Aero Flight Sneakers are incredibly comfortable. I wear them everywhere — from gym to grocery runs. Best purchase this year!', rating: 5 },
              { name: 'Mike R.', role: 'Verified Buyer', text: 'Oxford Classic Leather shoes are top quality. The leather is premium and they look even better in person. Highly recommend!', rating: 5 },
              { name: 'Emily K.', role: 'Verified Buyer', text: 'Love the Rose Petal Heels! Stylish, comfortable, and the block heel makes them easy to walk in all day. Fast shipping too.', rating: 4 },
            ].map((review, i) => (
              <div key={i} className="p-6 rounded-2xl border border-border hover:shadow-lg transition-shadow">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={idx < review.rating ? 'h-4 w-4 fill-amber-500 text-amber-500' : 'h-4 w-4 text-muted-foreground/30'}
                    />
                  ))}
                </div>
                <p className="text-sm text-foreground/80 mb-4 leading-relaxed">&ldquo;{review.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary font-semibold text-sm">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{review.name}</p>
                    <p className="text-xs text-muted-foreground">{review.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
