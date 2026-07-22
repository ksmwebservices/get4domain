import Hero from '@/components/Hero';
import PackagesSection from '@/components/PackagesSection';
import FleetSection from '@/components/FleetSection';
import ServicesSection from '@/components/ServicesSection';
import WhyChooseUs from '@/components/WhyChooseUs';
import Testimonials from '@/components/Testimonials';

export default function HomePage() {
  return (
    <>
      <Hero />
      <PackagesSection />
      <FleetSection />
      <ServicesSection />
      <WhyChooseUs />
      <Testimonials />
    </>
  );
}
