import { WHY_CHOOSE_US } from '@/lib/constants';

export default function WhyChooseUs() {
  return (
    <section className="py-20 px-4 bg-slate-950/40">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-accent font-semibold text-sm uppercase tracking-wide">
            Why Choose Us
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
            Why Travel With Allwin Tours
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {WHY_CHOOSE_US.map((item) => (
            <div key={item.title} className="text-center">
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="text-xs text-text-grey mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
