(function renderManagedPublicContent() {
  let data = window.MOXON_DATA || {};
  let lastRenderSignature = "";
  const byOrder = (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0);
  const activeItems = (items) => (Array.isArray(items) ? items.filter((item) => item.active !== false).sort(byOrder) : []);
  const text = (value) => String(value ?? "");
  const parseAboutListItems = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") {
            return { title: item.trim(), text: "" };
          }
          if (item && typeof item === "object") {
            return { title: text(item.title || item.name), text: text(item.text || item.description || item.summary) };
          }
          return null;
        })
        .filter(Boolean);
    }

    if (typeof value !== "string") return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === "string") return { title: item.trim(), text: "" };
            if (item && typeof item === "object") return { title: text(item.title || item.name), text: text(item.text || item.description || item.summary) };
            return null;
          })
          .filter(Boolean);
      }
    } catch {
      // Fall back to simple line parsing
    }

    return trimmed
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        if (line.includes(" | ")) {
          const [title, ...rest] = line.split(" | ");
          return { title: title.trim(), text: rest.join(" | ").trim() };
        }
        if (line.includes(":")) {
          const idx = line.indexOf(":");
          return { title: line.slice(0, idx).trim(), text: line.slice(idx + 1).trim() };
        }
        return { title: line, text: "" };
      });
  };
  const normalizeAboutItems = (items) =>
    (Array.isArray(items) ? items : parseAboutListItems(items))
      .map((item) => ({
        title: text(item.title || item.name),
        text: text(item.text || item.description || item.summary),
        image: text(item.image),
        alt: text(item.alt || item.title || item.name)
      }))
      .filter((item) => item.title || item.text || item.image);
  const safeId = (value) => text(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  const escapeHtml = (value) =>
    text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  let categories = [];
  let products = [];
  let services = [];
  let jobs = [];

  const refreshDerivedData = () => {
    categories = activeItems(data.productCategories);
    const categoryIds = new Set(categories.map((category) => text(category.id)));
    products = activeItems(data.products).filter((product) => !categories.length || !product.category || categoryIds.has(text(product.category)));
    services = activeItems(data.services);
    jobs = activeItems(data.jobs);
  };

  const quoteHref = (title) => `contact.html?quote=${encodeURIComponent(text(title))}#quote`;
  const getDataState = () => window.MOXON_SUPABASE_DATA_STATE || "static";
  const isDataLoading = () => getDataState() === "loading";
  const emptyProductMessage = () =>
    isDataLoading()
      ? "Dang tai danh sach san pham tu he thong..."
      : "Chua tai duoc danh sach san pham. Vui long lien he MOXON de duoc tu van.";
  const isExternalUrl = (url) => /^https?:\/\//i.test(text(url).trim());
  const newsHref = (item) => {
    const url = text(item.url).trim();
    if (url && url !== "#") return url;
    return `news.html?id=${encodeURIComponent(text(item.id))}`;
  };
  const newsLinkAttrs = (item) => (isExternalUrl(item.url) ? ' target="_blank" rel="noopener"' : "");
  const bannerPage = (item) => text(item.page || "home").trim().toLowerCase();

  const renderHomeBanners = () => {
    const banner = document.getElementById("hero-banner");
    if (!banner) return;

    const items = activeItems(data.banners).filter((item) => bannerPage(item) === "home");
    if (!items.length) {
      return;
    }

    const slides = items
      .map(
        (item, index) => `
          <div class="hero-slide${index === 0 ? " active" : ""}">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title || "MOXON banner")}" ${index === 0 ? 'loading="eager" fetchpriority="high"' : ""}>
          </div>
        `
      )
      .join("");

    const dots = items
      .map(
        (_, index) =>
          `<button class="hero-banner-dot${index === 0 ? " active" : ""}" type="button" aria-label="Hi&#7875;n th&#7883; banner ${index + 1}"></button>`
      )
      .join("");

    if (banner.__moxonSlideTimer) {
      window.clearInterval(banner.__moxonSlideTimer);
      banner.__moxonSlideTimer = 0;
    }
    delete banner.dataset.heroSlideshowReady;
    banner.innerHTML = `${slides}<div class="hero-banner-dots" aria-label="Ch&#7885;n &#7843;nh banner">${dots}</div>`;
  };

  const renderContactBanner = () => {
    const hero = document.querySelector(".contact-hero-banner");
    if (!hero) return;

    const item = activeItems(data.banners).find((bannerItem) => bannerPage(bannerItem) === "contact");
    if (!item?.image) {
      hero.classList.remove("is-visible");
      return;
    }

    const image = hero.matches("img") ? hero : hero.querySelector("img");
    if (!image) return;

    image.src = item.image;
    image.alt = item.alt || item.title || "Banner liên hệ MOXON";
  };

  const renderPartners = () => {
    const grid = document.querySelector(".brand-logo-grid");
    if (!grid) return;

    const items = activeItems(data.partners);
    if (!items.length) {
      return;
    }

    if (grid.__moxonAutoScrollTimer) {
      window.clearInterval(grid.__moxonAutoScrollTimer);
      grid.__moxonAutoScrollTimer = 0;
    }
    delete grid.dataset.autoScrollReady;

    grid.innerHTML = items
      .map((item) => {
        const image = item.image || item.logo || "";
        const tone = String(item.tone || "").trim();
        const isColorTone = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(tone);
        const toneClass = isColorTone ? "brand-custom-color" : escapeHtml(tone);
        const toneStyle = isColorTone ? ` style="--brand-text-color: ${escapeHtml(tone)}"` : "";
        const content = image
          ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name || "Logo đối tác")}" loading="lazy" decoding="async">${item.label ? `<span>${escapeHtml(item.label)}</span>` : ""}`
          : `<strong>${escapeHtml(item.name)}</strong>${item.label ? `<span>${escapeHtml(item.label)}</span>` : ""}`;
        if (item.url && item.url !== "#") {
          return `<a class="brand-logo-card ${toneClass}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"${toneStyle}>${content}</a>`;
        }
        return `<div class="brand-logo-card ${toneClass}"${toneStyle}>${content}</div>`;
      })
      .join("");
  };

  const renderProductCatalogMenu = () => {
    const menu = document.querySelector(".catalog-category-menu");
    if (!menu) return;

    menu.innerHTML = `
      <button class="catalog-category-btn is-active" type="button" data-catalog-filter="all">T&#7845;t c&#7843; s&#7843;n ph&#7849;m</button>
      ${categories
        .map(
          (category) =>
            `<button class="catalog-category-btn" type="button" data-catalog-filter="${escapeHtml(category.id)}">${escapeHtml(category.name)}</button>`
        )
        .join("")}
    `;
  };

  const renderHomeProductSidebarMenu = () => {
    const menu = document.querySelector(".home-sidebar .sidebar-widget .sidebar-menu-list");
    if (!menu) return;

    menu.innerHTML = `
      <li><a href="products.html">T&#7845;t c&#7843; s&#7843;n ph&#7849;m</a></li>
      ${categories
        .map(
          (category) =>
            `<li><a href="products.html?category=${encodeURIComponent(category.id)}">${escapeHtml(category.name)}</a></li>`
        )
        .join("")}
    `;
  };

  const renderCatalogProductCard = (product) => {
    const category = categories.find((item) => item.id === product.category);
    const categoryName = product.kicker || category?.name || "";
    return `
      <article
        class="product-item catalog-product-card"
        id="${escapeHtml(product.id)}"
        data-category="${escapeHtml(product.category)}"
        data-title="${escapeHtml(product.title)}"
        data-kicker="${escapeHtml(product.kicker)}"
        data-desc="${escapeHtml(product.description)}"
        data-img="${escapeHtml(product.image)}"
        data-search="${escapeHtml(product.search)}">
        <div class="product-item-img">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" decoding="async">
        </div>
        <div class="product-item-body">
          ${categoryName ? `<span class="catalog-product-meta">${escapeHtml(categoryName)}</span>` : ""}
          <h3>${escapeHtml(product.title)}</h3>
          ${product.description ? `<p class="catalog-product-desc">${escapeHtml(product.description)}</p>` : ""}
          <div class="catalog-product-actions">
            <button class="product-detail-btn" type="button">Chi tiết</button>
            <a class="price-contact" href="${quoteHref(product.title)}">Li&#234;n h&#7879;</a>
          </div>
        </div>
      </article>
    `;
  };

  const renderProductsPage = () => {
    const grid = document.querySelector(".catalog-product-grid");
    if (!grid) return;

    renderProductCatalogMenu();
    if (!products.length) {
      grid.innerHTML = "";
      const empty = document.querySelector("[data-product-empty]");
      if (empty) {
        empty.textContent = emptyProductMessage();
        empty.classList.add("is-visible");
      }
      return;
    }

    const empty = document.querySelector("[data-product-empty]");
    if (empty) {
      empty.textContent = "Khong tim thay san pham phu hop.";
      empty.classList.remove("is-visible");
    }
    grid.innerHTML = products.map(renderCatalogProductCard).join("");
  };

  const renderHomeProductCard = (product) => `
    <div class="product-item-card" onclick="location.href='products.html#${escapeHtml(product.id)}'">
      <div class="product-item-card-img">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" decoding="async">
      </div>
      <div class="product-item-card-body">
        <h4>${escapeHtml(product.title)}</h4>
        ${product.description ? `<p class="product-item-card-desc">${escapeHtml(product.description)}</p>` : ""}
        <a href="${quoteHref(product.title)}" class="product-card-cta-btn">Li&#234;n h&#7879;</a>
      </div>
    </div>
  `;

  const renderHomeProductRows = () => {
    const mainContent = document.querySelector(".home-main-content");
    const newsGrid = document.querySelector(".home-news-contact-grid");
    if (!mainContent || !newsGrid) return;

    mainContent.querySelectorAll(".product-row-wrap").forEach((row) => {
      const scrollable = row.querySelector(".product-row-grid-scrollable");
      if (scrollable?.__moxonAutoScrollTimer) {
        window.clearInterval(scrollable.__moxonAutoScrollTimer);
      }
      row.remove();
    });

    mainContent.querySelectorAll("[data-product-loading-row]").forEach((row) => row.remove());

    if (!categories.length || !products.length) {
      newsGrid.insertAdjacentHTML(
        "beforebegin",
        `
          <div class="product-row-wrap" data-product-loading-row>
            <div class="product-row-header"><h3>S&#7843;n ph&#7849;m</h3><a href="contact.html#quote" class="view-all-link">Li&#234;n h&#7879; t&#432; v&#7845;n &#8250;</a></div>
            <div class="catalog-empty is-visible">${escapeHtml(emptyProductMessage())}</div>
          </div>
        `
      );
      return;
    }

    const rows = categories
      .map((category) => {
        const items = products.filter((product) => product.category === category.id && product.featured !== false);
        if (!items.length) return "";

        const rowId = `home-product-row-${safeId(category.id)}`;
        const firstProduct = items[0];
        return `
          <div class="product-row-wrap" data-managed-product-row>
            <div class="product-row-header">
              <h3>${escapeHtml(category.name)}</h3>
              <a href="products.html?category=${encodeURIComponent(category.id)}" class="view-all-link">Xem t&#7845;t c&#7843; &#8250;</a>
            </div>
            <div class="product-row-slider-container">
              <button class="slider-arrow arrow-left" onclick="scrollRow('${escapeHtml(rowId)}', 'left')" aria-label="Tr&#432;&#7907;t tr&#225;i">&#8249;</button>
              <div class="product-row-grid-scrollable" id="${escapeHtml(rowId)}">
                ${items.map(renderHomeProductCard).join("")}
              </div>
              <button class="slider-arrow arrow-right" onclick="scrollRow('${escapeHtml(rowId)}', 'right')" aria-label="Tr&#432;&#7907;t ph&#7843;i">&#8250;</button>
            </div>
          </div>
        `;
      })
      .filter(Boolean)
      .join("");

    if (!rows) return;
    newsGrid.insertAdjacentHTML("beforebegin", rows);
  };

  const renderHomeProductCategorySelect = () => {
    const select =
      document.querySelector(".product-search-panel select") ||
      document.querySelector(".product-search-controls select") ||
      document.querySelector(".product-search-select select");
    if (!select) return;

    select.innerHTML = `
      <option value="all">T&#7845;t c&#7843; danh m&#7909;c</option>
      ${categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join("")}
    `;
  };

  const renderHomeNews = () => {
    const list = document.querySelector(".corporate-news-list");
    if (!list) return;

    const items = activeItems(data.news).slice(0, 4);
    if (!items.length) {
      return;
    }

    list.innerHTML = items
      .map(
        (item) => {
          return `
          <a href="${escapeHtml(newsHref(item))}" class="corporate-news-item"${newsLinkAttrs(item)}>
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">
            <div class="corporate-news-item-body">
              <span class="corporate-news-date">${escapeHtml(item.date)}</span>
              <h4>${escapeHtml(item.title)}</h4>
              <p>${escapeHtml(item.summary)}</p>
            </div>
          </a>
        `;
        }
      )
      .join("");
  };

  const renderNewsListPage = (container, items) => {
    container.innerHTML = `
      <section class="news-page-section">
        <div class="news-page-head">
          <p class="section-kicker">Tin tức - Hoạt động</p>
          <h1>Tin tức - Hoạt động MOXON</h1>
        </div>
        <div class="news-page-list">
          ${items
            .map(
              (item) => `
                <a href="${escapeHtml(newsHref(item))}" class="corporate-news-item news-page-item"${newsLinkAttrs(item)}>
                  <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">
                  <div class="corporate-news-item-body">
                    <span class="corporate-news-date">${escapeHtml(item.date)}</span>
                    <h4>${escapeHtml(item.title)}</h4>
                    <p>${escapeHtml(item.summary)}</p>
                  </div>
                </a>
              `
            )
            .join("")}
        </div>
      </section>
    `;
  };

  const renderNewsDetailPage = (container, item) => {
    const paragraphs = text(item.content || item.summary)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    container.innerHTML = `
      <article class="news-detail-page">
        <header class="news-detail-header">
          <h1>${escapeHtml(item.title)}</h1>
          ${item.date ? `<p class="news-detail-date">Ngày đăng: ${escapeHtml(item.date)}</p>` : ""}
        </header>
        ${item.summary ? `<p class="news-detail-summary">${escapeHtml(item.summary)}</p>` : ""}
        ${item.image ? `<img class="news-detail-main-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="eager">` : ""}
        <div class="news-detail-body">
          ${paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        </div>
        <a class="button button-primary news-detail-back" href="news.html">Quay lại danh sách tin</a>
      </article>
    `;
  };

  const renderNewsPage = () => {
    const detail = document.getElementById("news-detail");
    if (!detail) return;

    const items = activeItems(data.news);
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!items.length) {
      detail.innerHTML = `
        <section class="about-hero-section">
          <div class="about-hero-copy">
            <p class="section-kicker">Tin t&#7913;c</p>
            <h1>Ch&#432;a c&#243; tin t&#7913;c</h1>
            <p>N&#7897;i dung tin t&#7913;c s&#7869; &#273;&#432;&#7907;c c&#7853;p nh&#7853;t sau.</p>
          </div>
        </section>
      `;
      return;
    }

    if (!id) {
      renderNewsListPage(detail, items);
      return;
    }

    const item = items.find((newsItem) => newsItem.id === id);
    if (!item) {
      renderNewsListPage(detail, items);
      return;
    }

    renderNewsDetailPage(detail, item);
  };

  const renderServicesPage = () => {
    const grid = document.querySelector(".services-horizontal-grid");
    if (!grid) return;

    if (!services.length) {
      return;
    }

    const icons = ["&#9633;", "&#9638;", "&#9881;", "&#9737;", "&#9672;", "&#9733;"];
    grid.innerHTML = services
      .map((service, index) => {
        const number = String(index + 1).padStart(2, "0");
        const features = Array.isArray(service.features) ? service.features : [];
        return `
          <article class="services-card services-horizontal-card" id="${escapeHtml(service.id)}">
            <div class="services-card-image">
              <img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async">
              <span>${number}</span>
            </div>
            <div class="services-card-icon" aria-hidden="true">${icons[index % icons.length]}</div>
            <h2>${escapeHtml(service.title)}</h2>
            <p>${escapeHtml(service.summary)}</p>
            <ul>
              ${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
            </ul>
          </article>
        `;
      })
      .join("");
  };

  const renderRecruitmentPage = () => {
    const notice = document.querySelector(".recruitment-notice");
    const recruitmentNotice = data.recruitmentNotice || {};
    if (notice && recruitmentNotice.active !== false) {
      const content = text(recruitmentNotice.content)
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (recruitmentNotice.title || content.length) {
        notice.innerHTML = `
          <div>
            <p class="section-kicker">${escapeHtml(recruitmentNotice.kicker || "Thông tin hiện tại")}</p>
            <h2>${escapeHtml(recruitmentNotice.title)}</h2>
          </div>
          <div>
            ${content.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
          </div>
        `;
      }
    }

    const grid = document.querySelector(".recruitment-role-grid");
    if (!grid) return;

    if (jobs.length > 0) {
      grid.innerHTML = jobs
        .map(
          (job, index) => `
          <article class="recruitment-role-card" id="${escapeHtml(job.id)}">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(job.title)}</h3>
            <p>${escapeHtml(job.description)}</p>
          </article>
        `
        )
        .join("");
    }

    const select = document.querySelector("select[name='vi_tri']");
    if (select && jobs.length > 0) {
      select.innerHTML = `
        <option value="" disabled selected>Chọn vị trí quan tâm</option>
        ${jobs.map((job) => `<option>${escapeHtml(job.title)}</option>`).join("")}
        <option>Vị trí khác</option>
      `;
    }
  };

  const renderContactPage = () => {
    renderContactBanner();

    const panel = document.querySelector(".contact-info-panel");
    const serviceSelect = document.querySelector("select[name='service']");

    if (serviceSelect && services.length) {
      serviceSelect.innerHTML = `
        ${services.map((service) => `<option>${escapeHtml(service.title)}</option>`).join("")}
        <option>Kh&#225;c</option>
      `;
    }

    if (!panel || !data.company) return;

    const company = data.company;
    panel.innerHTML = `
      <p class="section-kicker">Th&#244;ng tin li&#234;n h&#7879;</p>
      <h2>${escapeHtml(company.displayName || company.legalName || "MOXON Tech")}</h2>
      <ul class="info-list">
        <li><strong>Hotline:</strong> <a href="tel:${escapeHtml(company.phoneHref || company.phone || "")}">${escapeHtml(company.phone || "")}</a></li>
        <li><strong>Email:</strong> <a href="mailto:${escapeHtml(company.email || "")}">${escapeHtml(company.email || "")}</a></li>
        <li><strong>Website:</strong> <a href="${escapeHtml(company.websiteUrl || "#")}" target="_blank" rel="noopener">${escapeHtml(company.website || company.websiteUrl || "")}</a></li>
        <li><strong>&#272;&#7883;a ch&#7881;:</strong> ${escapeHtml(company.address || "")}</li>
        <li><strong>Ng&#432;&#7901;i li&#234;n h&#7879;/&#273;&#7841;i di&#7879;n:</strong> ${escapeHtml(company.representative || "")}</li>
      </ul>
      ${
        company.mapEmbed
          ? `<div class="map-embed contact-map" aria-label="B&#7843;n &#273;&#7891; v&#7883; tr&#237; MOXON">
              <iframe
                title="B&#7843;n &#273;&#7891; v&#7883; tr&#237; MOXON"
                src="${escapeHtml(company.mapEmbed)}"
                loading="lazy"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </div>`
          : ""
      }
      ${
        company.mapLink
          ? `<a class="footer-map-button contact-map-button" href="${escapeHtml(company.mapLink)}" target="_blank" rel="noopener">M&#7903; Google Maps</a>`
          : ""
      }
    `;
  };

  const renderAboutPage = () => {
    const aboutPage = data.aboutPage || {};
    const list = document.querySelector(".about-company-list");
    const heroSection = document.querySelector(".about-hero-section");
    const valuesSection = document.querySelector(".about-values-section");

    if (heroSection) {
      const heroKicker = text(aboutPage.heroKicker || "Về chúng tôi");
      const heroTitle = text(aboutPage.heroTitle || data.company?.legalName || data.company?.displayName || "MOXON Tech");
      const heroIntro = text(aboutPage.heroIntro || "MOXON TECH là doanh nghiệp hoạt động trong lĩnh vực cơ khí chính xác, khuôn mẫu, Jig/Fixture, gia công CNC và tự động hóa công nghiệp.");
      const paragraphs = (Array.isArray(aboutPage.heroParagraphs) ? aboutPage.heroParagraphs : text(aboutPage.heroParagraphs).split(/\n+/))
        .map((line) => text(line).trim())
        .filter(Boolean);
      const heroImages = normalizeAboutItems(aboutPage.heroImages).filter((item) => item.image).slice(0, 3);
      const collageHtml = heroImages.length
        ? heroImages.map((item) => `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title || "MOXON")}" loading="eager" fetchpriority="high" decoding="async">`).join("")
        : `
          <img src="assets/optimized/product-injection-mold.jpg" alt="Khuôn mẫu chính xác" loading="eager" fetchpriority="high" decoding="async">
          <img src="assets/optimized/project-workshop-equipment.jpg" alt="Xưởng sản xuất MOXON" loading="eager" fetchpriority="high" decoding="async">
          <img src="assets/optimized/project-cnc-parts.jpg" alt="Chi tiết cơ khí CNC" loading="eager" fetchpriority="high" decoding="async">
        `;
      heroSection.innerHTML = `
        <div class="about-hero-copy">
          <p class="section-kicker">${escapeHtml(heroKicker)}</p>
          <h1>${escapeHtml(heroTitle)}</h1>
          <span class="about-title-line" aria-hidden="true"></span>
          <p>${escapeHtml(heroIntro)}</p>
          ${paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        </div>
        <div class="about-hero-collage" aria-label="Hình ảnh năng lực MOXON">
          ${collageHtml}
        </div>
      `;
    }

    if (valuesSection) {
      const values = parseAboutListItems(aboutPage.values);
      if (values.length) {
        valuesSection.innerHTML = values
          .map(
            (item, index) => `
              <article class="about-value-card">
                <div class="about-value-top">
                  <span class="about-card-icon ${index % 2 === 1 ? "green" : ""}">${String(index + 1).padStart(2, "0")}</span>
                  <h2>${escapeHtml(item.title || "")}</h2>
                </div>
                <p>${escapeHtml(item.text || "")}</p>
              </article>
            `
          )
          .join("");
      }
    }

    const capabilityGrid = document.querySelector(".about-capability-grid");
    const capabilities = normalizeAboutItems(aboutPage.capabilities);
    if (capabilityGrid && capabilities.length) {
      capabilityGrid.innerHTML = capabilities
        .map(
          (item, index) => `
            <article class="about-capability-card">
              <div class="about-card-top"><span>${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(item.title)}</h3></div>
              <p>${escapeHtml(item.text)}</p>
              ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title)}" loading="lazy" decoding="async">` : ""}
            </article>
          `
        )
        .join("");
    }

    const processList = document.querySelector(".about-process-list");
    const processSteps = normalizeAboutItems(aboutPage.processSteps);
    if (processList && processSteps.length) {
      const icons = [
        '<path d="M4 12a7 7 0 0 1 7-7h2a7 7 0 0 1 0 14h-1l-4 3v-3a7 7 0 0 1-4-7z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
        '<path d="M4 20h16"/><path d="M5 4h8v6H5z"/><path d="M15 5l4 4-8 8H7v-4z"/>',
        '<path d="M4 20h16"/><path d="M6 17V9l6-4 6 4v8"/><path d="M9 17v-5h6v5"/><path d="M8 8l8 8M16 8l-8 8"/>',
        '<path d="M9 4h6l1 2h3v14H5V6h3z"/><path d="M9 14l2 2 4-5"/>'
      ];
      processList.innerHTML = processSteps
        .map(
          (item, index) => `
            <article>
              <span class="about-step-number">${String(index + 1).padStart(2, "0")}</span>
              <span class="about-step-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[index % icons.length]}</svg></span>
              <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div>
              <span class="about-step-arrow" aria-hidden="true">&#8250;</span>
            </article>
          `
        )
        .join("");
    }

    if (!list || !data.company) return;

    const company = data.company;
    const rows = [
      { label: "T&#234;n ph&#225;p nh&#226;n", value: company.legalName || company.displayName || "MOXON Tech" },
      { label: "M&#227; s&#7889; thu&#7871;", value: company.taxCode },
      { label: "&#272;&#7883;a ch&#7881;", value: company.address },
      { label: "Email", value: company.email },
      { label: "Website", value: company.website || company.websiteUrl },
      { label: "Ng&#432;&#7901;i &#273;&#7841;i di&#7879;n", value: company.representative }
    ].filter((item) => text(item.value).trim());

    if (!rows.length) return;

    const icons = [
      '<path d="M4 21V7l8-4 8 4v14"/><path d="M9 21v-7h6v7"/><path d="M8 9h.01M12 9h.01M16 9h.01"/>',
      '<path d="M7 3h10l3 3v15H7z"/><path d="M17 3v4h4"/><path d="M10 12h7M10 16h5M10 8h2"/>',
      '<path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
      '<path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/>',
      '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>',
      '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>'
    ];

    list.innerHTML = rows
      .map(
        (item, index) => `
          <div>
            <span class="about-company-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="about-company-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[index % icons.length]}</svg></span>
            <div><strong>${item.label}</strong><p>${escapeHtml(item.value)}</p></div>
          </div>
        `
      )
      .join("");

    const heroTitle = document.querySelector(".about-hero-copy h1");
    if (heroTitle && (company.legalName || company.displayName)) {
      heroTitle.textContent = company.legalName || company.displayName;
    }
  };

  const renderAll = () => {
    const nextData = window.MOXON_DATA || data || {};
    let signature = "";
    try {
      signature = `${getDataState()}:${JSON.stringify(nextData)}`;
    } catch {
      signature = String(Date.now());
    }
    if (signature && signature === lastRenderSignature) return;
    lastRenderSignature = signature;
    data = nextData;
    refreshDerivedData();
    renderHomeBanners();
    renderPartners();
    renderHomeProductSidebarMenu();
    renderProductsPage();
    renderHomeProductCategorySelect();
    renderHomeProductRows();
    renderHomeNews();
    renderNewsPage();
    renderServicesPage();
    renderRecruitmentPage();
    renderContactPage();
    renderAboutPage();
    document.dispatchEvent(new CustomEvent("moxon:content-rendered"));
  };

  const finishRender = (nextData) => {
    if (nextData) {
      data = nextData;
      window.MOXON_DATA = nextData;
    }
    renderAll();
    document.body?.removeAttribute("data-cms-loading");
  };

  if (window.MOXON_SUPABASE_DATA_READY) {
    window.MOXON_SUPABASE_DATA_READY
      .then((nextData) => {
        finishRender(nextData || window.MOXON_DATA || data);
      })
      .catch((error) => {
        console.warn("Khong cap nhat duoc du lieu Supabase, hien thi du lieu fallback.", error);
        finishRender(window.MOXON_DATA || data);
      });
  } else {
    finishRender(window.MOXON_DATA || data);
  }
})();
