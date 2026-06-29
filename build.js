#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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

// ── Pre-render therapist list items ──
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

// ── SEO content section (crawlable, hidden by JS) ──
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

// ── JSON-LD structured data ──
function buildJsonLd(terapeutas) {
  const items = terapeutas.map((t, i) => {
    const item = {
      '@type': 'ProfessionalService',
      name: t.nombre,
      description: [
        t.subtipo ? `${t.tipo} – ${t.subtipo}` : t.tipo,
        t.especialidades || '',
        `Enfoques: ${(t.enfoques || []).join(', ')}`,
      ].filter(Boolean).join('. '),
      address: {
        '@type': 'PostalAddress',
        addressLocality: t.zona,
        ...(t.cp && { postalCode: t.cp }),
      },
      ...(t.telefono && { telephone: t.telefono }),
      ...(t.costo && {
        priceRange: `$${t.costo} MXN`,
      }),
      availableService: (t.modalidades || []).map(m => ({
        '@type': 'Service',
        name: m === 'Online' ? 'Terapia online' : m === 'Presencial' ? 'Terapia presencial' : `Terapia ${m.toLowerCase()}`,
        serviceType: t.subtipo || t.tipo,
      })),
      ...(t.idiomas?.length && { knowsLanguage: ['Español', ...t.idiomas] }),
    };

    return {
      '@type': 'ListItem',
      position: i + 1,
      item,
    };
  });

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Red Inessentia – Directorio de Terapeutas',
    description: 'Directorio interactivo de terapeutas en experiencia somática, psicoterapia, terapia familiar sistémica, terapia transpersonal, psiquiatría y terapia física en Latinoamérica.',
    url: 'https://www.inessentia.mx/red-inessentia',
    numberOfItems: terapeutas.length,
    itemListElement: items,
  };

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

// ── Inject into HTML ──
const terapeutas = data.terapeutas;
const listHtml = buildListItems(terapeutas);
const seoHtml = buildSeoSection(terapeutas);
const jsonLd = buildJsonLd(terapeutas);

// 1. Inject JSON-LD before </head>
html = html.replace('</head>', `${jsonLd}\n</head>`);

// 2. Pre-populate list container
html = html.replace(
  '<div class="list-container" id="list-container"></div>',
  `<div class="list-container" id="list-container">\n${listHtml}\n  </div>`
);

// 3. Add SEO content section before info-bar (hidden by JS on load)
html = html.replace(
  '<div class="info-bar">',
  `${seoHtml}\n\n<div class="info-bar">`
);

// 4. Add JS to hide SEO section once app loads
html = html.replace(
  'applyFilters();\n  } catch',
  `applyFilters();\n    const seoDir = document.getElementById('seo-directory');\n    if (seoDir) seoDir.style.display = 'none';\n  } catch`
);

// 5. Add CSS for SEO section (visible to crawlers, styled for brief flash before JS)
html = html.replace(
  '/* ── LOADING ── */',
  `/* ── SEO DIRECTORY (pre-rendered for crawlers) ── */
  #seo-directory {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px;
    font-size: 0.85rem;
    line-height: 1.7;
    color: var(--deep);
  }
  #seo-directory h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.3rem;
    font-weight: 600;
    margin-bottom: 8px;
  }
  #seo-directory h3 {
    font-size: 0.95rem;
    font-weight: 500;
    margin: 12px 0 2px;
  }
  #seo-directory > p {
    color: var(--warm-gray);
    margin-bottom: 16px;
    font-size: 0.8rem;
  }
  #seo-directory article p {
    color: #555;
    font-size: 0.8rem;
  }

  /* ── LOADING ── */`
);

// 6. Update sidebar subtitle to be more descriptive for crawlers
html = html.replace(
  '<div class="sidebar-sub" id="sidebar-sub">Selecciona un pin o nombre</div>',
  `<div class="sidebar-sub" id="sidebar-sub">${terapeutas.length} terapeutas en el directorio</div>`
);

fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log(`✓ Pre-rendered ${terapeutas.length} therapists`);
console.log(`✓ Added JSON-LD structured data`);
console.log(`✓ Added SEO content section`);
console.log(`✓ Updated sidebar subtitle`);
