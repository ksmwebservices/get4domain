export default function TrustBar() {
  const stats = [
    { value: '500+', label: 'Businesses Online' },
    { value: '20+', label: 'Industries' },
    { value: '99.9%', label: 'Uptime' },
    { value: '< 24h', label: 'Consultant Call' },
    { value: '5★', label: 'Client Rating' },
  ];

  return (
    <div className="border-y border-slate-100 bg-slate-50/60 py-5">
      <div className="container-mx container-px">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2.5">
              <span className="text-lg font-bold text-primary-600">{stat.value}</span>
              <span className="text-sm text-slate-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
