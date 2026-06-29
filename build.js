#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const BASE_URL = 'https://www.inessentia.mx';

// ═══════════════════════════════════════════════════════════════════════════
// PART 1: DIRECTORY (index.html)
// ═══════════════════════════════════════════════════════════════════════════

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
let html = fs.readFileSync(path.join(__dirname, 'index.src.html'), 'utf8');

const SUBTIPO_TAG = {
  'Terapia somática': 'tag-somatica',
  'Terapia transpersonal': 'tag-transpersonal',
  'Terapia psicológica': 'tag-psicologica',
};
const TIPO_TAG = {
  'Terapia Física': 'tag-fisica',
  'Psiquiátrica': 'tag-psiquiatrica',
};

function getTagClass(t) {
  return (t.subtipo && SUBTIPO_TAG[t.subtipo]) || TIPO_TAG[t.tipo] || 'tag-somatica';
}
function getTagLabel(t) {
  return t.subtipo || t.tipo;
}
function modTagHtml(m) {
  const cls = m === 'Online' ? 'tag-online' : m === 'Presencial' ? 'tag-presencial' : 'tag-domicilio';
  return `<span class="tag ${cls}">${m}</span>`;
}

function buildListItems(terapeutas) {
  return terapeutas.map((t, i) => {
    const tagClass = getTagClass(t);
    const tipoLabel = getTagLabel(t);
    const modTags = (t.modalidades || []).map(modTagHtml).join('');
    const idiomTag = t.idiomas?.length
      ? `<span class="tag tag-idioma">🌐 ${t.idiomas.join(', ')}</span>` : '';
    const listaTag = t.disponibilidad && t.disponibilidad !== 'Agenda abierta'
      ? `<span class="tag tag-lista">⏳ Lista de espera</span>` : '';
    return `    <div class="therapist-item" data-idx="${i}">
      <div class="therapist-name">${t.nombre}</div>
      <div class="therapist-location">📍 ${t.zona}</div>
      <div class="therapist-tags">
        <span class="tag ${tagClass}">${tipoLabel}</span>
        ${modTags}${idiomTag}${listaTag}
      </div>
    </div>`;
  }).join('\n');
}

function buildSeoSection(terapeutas) {
  const articles = terapeutas.map(t => {
    const enfoques = (t.enfoques || []).join(', ');
    const casos = (t.casos || []).join(', ');
    const modalidades = (t.modalidades || []).join(', ');
    const idiomas = t.idiomas?.length ? ` Idiomas: ${t.idiomas.join(', ')}.` : '';
    const costo = t.costo ? ` Costo primera sesión: $${t.costo.toLocaleString()} MXN.` : '';
    const tipo = t.subtipo ? `${t.tipo} – ${t.subtipo}` : t.tipo;
    const disponibilidad = t.disponibilidad === 'Agenda abierta' ? '' : ' Actualmente en lista de espera.';
    return `      <article>
        <h3>${t.nombre}</h3>
        <p>${tipo} en ${t.zona}.${t.cp ? ` CP ${t.cp}.` : ''} Enfoques: ${enfoques}. ${t.especialidades || ''} Atiende: ${casos}. Modalidad: ${modalidades}.${idiomas}${costo}${disponibilidad}</p>
      </article>`;
  }).join('\n');
  return `  <section id="seo-directory" aria-label="Directorio completo de terapeutas">
    <h2>Directorio de terapeutas – Red Inessentia</h2>
    <p>Directorio interactivo de terapeutas en experiencia somática, psicoterapia, terapia familiar sistémica, terapia transpersonal, psiquiatría y terapia física en Latinoamérica. Profesionales recomendados por Patricio Ruiz.</p>
${articles}
  </section>`;
}

function buildJsonLd(terapeutas) {
  const items = terapeutas.map((t, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'ProfessionalService',
      name: t.nombre,
      description: [
        t.subtipo ? `${t.tipo} – ${t.subtipo}` : t.tipo,
        t.especialidades || '',
        `Enfoques: ${(t.enfoques || []).join(', ')}`,
      ].filter(Boolean).join('. '),
      address: { '@type': 'PostalAddress', addressLocality: t.zona, ...(t.cp && { postalCode: t.cp }) },
      ...(t.telefono && { telephone: t.telefono }),
      ...(t.costo && { priceRange: `$${t.costo} MXN` }),
      availableService: (t.modalidades || []).map(m => ({
        '@type': 'Service',
        name: m === 'Online' ? 'Terapia online' : m === 'Presencial' ? 'Terapia presencial' : `Terapia ${m.toLowerCase()}`,
        serviceType: t.subtipo || t.tipo,
      })),
      ...(t.idiomas?.length && { knowsLanguage: ['Español', ...t.idiomas] }),
    },
  }));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Red Inessentia – Directorio de Terapeutas',
    description: 'Directorio interactivo de terapeutas en experiencia somática, psicoterapia, terapia familiar sistémica, terapia transpersonal, psiquiatría y terapia física en Latinoamérica.',
    url: `${BASE_URL}/red-inessentia`,
    numberOfItems: terapeutas.length,
    itemListElement: items,
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

const terapeutas = data.terapeutas;
const listHtml = buildListItems(terapeutas);
const seoHtml = buildSeoSection(terapeutas);
const jsonLd = buildJsonLd(terapeutas);

html = html.replace('</head>', `${jsonLd}\n</head>`);
html = html.replace(
  '<div class="list-container" id="list-container"></div>',
  `<div class="list-container" id="list-container">\n${listHtml}\n  </div>`
);
html = html.replace('<div class="info-bar">', `${seoHtml}\n\n<div class="info-bar">`);
html = html.replace(
  'applyFilters();\n  } catch',
  `applyFilters();\n    const seoDir = document.getElementById('seo-directory');\n    if (seoDir) seoDir.style.display = 'none';\n  } catch`
);
html = html.replace(
  '/* ── LOADING ── */',
  `/* ── SEO DIRECTORY (pre-rendered for crawlers) ── */
  #seo-directory { max-width: 900px; margin: 0 auto; padding: 24px; font-size: 0.85rem; line-height: 1.7; color: var(--deep); }
  #seo-directory h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 600; margin-bottom: 8px; }
  #seo-directory h3 { font-size: 0.95rem; font-weight: 500; margin: 12px 0 2px; }
  #seo-directory > p { color: var(--warm-gray); margin-bottom: 16px; font-size: 0.8rem; }
  #seo-directory article p { color: #555; font-size: 0.8rem; }

  /* ── LOADING ── */`
);
html = html.replace(
  '<div class="sidebar-sub" id="sidebar-sub">Selecciona un pin o nombre</div>',
  `<div class="sidebar-sub" id="sidebar-sub">${terapeutas.length} terapeutas en el directorio</div>`
);

fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log(`✓ Pre-rendered ${terapeutas.length} therapists`);
console.log(`✓ Added JSON-LD structured data`);

// ═══════════════════════════════════════════════════════════════════════════
// PART 2: BLOG
// ═══════════════════════════════════════════════════════════════════════════

const BLOG_DIR = path.join(__dirname, 'blog');
const POSTS_DIR = path.join(BLOG_DIR, 'posts');
const OUT_DIR = path.join(__dirname, 'blog');

const postTemplate = fs.readFileSync(path.join(BLOG_DIR, 'post-template.html'), 'utf8');
const indexTemplate = fs.readFileSync(path.join(BLOG_DIR, 'index-template.html'), 'utf8');

const I18N = {
  es: {
    ogLocale: 'es_MX',
    ctaText: '¿Buscas un terapeuta que trabaje con este enfoque?',
    ctaButton: 'Explorar el directorio',
    backText: 'Volver al blog',
    readMore: 'Leer más →',
    readingUnit: 'min de lectura',
    pageTitle: 'Blog',
    pageDescription: 'Artículos sobre terapia somática, experiencia somática, Core Energetics y bienestar. Recursos para entender los enfoques terapéuticos del directorio Red Inessentia.',
    headerDescription: 'Recursos y artículos sobre terapia somática, experiencia somática, Core Energetics y procesos de autoconocimiento.',
  },
  en: {
    ogLocale: 'en_US',
    ctaText: 'Looking for a therapist who works with this approach?',
    ctaButton: 'Explore the directory',
    backText: 'Back to blog',
    readMore: 'Read more →',
    readingUnit: 'min read',
    pageTitle: 'Blog',
    pageDescription: 'Articles on somatic therapy, Somatic Experiencing, Core Energetics and wellbeing. Resources to understand the therapeutic approaches in the Red Inessentia directory.',
    headerDescription: 'Resources and articles on somatic therapy, Somatic Experiencing, Core Energetics and self-knowledge.',
  },
};

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      meta[key] = val;
    }
  });
  return { meta, body: match[2] };
}

function readingTime(text) {
  const words = text.replace(/<[^>]+>/g, '').split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function formatDate(dateStr, lang) {
  const d = new Date(dateStr + 'T12:00:00');
  const months = lang === 'en'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function extractExcerpt(htmlContent, maxLen = 160) {
  const text = htmlContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen).replace(/\s+\S*$/, '') + '...' : text;
}

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const { meta, body } = parseFrontMatter(raw);
    const htmlContent = marked(body);
    const lang = meta.lang || 'es';
    const mins = readingTime(body);
    return {
      ...meta,
      file,
      lang,
      htmlContent,
      readingTime: mins,
      excerpt: meta.description || extractExcerpt(htmlContent),
      dateFormatted: formatDate(meta.date || '2026-01-01', lang),
      dateISO: meta.date || '2026-01-01',
    };
  }).sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

function buildPost(post, allPosts) {
  const lang = post.lang || 'es';
  const i18n = I18N[lang] || I18N.es;

  let hreflang = '';
  let langLink = '';
  if (post.translationSlug) {
    const translation = allPosts.find(p => p.slug === post.translationSlug);
    if (translation) {
      const otherLang = translation.lang || 'es';
      hreflang = `<link rel="alternate" hreflang="${lang}" href="${BASE_URL}/blog/${post.slug}.html">\n<link rel="alternate" hreflang="${otherLang}" href="${BASE_URL}/blog/${translation.slug}.html">`;
      const linkLabel = otherLang === 'en' ? 'EN' : 'ES';
      langLink = `<a href="/blog/${translation.slug}.html" class="lang-switch">${linkLabel}</a>`;
    }
  }

  let out = postTemplate;
  out = out.replace(/\{\{title\}\}/g, post.title);
  out = out.replace(/\{\{description\}\}/g, post.description || post.excerpt);
  out = out.replace(/\{\{slug\}\}/g, post.slug);
  out = out.replace(/\{\{lang\}\}/g, lang);
  out = out.replace(/\{\{ogLocale\}\}/g, i18n.ogLocale);
  out = out.replace(/\{\{date\}\}/g, post.dateFormatted);
  out = out.replace(/\{\{category\}\}/g, post.category || '');
  out = out.replace(/\{\{readingTime\}\}/g, `${post.readingTime}`);
  out = out.replace(/\{\{readingUnit\}\}/g, i18n.readingUnit);
  out = out.replace(/\{\{content\}\}/g, post.htmlContent);
  out = out.replace(/\{\{ctaText\}\}/g, i18n.ctaText);
  out = out.replace(/\{\{ctaButton\}\}/g, i18n.ctaButton);
  out = out.replace(/\{\{backText\}\}/g, i18n.backText);
  out = out.replace(/\{\{hreflang\}\}/g, hreflang);
  out = out.replace(/\{\{langLink\}\}/g, langLink);
  return out;
}

function buildBlogIndex(posts, lang) {
  const i18n = I18N[lang] || I18N.es;
  const langPosts = posts.filter(p => (p.lang || 'es') === lang);

  const cards = langPosts.map(post => {
    return `    <li>
      <a href="/blog/${post.slug}.html" class="post-card">
        <div class="post-card-meta">
          <span class="post-card-date">${post.dateFormatted}</span>
          <span class="post-card-tag">${post.category || ''}</span>
          <span class="post-card-reading">${post.readingTime} ${i18n.readingUnit}</span>
        </div>
        <div class="post-card-title">${post.title}</div>
        <div class="post-card-excerpt">${post.excerpt}</div>
        <span class="post-card-read">${i18n.readMore}</span>
      </a>
    </li>`;
  }).join('\n');

  let out = indexTemplate;
  out = out.replace(/\{\{lang\}\}/g, lang);
  out = out.replace(/\{\{ogLocale\}\}/g, i18n.ogLocale);
  out = out.replace(/\{\{pageTitle\}\}/g, i18n.pageTitle);
  out = out.replace(/\{\{pageDescription\}\}/g, i18n.pageDescription);
  out = out.replace(/\{\{headerDescription\}\}/g, i18n.headerDescription);
  out = out.replace(/\{\{postCards\}\}/g, cards || '    <li><p style="color:var(--warm-gray);padding:40px;text-align:center">Próximamente...</p></li>');
  return out;
}

// ── Generate blog ──
const allPosts = loadPosts();

allPosts.forEach(post => {
  const postHtml = buildPost(post, allPosts);
  fs.writeFileSync(path.join(OUT_DIR, `${post.slug}.html`), postHtml, 'utf8');
});

const langs = [...new Set(allPosts.map(p => p.lang || 'es'))];
if (!langs.includes('es')) langs.push('es');

const indexHtml = buildBlogIndex(allPosts, 'es');
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml, 'utf8');

if (langs.includes('en')) {
  const enIndexHtml = buildBlogIndex(allPosts, 'en');
  fs.writeFileSync(path.join(OUT_DIR, 'index-en.html'), enIndexHtml, 'utf8');
}

console.log(`✓ Generated ${allPosts.length} blog posts`);
console.log(`✓ Generated blog index`);

// ═══════════════════════════════════════════════════════════════════════════
// PART 3: SITEMAP
// ═══════════════════════════════════════════════════════════════════════════

function buildSitemap(terapeutas, posts) {
  const today = new Date().toISOString().split('T')[0];

  let urls = [];

  urls.push({ loc: `${BASE_URL}/red-inessentia`, changefreq: 'weekly', priority: '1.0', lastmod: today });
  urls.push({ loc: `${BASE_URL}/blog/`, changefreq: 'weekly', priority: '0.8', lastmod: today });

  posts.forEach(post => {
    urls.push({
      loc: `${BASE_URL}/blog/${post.slug}.html`,
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: post.dateISO,
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return xml;
}

const sitemap = buildSitemap(terapeutas, allPosts);
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap, 'utf8');
console.log(`✓ Generated sitemap.xml (${2 + allPosts.length} URLs)`);
