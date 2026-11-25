// Template markup for a factory pack. Every function returns plain HTML text with {{bindings}}; the shapes follow the proven
// route-board-travels reference (skip link, claim banner, header with nav and action, main#main, platform slots in the footer).
// Nothing here knows about a trade: wording comes from spec.labels (English) or from bindings (ui.*, terms.*, block.title ...).

const SLOTS_FOOT = `<g4d-footer variant="columns"></g4d-footer>
<g4d-listed-on-badge></g4d-listed-on-badge>
<g4d-share-qr></g4d-share-qr>
<g4d-bottom-nav></g4d-bottom-nav>
<g4d-whatsapp-float></g4d-whatsapp-float>`;

export function head(spec) {
  const h = spec.look.header;
  return `<a class="skip-link" href="#main">{{ui.skip}}</a>
<g4d-claim-banner></g4d-claim-banner>
<header class="site-header h-${h}">
  <div class="wrap head-row">
    <a class="brand" href="/">
      <img data-g4d-if="site.logo" src="{{site.logo}}" alt="{{site.logoAlt}}" width="160" height="48" loading="lazy" decoding="async">
      ${spec.mark.replace('<svg ', '<svg class="brand-mark" data-g4d-if-not="site.logo" aria-hidden="true" focusable="false" ')}
      <span class="brand-name">{{site.name}}</span>
    </a>
    <g4d-header-nav label="Main"></g4d-header-nav>
    <g4d-action class="btn btn--go btn--sm"></g4d-action>
  </div>
</header>`;
}

export const foot = () => SLOTS_FOOT;

/** One section wrapper. `cond` is a list path or binding that must be non-empty for the section to draw. */
export function sec(id, label, { optional = true, cls = '', cond = '', attrs = '' } = {}, inner = '') {
  const c = cond ? ` data-g4d-if="${cond}"` : '';
  return `<section class="section${cls ? ' ' + cls : ''}" data-g4d-section="${id}" data-g4d-label="${label}" data-g4d-optional="${optional}"${c}${attrs}>\n${inner}\n</section>`;
}

const secHead = (title, more = '') => `<div class="sec-head"><h2>${title}</h2>${more}</div>`;

/** The card used for one item on the home page, the lists and "more like this". */
export function itemCard(spec, v = 'item', { limit = true, img = true } = {}) {
  const wrapIf = limit ? ` data-g4d-if="${v}.shown"` : '';
  const flavour = spec.cardFlavour ?? {};
  const chips = (spec.cardMeta ?? ['location', 'area', 'bedrooms'])
    .map((f) => `<span data-g4d-if="${v}.${f}">{{${v}.${f}}}</span>`).join('');
  return `<article class="card c-${spec.look.card}"${wrapIf}>
  <div class="card-art" aria-hidden="false"><span class="badge" data-g4d-if="${v}.badge">{{${v}.badge}}</span>${img ? `<img data-g4d-if="${v}.featured" src="{{${v}.image}}" alt="{{${v}.name}}" width="640" height="400" loading="lazy">` : ''}</div>
  <div class="card-body">
    <h3><a href="{{${v}.href}}">{{${v}.name}}</a></h3>
    <p class="card-desc">{{${v}.description}}</p>
    <p class="meta">${chips}</p>
    <div class="card-foot"><span class="price" data-g4d-if="${v}.price">{{${v}.price}}</span><a class="btn btn--sm" href="{{${v}.href}}">${flavour.more ?? '{{ui.readMore}}'}</a></div>
  </div>
</article>`;
}

/** The hero: text, a row of links to the first items (variant B) and either the banner picture (when the vendor uploads one) or the drawn scene. */
export function hero(spec) {
  const L = spec.labels;
  return `<section class="hero hero--${spec.look.hero}" data-g4d-section="hero" data-g4d-label="Hero banner" data-g4d-optional="false">
  <div class="hero-art" aria-hidden="false">
    <img class="hero-photo" data-g4d-if="hero.image" src="{{hero.image}}" alt="{{hero.imageAlt}}" width="1600" height="800" fetchpriority="high">
    <div class="hero-shade" data-g4d-if="hero.image" aria-hidden="true"></div>
    <div class="scene" data-g4d-if-not="hero.image" aria-hidden="true">${spec.scene}</div>
  </div>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="hero-eyebrow" data-g4d-if="hero.badge">{{hero.badge}}</p>
      <p class="hero-eyebrow" data-g4d-if-not="hero.badge"><span data-g4d-if="site.tagline">{{site.tagline}}</span></p>
      <h1>{{hero.title}}</h1>
      <p class="lede" data-g4d-if="hero.subtitle">{{hero.subtitle}}</p>
      <div class="hero-cta"><g4d-action class="btn btn--go"></g4d-action><a class="btn btn--wa" data-g4d-if="contact.whatsappHref" href="{{contact.whatsappHref}}">{{ui.whatsapp}}</a><g4d-open-now></g4d-open-now></div>
      <div class="svc-row" data-g4d-if="items"><p class="svc-label">${L.linkRow}</p><ul class="svc-links"><template data-g4d-each="items"><li data-g4d-if="item.shown"><a href="{{item.href}}">{{item.name}}</a></li></template></ul></div>
    </div>
  </div>
</section>`;
}

const trustStrip = () => `<ul class="trust-strip" data-g4d-if="trust"><template data-g4d-each="trust"><li>{{point.text}}</li></template></ul>`;

const blocksSection = (spec) => sec('highlights', spec.labels.blocksSection, { cls: 'section--tint', cond: 'blocks' },
  `<div class="wrap blocks">
  <template data-g4d-each="blocks"><section class="block" data-block="{{block.key}}">
    <div class="sec-head"><h2>{{block.title}}</h2></div>
    <ul class="stones"><template data-g4d-each="block.items"><li class="stone"><div class="top">{{entry.title}}</div><div class="body"><b>{{entry.detail}}</b><span data-g4d-if="entry.price">{{entry.price}}</span></div></li></template></ul>
  </section></template>
</div>`);

const groupTiles = (spec) => sec('groups', spec.labels.groupsSection, { cond: 'groups' },
  `<div class="wrap">
  ${secHead('{{terms.groups}}')}
  <div class="tiles"><template data-g4d-each="groups"><a class="tile" href="/${spec.listPage.slug}#group-{{group.slug}}"><span class="tile-ic" aria-hidden="true"></span><b>{{group.name}}</b><small>{{group.count}}</small></a></template></div>
</div>`);

const itemsHome = (spec) => sec('services', spec.labels.itemsSection, { cls: 'section--white', cond: 'items' },
  `<div class="wrap">
  ${secHead('{{terms.items}}', `<a class="btn btn--sm" href="/${spec.listPage.slug}">{{ui.viewAll}}</a>`)}
  <div class="cards"><template data-g4d-each="items">${itemCard(spec, 'item', { img: !spec.slides })}</template></div>
</div>`);

const aboutBand = (spec) => sec('about', spec.labels.aboutSection, { cls: 'section--band' },
  `<div class="wrap split">
  <div><h2>{{about.title}}</h2><p class="lede" data-g4d-if="about.text">{{about.text}}</p><div class="hero-cta"><a class="btn btn--sm" href="/about">{{ui.about}}</a><g4d-action class="btn btn--go btn--sm"></g4d-action></div></div>
  <div>
    <ul class="creds" data-g4d-if="credentials"><template data-g4d-each="credentials"><li><b>{{credential.title}}</b><span>{{credential.detail}}</span></li></template></ul>
    <ul class="offers" data-g4d-if="offers"><template data-g4d-each="offers"><li><div><b>{{offer.title}}</b><span>{{offer.detail}}</span></div><span class="p" data-g4d-if="offer.price">{{offer.price}}</span></li></template></ul>
  </div>
</div>`);

const stepsSec = (spec) => sec('process', spec.labels.stepsSection, { cond: 'steps' },
  `<div class="wrap">
  ${secHead('{{ui.process}}')}
  <ol class="steps"><template data-g4d-each="steps"><li><span class="n"><i>{{step.n}}</i></span><h3>{{step.title}}</h3><p>{{step.desc}}</p></li></template></ol>
</div>`);

const statsSec = () => sec('stats', 'Numbers', { cls: 'section--white', cond: 'stats' },
  `<div class="wrap"><ul class="stats"><template data-g4d-each="stats"><li><b>{{stat.value}}</b><span>{{stat.label}}</span></li></template></ul></div>`);

const gallerySec = () => sec('gallery', 'Gallery', { cond: 'gallery', attrs: ' id="gallery"' },
  `<div class="wrap">
  ${secHead('{{ui.gallery}}')}
  <ul class="gal"><template data-g4d-each="gallery"><li data-g4d-if="image.shown"><figure><img src="{{image.src}}" alt="{{image.alt}}" width="640" height="480" loading="lazy"><figcaption>{{image.caption}}</figcaption></figure></li></template></ul>
</div>`);

const teamSec = (spec) => sec('team', spec.labels.teamSection, { cls: 'section--white', cond: 'team' },
  `<div class="wrap">
  ${secHead('{{terms.team}}')}
  <ul class="team"><template data-g4d-each="team"><li class="member"><span class="avatar" aria-hidden="true">{{member.initial}}</span><div><b>{{member.name}}</b><span>{{member.role}}</span><small data-g4d-if="member.note">{{member.note}}</small></div></li></template></ul>
</div>`);

const reviewsSec = () => sec('reviews', 'Reviews', { cls: 'section--white' }, `<div class="wrap"><g4d-reviews></g4d-reviews></div>`);

const faqSec = () => sec('faq', 'Questions', { cond: 'faqs' },
  `<div class="wrap split">
  <div><h2>{{ui.faq}}</h2></div>
  <div class="faq"><template data-g4d-each="faqs"><details><summary>{{faq.q}}</summary><p>{{faq.a}}</p></details></template></div>
</div>`);

const areasSec = (spec) => sec('areas', spec.labels.areasSection, { cls: 'section--white', cond: 'areas' },
  `<div class="wrap">${secHead('{{contact.city}}')}<ul class="chips"><template data-g4d-each="areas"><li>{{area.name}}</li></template></ul></div>`);

const contactBlock = `<div class="wrap split">
  <div>
    <ul class="contact-list">
      <li data-g4d-if="contact.address"><b>{{ui.directions}}</b><address>{{contact.address}}</address></li>
      <li data-g4d-if="contact.phone"><b>{{ui.call}}</b><a href="{{contact.phoneHref}}">{{contact.phone}}</a></li>
      <li data-g4d-if="contact.whatsappHref"><b>{{ui.whatsapp}}</b><a href="{{contact.whatsappHref}}">{{contact.whatsapp}}</a></li>
      <li data-g4d-if="contact.email"><a href="mailto:{{contact.email}}">{{contact.email}}</a></li>
    </ul>
    <g4d-hours variant="table"></g4d-hours>
    <g4d-social></g4d-social>
  </div>
  <div><g4d-map></g4d-map></div>
</div>
<div class="wrap form-wrap"><g4d-enquiry-form></g4d-enquiry-form></div>`;

const contactSec = (spec) => sec('contact', spec.labels.contactSection, { attrs: ' id="contact"' }, `<div class="wrap">${secHead('{{ui.contact}}')}</div>\n${contactBlock}`);

const ctaBand = () => `<section class="cta-band" data-g4d-section="cta" data-g4d-label="Call to action" data-g4d-optional="true">
  <div class="wrap">
    <div><h2>{{cta.label}}</h2><p data-g4d-if="site.tagline">{{site.tagline}}</p></div>
    <div class="cta-actions"><g4d-action class="btn btn--go"></g4d-action><a class="btn" data-g4d-if="contact.phone" href="{{contact.phoneHref}}">{{ui.call}} {{contact.phone}}</a></div>
  </div>
</section>`;

const slidesSec = (spec) => sec('slides', spec.labels.slidesSection, { cls: 'section--slides', cond: 'items' },
  `<div class="wrap">${secHead('{{terms.items}}', `<a class="btn btn--sm" href="/${spec.listPage.slug}">{{ui.viewAll}}</a>`)}</div>
  <ul class="slides"><template data-g4d-each="items"><li class="slide" data-g4d-if="item.featured"><a class="slide-link" href="{{item.href}}"><span class="slide-art"><img src="{{item.image}}" alt="{{item.name}}" width="900" height="560" loading="lazy"></span><span class="slide-copy"><span class="badge" data-g4d-if="item.badge">{{item.badge}}</span><b>{{item.name}}</b><span data-g4d-if="item.location">{{item.location}}</span><span class="price" data-g4d-if="item.price">{{item.price}}</span></span></a></li></template></ul>`);

const SECTION_BUILDERS = {
  slides: slidesSec,
  trust: () => `<section class="trust" data-g4d-section="trust" data-g4d-label="Trust points" data-g4d-optional="true" data-g4d-if="trust"><div class="wrap">${trustStrip()}</div></section>`,
  groups: groupTiles, items: itemsHome, blocks: blocksSection, about: aboutBand, steps: stepsSec, stats: statsSec,
  gallery: gallerySec, team: teamSec, reviews: reviewsSec, faq: faqSec, areas: areasSec, contact: contactSec,
};

export function homePage(spec) {
  const order = spec.home;
  const body = order.map((id) => { const b = SECTION_BUILDERS[id]; if (!b) throw new Error(`unknown home section ${id}`); return b(spec); }).join('\n\n');
  return `${head(spec)}
<main id="main">
${hero(spec)}

${body}

${ctaBand()}
</main>
${foot()}
`;
}

const pageHero = (inner) => `<section class="page-hero"><div class="wrap">${inner}</div></section>`;
const crumbs = (spec, mid) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">{{ui.home}}</a><span aria-hidden="true">/</span><a href="/${spec.listPage.slug}">${mid}</a></nav>`;

/** A list page grouped by group (status, kind, plan ...): each group is a section with its own items. */
export function listPage(spec, slug, title) {
  return `${head(spec)}
<main id="main">
  ${pageHero(`${crumbs(spec, '{{terms.items}}')}<h1>{{page.title}}</h1><p data-g4d-if="page.intro">{{page.intro}}</p>`)}
  <section class="section" data-g4d-section="list" data-g4d-label="${title}" data-g4d-optional="false">
    <div class="wrap">
      <ul class="jump" data-g4d-if="groups"><template data-g4d-each="groups"><li><a href="#group-{{group.slug}}">{{group.name}}</a></li></template></ul>
      <template data-g4d-each="groups"><div class="group" id="group-{{group.slug}}">
        <div class="sec-head"><h2>{{group.name}}</h2><small>{{group.count}}</small></div>
        <div class="cards"><template data-g4d-each="group.items">${itemCard(spec, 'item', { limit: false })}</template></div>
      </div></template>
      <div class="cards" data-g4d-if-not="groups"><h2 class="vh">{{terms.items}}</h2><template data-g4d-each="items">${itemCard(spec, 'item', { limit: false })}</template></div>
    </div>
  </section>
  ${sec('enquiry', 'Enquiry', {}, `<div class="wrap"><g4d-enquiry-form></g4d-enquiry-form></div>`).replace('class="section"', 'class="section section--white"')}
</main>
${foot()}
`;
}

/** Plain list of all items (services page): cards only, no grouping. */
export function servicesPage(spec) {
  return `${head(spec)}
<main id="main">
  ${pageHero(`<h1>{{page.title}}</h1><p data-g4d-if="page.intro">{{page.intro}}</p>`)}
  <section class="section" data-g4d-section="list" data-g4d-label="${spec.labels.itemsSection}" data-g4d-optional="false">
    <div class="wrap">
      <h2 class="vh">{{terms.items}}</h2>
      <div class="cards"><template data-g4d-each="items">${itemCard(spec, 'item', { limit: false })}</template></div>
    </div>
  </section>
  ${blocksSection(spec)}
  ${sec('enquiry', 'Enquiry', { cls: 'section--white' }, `<div class="wrap"><g4d-enquiry-form></g4d-enquiry-form></div>`)}
</main>
${foot()}
`;
}

/** The full landing page of one item. */
export function itemPage(spec) {
  const L = spec.labels;
  const facts = (spec.itemFacts ?? [['category', 'Type'], ['location', 'Location'], ['area', 'Size'], ['bedrooms', 'Configuration'], ['duration', 'Timeline']])
    .map(([f, label]) => `<div data-g4d-if="item.${f}"><dt>${label}</dt><dd>{{item.${f}}}</dd></div>`).join('\n          ');
  return `${head(spec)}
<main id="main">
  <section class="page-hero page-hero--item"><div class="wrap">
    ${crumbs(spec, '{{terms.items}}')}
    <p class="badge badge--hero" data-g4d-if="item.badge">{{item.badge}}</p>
    <h1>{{item.name}}</h1>
    <p class="lede" data-g4d-if="item.location">{{item.location}}</p>
    <div class="hero-cta"><g4d-action class="btn btn--go"></g4d-action><a class="btn btn--wa" data-g4d-if="contact.whatsappHref" href="{{contact.whatsappHref}}">{{ui.whatsapp}}</a><a class="btn btn--ghost" data-g4d-if="contact.phone" href="{{contact.phoneHref}}">{{ui.call}} {{contact.phone}}</a></div>
  </div></section>
  <section class="section" data-g4d-section="detail" data-g4d-label="${L.detailSection}" data-g4d-optional="false">
    <div class="wrap detail-grid">
      <div class="detail-main">
        <img class="detail-img" data-g4d-if="item.image" src="{{item.image}}" alt="{{item.name}}" width="1200" height="675" fetchpriority="high">
        <div class="prose"><h2>${L.summary}</h2><p>{{item.description}}</p></div>
        <div class="highlights" data-g4d-if="item.includes"><h2>${L.highlights}</h2><p class="lede">{{item.includes}}</p></div>
        <div class="facts-wrap"><h2>${L.keyFacts}</h2><dl class="facts">
          ${facts}
          <div data-g4d-if="site.registrationNo"><dt>${L.regNo}</dt><dd>{{site.registrationNo}}</dd></div>
          <div data-g4d-if="item.price"><dt>${L.priceWord}</dt><dd>{{item.price}}</dd></div>
        </dl></div>
        <div data-g4d-if="steps" class="item-steps"><h2>{{ui.process}}</h2><ol class="steps"><template data-g4d-each="steps"><li><span class="n"><i>{{step.n}}</i></span><h3>{{step.title}}</h3><p>{{step.desc}}</p></li></template></ol></div>
        <div data-g4d-if="gallery" class="item-gallery"><h2>{{ui.gallery}}</h2><ul class="gal gal--item"><template data-g4d-each="gallery"><li data-g4d-if="image.featured"><figure><img src="{{image.src}}" alt="{{image.alt}}" width="640" height="480" loading="lazy"><figcaption>{{image.caption}}</figcaption></figure></li></template></ul></div>
        <div data-g4d-if="faqs" class="faq item-faq"><h2>{{ui.faq}}</h2><template data-g4d-each="faqs"><details><summary>{{faq.q}}</summary><p>{{faq.a}}</p></details></template></div>
      </div>
      <aside class="aside-card">
        <p class="aside-label">${L.priceHeading}</p>
        <div class="price" data-g4d-if="item.price">{{item.price}}</div>
        <p class="note" data-g4d-if-not="item.price">${L.noPrice}</p>
        <p class="meta"><span data-g4d-if="item.duration">{{item.duration}}</span><span data-g4d-if="item.category">{{item.category}}</span></p>
        <g4d-action class="btn btn--go"></g4d-action>
        <a class="btn btn--wa" data-g4d-if="contact.whatsappHref" href="{{contact.whatsappHref}}">{{ui.whatsapp}}</a>
        <a class="btn" data-g4d-if="contact.phone" href="{{contact.phoneHref}}">{{ui.call}} {{contact.phone}}</a>
        <div class="aside-booking" data-g4d-if="entitlements.booking"><g4d-booking></g4d-booking></div>
      </aside>
    </div>
  </section>
  ${sec('related', L.relatedSection, { cls: 'section--tint', cond: 'items' }, `<div class="wrap">
    ${secHead(L.relatedHeading, `<a class="btn btn--sm" href="/${spec.listPage.slug}">{{ui.viewAll}}</a>`)}
    <div class="cards"><template data-g4d-each="items">${itemCard(spec, 'item', { limit: false })}</template></div>
  </div>`)}
  ${sec('enquiry', 'Enquiry', { cls: 'section--white' }, `<div class="wrap"><g4d-enquiry-form></g4d-enquiry-form></div>`)}
</main>
${foot()}
`;
}

export function aboutPage(spec) {
  const L = spec.labels;
  return `${head(spec)}
<main id="main">
  ${pageHero(`<h1>{{page.title}}</h1><p data-g4d-if="page.intro">{{page.intro}}</p>`)}
  ${sec('about', 'About', { optional: false }, `<div class="wrap split">
    <div class="prose"><h2>{{about.title}}</h2><p>{{about.text}}</p>
      <ul class="creds creds--cols" data-g4d-if="credentials"><template data-g4d-each="credentials"><li><b>{{credential.title}}</b><span>{{credential.detail}}</span></li></template></ul>
    </div>
    <aside class="aside-card"><p class="aside-label">${L.findUs}</p>
      <ul class="contact-list">
        <li data-g4d-if="contact.address"><b>{{ui.directions}}</b><address>{{contact.address}}</address></li>
        <li data-g4d-if="contact.phone"><b>{{ui.call}}</b><a href="{{contact.phoneHref}}">{{contact.phone}}</a></li>
      </ul>
      <g4d-map></g4d-map>
    </aside>
  </div>`)}
  ${teamSec(spec)}
  ${sec('trust-list', 'Why choose us', { cond: 'trust' }, `<div class="wrap">${secHead('{{ui.why}}')}<ul class="why"><template data-g4d-each="trust"><li>{{point.text}}</li></template></ul></div>`)}
  ${areasSec(spec)}
  ${statsSec()}
  ${ctaBand()}
</main>
${foot()}
`;
}

export function galleryPage(spec) {
  return `${head(spec)}
<main id="main">
  ${pageHero(`<h1>{{page.title}}</h1><p data-g4d-if="page.intro">{{page.intro}}</p>`)}
  ${sec('gallery', 'Gallery', { optional: false }, `<div class="wrap"><ul class="gal"><template data-g4d-each="gallery"><li><figure><img src="{{image.src}}" alt="{{image.alt}}" width="640" height="480" loading="lazy"><figcaption>{{image.caption}}</figcaption></figure></li></template></ul></div>`)}
</main>
${foot()}
`;
}

export function contactPage(spec) {
  return `${head(spec)}
<main id="main">
  ${pageHero(`<h1>{{page.title}}</h1><p data-g4d-if="page.intro">{{page.intro}}</p>`)}
  ${sec('contact', spec.labels.contactSection, { optional: false }, contactBlock)}
  ${areasSec(spec)}
</main>
${foot()}
`;
}

export function genericPage(spec) {
  return `${head(spec)}
<main id="main">
  ${pageHero(`<h1>{{page.title}}</h1><p data-g4d-if="page.intro">{{page.intro}}</p>`)}
  ${sec('body', 'Page', { optional: false }, `<div class="wrap prose"><p>{{page.body}}</p></div>`)}
</main>
${foot()}
`;
}
