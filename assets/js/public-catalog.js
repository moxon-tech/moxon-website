/**
 * MOXON Tech - Public Catalog
 * Handles product filtering, product detail modal, and dynamic catalog updates.
 */

document.addEventListener("DOMContentLoaded", () => {
  // 2. Interactive Product Filtering (products.html)
  const filterBtns = document.querySelectorAll(".filter-btn");
  const productGroups = document.querySelectorAll(".product-group-section");

  if (filterBtns.length > 0 && productGroups.length > 0) {
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Set active button style
        filterBtns.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");

        const filterValue = btn.getAttribute("data-filter");

        // Show / Hide corresponding product group sections
        productGroups.forEach((group) => {
          const category = group.getAttribute("data-category");
          if (filterValue === "all" || category === filterValue) {
            group.classList.remove("is-hidden");
            // Trigger visual fade in
            group.style.opacity = "0";
            group.style.transform = "translateY(10px)";
            setTimeout(() => {
              group.style.opacity = "1";
              group.style.transform = "translateY(0)";
              group.style.transition = "opacity 0.4s ease, transform 0.4s ease";
            }, 50);
          } else {
            group.classList.add("is-hidden");
          }
        });
      });
    });
  }

  // Product catalog search (products.html)
  const productSearchInput = document.getElementById("product-search-input");
  const catalogProductCards = document.querySelectorAll(".catalog-product-card");
  const catalogEmpty = document.querySelector("[data-product-empty]");
  const catalogCategoryBtns = document.querySelectorAll("[data-catalog-filter]");
  const catalogHeading = document.querySelector("[data-catalog-heading]");
  const catalogKicker = document.querySelector("[data-catalog-kicker]");
  const catalogToolbar = document.querySelector("[data-catalog-toolbar]");

  if (productSearchInput && catalogProductCards.length > 0) {
    let activeCatalogCategory = "all";
    const managedCategories = Array.isArray(window.MOXON_DATA?.productCategories)
      ? window.MOXON_DATA.productCategories.filter((category) => category.active !== false)
      : [];
    const categoryLabels = managedCategories.reduce(
      (labels, category) => {
        if (category.id && category.name) labels[category.id] = category.name;
        return labels;
      },
      { all: "T\u1ea5t c\u1ea3 s\u1ea3n ph\u1ea9m" }
    );

    const normalizeSearchText = (value) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\u0111/g, "d")
        .replace(/\u0110/g, "d");

    const runProductSearch = () => {
      const query = normalizeSearchText(productSearchInput.value.trim());
      let visibleCount = 0;

      catalogProductCards.forEach((card) => {
        const category = card.dataset.category || "";
        const matchCategory = activeCatalogCategory === "all" || category === activeCatalogCategory;
        const text = normalizeSearchText(
          [
            card.dataset.search || "",
            card.dataset.title || "",
            card.dataset.kicker || "",
            card.textContent || ""
          ].join(" ")
        );
        const matchSearch = query === "" || text.includes(query);
        const isVisible = matchCategory && matchSearch;

        card.hidden = !isVisible;
        card.classList.toggle("is-hidden", !isVisible);
        if (isVisible) visibleCount += 1;
      });

      if (catalogEmpty) {
        catalogEmpty.classList.toggle("is-visible", visibleCount === 0);
      }
    };

    const updateCatalogTitle = () => {
      const isAllProducts = activeCatalogCategory === "all";
      if (catalogHeading) {
        const activeButton = Array.from(catalogCategoryBtns).find(
          (button) => button.dataset.catalogFilter === activeCatalogCategory
        );
        catalogHeading.textContent =
          categoryLabels[activeCatalogCategory] || activeButton?.textContent?.trim() || "T\u1ea5t c\u1ea3 s\u1ea3n ph\u1ea9m";
      }
      if (catalogKicker) {
        catalogKicker.hidden = !isAllProducts;
        catalogKicker.style.display = isAllProducts ? "" : "none";
      }
      if (catalogToolbar) {
        catalogToolbar.classList.toggle("is-filtered", !isAllProducts);
      }
    };

    catalogCategoryBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCatalogCategory = btn.dataset.catalogFilter || "all";
        catalogCategoryBtns.forEach((item) => item.classList.remove("is-active"));
        btn.classList.add("is-active");
        productSearchInput.value = "";

        updateCatalogTitle();
        runProductSearch();
      });
    });

    productSearchInput.addEventListener("input", runProductSearch);
    updateCatalogTitle();
    runProductSearch();
  }

  // 3. Product Details Modal View (products.html)
  const modal = document.getElementById("product-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const productCards = document.querySelectorAll(".product-item");

  if (modal && productCards.length > 0) {
    const modalImg = document.getElementById("modal-img");
    const modalKicker = document.getElementById("modal-kicker");
    const modalTitle = document.getElementById("modal-title");
    const modalDesc = document.getElementById("modal-description");
    const modalQuoteBtn = document.getElementById("modal-quote-btn");

    productCards.forEach((card) => {
      if (card.querySelector(".product-detail-btn")) return;
      const contactBtn = card.querySelector(".price-contact");
      if (!contactBtn) return;
      const actions = document.createElement("div");
      actions.className = "catalog-product-actions";
      const detailBtn = document.createElement("button");
      detailBtn.className = "product-detail-btn";
      detailBtn.type = "button";
      detailBtn.textContent = "Chi tiết";
      contactBtn.parentNode.insertBefore(actions, contactBtn);
      actions.append(detailBtn, contactBtn);
    });

    productCards.forEach((card) => {
      card.addEventListener("click", (e) => {
        if (!e.target.closest(".product-detail-btn")) {
          return;
        }
        e.stopPropagation();

        const title = card.getAttribute("data-title");
        const kicker = card.getAttribute("data-kicker");
        const desc = card.getAttribute("data-desc");
        const img = card.getAttribute("data-img");

        // Populate modal content
        if (modalImg) modalImg.src = img || "";
        if (modalImg) modalImg.alt = title || "";
        if (modalKicker) modalKicker.textContent = kicker || "";
        if (modalTitle) modalTitle.textContent = title || "";
        if (modalDesc) modalDesc.textContent = desc || "";
        
        if (modalQuoteBtn) {
          modalQuoteBtn.href = `contact.html?quote=${encodeURIComponent(title)}#quote`;
        }

        // Open modal
        modal.classList.add("is-active");
        document.body.style.overflow = "hidden"; // Prevent background scroll
      });
    });

    // Close modal functions
    const closeModal = () => {
      modal.classList.remove("is-active");
      document.body.style.overflow = ""; // Restore background scroll
    };

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener("click", closeModal);
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Support escape key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-active")) {
        closeModal();
      }
    });
  }

  const initDynamicProductCatalog = () => {
    const catalogMenu = document.querySelector(".catalog-category-menu");
    const catalogGrid = document.querySelector(".catalog-product-grid");
    const searchInput = document.getElementById("product-search-input");
    const emptyState = document.querySelector("[data-product-empty]");
    const heading = document.querySelector("[data-catalog-heading]");
    const kicker = document.querySelector("[data-catalog-kicker]");
    const toolbar = document.querySelector("[data-catalog-toolbar]");
    const productModal = document.getElementById("product-modal");
    if (!catalogMenu || !catalogGrid) return;

    const getRequestedCategory = () => {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("category") || params.get("danh-muc") || "";
      const fromHash = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";
      const requested = fromQuery || fromHash;
      if (!requested) return "";
      const escaped = window.CSS?.escape ? window.CSS.escape(requested) : requested.replace(/"/g, '\\"');
      return catalogMenu.querySelector(`[data-catalog-filter="${escaped}"]`) ? requested : "";
    };

    let activeCategory =
      getRequestedCategory() ||
      catalogMenu.querySelector("[data-catalog-filter].is-active")?.dataset.catalogFilter ||
      "all";

    const normalizeSearchText = (value) =>
      String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\u0111/g, "d")
        .replace(/\u0110/g, "d");

    const getCategoryLabels = () => {
      const labels = { all: "Tất cả sản phẩm" };
      const categories = Array.isArray(window.MOXON_DATA?.productCategories) ? window.MOXON_DATA.productCategories : [];
      categories
        .filter((category) => category.active !== false)
        .forEach((category) => {
          if (category.id && category.name) labels[category.id] = category.name;
        });
      return labels;
    };

    const updateCatalogView = () => {
      const buttons = Array.from(catalogMenu.querySelectorAll("[data-catalog-filter]"));
      const cards = Array.from(catalogGrid.querySelectorAll(".catalog-product-card"));
      const query = normalizeSearchText(searchInput?.value || "");
      const categoryLabels = getCategoryLabels();
      let visibleCount = 0;

      buttons.forEach((button) => {
        button.classList.toggle("is-active", (button.dataset.catalogFilter || "all") === activeCategory);
      });

      cards.forEach((card) => {
        const category = card.dataset.category || "";
        const matchCategory = activeCategory === "all" || category === activeCategory;
        const searchableText = normalizeSearchText(
          [card.dataset.search, card.dataset.title, card.dataset.kicker, card.textContent].join(" ")
        );
        const matchSearch = !query || searchableText.includes(query);
        const isVisible = matchCategory && matchSearch;

        card.hidden = !isVisible;
        card.classList.toggle("is-hidden", !isVisible);
        if (isVisible) visibleCount += 1;
      });

      let visibleIndex = 0;
      cards.forEach((card) => {
        if (card.hidden || card.classList.contains("is-hidden")) return;
        card.style.setProperty("--product-motion-index", String(visibleIndex));
        card.classList.remove("is-filter-animated");
        window.requestAnimationFrame(() => card.classList.add("is-filter-animated"));
        visibleIndex += 1;
      });

      if (heading) {
        const activeButton = buttons.find((button) => (button.dataset.catalogFilter || "all") === activeCategory);
        heading.textContent = categoryLabels[activeCategory] || activeButton?.textContent?.trim() || "Tất cả sản phẩm";
      }
      if (kicker) {
        const isAll = activeCategory === "all";
        kicker.hidden = !isAll;
        kicker.style.display = isAll ? "" : "none";
      }
      if (toolbar) toolbar.classList.toggle("is-filtered", activeCategory !== "all");
      if (emptyState) emptyState.classList.toggle("is-visible", visibleCount === 0);
    };

    if (catalogMenu.dataset.dynamicCatalogReady !== "true") {
      catalogMenu.dataset.dynamicCatalogReady = "true";
      catalogMenu.addEventListener("click", (event) => {
        const button = event.target.closest("[data-catalog-filter]");
        if (!button) return;
        event.preventDefault();
        activeCategory = button.dataset.catalogFilter || "all";
        const nextUrl =
          activeCategory === "all"
            ? `${window.location.pathname}${window.location.hash && window.location.hash.startsWith("#") ? "" : ""}`
            : `${window.location.pathname}?category=${encodeURIComponent(activeCategory)}`;
        window.history.replaceState({}, "", nextUrl);
        if (searchInput) searchInput.value = "";
        updateCatalogView();
      });
    }

    if (searchInput && searchInput.dataset.dynamicCatalogReady !== "true") {
      searchInput.dataset.dynamicCatalogReady = "true";
      searchInput.addEventListener("input", updateCatalogView);
    }

    if (catalogGrid.dataset.dynamicModalReady !== "true") {
      catalogGrid.dataset.dynamicModalReady = "true";
      catalogGrid.addEventListener("click", (event) => {
        if (!event.target.closest(".product-detail-btn")) return;
        const card = event.target.closest(".catalog-product-card");
        if (!card || !productModal) return;

        const cardTitle = card.dataset.title || card.querySelector("h3")?.textContent?.trim() || "";
        const cardKicker = card.dataset.kicker || "";
        const cardDesc = card.dataset.desc || "";
        const cardImg = card.dataset.img || card.querySelector("img")?.getAttribute("src") || "";
        const modalImg = document.getElementById("modal-img");
        const modalKicker = document.getElementById("modal-kicker");
        const modalTitle = document.getElementById("modal-title");
        const modalDesc = document.getElementById("modal-description");
        const modalQuoteBtn = document.getElementById("modal-quote-btn");

        if (modalImg) {
          modalImg.src = cardImg;
          modalImg.alt = cardTitle;
        }
        if (modalKicker) modalKicker.textContent = cardKicker || "Sản phẩm";
        if (modalTitle) modalTitle.textContent = cardTitle;
        if (modalDesc) modalDesc.textContent = cardDesc;
        if (modalQuoteBtn) modalQuoteBtn.href = `contact.html?quote=${encodeURIComponent(cardTitle)}#quote`;

        productModal.classList.add("is-active");
        document.body.style.overflow = "hidden";
      });
    }

    activeCategory = getRequestedCategory() || activeCategory;
    updateCatalogView();
  };

  initDynamicProductCatalog();
  document.addEventListener("moxon:content-rendered", initDynamicProductCatalog);
});