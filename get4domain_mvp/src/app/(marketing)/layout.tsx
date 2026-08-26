import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ChatBot from '@/components/ChatBot';
import MarketingBottomNav from '@/components/MarketingBottomNav';
import DemoGateProvider from '@/components/marketing/DemoGate';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoGateProvider>
      <div className="min-h-screen bg-white flex flex-col">
        <Header />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <ChatBot />
        <MarketingBottomNav />
      </div>
    </DemoGateProvider>
  );
}
