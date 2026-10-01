import Header from '@/components/site/Header';
import Hero from '@/components/site/Hero';
import About from '@/components/site/About';
import Services from '@/components/site/Services';
import Portfolio from '@/components/site/Portfolio';
import Testimonials from '@/components/site/Testimonials';
import Contact from '@/components/site/Contact';
import Footer from '@/components/site/Footer';
import BottomNav from '@/components/site/BottomNav';
import FloatingWhatsApp from '@/components/site/FloatingWhatsApp';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <Services />
        <Portfolio />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
      <BottomNav />
      <FloatingWhatsApp />
    </>
  );
}
