/**
 * MOXON Tech - Main Script
 * Handles contact forms, product filtering, details modal, and quotation pre-fills.
 */

document.addEventListener("DOMContentLoaded", () => {
  const setupVietnameseValidationMessages = () => {
    const messages = {
      phoneRequired: "Vui l\u00f2ng nh\u1eadp s\u1ed1 \u0111i\u1ec7n tho\u1ea1i.",
      phoneInvalid: "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i ch\u01b0a \u0111\u00fang. V\u00ed d\u1ee5: 0988 440 436 ho\u1eb7c +84 988 440 436.",
      emailInvalid: "Email ch\u01b0a \u0111\u00fang \u0111\u1ecbnh d\u1ea1ng. V\u00ed d\u1ee5: moxontech.vn@gmail.com."
    };

    document.querySelectorAll("input[type='tel']").forEach((input) => {
      const updatePhoneMessage = () => {
        input.setCustomValidity("");
        if (input.validity.valueMissing) {
          input.setCustomValidity(messages.phoneRequired);
          return;
        }
        if (input.validity.patternMismatch) {
          input.setCustomValidity(messages.phoneInvalid);
        }
      };

      input.addEventListener("invalid", updatePhoneMessage);
      input.addEventListener("input", updatePhoneMessage);
      input.addEventListener("blur", updatePhoneMessage);
    });

    document.querySelectorAll("input[type='email']").forEach((input) => {
      const updateEmailMessage = () => {
        input.setCustomValidity("");
        if (input.validity.typeMismatch) {
          input.setCustomValidity(messages.emailInvalid);
        }
      };

      input.addEventListener("invalid", updateEmailMessage);
      input.addEventListener("input", updateEmailMessage);
      input.addEventListener("blur", updateEmailMessage);
    });
  };

  setupVietnameseValidationMessages();

  const addManagedActivityLog = async ({ action, target, detail, actorName, actorRole, actorEmail }) => {
    const client = window.MOXON_SUPABASE_CLIENT || null;
    if (!client) return;

    const { error } = await client.from("admin_activity_logs").insert({
      id: `public-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      target,
      detail,
      actor_name: actorName || "Khách hàng",
      actor_role: actorRole || "Khách truy cập",
      actor_email: actorEmail || "",
      actor_avatar: "",
      created_at: new Date().toISOString()
    });

    if (error) {
      console.warn("Không lưu được nhật ký public form vào Supabase.", error);
    }
  };

  const safeFileName = (name) =>
    String(name || "tep-dinh-kem")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0111/g, "d")
      .replace(/\u0110/g, "D")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "tep-dinh-kem";

  const uploadMessageAttachment = async (client, file, type, messageId, fieldName) => {
    const bucket = window.MOXON_SUPABASE_CONFIG?.privateBucket || window.MOXON_SUPABASE_CONFIG?.mediaBucket || "moxon-media";
    const path = `contact-attachments/${type}/${messageId}/${Date.now()}-${fieldName}-${safeFileName(file.name)}`;
    const { error } = await client.storage.from(bucket).upload(path, file, {
      cacheControl: "31536000",
      upsert: false
    });
    if (error) throw error;

    return {
      path
    };
  };

  const saveManagedMessage = async (form, type) => {
    const formData = new FormData(form);
    const fields = {};
    const client = window.MOXON_SUPABASE_CLIENT || null;
    const messageId = `${type}-${Date.now()}`;

    if (!client) {
      throw new Error("Kh\u00f4ng k\u1ebft n\u1ed1i \u0111\u01b0\u1ee3c h\u1ec7 th\u1ed1ng l\u01b0u d\u1eef li\u1ec7u. Vui l\u00f2ng th\u1eed l\u1ea1i sau ho\u1eb7c li\u00ean h\u1ec7 tr\u1ef1c ti\u1ebfp qua hotline.");
    }

    formData.forEach((value, key) => {
      if (key.startsWith("_")) return;
      fields[key] = value instanceof File ? value.name : value;
    });

    const fileInputs = Array.from(form.querySelectorAll("input[type='file']"));
    await Promise.all(fileInputs.map(async (fileInput) => {
      const name = fileInput.name;
      const file = fileInput.files?.[0];
      if (!name || !file) return;

      fields[name] = file.name;
      if (client) {
        try {
          const uploaded = await uploadMessageAttachment(client, file, type, messageId, name);
          fields[name + "Data"] = uploaded.path;
          fields[name + "Path"] = uploaded.path;
          return;
        } catch (error) {
          console.warn("Khong upload duoc tep len Supabase Storage.", error);
          throw new Error("Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c t\u1ec7p \u0111\u00ednh k\u00e8m. Vui l\u00f2ng th\u1eed l\u1ea1i ho\u1eb7c g\u1eedi form kh\u00f4ng k\u00e8m t\u1ec7p.");
        }
      }
      throw new Error("Không tải được tệp đính kèm. Vui lòng thử lại hoặc gửi form không kèm tệp.");
    }));

    const attachmentFile = fields.attachment || fields.cv || "";
    const attachmentData = fields.attachmentData || fields.cvData || "";

    const messageRecord = {
      id: messageId,
      type,
      title: type === "application" ? "Th\u00f4ng tin \u1ee9ng tuy\u1ec3n m\u1edbi" : "Y\u00eau c\u1ea7u t\u01b0 v\u1ea5n m\u1edbi",
      name: fields.name || fields.ho_ten || "",
      phone: fields.phone || fields.dien_thoai || "",
      email: fields.email || "",
      company: fields.company || "",
      service: fields.service || fields.vi_tri || "",
      message: fields.message || fields.gioi_thieu || "",
      attachment: attachmentFile,
      attachmentData,
      rawFields: fields,
      createdAt: new Date().toISOString(),
      active: true,
      sortOrder: 0
    };

    const { error } = await client.from("contact_messages").insert({
      id: messageRecord.id,
      type: messageRecord.type,
      title: messageRecord.title,
      name: messageRecord.name,
      phone: messageRecord.phone,
      email: messageRecord.email,
      company: messageRecord.company,
      service: messageRecord.service,
      message: messageRecord.message,
      attachment: messageRecord.attachment,
      attachment_data: messageRecord.attachmentData,
      raw_fields: messageRecord.rawFields,
      seen: false,
      active: true,
      sort_order: messageRecord.sortOrder,
      created_at: messageRecord.createdAt
    });

    if (error) {
      console.warn("Không lưu được liên hệ vào Supabase.", error);
      throw new Error("Kh\u00f4ng g\u1eedi \u0111\u01b0\u1ee3c th\u00f4ng tin l\u00ean h\u1ec7 th\u1ed1ng. Vui l\u00f2ng th\u1eed l\u1ea1i sau ho\u1eb7c li\u00ean h\u1ec7 tr\u1ef1c ti\u1ebfp qua hotline.");
    }

    await addManagedActivityLog({
      action: "Gửi mới",
      target: type === "application" ? "Ứng tuyển" : "Liên hệ",
      detail: messageRecord.name || messageRecord.email || messageRecord.phone || messageRecord.title,
      actorName: messageRecord.name || "Khách hàng",
      actorRole: type === "application" ? "Ứng viên" : "Khách liên hệ",
      actorEmail: messageRecord.email
    });
  };

  // 1. Form Submission Feedback Handling
  const params = new URLSearchParams(window.location.search);
  const statusEl = document.querySelector("[data-form-status]");

  if (statusEl) {
    if (params.get("sent") === "1") {
      statusEl.textContent = "C\u1ea3m \u01a1n b\u1ea1n. MOXON \u0111\u00e3 ti\u1ebfp nh\u1eadn th\u00f4ng tin li\u00ean h\u1ec7 t\u01b0 v\u1ea5n.";
      statusEl.style.display = "block";
      statusEl.className = "form-status success";
      statusEl.scrollIntoView({ behavior: "smooth", block: "center" });
      window.history.replaceState({}, "", window.location.pathname + "#contact-form");
    } else if (params.get("applied") === "1") {
      statusEl.textContent = "MOXON \u0111\u00e3 ti\u1ebfp nh\u1eadn th\u00f4ng tin \u1ee9ng tuy\u1ec3n c\u1ee7a b\u1ea1n.";
      statusEl.style.display = "block";
      statusEl.className = "form-status success";
      statusEl.scrollIntoView({ behavior: "smooth", block: "center" });
      window.history.replaceState({}, "", window.location.pathname + "#apply");
    }
  }

  const normalizePhone = (value) => String(value || "").replace(/[\s.\-()]/g, "");
  const isValidVietnamPhone = (value) => {
    const phone = normalizePhone(value);
    return /^0\d{9,10}$/.test(phone) || /^\+84\d{9,10}$/.test(phone);
  };
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
  const showFormError = (form, message, targetInput) => {
    const formStatus = form.querySelector("[data-form-status]");
    if (formStatus) {
      formStatus.textContent = message;
      formStatus.style.display = "block";
      formStatus.className = "form-status error";
    }
    if (targetInput) {
      targetInput.focus();
      targetInput.setCustomValidity(message);
      targetInput.reportValidity();
      setTimeout(() => targetInput.setCustomValidity(""), 1000);
    }
  };
  const showFormSuccess = (form, message) => {
    const formStatus = form.querySelector("[data-form-status]");
    if (formStatus) {
      formStatus.textContent = message;
      formStatus.style.display = "block";
      formStatus.className = "form-status success";
      formStatus.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  document.querySelectorAll("input[type='tel']").forEach((input) => {
    input.addEventListener("input", () => {
      input.setCustomValidity("");
    });
    input.addEventListener("blur", () => {
      if (input.value.trim() && !isValidVietnamPhone(input.value)) {
        input.setCustomValidity("Vui l\u00f2ng nh\u1eadp s\u1ed1 \u0111i\u1ec7n tho\u1ea1i Vi\u1ec7t Nam h\u1ee3p l\u1ec7.");
        input.reportValidity();
      } else {
        input.setCustomValidity("");
      }
    });
  });

  document.querySelectorAll("input[type='email']").forEach((input) => {
    input.addEventListener("input", () => {
      input.setCustomValidity("");
    });
    input.addEventListener("blur", () => {
      if (input.value.trim() && !isValidEmail(input.value)) {
        input.setCustomValidity("Vui l\u00f2ng nh\u1eadp email \u0111\u00fang \u0111\u1ecbnh d\u1ea1ng.");
        input.reportValidity();
      } else {
        input.setCustomValidity("");
      }
    });
  });

  // Double check submit state
  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      const phoneInput = form.querySelector("input[type='tel']");
      const emailInput = form.querySelector("input[type='email']");
      const isManagedForm = form.matches("#quote") || form.matches("#apply-form");
      const button = form.querySelector("button[type='submit']");
      const originalButtonText = button?.textContent || "";
      const phoneValue = phoneInput?.value.trim() || "";
      const emailValue = emailInput?.value.trim() || "";

      if (isManagedForm && !phoneValue && !emailValue) {
        event.preventDefault();
        showFormError(form, "Vui lòng nhập số điện thoại hoặc email để MOXON liên hệ lại.", phoneInput || emailInput);
        return;
      }

      if (phoneInput && phoneValue && !isValidVietnamPhone(phoneValue)) {
        event.preventDefault();
        showFormError(form, "Vui l\u00f2ng nh\u1eadp s\u1ed1 \u0111i\u1ec7n tho\u1ea1i Vi\u1ec7t Nam h\u1ee3p l\u1ec7.", phoneInput);
        return;
      }

      if (emailInput && emailValue && !isValidEmail(emailValue)) {
        event.preventDefault();
        showFormError(form, "Vui l\u00f2ng nh\u1eadp email \u0111\u00fang \u0111\u1ecbnh d\u1ea1ng.", emailInput);
        return;
      }

      if (isManagedForm) {
        event.preventDefault();
        form.classList.add("is-submitting");
        if (button) {
          button.textContent = "\u0110ang g\u1eedi...";
          button.setAttribute("disabled", "true");
        }
        try {
          await saveManagedMessage(form, form.matches("#apply-form") ? "application" : "contact");
        } catch (error) {
          if (button) {
            button.textContent = originalButtonText || "G\u1eedi";
            button.removeAttribute("disabled");
          }
          form.classList.remove("is-submitting");
          showFormError(form, error.message || "Kh\u00f4ng l\u01b0u \u0111\u01b0\u1ee3c t\u1ec7p \u0111\u00ednh k\u00e8m.", form.querySelector("input[type='file']"));
          return;
        }

        if (button) {
          button.textContent = "\u0110\u00e3 g\u1eedi";
          button.setAttribute("disabled", "true");
        }
        showFormSuccess(
          form,
          form.matches("#apply-form")
            ? "MOXON \u0111\u00e3 ti\u1ebfp nh\u1eadn th\u00f4ng tin \u1ee9ng tuy\u1ec3n c\u1ee7a b\u1ea1n."
            : "C\u1ea3m \u01a1n b\u1ea1n. MOXON \u0111\u00e3 ti\u1ebfp nh\u1eadn th\u00f4ng tin li\u00ean h\u1ec7 t\u01b0 v\u1ea5n."
        );
        form.reset();
        setTimeout(() => {
          if (button) {
            button.textContent = originalButtonText || "G\u1eedi";
            button.removeAttribute("disabled");
          }
          form.classList.remove("is-submitting");
        }, 1800);
        return;
      }
    });
  });

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

  // 4. Quotation Pre-fill (contact.html)
  const rfqParam = params.get("quote");
  const messageTextarea = document.querySelector("textarea[name='message']");

  if (rfqParam && messageTextarea) {
    messageTextarea.value = `Tôi cần tư vấn kỹ thuật và nhận báo giá chi tiết cho sản phẩm: ${decodeURIComponent(rfqParam)}.\nXin cảm ơn!`;
    // Scroll to form smoothly
    const contactForm = document.getElementById("quote");
    if (contactForm) {
      setTimeout(() => {
        contactForm.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }
});

/* ============================================================
   SITE ANIMATION ENGINE
   Scroll reveal, page hero entrance, hover depth, and counters.
   ============================================================ */
(function initAnimations() {
  const isHomePage = document.body.dataset.page === "home";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    document.body.classList.add("reduce-motion");
    return;
  }

  if (!isHomePage) {
    document.body.classList.add("animations-ready");
  }

  const pageHero = document.querySelector(".page-hero");
  if (pageHero) {
    requestAnimationFrame(() => pageHero.classList.add("is-visible"));
  }

  const hero = document.querySelector(".hero");
  if (hero && !hero.querySelector(".hero-particles")) {
    const particles = document.createElement("div");
    particles.className = "hero-particles";
    particles.setAttribute("aria-hidden", "true");

    for (let i = 0; i < 6; i += 1) {
      const particle = document.createElement("span");
      particle.className = "particle";
      particles.appendChild(particle);
    }

    hero.appendChild(particles);
  }

  const autoRevealSelectors = [
    ".page-hero > div",
    ".section-title",
    ".intro-main",
    ".intro-card",
    ".content-card",
    ".service-card",
    ".detail-card",
    ".project-card",
    ".product-group-header",
    ".product-item",
    ".why-card",
    ".metric-card",
    ".process-step",
    ".capability-note",
    ".equipment-table-wrap",
    ".contact-info-panel",
    ".quote-form",
    ".contact-map",
    ".cta-band",
    ".corporate-page-sidebar .sidebar-widget",
    ".corporate-intro-panel",
    ".corporate-section-block",
    ".services-overview-grid",
    ".service-list-panel"
  ];

  autoRevealSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el, index) => {
      if (el.closest(".hero")) return;

      el.classList.add("reveal-fade-up");

      if (!el.style.getPropertyValue("--delay")) {
        el.style.setProperty("--delay", `${Math.min((index % 6) * 80, 400)}ms`);
      }
    });
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll(".reveal-fade-up:not(.hero *)").forEach((el) => {
    revealObserver.observe(el);
  });

  const metricObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.style.getPropertyValue("--delay") || "0", 10);
          setTimeout(() => entry.target.classList.add("is-visible"), delay + 50);
          metricObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  document.querySelectorAll(".metric-card").forEach((card) => {
    metricObserver.observe(card);
  });

  const processObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          processObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25 }
  );

  document.querySelectorAll(".process-step").forEach((step) => {
    processObserver.observe(step);
  });

  const titleObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          titleObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll(".section-title").forEach((title) => {
    titleObserver.observe(title);
  });

  const whyObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          whyObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".why-card").forEach((card) => {
    whyObserver.observe(card);
  });

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const countTo = parseInt(el.getAttribute("data-count-to"), 10);
        if (isNaN(countTo) || countTo <= 0) return;

        const prefix = el.getAttribute("data-prefix") || "";
        let current = 0;
        const duration = 1200;
        const stepTime = Math.max(16, Math.floor(duration / countTo));

        const timer = setInterval(() => {
          current += 1;
          el.textContent = prefix + current;
          if (current >= countTo) {
            el.textContent = prefix + countTo;
            clearInterval(timer);
          }
        }, stepTime);

        counterObserver.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll("[data-count-to]").forEach((el) => {
    counterObserver.observe(el);
  });

  const animateCompactNumber = (el) => {
    if (!el || el.dataset.countAnimated === "true") return;
    const raw = (el.dataset.countTo || el.textContent || "").trim();
    const match = raw.match(/^(\D*)(\d+)(\D*)$/);
    if (!match) return;

    el.dataset.countAnimated = "true";
    const [, prefix, digits, suffix] = match;
    const target = Number(digits);
    const width = digits.length;
    if (!Number.isFinite(target) || target <= 0 || target > 9999) return;

    const duration = Math.min(760, Math.max(360, target * 80));
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = `${prefix}${String(value).padStart(width, "0")}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const initTechnicalSequenceMotion = () => {
    document.querySelectorAll("body[data-page='about'] .about-process-list").forEach((list) => {
      list.classList.add("is-motion-ready");
    });

    const sequenceItems = [
      ...document.querySelectorAll("body[data-page='about'] .about-value-card"),
      ...document.querySelectorAll("body[data-page='about'] .about-capability-card"),
      ...document.querySelectorAll("body[data-page='about'] .about-process-list article"),
      ...document.querySelectorAll("body[data-page='about'] .about-company-list > div"),
      ...document.querySelectorAll(".metric-card")
    ];

    sequenceItems.forEach((item, index) => {
      if (item.dataset.motionReady === "true") return;
      item.dataset.motionReady = "true";
      item.classList.add("moxon-sequence-item");
      item.style.setProperty("--sequence-delay", `${Math.min(index * 55, 420)}ms`);
    });

    const sequenceObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          entry.target.closest(".about-process-list")?.classList.add("is-motion-active");
          sequenceObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -36px 0px" }
    );

    sequenceItems.forEach((item) => {
      if (item.dataset.sequenceObserveReady === "true") return;
      item.dataset.sequenceObserveReady = "true";
      sequenceObserver.observe(item);
    });

    const animatedNumbers = document.querySelectorAll(
      [
        ".metric-number:not([data-count-to])",
        "body[data-page='about'] .about-card-icon",
        "body[data-page='about'] .about-card-top > span",
        "body[data-page='about'] .about-step-number",
        "body[data-page='about'] .about-company-number"
      ].join(",")
    );

    const numberObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCompactNumber(entry.target);
          numberObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.45 }
    );

    animatedNumbers.forEach((el) => {
      if (el.dataset.countObserveReady === "true") return;
      el.dataset.countObserveReady = "true";
      numberObserver.observe(el);
    });
  };

  initTechnicalSequenceMotion();
  document.addEventListener("moxon:content-rendered", initTechnicalSequenceMotion);

  const initHomeProductAutoScroll = () => {
    if (!isHomePage) return;

    const rows = Array.from(document.querySelectorAll(".product-row-grid-scrollable"));
    if (!rows.length) return;

    rows.forEach((row, index) => {
      if (row.dataset.autoScrollReady === "true") return;
      row.dataset.autoScrollReady = "true";

      let isPaused = false;
      let resumeTimer = 0;
      const delay = 2800 + index * 360;

      const pauseBriefly = () => {
        isPaused = true;
        window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => {
          isPaused = false;
        }, 3600);
      };
      row.__moxonPauseAutoScroll = pauseBriefly;

      const getStep = () => {
        const firstCard = row.querySelector(".product-item-card");
        if (!firstCard) return Math.max(180, row.clientWidth * 0.72);
        const styles = window.getComputedStyle(row);
        const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
        return firstCard.getBoundingClientRect().width + gap;
      };

      const moveNext = () => {
        if (!row.isConnected) return;
        if (isPaused || document.hidden) return;
        const maxScroll = row.scrollWidth - row.clientWidth;
        if (maxScroll <= 8) return;

        const nextLeft = row.scrollLeft + getStep();
        if (nextLeft >= maxScroll - 8) {
          row.scrollTo({ left: 0, behavior: "smooth" });
          return;
        }
        row.scrollBy({ left: getStep(), behavior: "smooth" });
      };

      row.addEventListener("pointerdown", pauseBriefly, { passive: true });
      row.addEventListener("wheel", pauseBriefly, { passive: true });
      row.addEventListener("mouseenter", () => {
        isPaused = true;
      });
      row.addEventListener("mouseleave", () => {
        pauseBriefly();
      });

      window.clearInterval(row.__moxonAutoScrollTimer);
      row.__moxonAutoScrollTimer = window.setInterval(moveNext, delay);
      window.setTimeout(moveNext, 900 + index * 180);
    });
  };

  const initHomeBrandAutoScroll = () => {
    if (!isHomePage) return;

    const grid = document.querySelector(".brand-logo-grid");
    if (!grid || grid.dataset.autoScrollReady === "true") return;
    grid.dataset.autoScrollReady = "true";

    let isPaused = false;
    let resumeTimer = 0;

    const pauseBriefly = () => {
      isPaused = true;
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        isPaused = false;
      }, 3600);
    };

    const getStep = () => {
      const firstCard = grid.querySelector(".brand-logo-card");
      if (!firstCard) return Math.max(120, grid.clientWidth * 0.5);
      const styles = window.getComputedStyle(grid);
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return firstCard.getBoundingClientRect().width + gap;
    };

      const moveNext = () => {
      if (!grid.isConnected) return;
      if (isPaused || document.hidden) return;
      const maxScroll = grid.scrollWidth - grid.clientWidth;
      if (maxScroll <= 8) return;

      const nextLeft = grid.scrollLeft + getStep();
      if (nextLeft >= maxScroll - 8) {
        grid.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      grid.scrollBy({ left: getStep(), behavior: "smooth" });
    };

    grid.addEventListener("pointerdown", pauseBriefly, { passive: true });
    grid.addEventListener("wheel", pauseBriefly, { passive: true });
    grid.addEventListener("mouseenter", () => {
      isPaused = true;
    });
    grid.addEventListener("mouseleave", pauseBriefly);

    window.setInterval(moveNext, 2600);
  };

  // Auto-scroll slideshow logic for Hero Banner
  const initHeroSlideshow = () => {
    const heroBanner = document.getElementById("hero-banner");
    if (!heroBanner || heroBanner.dataset.heroSlideshowReady === "true") return;
    const slides = document.querySelectorAll("#hero-banner .hero-slide");
    const dots = document.querySelectorAll("#hero-banner .hero-banner-dot");
    if (slides.length <= 1) return;
    heroBanner.dataset.heroSlideshowReady = "true";
    if (heroBanner.__moxonSlideTimer) {
      window.clearInterval(heroBanner.__moxonSlideTimer);
      heroBanner.__moxonSlideTimer = 0;
    }

    let currentSlide = 0;
    let slideTimer;

    const syncBannerRatio = (slideIndex = currentSlide) => {
      const activeImage = slides[slideIndex]?.querySelector("img");
      if (!heroBanner || !activeImage) return;

      const applyRatio = () => {
        if (!activeImage.naturalWidth || !activeImage.naturalHeight) return;
        heroBanner.style.setProperty(
          "--hero-banner-ratio",
          `${activeImage.naturalWidth} / ${activeImage.naturalHeight}`
        );
      };

      if (activeImage.complete) {
        applyRatio();
      } else {
        activeImage.addEventListener("load", applyRatio, { once: true });
      }
    };

    const setSlide = (nextSlide) => {
      if (nextSlide === currentSlide) return;

      const previousSlide = currentSlide;
      slides[previousSlide].classList.remove("active");
      slides[previousSlide].classList.add("previous");
      if (dots[currentSlide]) dots[currentSlide].classList.remove("active");

      currentSlide = nextSlide;

      slides[currentSlide].classList.remove("previous");
      slides[currentSlide].classList.add("active");
      if (dots[currentSlide]) dots[currentSlide].classList.add("active");
      syncBannerRatio(currentSlide);

      window.setTimeout(() => {
        slides[previousSlide].classList.remove("previous");
      }, 900);
    };

    const changeSlide = () => {
      setSlide((currentSlide + 1) % slides.length);
    };

    const restartTimer = () => {
      window.clearInterval(slideTimer);
      slideTimer = window.setInterval(changeSlide, 5000);
      heroBanner.__moxonSlideTimer = slideTimer;
    };

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        if (index === currentSlide) return;
        setSlide(index);
        restartTimer();
      });
    });

    syncBannerRatio(currentSlide);
    restartTimer();
  };
  initHeroSlideshow();
  initHomeProductAutoScroll();
  initHomeBrandAutoScroll();
  document.addEventListener("moxon:content-rendered", () => {
    initHeroSlideshow();
    initHomeProductAutoScroll();
    initHomeBrandAutoScroll();
  });
})();

window.scrollRow = (rowId, direction) => {
  const container = document.getElementById(rowId);
  if (!container) return;
  const scrollAmount = container.clientWidth * 0.75;
  container.scrollBy({
    left: direction === "left" ? -scrollAmount : scrollAmount,
    behavior: "smooth"
  });
};

