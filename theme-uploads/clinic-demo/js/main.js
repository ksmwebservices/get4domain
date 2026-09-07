document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Mobile nav toggle ---------- */
  const navToggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach((item) => {
    const btn = item.querySelector('.faq-question');
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      document.querySelectorAll('.faq-item.is-open').forEach((open) => {
        open.classList.remove('is-open');
        open.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Testimonial dots (mobile) ---------- */
  const track = document.getElementById('testimonialTrack');
  const dotsWrap = document.getElementById('testimonialDots');
  if (track && dotsWrap) {
    const cards = Array.from(track.children);
    cards.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.setAttribute('aria-label', `Show testimonial ${i + 1}`);
      if (i === 0) dot.classList.add('is-active');
      dot.addEventListener('click', () => {
        cards[i].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      });
      dotsWrap.appendChild(dot);
    });

    const dots = Array.from(dotsWrap.children);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = cards.indexOf(entry.target);
            dots.forEach((d) => d.classList.remove('is-active'));
            if (dots[idx]) dots[idx].classList.add('is-active');
          }
        });
      },
      { root: track, threshold: 0.6 }
    );
    cards.forEach((c) => observer.observe(c));
  }

  /* ---------- Contact form (demo — no backend) ---------- */
  const form = document.getElementById('contactForm');
  const note = document.getElementById('formNote');
  if (form && note) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.querySelector('[name="name"]').value.trim();
      note.textContent = name
        ? `Thanks, ${name.split(' ')[0]} — we'll call you back within one working day.`
        : `Thanks — we'll call you back within one working day.`;
      form.reset();
    });
  }

  /* ---------- Mobile bottom nav active state ---------- */
  const mbItems = document.querySelectorAll('.mb-item[data-mb]');
  const sectionMap = {
    top: document.getElementById('top'),
    services: document.getElementById('services'),
    contact: document.getElementById('contact'),
  };
  const sections = Object.entries(sectionMap).filter(([, el]) => el);

  if (mbItems.length && sections.length) {
    const setActive = (key) => {
      mbItems.forEach((item) => {
        item.classList.toggle('is-active', item.dataset.mb === key);
      });
    };
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const match = sections.find(([, el]) => el === entry.target);
            if (match) setActive(match[0]);
          }
        });
      },
      { rootMargin: '-40% 0px -50% 0px' }
    );
    sections.forEach(([, el]) => sectionObserver.observe(el));
  }

});
