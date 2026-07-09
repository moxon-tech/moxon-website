/**
 * MOXON Tech - Shared Components Loader
 * Injects shared header, footer, and quick contact blocks for static pages.
 */

let MOXON_SITE_DATA = window.MOXON_DATA || {};
let MOXON_COMPANY = MOXON_SITE_DATA.company || {};
let MOXON_BRAND = MOXON_SITE_DATA.brand || {};
function escapeComponentHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
let MOXON_LOGO = "";
let MOXON_LEGAL_NAME = "";
let MOXON_TAGLINE = "";
let MOXON_PHONE = "";
let MOXON_PHONE_HREF = "";
let MOXON_EMAIL = "";
let MOXON_WEBSITE = "";
let MOXON_WEBSITE_URL = "";
let MOXON_ADDRESS_HTML = "";
let MOXON_REPRESENTATIVE = "";
let MOXON_MAP_EMBED = "";
let MOXON_MAP_LINK = "";
let MOXON_FACEBOOK_URL = "";
let MOXON_ZALO_URL = "";
let MOXON_YOUTUBE_URL = "";
let MOXON_FOOTER_SERVICES = [];

function refreshComponentData() {
  MOXON_SITE_DATA = window.MOXON_DATA || {};
  MOXON_COMPANY = MOXON_SITE_DATA.company || {};
  MOXON_BRAND = MOXON_SITE_DATA.brand || {};
  MOXON_LOGO = MOXON_BRAND.logo || "assets/logo-transparent.png?v=20260630-opt";
  MOXON_LEGAL_NAME = MOXON_COMPANY.legalName || "C&#212;NG TY TNHH C&#212;NG NGH&#7878; MOXON";
  MOXON_TAGLINE =
    MOXON_BRAND.tagline || "Jig / Fixture &bull; Gia c&#244;ng CNC &bull; Khu&#244;n m&#7851;u &bull; T&#7921; &#273;&#7897;ng h&#243;a";
  MOXON_PHONE = MOXON_COMPANY.phone || "0988 440 436";
  MOXON_PHONE_HREF = MOXON_COMPANY.phoneHref || "0988440436";
  MOXON_EMAIL = MOXON_COMPANY.email || "moxontech.vn@gmail.com";
  MOXON_WEBSITE = MOXON_COMPANY.website || "www.moxontech.vn";
  MOXON_WEBSITE_URL = MOXON_COMPANY.websiteUrl || "https://www.moxontech.vn";
  MOXON_ADDRESS_HTML =
    MOXON_COMPANY.addressHtml || escapeComponentHtml(MOXON_COMPANY.address) || "S&#7889; 16 Khu Qu&#7871; S&#417;n, P. H&#7841;p L&#297;nh, B&#7855;c Ninh";
  MOXON_REPRESENTATIVE = MOXON_COMPANY.representative || "&#212;ng Tr&#7883;nh V&#259;n Chinh - Gi&#225;m &#273;&#7889;c";
  MOXON_MAP_EMBED =
    MOXON_COMPANY.mapEmbed ||
    "https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d2525.9855319814924!2d106.07790280497397!3d21.126551099888523!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMjHCsDA3JzM1LjUiTiAxMDbCsDA0JzQwLjIiRQ!5e1!3m2!1svi!2s!4v1782618199915!5m2!1svi!2s";
  MOXON_MAP_LINK =
    MOXON_COMPANY.mapLink ||
    "https://www.google.com/maps/search/?api=1&query=21.126551099888523,106.07790280497397";
  MOXON_FACEBOOK_URL = MOXON_BRAND.facebookUrl || "#";
  MOXON_ZALO_URL = MOXON_BRAND.zaloUrl || `https://zalo.me/${MOXON_PHONE_HREF}`;
  MOXON_YOUTUBE_URL = MOXON_BRAND.youtubeUrl || "https://www.youtube.com";
  MOXON_FOOTER_SERVICES = Array.isArray(MOXON_SITE_DATA.services)
    ? MOXON_SITE_DATA.services
        .filter((service) => service && service.active !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .slice(0, 6)
    : [];
}

function initSharedComponents() {
  refreshComponentData();

  if (MOXON_BRAND.favicon) {
    const existingIcon = document.querySelector("link[rel='icon']");
    const favicon = existingIcon || document.createElement("link");
    favicon.rel = "icon";
    favicon.href = MOXON_BRAND.favicon;
    if (!existingIcon) document.head.appendChild(favicon);
  }

  const headerContainer = document.getElementById("header-container");
  if (headerContainer) {
    headerContainer.className = "masthead-split";
    headerContainer.setAttribute("data-header", "");
    headerContainer.innerHTML = `
      <div class="header-top">
        <div class="header-top-inner">
          <a class="brand-split" href="index.html" aria-label="MOXON trang ch&#7911;">
            <img class="brand-logo-split" src="${MOXON_LOGO}" alt="MOXON" width="90" height="54">
            <div class="brand-info-split">
              <span class="brand-name-split">${MOXON_LEGAL_NAME}</span>
              <span class="brand-tagline-split">${MOXON_TAGLINE}</span>
              <div class="brand-contact-split">
                <span>
                  <span class="contact-icon-split" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>
                  </span>
                  ${MOXON_ADDRESS_HTML.replace(", ", ",<br>")}
                </span>
                <span>
                  <span class="contact-icon-split" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
                  </span>
                  ${MOXON_EMAIL}
                </span>
                <span>
                  <span class="contact-icon-split" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 1 0 .01 0H12zm6.93 6h-2.95a15.7 15.7 0 0 0-1.38-3.1A8.03 8.03 0 0 1 18.93 8zM12 4.04A14.1 14.1 0 0 1 13.91 8h-3.82A14.1 14.1 0 0 1 12 4.04zM4.26 14a8.33 8.33 0 0 1 0-4h3.33a16.5 16.5 0 0 0 0 4H4.26zm.81 2h2.95c.32 1.12.78 2.18 1.38 3.1A8.03 8.03 0 0 1 5.07 16zm2.95-8H5.07A8.03 8.03 0 0 1 9.4 4.9 15.7 15.7 0 0 0 8.02 8zM12 19.96A14.1 14.1 0 0 1 10.09 16h3.82A14.1 14.1 0 0 1 12 19.96zM14.34 14H9.66a14.8 14.8 0 0 1 0-4h4.68a14.8 14.8 0 0 1 0 4zm.26 5.1c.6-.92 1.06-1.98 1.38-3.1h2.95a8.03 8.03 0 0 1-4.33 3.1zM16.41 14a16.5 16.5 0 0 0 0-4h3.33a8.33 8.33 0 0 1 0 4h-3.33z"/></svg>
                  </span>
                  ${MOXON_WEBSITE}
                </span>
              </div>
            </div>
          </a>
          <button class="menu-toggle menu-toggle-top" type="button" aria-label="M&#7903; menu" aria-expanded="false" data-menu-toggle>
            <span></span><span></span><span></span>
          </button>

          <a class="header-cta-split" href="tel:${MOXON_PHONE_HREF}">
            <div class="cta-split-label">HOTLINE T&#431; V&#7844;N</div>
            <div class="cta-split-phone">
              <span class="phone-icon-circle">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02A11.36 11.36 0 0 1 8.5 3.99c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.61c0-.55-.45-1-1-1z"/>
                </svg>
              </span>
              ${MOXON_PHONE}
            </div>
          </a>
        </div>
      </div>
      <div class="header-bottom">
        <div class="header-bottom-inner">
          <button class="menu-toggle" type="button" aria-label="M&#7903; menu" aria-expanded="false" data-menu-toggle>
            <span></span><span></span><span></span>
          </button>
          <nav class="main-nav" aria-label="Menu ch&#237;nh" data-nav>
            <a href="index.html" data-page-link="home">Trang ch&#7911;</a>
            <a href="about.html" data-page-link="about">Gi&#7899;i thi&#7879;u</a>            <a href="news.html" data-page-link="news">Tin t&#7913;c</a>            <a href="services.html" data-page-link="services">D&#7883;ch v&#7909;</a>
            <a href="products.html" data-page-link="products">S&#7843;n ph&#7849;m</a>
            <a href="recruitment.html" data-page-link="recruitment">Tuy&#7875;n d&#7909;ng</a>
            <a href="contact.html" data-page-link="contact">Li&#234;n h&#7879;</a>
          </nav>
        </div>
      </div>
    `;
  }

  const footerContainer = document.getElementById("footer-container");
  if (footerContainer) {
    footerContainer.className = "site-footer compact-footer";
    footerContainer.innerHTML = `
      <div class="footer-grid">
        <div class="footer-about">
          <img class="footer-logo" src="${MOXON_LOGO}" alt="MOXON" loading="lazy" decoding="async">
          <p>Chuy&#234;n thi&#7871;t k&#7871;, ch&#7871; t&#7841;o khu&#244;n m&#7851;u, Jig/Fixture, gia c&#244;ng CNC v&#224; t&#7921; &#273;&#7897;ng h&#243;a.</p>
          <div class="footer-socials" aria-label="K&#234;nh li&#234;n h&#7879; MOXON">
            <a class="footer-social-link footer-social-facebook" href="${MOXON_FACEBOOK_URL}" target="_blank" rel="noopener" aria-label="Facebook"><span>f</span></a>
            <a class="footer-social-link footer-social-zalo" href="${MOXON_ZALO_URL}" target="_blank" rel="noopener" aria-label="Zalo"><span>Z</span></a>
            <a class="footer-social-link footer-social-youtube" href="${MOXON_YOUTUBE_URL}" target="_blank" rel="noopener" aria-label="Youtube"><span>&#9654;</span></a>
          </div>
        </div>
        <div class="footer-col">
          <h3>D&#7883;ch v&#7909;</h3>
          <ul>
            ${
              MOXON_FOOTER_SERVICES.length
                ? MOXON_FOOTER_SERVICES.map(
                    (service) =>
                      `<li><a href="services.html#${escapeComponentHtml(service.id || "")}">${escapeComponentHtml(service.title || service.name || "Dịch vụ")}</a></li>`
                  ).join("")
                : '<li><a href="services.html">Xem d&#7883;ch v&#7909;</a></li>'
            }
          </ul>
        </div>
        <div class="footer-col">
          <h3>Li&#234;n k&#7871;t nhanh</h3>
          <ul>
            <li><a href="about.html">Gi&#7899;i thi&#7879;u</a></li>
            <li><a href="news.html">Tin t&#7913;c</a></li>
            <li><a href="services.html">D&#7883;ch v&#7909;</a></li>
            <li><a href="products.html">S&#7843;n ph&#7849;m</a></li>
            <li><a href="recruitment.html">Tuy&#7875;n d&#7909;ng</a></li>
            <li><a href="contact.html">Li&#234;n h&#7879;</a></li>
          </ul>
        </div>
        <div class="footer-col footer-contact-col">
          <h3>Th&#244;ng tin li&#234;n h&#7879;</h3>
          <ul class="contact-list">
            <li><span class="footer-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.81a2 2 0 0 1-.45 2.11L8.05 9.91a16 16 0 0 0 6.04 6.04l1.27-1.27a2 2 0 0 1 2.11-.45c.91.31 1.85.53 2.81.66A2 2 0 0 1 22 16.92z"/></svg></span><a href="tel:${MOXON_PHONE_HREF}">${MOXON_PHONE}</a></li>
            <li><span class="footer-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm16 4-8 5L4 8"/></svg></span><a href="mailto:${MOXON_EMAIL}">${MOXON_EMAIL}</a></li>
            <li><span class="footer-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span><a href="${MOXON_WEBSITE_URL}">${MOXON_WEBSITE}</a></li>
            <li><span class="footer-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span>${MOXON_ADDRESS_HTML}</li>
            <li><span class="footer-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg></span>${MOXON_REPRESENTATIVE}</li>
          </ul>
        </div>
        <div class="footer-map-col">
          <h3>B&#7843;n &#273;&#7891;</h3>
          <div class="map-embed" aria-label="B&#7843;n &#273;&#7891; v&#7883; tr&#237; MOXON">
            <iframe
              title="B&#7843;n &#273;&#7891; v&#7883; tr&#237; MOXON"
              src="${MOXON_MAP_EMBED}"
              loading="lazy"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"></iframe>
          </div>
          <a class="footer-map-button" href="${MOXON_MAP_LINK}" target="_blank" rel="noopener">M&#7903; Google Maps</a>
        </div>
      </div>
      <div class="footer-bottom-bar">
        <span>&copy; 2026 MOXON Tech. All rights reserved.</span>
      </div>
    `;
  }

  const quickContactContainer = document.getElementById("quick-contact-container") || document.querySelector(".floating-contact");
  if (quickContactContainer) {
    quickContactContainer.outerHTML = `
      <div class="floating-contact" aria-label="Li&#234;n h&#7879; nhanh">
        <a class="floating-btn floating-facebook" href="${MOXON_FACEBOOK_URL}" target="_blank" rel="noopener" aria-label="Facebook MOXON">
          <div class="ripple-ring ring-1"></div>
          <div class="ripple-ring ring-2"></div>
          <span class="floating-icon floating-contact-icon facebook-badge-text">f</span>
        </a>
        <a class="floating-btn floating-zalo" href="${MOXON_ZALO_URL}" target="_blank" rel="noopener" aria-label="Li&#234;n h&#7879; Zalo">
          <div class="ripple-ring ring-1"></div>
          <div class="ripple-ring ring-2"></div>
          <span class="floating-icon zalo-badge-text">Zalo</span>
        </a>
        <a class="floating-btn floating-phone" href="tel:${MOXON_PHONE_HREF}" aria-label="G&#7885;i &#273;i&#7879;n hotline">
          <div class="ripple-ring ring-1"></div>
          <div class="ripple-ring ring-2"></div>
          <div class="floating-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02A11.36 11.36 0 0 1 8.5 3.99c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.61c0-.55-.45-1-1-1z"/>
            </svg>
          </div>
        </a>
      </div>
    `;
  }

  initHeaderInteractions();
}

function initHeaderInteractions() {
  const masthead = document.querySelector("[data-header]");
  const nav = document.querySelector("[data-nav]");
  const menuToggles = Array.from(document.querySelectorAll("[data-menu-toggle]"));
  const navLinks = Array.from(document.querySelectorAll(".main-nav a"));

  const setHeaderState = () => {
    masthead?.classList.toggle("is-scrolled", window.scrollY > 16);
  };

  const setActiveNav = () => {
    const page = document.body.dataset.page;
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("data-page-link") === page);
    });
  };

  const setMenuOpen = (isOpen) => {
    nav?.classList.toggle("is-open", isOpen);
    menuToggles.forEach((toggle) => {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "\u0110\u00f3ng menu" : "M\u1edf menu");
    });
  };

  menuToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      setMenuOpen(!nav?.classList.contains("is-open"));
    });
  });

  nav?.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      setMenuOpen(false);
    }
  });

  if (window.__moxonHeaderScrollHandler) {
    window.removeEventListener("scroll", window.__moxonHeaderScrollHandler);
  }
  window.__moxonHeaderScrollHandler = setHeaderState;
  window.addEventListener("scroll", window.__moxonHeaderScrollHandler, { passive: true });
  setHeaderState();
  setActiveNav();
}

if (document.getElementById("header-container") || document.getElementById("footer-container")) {
  initSharedComponents();
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSharedComponents, { once: true });
} else {
  initSharedComponents();
}

document.addEventListener("moxon:content-rendered", initSharedComponents);
