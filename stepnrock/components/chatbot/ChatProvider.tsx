'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export type ChatMessage = {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: number;
  action?: { label: string; href: string };
};

export type SupportTicket = {
  id: string;
  subject: string;
  email: string;
  message: string;
  status: 'open';
  createdAt: number;
};

type ChatContextType = {
  messages: ChatMessage[];
  isOpen: boolean;
  tickets: SupportTicket[];
  sendMessage: (text: string) => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  createTicket: (subject: string, email: string, message: string) => string;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const QUICK_REPLIES = [
  'Tell me about new arrivals',
  'What are your best sellers?',
  'Track my order',
  'Shipping & returns',
  'Create a support ticket',
  'Request new arrivals notification',
];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function autoReply(userText: string): { text: string; action?: { label: string; href: string } } {
  const text = userText.toLowerCase();

  if (text.includes('new arrival') || text.includes('new release') || text.includes('coming soon')) {
    return {
      text: 'We just dropped new arrivals! Our Scarlet High-Top Sneakers, Velocity Pro Running shoes, and Rose Petal Heels are fresh in stock. Check them out before they sell out!',
      action: { label: 'View New Arrivals', href: '/shop?filter=new' },
    };
  }

  if (text.includes('best seller') || text.includes('popular') || text.includes('recommend')) {
    return {
      text: 'Our top sellers are the Aero Flight Sneakers, Oxford Classic Leather, and Graphite Runner Sneakers. Customers love them for their quality and comfort!',
      action: { label: 'Shop Best Sellers', href: '/shop?filter=bestseller' },
    };
  }

  if (text.includes('shipping') || text.includes('delivery') || text.includes('returns') || text.includes('refund')) {
    return {
      text: 'We offer FREE shipping on all orders over $75. Standard delivery takes 3-5 business days. Returns are free within 30 days — no questions asked!',
    };
  }

  if (text.includes('track') && text.includes('order')) {
    return {
      text: 'To track your order, please provide your order number. You can also view your order status by logging into your account.',
      action: { label: 'Track Order', href: '/contact' },
    };
  }

  if (text.includes('size') || text.includes('fit') || text.includes('sizing')) {
    return {
      text: 'We have a detailed size guide for every product! Check the sizing chart on each product page. If between sizes, we recommend sizing up for sneakers and staying true to size for formal shoes.',
    };
  }

  if (text.includes('ticket') || text.includes('support') || text.includes('help') || text.includes('contact')) {
    return {
      text: 'I can create a support ticket for you. Just type "create ticket" followed by your email and issue, or visit our contact page for more options.',
      action: { label: 'Contact Support', href: '/contact' },
    };
  }

  if (text.includes('price') || text.includes('cost') || text.includes('discount') || text.includes('coupon') || text.includes('sale')) {
    return {
      text: 'We have great deals right now! Many items are on sale — look for the original price crossed out. Sign up for our newsletter to get 10% off your first order!',
      action: { label: 'View Sale Items', href: '/shop' },
    };
  }

  if (text.includes('payment') || text.includes('checkout') || text.includes('pay')) {
    return {
      text: 'We accept all major credit cards, PayPal, Apple Pay, and Google Pay. Your payment is secured with 256-bit SSL encryption.',
    };
  }

  if (text.includes('store') || text.includes('location') || text.includes('address') || text.includes('where')) {
    return {
      text: 'Our flagship store is at 123 Sole Street, New York, NY 10001. We\'re open Mon-Sat 10am-9pm and Sun 11am-6pm. Shop online 24/7!',
      action: { label: 'View on Map', href: '/contact' },
    };
  }

  if (text.includes('hello') || text.includes('hi') || text.includes('hey') || text.includes('greetings')) {
    return {
      text: 'Hello! Welcome to Step N Rock! How can I help you today? You can ask about our products, track orders, get info on new arrivals, or create a support ticket.',
    };
  }

  if (text.includes('thank')) {
    return { text: 'You\'re welcome! Happy shopping at Step N Rock. Is there anything else I can help you with?' };
  }

  if (text.includes('create ticket') || text.includes('request new arrival')) {
    return {
      text: 'Great! To create a support ticket or request new arrival notifications, please provide your email address and a brief message about what you need. You can also use the contact form on our Contact page.',
      action: { label: 'Open Contact Form', href: '/contact' },
    };
  }

  if (text.includes('sneaker') || text.includes('shoe') || text.includes('footwear')) {
    return {
      text: 'We have an amazing collection of sneakers, running shoes, formal shoes, and sandals! Browse our shop to find your perfect pair. Any specific style you\'re looking for?',
      action: { label: 'Shop Footwear', href: '/shop' },
    };
  }

  if (text.includes('apparel') || text.includes('hoodie') || text.includes('shirt') || text.includes('clothing')) {
    return {
      text: 'Check out our Urban Pulse Hoodie and apparel collection — premium quality and street-ready style!',
      action: { label: 'Shop Apparel', href: '/shop/apparel' },
    };
  }

  return {
    text: 'I\'m here to help! I can assist with product info, order tracking, shipping questions, new arrival requests, and support tickets. What would you like to know?',
  };
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'bot',
  text: 'Welcome to Step N Rock! I\'m your shopping assistant. Ask me about products, track orders, request new arrivals, or create a support ticket. How can I help you today?',
  timestamp: Date.now(),
};

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isOpen, setIsOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: text.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      const reply = autoReply(text);
      const botMsg: ChatMessage = {
        id: generateId(),
        role: 'bot',
        text: reply.text,
        timestamp: Date.now(),
        action: reply.action,
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 800 + Math.random() * 600);
  }, []);

  const createTicket = useCallback((subject: string, email: string, message: string) => {
    const id = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const ticket: SupportTicket = {
      id,
      subject,
      email,
      message,
      status: 'open',
      createdAt: Date.now(),
    };
    setTickets((prev) => [...prev, ticket]);
    return id;
  }, []);

  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);
  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);

  return (
    <ChatContext.Provider
      value={{ messages, isOpen, tickets, sendMessage, toggleChat, openChat, closeChat, createTicket }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

export { QUICK_REPLIES };
