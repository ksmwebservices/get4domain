'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/products';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeFromCart, total, count } = useCart();

  const freeShippingThreshold = 999;
  const shippingCost = 49;
  const remaining = Math.max(0, freeShippingThreshold - total);
  const progress = Math.min(100, (total / freeShippingThreshold) * 100);

  return (
    <Sheet open={isOpen} onOpenChange={closeCart}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="flex items-center gap-2 font-display">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Your Cart ({count})
          </SheetTitle>
        </SheetHeader>

        {items.length > 0 && (
          <div className="px-6 py-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                {remaining > 0 ? `Add ${formatPrice(remaining)} for FREE shipping` : 'You qualify for FREE shipping!'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Your cart is empty</p>
            <p className="text-sm text-muted-foreground text-center">Start shopping and find your perfect pair.</p>
            <Button asChild onClick={closeCart}>
              <Link href="/shop">Browse Products</Link>
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4 py-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 group">
                    <Link href={`/product/${item.slug}`} onClick={closeCart} className="shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-20 w-20 rounded-lg object-cover border border-border"
                      />
                    </Link>
                    <div className="flex-1 min-w-0 space-y-1">
                      <Link href={`/product/${item.slug}`} onClick={closeCart} className="block">
                        <p className="font-medium text-sm truncate hover:text-primary transition-colors">{item.name}</p>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.color} / Size {item.size}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{formatPrice(item.price * item.quantity)}</span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <SheetFooter className="px-6 pb-6 pt-2 border-t">
              <div className="space-y-3 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatPrice(total)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-semibold">{total >= freeShippingThreshold ? 'FREE' : formatPrice(shippingCost)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatPrice(total + (total >= freeShippingThreshold ? 0 : shippingCost))}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" onClick={closeCart}>
                  <Link href="/cart">View Cart</Link>
                </Button>
                <Button asChild className="flex-1" onClick={closeCart}>
                  {/* /checkout never existed in the uploaded design (dead link) — the
                      real checkout (wired to engine.checkout.order/confirm) lives on
                      the cart page. */}
                  <Link href="/cart">Checkout</Link>
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
