(async function initMoxonAdmin() {
  const fallbackData = window.MOXON_DATA || {};
  const supabaseClient = window.MOXON_SUPABASE_CLIENT || null;
  const supabaseConfig = window.MOXON_SUPABASE_CONFIG || {};
  const remoteCatalogKeys = new Set(["productCategories", "products"]);
  const remoteCmsSectionKeys = new Set([
    "company",
    "brand",
    "aboutPage",
    "recruitmentNotice",
    "banners",
    "partners",
    "services",
    "news",
    "jobs"
  ]);
  const remoteSectionKeys = new Set([...remoteCatalogKeys, ...remoteCmsSectionKeys, "contactMessages"]);

  if (!supabaseClient) {
    window.location.href = "login.html";
    return;
  }

  let sessionData = null;
  try {
    const sessionResult = await supabaseClient.auth.getSession();
    sessionData = sessionResult.data;
  } catch (error) {
    document.body.innerHTML = `
      <main class="admin-login-shell">
        <section class="admin-login-panel">
          <p class="admin-kicker">MOXON CMS</p>
          <h1>Không kết nối được Supabase Auth</h1>
          <p class="admin-muted">${String(error?.message || "Vui lòng kiểm tra mạng hoặc cấu hình Supabase.")}</p>
          <a class="admin-primary-btn" href="login.html">Quay lại đăng nhập</a>
        </section>
      </main>
    `;
    return;
  }
  if (!sessionData?.session) {
    window.location.href = "login.html";
    return;
  }
  let currentAuthUser = sessionData.session.user || null;

  const sections = [
    { key: "overview", label: "Tổng quan", type: "dashboard", summary: "Dashboard" },
    { key: "company", label: "Công ty", type: "object", summary: "Thông tin" },
    { key: "brand", label: "Nhận diện", type: "object", summary: "Kênh" },
    { key: "aboutPage", label: "Trang giới thiệu", type: "object", summary: "Nội dung" },
    { key: "recruitmentNotice", label: "Thông báo tuyển dụng", type: "object", summary: "Nội dung" },
    { key: "banners", label: "Banner", type: "array", summary: "banner" },
    { key: "partners", label: "Thương hiệu", type: "array", summary: "Đối tác" },
    { key: "productCategories", label: "Danh mục", type: "array", summary: "Nhóm" },
    { key: "products", label: "Sản phẩm", type: "array", summary: "Sản phẩm" },
    { key: "services", label: "Dịch vụ", type: "array", summary: "Dịch vụ" },
    { key: "news", label: "Tin tức", type: "array", summary: "Tin" },
    { key: "jobs", label: "Tuyển dụng", type: "array", summary: "Vị trí" },
    { key: "contactMessages", label: "Liên hệ", type: "array", summary: "Yêu cầu" }
  ];

  const nav = document.querySelector("[data-admin-nav]");
  const mobileMenuToggle = document.querySelector("[data-admin-mobile-menu-toggle]");
  const profileHosts = document.querySelectorAll("[data-admin-profile]");
  const headingHost = document.querySelector("[data-admin-heading]");
  const title = document.querySelector("[data-admin-title]");
  const summary = document.querySelector("[data-admin-summary]");
  const editor = document.querySelector("[data-admin-editor]");
  let currentKey = "overview";
  let isInitialLoading = true;
  let supabaseLoadStatus = {
    publicSnapshot: "pending",
    authenticated: "pending",
    contacts: "pending",
    logs: "pending",
    cmsSections: 0,
    contactRows: 0,
    logRows: 0,
    contactSource: "",
    logSource: "",
    jwtRole: "",
    userId: "",
    lastUpdated: "",
    errors: []
  };

  const markSupabaseLoad = (key, status, error = null) => {
    supabaseLoadStatus = {
      ...supabaseLoadStatus,
      [key]: status,
      lastUpdated: new Date().toLocaleString("vi-VN")
    };
    if (error) {
      const message = error?.message || String(error);
      supabaseLoadStatus.errors = [
        `${key}: ${message}`,
        ...(supabaseLoadStatus.errors || [])
      ].slice(0, 4);
    }
  };

  const setMobileMenuOpen = (isOpen) => {
    nav?.classList.toggle("is-open", isOpen);
    mobileMenuToggle?.classList.toggle("is-open", isOpen);
    mobileMenuToggle?.setAttribute("aria-expanded", String(isOpen));
    mobileMenuToggle?.setAttribute("aria-label", isOpen ? "Đóng menu quản trị" : "Mở menu quản trị");
  };

  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  const deepMerge = (target, source) => {
    if (Array.isArray(target) && Array.isArray(source)) return source;
    if (isPlainObject(target) && isPlainObject(source)) {
      return Object.keys({ ...target, ...source }).reduce((merged, key) => {
        merged[key] = key in source ? deepMerge(target[key], source[key]) : target[key];
        return merged;
      }, {});
    }
    return source === undefined ? target : source;
  };
  const originalCatalogData = {
    productCategories: deepClone(window.MOXON_DATA?.productCategories || []),
    products: deepClone(window.MOXON_DATA?.products || [])
  };
  const useClassicLocalAdmin = false;
  const LOCAL_DATA_KEY = "moxon_admin_data";
  const LOCAL_LOGS_KEY = "moxon_admin_logs";
  const LOCAL_EMAIL_KEY = "moxon_admin_email";
  const readLocalJson = (key, fallbackValue = null) => {
    try {
      const rawValue = window.localStorage?.getItem(key);
      return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch {
      return fallbackValue;
    }
  };
  const writeLocalJson = (key, value) => {
    try {
      window.localStorage?.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Không lưu được ${key} vào localStorage.`, error);
    }
  };
  const getProfileStorageKey = (email = currentAuthUser?.email || "") =>
    `moxon_admin_profile_${String(email || "default").toLowerCase()}`;
  const readLocalAdminProfile = () => {
    const currentProfile = readLocalJson(getProfileStorageKey(), null);
    if (currentProfile) return currentProfile;
    try {
      const storedEmail = window.localStorage?.getItem(LOCAL_EMAIL_KEY);
      return storedEmail ? readLocalJson(getProfileStorageKey(storedEmail), null) : null;
    } catch {
      return null;
    }
  };
  const writeLocalAdminProfile = (profile) => {
    writeLocalJson(getProfileStorageKey(profile.email), profile);
    if (currentAuthUser?.email && currentAuthUser.email !== profile.email) {
      writeLocalJson(getProfileStorageKey(currentAuthUser.email), profile);
    }
    try {
      window.localStorage?.setItem(LOCAL_EMAIL_KEY, profile.email || currentAuthUser?.email || "");
    } catch {
      // Ignore storage errors for compatibility with the old local admin mode.
    }
  };
  const storedAdminData = readLocalJson(LOCAL_DATA_KEY, null);
  const storedActivityLogs = readLocalJson(LOCAL_LOGS_KEY, []);

  let currentCropper = null;
  let activeImageValueInput = null;
  let activeImagePreviewImg = null;
  let activeCropAspectRatio = 4 / 3;
  const MAX_UPLOAD_FILE_SIZE = 12 * 1024 * 1024;
  const MAX_DATA_IMAGE_LENGTH = 2.4 * 1024 * 1024;

  const slugify = (text) => {
    if (!text) return "";
    return text
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  };

  const getData = () => deepClone(data || fallbackData);

  const mapCategoryFromDb = (row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order || 0,
    active: row.active !== false,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  });

  const mapProductFromDb = (row) => ({
    id: row.id,
    category: row.category || "",
    title: row.title,
    kicker: row.kicker || "",
    image: row.image || "",
    description: row.description || "",
    search: row.search || "",
    active: row.active !== false,
    featured: row.featured !== false,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  });

  const mapCategoryToDb = (record) => ({
    id: record.id,
    name: record.name || record.title || record.id,
    sort_order: Number(record.sortOrder) || 0,
    active: record.active !== false
  });

  const mapProductToDb = (record) => ({
    id: record.id,
    category: record.category || null,
    title: record.title || record.name || record.id,
    kicker: record.kicker || "",
    image: record.image || "",
    description: record.description || "",
    search: record.search || "",
    active: record.active !== false,
    featured: record.featured !== false,
    sort_order: Number(record.sortOrder) || 0,
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const mapMessageFromDb = (row) => ({
    id: row.id,
    type: row.type || "contact",
    title: row.title || "",
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    company: row.company || "",
    service: row.service || "",
    message: row.message || "",
    attachment: row.attachment || "",
    attachmentData: row.attachment_data || "",
    rawFields: row.raw_fields || {},
    seen: row.seen === true,
    active: row.active !== false,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  });

  const mapMessageToDb = (record) => ({
    id: record.id,
    type: record.type || "contact",
    title: record.title || "",
    name: record.name || "",
    phone: record.phone || "",
    email: record.email || "",
    company: record.company || "",
    service: record.service || "",
    message: record.message || "",
    attachment: record.attachment || "",
    attachment_data: record.attachmentData || "",
    raw_fields: record.rawFields || {},
    seen: record.seen === true,
    active: record.active !== false,
    sort_order: Number(record.sortOrder) || 0,
    created_at: record.createdAt || new Date().toISOString()
  });

  const dataUrlToBlob = (dataUrl) => {
    const [meta, content] = String(dataUrl).split(",");
    const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
    const binary = atob(content || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  };

  const uploadProductImageIfNeeded = async (record) => {
    if (!supabaseClient || !String(record.image || "").startsWith("data:image/")) return record;
    const blob = dataUrlToBlob(record.image);
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const path = `products/${record.id}-${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage
      .from(supabaseConfig.mediaBucket || "moxon-media")
      .upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) throw error;
    const { data: publicData } = supabaseClient.storage
      .from(supabaseConfig.mediaBucket || "moxon-media")
      .getPublicUrl(path);
    return { ...record, image: publicData.publicUrl };
  };

  const uploadCmsImageValue = async (value, sectionKey = "cms") => {
    if (!supabaseClient || !String(value || "").startsWith("data:image/")) return value;
    const blob = dataUrlToBlob(value);
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const safeSection = slugify(sectionKey) || "cms";
    const path = `${safeSection}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabaseClient.storage
      .from(supabaseConfig.mediaBucket || "moxon-media")
      .upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) throw error;
    const { data: publicData } = supabaseClient.storage
      .from(supabaseConfig.mediaBucket || "moxon-media")
      .getPublicUrl(path);
    return publicData.publicUrl;
  };

  const uploadCmsImagesInValue = async (value, sectionKey = "cms") => {
    if (typeof value === "string") return uploadCmsImageValue(value, sectionKey);
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => uploadCmsImagesInValue(item, sectionKey)));
    }
    if (value && typeof value === "object") {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, childValue]) => [key, await uploadCmsImagesInValue(childValue, sectionKey)])
      );
      return Object.fromEntries(entries);
    }
    return value;
  };

  const withTimeout = (promise, timeoutMs = 7000, label = "Supabase") => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
  };
  const runWithDeadline = (promise, timeoutMs, label) => withTimeout(promise, timeoutMs, label);

  const decodeJwtPayload = (token) => {
    try {
      const payload = String(token || "").split(".")[1];
      if (!payload) return {};
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      return JSON.parse(atob(padded));
    } catch {
      return {};
    }
  };

  const sdkQuery = async (queryPromise, label = "Supabase") => {
    const result = await withTimeout(queryPromise, 20000, label);
    if (result.error) throw result.error;
    return result.data || [];
  };

  const loadPublicCatalogSnapshot = async () => {
    if (!supabaseClient) return { ...fallbackData, ...(getData()) };
    const [categoriesResult, productsResult, cmsResult] = await Promise.allSettled([
      sdkQuery(supabaseClient.from("product_categories").select("*").eq("active", true).order("sort_order", { ascending: true }), "product_categories"),
      sdkQuery(supabaseClient.from("products").select("*").eq("active", true).order("sort_order", { ascending: true }), "products"),
      sdkQuery(supabaseClient.from("cms_sections").select("*"), "cms_sections")
    ]);

    const latestData = getData();
    const snapshotData = { ...fallbackData, ...latestData };

    if (cmsResult.status === "fulfilled") {
      supabaseLoadStatus.cmsSections = (cmsResult.value || []).length;
      (cmsResult.value || []).forEach((row) => {
        if (row.section_key) snapshotData[row.section_key] = deepMerge(fallbackData[row.section_key], row.section_value);
      });
    } else {
      console.warn("Không tải được cms_sections từ Supabase.", cmsResult.reason);
    }

    if (categoriesResult.status === "fulfilled") {
      snapshotData.productCategories = (categoriesResult.value || []).map(mapCategoryFromDb);
    } else {
      console.warn("Không tải được product_categories từ Supabase.", categoriesResult.reason);
    }

    if (productsResult.status === "fulfilled") {
      snapshotData.products = (productsResult.value || []).map(mapProductFromDb);
    } else {
      console.warn("Không tải được products từ Supabase.", productsResult.reason);
    }

    return snapshotData;
  };

  const loadRemoteCatalogData = async () => {
    if (!supabaseClient) return null;
    const [categoriesResult, productsResult, cmsResult] = await Promise.allSettled([
      sdkQuery(supabaseClient.from("product_categories").select("*").order("sort_order", { ascending: true }), "product_categories"),
      sdkQuery(supabaseClient.from("products").select("*").order("sort_order", { ascending: true }), "products"),
      sdkQuery(supabaseClient.from("cms_sections").select("*"), "cms_sections")
    ]);

    const cmsData = {};
    if (cmsResult.status === "fulfilled" && cmsResult.value) {
      cmsResult.value.forEach((row) => {
        if (row.section_key) cmsData[row.section_key] = deepMerge(fallbackData[row.section_key], row.section_value);
      });
    } else if (cmsResult.status === "rejected") {
      console.warn("Không tải được cms_sections.", cmsResult.reason);
    }
    const latestData = getData();
    const categoriesRows = categoriesResult.status === "fulfilled" ? categoriesResult.value : null;
    const productsRows = productsResult.status === "fulfilled" ? productsResult.value : null;
    if (categoriesResult.status === "rejected") console.warn("Không tải được product_categories.", categoriesResult.reason);
    if (productsResult.status === "rejected") console.warn("Không tải được products.", productsResult.reason);
    return {
      ...fallbackData,
      ...latestData,
      ...cmsData,
      productCategories: categoriesRows ? categoriesRows.map(mapCategoryFromDb) : latestData.productCategories || fallbackData.productCategories || [],
      products: productsRows ? productsRows.map(mapProductFromDb) : latestData.products || fallbackData.products || [],
      contactMessages: latestData.contactMessages || fallbackData.contactMessages || []
    };
  };

  const loadRemoteContactMessages = async () => {
    if (!supabaseClient) return getData().contactMessages || [];
    const rows = await sdkQuery(
      supabaseClient.from("contact_messages").select("*").order("created_at", { ascending: false }),
      "contact_messages"
    );
    supabaseLoadStatus.contactSource = rows.length ? "sdk-table" : "empty";
    return rows.map(mapMessageFromDb);
  };

  const selectRemoteIds = async (table) => {
    return await sdkQuery(supabaseClient.from(table).select("id"), `${table} select`);
  };

  const deleteRemoteIds = async (table, ids) => {
    if (!ids.length) return;
    await sdkQuery(supabaseClient.from(table).delete().in("id", ids), `${table} delete`);
  };

  const upsertRemoteRows = async (table, rows, conflictKey = "id") => {
    if (!rows.length) return;
    await sdkQuery(supabaseClient.from(table).upsert(rows, { onConflict: conflictKey }), `${table} upsert`);
  };

  const syncRemoteSection = async (sectionKey, sectionValue) => {
    if (!supabaseClient || !remoteSectionKeys.has(sectionKey)) return sectionValue;

    if (remoteCmsSectionKeys.has(sectionKey)) {
      const remoteValue = await uploadCmsImagesInValue(sectionValue, sectionKey);
      await upsertRemoteRows(
        "cms_sections",
        [{
          section_key: sectionKey,
          section_value: remoteValue,
          updated_at: new Date().toISOString()
        }],
        "section_key"
      );
      return remoteValue;
    }

    if (sectionKey === "contactMessages") {
      const currentRows = await selectRemoteIds("contact_messages");
      const nextRecords = Array.isArray(sectionValue) ? sectionValue : [];
      const nextIds = new Set(nextRecords.map((record) => record.id));
      const oldIds = (currentRows || []).map((record) => record.id);
      const deletedIds = oldIds.filter((id) => !nextIds.has(id));

      await deleteRemoteIds("contact_messages", deletedIds);
      await upsertRemoteRows("contact_messages", nextRecords.map(mapMessageToDb));

      return nextRecords;
    }

    const table = sectionKey === "productCategories" ? "product_categories" : "products";
    const mapper = sectionKey === "productCategories" ? mapCategoryToDb : mapProductToDb;
    const currentRows = await selectRemoteIds(table);

    const nextRecords =
      sectionKey === "products"
        ? await Promise.all(sectionValue.map(uploadProductImageIfNeeded))
        : sectionValue;

    const nextIds = new Set(nextRecords.map((record) => record.id));
    const oldIds = (currentRows || []).map((record) => record.id);
    const deletedIds = oldIds.filter((id) => !nextIds.has(id));

    await deleteRemoteIds(table, deletedIds);
    await upsertRemoteRows(table, nextRecords.map(mapper));

    return nextRecords;
  };

  const restoreOriginalCatalogData = async () => {
    const fallbackCategories = deepClone(originalCatalogData.productCategories || []);
    const fallbackProducts = deepClone(originalCatalogData.products || []);
    if (!fallbackCategories.length || !fallbackProducts.length) {
      throw new Error("Không tìm thấy dữ liệu mẫu cũ trong site-data.js.");
    }

    const normalizedCategories = normalizeUniqueIds(fallbackCategories, "category").records
      .map((category, index) => ({
        ...category,
        sortOrder: Number(category.sortOrder) || index + 1,
        active: category.active !== false
      }));
    const categoryIds = new Set(normalizedCategories.map((category) => category.id));
    const firstCategoryId = normalizedCategories[0]?.id || "";
    const normalizedProducts = normalizeUniqueIds(fallbackProducts, "product").records
      .map((product, index) => ({
        ...product,
        category: categoryIds.has(product.category) ? product.category : firstCategoryId,
        sortOrder: Number(product.sortOrder) || index + 1,
        active: product.active !== false,
        featured: product.featured !== false
      }));

    await saveSectionData("productCategories", normalizedCategories, {
      action: "Khôi phục",
      target: "Danh mục",
      detail: "Dữ liệu mẫu cũ"
    });
    await saveSectionData("products", normalizedProducts, {
      action: "Khôi phục",
      target: "Sản phẩm",
      detail: "Dữ liệu mẫu cũ"
    });
    data = { ...getData(), productCategories: normalizedCategories, products: normalizedProducts };
    return data;
  };


  const getAuthDisplayName = () => {
    const emailName = String(currentAuthUser?.email || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .trim();
    return emailName ? emailName.replace(/\b\w/g, (char) => char.toUpperCase()) : "MOXON Admin";
  };

  const getCurrentAdmin = () => {
    const localProfile = useClassicLocalAdmin ? readLocalAdminProfile() : null;
    const metadata = currentAuthUser?.user_metadata || {};
    return {
      name:
        localProfile?.name ||
        metadata.displayName ||
        metadata.name ||
        getAuthDisplayName(),
      role:
        localProfile?.role ||
        metadata.role ||
        "Quản trị viên",
      email:
        localProfile?.email ||
        metadata.contactEmail ||
        currentAuthUser?.email ||
        "admin@moxontech.vn",
      avatar:
        localProfile?.avatar ||
        metadata.avatar ||
        ""
    };
  };

  const compactStorageImages = (value, key = "") => {
    if (typeof value === "string") {
      if (!value.startsWith("data:image/")) return { value, changed: false, count: 0 };
      if (key === "attachmentData" || key === "cvData") return { value: "", changed: true, count: 1 };
      if (key === "logo") return { value: "assets/logo-transparent.png?v=20260630-opt", changed: true, count: 1 };
      if (key === "favicon" || key === "avatar") return { value: "", changed: true, count: 1 };
      return { value: "assets/optimized/project-cnc-parts.jpg", changed: true, count: 1 };
    }

    if (Array.isArray(value)) {
      let changed = false;
      let count = 0;
      const nextValue = value.map((item) => {
        const result = compactStorageImages(item, key);
        changed = changed || result.changed;
        count += result.count;
        return result.value;
      });
      return { value: nextValue, changed, count };
    }

    if (value && typeof value === "object") {
      let changed = false;
      let count = 0;
      const nextValue = {};
      Object.keys(value).forEach((childKey) => {
        const result = compactStorageImages(value[childKey], childKey);
        changed = changed || result.changed;
        count += result.count;
        nextValue[childKey] = result.value;
      });
      return { value: nextValue, changed, count };
    }

    return { value, changed: false, count: 0 };
  };

  const addActivityLog = async (action, target, detail) => {
    const actor = getCurrentAdmin();
    const log = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      target,
      detail,
      time: new Date().toISOString(),
      actorName: actor.name,
      actorRole: actor.role,
      actorEmail: actor.email,
      actorAvatar: actor.avatar
    };
    activityLogs = [log, ...activityLogs].slice(0, 50);
    if (useClassicLocalAdmin) {
      writeLocalJson(LOCAL_LOGS_KEY, activityLogs);
      return log;
    }
    if (!supabaseClient) {
      showToast("Dữ liệu đã lưu, nhưng chưa kết nối Supabase để ghi nhật ký hoạt động.", "error");
      return null;
    }
    try {
      await sdkQuery(
        supabaseClient.from("admin_activity_logs").insert(mapActivityLogToDb(log)),
        "admin_activity_logs insert"
      );
    } catch (insertError) {
      console.warn("Không lưu được nhật ký hoạt động lên Supabase.", insertError);
      showToast(`Dữ liệu đã lưu, nhưng nhật ký hoạt động chưa ghi được: ${formatActionError(insertError, "kiểm tra bảng admin_activity_logs")}.`, "error");
      return null;
    }
    return log;
  };

  const mapActivityLogFromDb = (row) => ({
    id: row.id,
    action: fixLegacyMojibakeText(row.action || ""),
    target: fixLegacyMojibakeText(row.target || ""),
    detail: fixLegacyMojibakeText(row.detail || ""),
    time: row.created_at || "",
    actorName: fixLegacyMojibakeText(row.actor_name || ""),
    actorRole: fixLegacyMojibakeText(row.actor_role || ""),
    actorEmail: row.actor_email || "",
    actorAvatar: row.actor_avatar || ""
  });

  const mapActivityLogToDb = (log) => ({
    id: log.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: log.action || "Hoạt động",
    target: log.target || "",
    detail: log.detail || "",
    actor_name: log.actorName || "",
    actor_role: log.actorRole || "",
    actor_email: log.actorEmail || "",
    actor_avatar: log.actorAvatar || "",
    created_at: log.time || new Date().toISOString()
  });

  const loadRemoteActivityLogs = async () => {
    if (!supabaseClient) {
      activityLogs = [];
      return activityLogs;
    }
    const rows = await sdkQuery(
      supabaseClient.from("admin_activity_logs").select("*").order("created_at", { ascending: false }).limit(50),
      "admin_activity_logs"
    );
    supabaseLoadStatus.logSource = rows.length ? "sdk-table" : "empty";
    activityLogs = rows.map(mapActivityLogFromDb);
    return activityLogs;
  };

  const saveData = (nextData) => {
    data = deepClone(nextData || fallbackData);
    if (useClassicLocalAdmin) {
      writeLocalJson(LOCAL_DATA_KEY, data);
    }
    return data;
  };

  let data = useClassicLocalAdmin && storedAdminData
    ? deepMerge(deepClone(fallbackData), storedAdminData)
    : deepClone(fallbackData);
  let activityLogs = Array.isArray(storedActivityLogs) ? storedActivityLogs.slice(0, 50) : [];

  const mediaLibrary = [
    { path: "assets/optimized/moxon-banner.jpg", label: "Banner MOXON" },
    { path: "assets/optimized/baner1.jpg", label: "Banner năng lực cơ khí" },
    { path: "assets/optimized/baner2.jpg", label: "Banner Jig Fixture và CNC" },
    { path: "assets/optimized/baner3.jpg", label: "Banner khuôn mẫu" },
    { path: "assets/optimized/baner4.jpg", label: "Banner giải pháp kỹ thuật" },
    { path: "assets/optimized/project-checking-jig.jpg", label: "Checking Jig" },
    { path: "assets/optimized/product-checking-jig-camera.jpg", label: "Jig kiểm tra camera" },
    { path: "assets/optimized/project-assembly-jig.jpg", label: "Assembly Jig" },
    { path: "assets/optimized/project-cnc-parts.jpg", label: "Chi tiết CNC" },
    { path: "assets/optimized/project-pressing-die.jpg", label: "Pressing Die" },
    { path: "assets/optimized/project-workshop-equipment.jpg", label: "Xưởng / thiết bị" },
    { path: "assets/optimized/product-cnc-rotary-fixture.jpg", label: "Fixture CNC" },
    { path: "assets/optimized/product-conveyor-belt.jpg", label: "Băng tải" },
    { path: "assets/optimized/product-die-casting-mold.jpg", label: "Khuôn đúc" },
    { path: "assets/optimized/product-injection-mold.jpg", label: "Khuôn nhựa" },
    { path: "assets/optimized/product-press-machine.jpg", label: "Máy ép" },
    { path: "assets/optimized/product-trolley.jpg", label: "Xe đẩy" },
    { path: "assets/optimized/product-workbench.jpg", label: "Bàn thao tác" },
    { path: "assets/optimized/service-automation.jpg", label: "Dịch vụ tự động hóa" },
    { path: "assets/optimized/service-cnc.jpg", label: "Dịch vụ CNC" },
    { path: "assets/optimized/service-jig-fixture.jpg", label: "Dịch vụ Jig Fixture" }
  ];

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const fixLegacyMojibakeText = (value) => {
    const textValue = String(value ?? "");
    if (!/[ÃÄÆÂÅ]|áº|á»|â/.test(textValue)) return textValue;
    try {
      const bytes = Array.from(textValue)
        .map((char) => {
          const code = char.charCodeAt(0);
          return code <= 255 ? `%${code.toString(16).padStart(2, "0")}` : encodeURIComponent(char);
        })
        .join("");
      const decoded = decodeURIComponent(bytes);
      const oldMarkers = (textValue.match(/[ÃÄÆÂÅ]|áº|á»|â/g) || []).length;
      const newMarkers = (decoded.match(/[ÃÄÆÂÅ]|áº|á»|â/g) || []).length;
      return newMarkers < oldMarkers ? decoded : textValue;
    } catch {
      return textValue;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Chưa có ngày";
    const value = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        const pad = (number) => String(number).padStart(2, "0");
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
      }
    }
    const dateOnly = value.includes("T") ? value.split("T")[0] : value;
    const parts = dateOnly.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return value;
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return "Không rõ thời gian";
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return formatDate(isoStr);
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  };

  const formatActivityTime = (isoStr) => {
    if (!isoStr) return { time: "Không rõ", day: "" };
    const trimmed = isoStr.trim();
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    const date = new Date(isDateOnly ? trimmed + "T00:00:00" : trimmed);
    if (Number.isNaN(date.getTime())) return { time: formatDate(isoStr), day: "" };
    const now = new Date();
    
    // So sánh ngày theo giờ địa phương
    const dateString = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toDateString();
    const todayString = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayString = new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate()).toDateString();
    
    const isToday = dateString === todayString;
    const isYesterday = dateString === yesterdayString;
    
    const day = isToday ? "Hôm nay" : isYesterday ? "Hôm qua" : `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    if (isDateOnly) {
      return { time: "", day };
    }
    const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
    return { time, day };
  };

  const formatContactTimestamp = (isoStr) => {
    if (!isoStr) {
      return `<span class="admin-date-main">Chưa rõ</span>`;
    }
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) {
      return `<span class="admin-date-main">${escapeHtml(formatDate(isoStr))}</span>`;
    }
    const pad = (value) => String(value).padStart(2, "0");
    const dateText = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    const timeText = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return `
      <span class="admin-date-main">${dateText}</span>
      <span class="admin-date-time">${timeText}</span>
    `;
  };

  const imageSrc = (value) => {
    const src = String(value || "");
    if (!src) return "";
    if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) return src;
    return `../${src}`;
  };

  const getAspectValue = (aspectStr) => {
    if (!aspectStr) return 4 / 3;
    if (aspectStr === "free") return NaN;
    if (aspectStr.includes(":")) {
      const [w, h] = aspectStr.split(":").map(Number);
      if (w && h) return w / h;
    }
    return 4 / 3;
  };

  const setupTablePaginationAndFilters = (container, tableSelector, searchInputSelector, filterSelectSelector = null, filterAttr = "") => {
    const searchInput = container.querySelector(searchInputSelector);
    const filterSelect = filterSelectSelector ? container.querySelector(filterSelectSelector) : null;
    const paginationContainer = container.querySelector(".admin-pagination");
    const pageSize = 8;
    let page = 1;

    const filterAndPaginate = () => {
      const query = searchInput?.value.toLowerCase().trim() || "";
      const filterValue = filterSelect?.value || "";
      const rows = Array.from(container.querySelectorAll(`${tableSelector} tbody tr`));
      
      if (rows.length === 0 || rows[0].querySelector(".admin-empty-note")) return;

      const visibleRows = rows.filter(row => {
        const text = row.textContent.toLowerCase();
        const matchesQuery = text.includes(query);
        let matchesFilter = true;
        if (filterSelect && filterAttr) {
          const rowVal = row.getAttribute(filterAttr) || "";
          matchesFilter = !filterValue || rowVal === filterValue;
        }
        return matchesQuery && matchesFilter;
      });

      rows.forEach(row => row.style.display = "none");

      const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
      if (page > totalPages) page = totalPages;
      if (page < 1) page = 1;

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      visibleRows.slice(start, end).forEach(row => row.style.display = "");

      if (paginationContainer) {
        let html = `<button class="admin-pagination-btn prev-btn" ${page === 1 ? 'disabled' : ''}>&lt;</button>`;
        for (let i = 1; i <= totalPages; i++) {
          html += `<button class="admin-pagination-btn page-num-btn ${i === page ? 'is-active' : ''}" data-page="${i}">${i}</button>`;
        }
        html += `<button class="admin-pagination-btn next-btn" ${page === totalPages ? 'disabled' : ''}>&gt;</button>`;
        paginationContainer.innerHTML = html;

        paginationContainer.querySelector(".prev-btn")?.addEventListener("click", () => {
          if (page > 1) {
            page--;
            filterAndPaginate();
          }
        });
        paginationContainer.querySelector(".next-btn")?.addEventListener("click", () => {
          if (page < totalPages) {
            page++;
            filterAndPaginate();
          }
        });
        paginationContainer.querySelectorAll(".page-num-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            page = Number(btn.dataset.page);
            filterAndPaginate();
          });
        });
      }
    };

    searchInput?.addEventListener("input", () => {
      page = 1;
      filterAndPaginate();
    });
    filterSelect?.addEventListener("change", () => {
      page = 1;
      filterAndPaginate();
    });

    filterAndPaginate();
  };

  const canvasToCompactJpeg = (canvas, maxLength = MAX_DATA_IMAGE_LENGTH) => {
    const compactCanvas = document.createElement("canvas");
    let width = canvas.width;
    let height = canvas.height;
    let quality = 0.92;

    for (let attempt = 0; attempt < 7; attempt += 1) {
      compactCanvas.width = Math.max(1, Math.round(width));
      compactCanvas.height = Math.max(1, Math.round(height));
      const context = compactCanvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, compactCanvas.width, compactCanvas.height);
      context.drawImage(canvas, 0, 0, compactCanvas.width, compactCanvas.height);

      const dataUrl = compactCanvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= maxLength || attempt === 7) return dataUrl;

      if (quality > 0.78) {
        quality -= 0.04;
      } else {
        width *= 0.9;
        height *= 0.9;
      }
    }

    return compactCanvas.toDataURL("image/jpeg", 0.78);
  };

  const fileToOptimizedDataUrl = (file) =>
    new Promise((resolve, reject) => {
      if (file.size > MAX_UPLOAD_FILE_SIZE) {
        reject(new Error("Ảnh quá lớn. Hãy chọn ảnh dưới 12MB hoặc nén ảnh trước khi upload."));
        return;
      }
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        const maxSize = 2200;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvasToCompactJpeg(canvas));
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Không đọc được ảnh đã chọn."));
      };
      image.src = objectUrl;
    });

  const openCropperModal = (src, valueInput, previewImg, aspectRatio = 4 / 3) => {
    valueInput.value = src;
    previewImg.src = src;
    previewImg.closest(".admin-image-preview-box")?.classList.remove("is-empty");
    previewImg.classList?.remove("is-empty");

    const modal = document.getElementById("cropper-modal");
    const cropperImage = document.getElementById("cropper-image");
    if (!modal || !cropperImage || typeof Cropper === "undefined") {
      showToast("Đã chọn ảnh. Nhớ bấm lưu để cập nhật dữ liệu.", "info");
      return;
    }

    activeImageValueInput = valueInput;
    activeImagePreviewImg = previewImg;
    activeCropAspectRatio = aspectRatio;

    cropperImage.src = src;
    modal.classList.add("is-active");
    modal.setAttribute("aria-hidden", "false");

    if (currentCropper) {
      currentCropper.destroy();
    }

    if (typeof Cropper !== "function") {
      valueInput.value = src;
      previewImg.src = src;
      previewImg.classList?.remove("is-empty");
      previewImg.closest(".admin-image-preview-box")?.classList.remove("is-empty");
      modal.classList.remove("is-active");
      modal.setAttribute("aria-hidden", "true");
      showToast("Không tải được công cụ cắt ảnh, ảnh đã được chọn trực tiếp. Bấm lưu để cập nhật.", "info");
      return;
    }

    currentCropper = new Cropper(cropperImage, {
      aspectRatio,
      viewMode: 1,
      autoCropArea: 1,
      responsive: true,
      checkOrientation: false
    });
  };

  const showToast = (message, type = "success") => {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `admin-toast is-${type}`;
    
    let icon = "i";
    if (type === "success") icon = "✓";
    if (type === "error") icon = "×";
    if (type === "info") icon = "i";

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add("is-show"), 10);

    setTimeout(() => {
      toast.classList.remove("is-show");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason?.message || "Thao tác chưa hoàn tất. Vui lòng thử lại.";
    console.error("Lỗi thao tác Admin:", event.reason);
    showToast(message, "error");
  });

  window.addEventListener("error", (event) => {
    const message = event.error?.message || event.message || "Giao diện admin gặp lỗi.";
    console.error("Lỗi giao diện Admin:", event.error || event.message);
    showToast(message, "error");
  });

  const sectionLabel = (key) => sections.find((section) => section.key === key)?.label || "mục quản trị";
  const saveDestinationText = () => useClassicLocalAdmin ? "bộ nhớ trình duyệt" : supabaseClient ? "Supabase" : "bộ nhớ phiên hiện tại";

  const setEditorStatus = (message, type = "success") => {
    const status = getEditorStatus();
    if (!status) return;
    status.textContent = message;
    status.style.color = type === "error" ? "#c0392b" : type === "info" ? "#2563eb" : "#138a5b";
  };

  const getEditorStatus = () => document.querySelector("[data-editor-status]") || { style: {}, textContent: "" };

  const formatActionError = (error, fallbackMessage = "Thao tác chưa hoàn tất.") => {
    const message = String(error?.message || error || "").replace(/^TypeError:\s*/i, "");
    if (!message) return fallbackMessage;
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return "Không kết nối được Supabase. Vui lòng kiểm tra mạng, đăng nhập lại admin, rồi thử lại.";
    }
    if (/jwt|session|auth|permission|row-level security|rls|401|403/i.test(message)) {
      return "Phiên đăng nhập hoặc quyền Supabase không hợp lệ. Vui lòng đăng xuất, đăng nhập lại admin và kiểm tra RLS.";
    }
    return message;
  };

  const runAdminAction = async (button, actionCallback, options = {}) => {
    const targetButton = button?.closest?.("button") || button;
    const oldText = targetButton?.textContent;
    if (targetButton) {
      targetButton.disabled = true;
      if (options.pendingText) targetButton.textContent = options.pendingText;
    }
    try {
      await actionCallback();
    } catch (error) {
      const message = formatActionError(error, options.errorMessage || "Không thực hiện được thao tác.");
      setEditorStatus(message, "error");
      showToast(message, "error");
      console.error("Lỗi thao tác Admin:", error);
    } finally {
      if (targetButton && document.body.contains(targetButton)) {
        targetButton.disabled = false;
        if (options.pendingText && oldText !== undefined) targetButton.textContent = oldText;
      }
    }
  };

  const runFormSave = async (form, saveCallback) => {
    if (!form) {
      showToast("Không tìm thấy biểu mẫu cần lưu.", "error");
      return;
    }
    if (typeof form.checkValidity === "function" && !form.checkValidity()) {
      form.reportValidity?.();
      const invalidField = Array.from(form.elements || []).find((field) => typeof field.checkValidity === "function" && !field.checkValidity());
      invalidField?.focus?.();
      showToast("Vui lòng kiểm tra lại các trường bắt buộc hoặc chưa đúng định dạng.", "error");
      return;
    }
    const submitButtons = Array.from(form.querySelectorAll("button[type='submit'], [data-save-form], [data-submit-list-form], [data-submit-product-form], [data-submit-service-form]"));
    const oldLabels = submitButtons.map((button) => button.textContent);
    submitButtons.forEach((button) => {
      button.disabled = true;
      button.textContent = "Đang lưu...";
    });
    setEditorStatus("Đang lưu dữ liệu lên Supabase...", "info");
    try {
      await saveCallback(form);
    } catch (error) {
      const message = formatActionError(error, "Không lưu được dữ liệu.");
      setEditorStatus(message, "error");
      showToast(message, "error");
      console.error("Không lưu được dữ liệu admin:", error);
    } finally {
      submitButtons.forEach((button, index) => {
        if (!document.body.contains(button)) return;
        button.disabled = false;
        button.textContent = oldLabels[index];
      });
    }
  };

  const saveSectionData = async (sectionKey, sectionValue, actionInfo = null) => {
    const latestData = getData();
    let savedData;
    if (!useClassicLocalAdmin && supabaseClient && remoteSectionKeys.has(sectionKey)) {
      const remoteValue = await syncRemoteSection(sectionKey, sectionValue);
      let nextData = { ...latestData, [sectionKey]: remoteValue };
      if (remoteCatalogKeys.has(sectionKey)) {
        const remoteData = await loadRemoteCatalogData();
        if (remoteData) {
          nextData = { ...nextData, ...remoteData };
        }
      }
      savedData = saveData(nextData);
    } else {
      const nextData = { ...latestData, [sectionKey]: sectionValue };
      savedData = saveData(nextData);
    }
    data = savedData;
    if (actionInfo) {
      await addActivityLog(actionInfo.action, actionInfo.target, actionInfo.detail);
    }
    return savedData;
  };

  const scrollEditorToTop = () => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector(".admin-editor-panel") || document.querySelector(".admin-main");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const afterListSave = (section, renderList, message) => {
    renderSummary();
    renderList();
    wireEditorActions(section);
    showToast(message, "success");
    scrollEditorToTop();
  };

  const formSchemas = {
    company: {
      heading: "Chỉnh sửa thông tin công ty",
      note: "Những thông tin này được dùng ở header, footer và trang liên hệ.",
      fields: [
        { key: "legalName", label: "Tên pháp lý" },
        { key: "displayName", label: "Tên hiển thị" },
        { key: "taxCode", label: "Mã số thuế" },
        { key: "representative", label: "Người đại diện" },
        { key: "phone", label: "Hotline" },
        { key: "phoneHref", label: "Số điện thoại dạng link tel" },
        { key: "email", label: "Email", type: "email" },
        { key: "website", label: "Website hiển thị" },
        { key: "websiteUrl", label: "Website URL", type: "url" },
        { key: "address", label: "Địa chỉ", input: "textarea" },
        { key: "mapLink", label: "Link Google Maps", type: "url" },
        { key: "mapEmbed", label: "Google Maps embed URL", input: "textarea" }
      ]
    },
    brand: {
      heading: "Chỉnh sửa nhận diện thương hiệu",
      note: "Nhận diện là logo, favicon, khẩu hiệu và các kênh mạng xã hội của website MOXON.",
      fields: [
        { key: "logo", label: "Logo website", input: "image", aspect: "free" },
        { key: "favicon", label: "Favicon / biểu tượng tab trình duyệt", input: "image", optional: true, aspect: "1:1" },
        { key: "tagline", label: "Khẩu hiệu / mô tả ngắn", input: "textarea" },
        { key: "zaloUrl", label: "Link Zalo", type: "url" },
        { key: "facebookUrl", label: "Link Facebook", type: "url" },
        { key: "youtubeUrl", label: "Link YouTube", type: "url" }
      ]
    },
    aboutPage: {
      heading: "Chỉnh sửa nội dung trang giới thiệu",
      note: "Những nội dung này dùng để render phần hero và giá trị cốt lõi trên trang Giới thiệu.",
      fields: [
        { key: "heroKicker", label: "Nhãn nhỏ ở hero" },
        { key: "heroTitle", label: "Tiêu đề hero" },
        { key: "heroIntro", label: "Đoạn mở đầu", input: "textarea" },
        { key: "heroParagraphs", label: "Các đoạn nội dung bổ sung (mỗi dòng 1 đoạn)", input: "textarea" },
        { key: "values", label: "Giá trị cốt lõi (mỗi dòng: Tiêu đề | mô tả)", input: "textarea" }
      ]
    },
    recruitmentNotice: {
      heading: "Chỉnh sửa thông báo tuyển dụng",
      note: "Nội dung này hiển thị ở khối trên cùng của trang tuyển dụng.",
      fields: [
        { key: "active", label: "Hiển thị thông báo", input: "checkbox" },
        { key: "kicker", label: "Nhãn nhỏ" },
        { key: "title", label: "Tiêu đề" },
        { key: "content", label: "Nội dung thông báo", input: "textarea" }
      ]
    }
  };

  const getRecordTitle = (record, index) =>
    record.title || record.name || record.displayName || record.legalName || record.id || `Bản ghi ${index + 1}`;

  const getRecordSubtitle = (record) =>
    record.summary || record.description || record.email || record.phone || record.url || record.image || "";

  const getProductCategories = () =>
    Array.isArray(data.productCategories) ? data.productCategories.filter((category) => category.active !== false) : [];

  const getProductCategoryName = (categoryId) => {
    if (!categoryId) return "Chưa phân loại";
    const categories = getProductCategories();
    return categories.find((category) => category.id === categoryId)?.name || "Chưa phân loại";
  };

  const makeUniqueId = (records, base, fallbackPrefix = "record") => {
    const cleanBase = slugify(base || "") || `${fallbackPrefix}-${Date.now()}`;
    const usedIds = new Set((Array.isArray(records) ? records : []).map((record) => String(record.id || "")));
    if (!usedIds.has(cleanBase)) return cleanBase;

    let counter = 2;
    let nextId = `${cleanBase}-${counter}`;
    while (usedIds.has(nextId)) {
      counter += 1;
      nextId = `${cleanBase}-${counter}`;
    }
    return nextId;
  };

  const normalizeUniqueIds = (records, fallbackPrefix = "record") => {
    const usedIds = new Set();
    let changed = false;
    const nextRecords = (Array.isArray(records) ? records : []).map((record, index) => {
      const baseId = slugify(record.id || "") || `${fallbackPrefix}-${Date.now()}-${index + 1}`;
      let nextId = baseId;
      let counter = 2;
      while (usedIds.has(nextId)) {
        nextId = `${baseId}-${counter}`;
        counter += 1;
      }
      usedIds.add(nextId);
      if (nextId !== record.id) changed = true;
      return nextId === record.id ? record : { ...record, id: nextId };
    });

    return { records: nextRecords, changed };
  };

  const renderImagePicker = (fieldName, value, datasetName, aspect = "4:3", label = "Ảnh hiển thị") => `
    <label class="admin-field-wide admin-image-picker" data-image-aspect="${aspect}">
      ${label}
      <div class="admin-image-picker-row">
        <div class="admin-image-upload">
          <input type="hidden" ${datasetName}="${fieldName}" value="${escapeHtml(value || mediaLibrary[0]?.path || "")}" data-image-value>
          <input type="file" accept="image/*" data-image-upload>
          <small>Chọn ảnh từ máy. Khi bấm lưu, ảnh sẽ được tải lên Supabase Storage.</small>
        </div>
        <img src="${escapeHtml(imageSrc(value || mediaLibrary[0]?.path || ""))}" alt="Xem trước ảnh" data-image-preview>
      </div>
    </label>
  `;

  const createProductRecord = () => {
    const records = Array.isArray(data.products) ? data.products : [];
    const firstCategory = getProductCategories()[0]?.id || "";
    const id = makeUniqueId(records, `product-${Date.now()}`, "product");
    return {
      id,
      category: firstCategory,
      title: "Sản phẩm mới",
      kicker: "",
      image: "assets/optimized/project-cnc-parts.jpg",
      description: "",
      material: "",
      tolerance: "",
      machining: "",
      search: "",
      active: true,
      featured: true,
      createdAt: new Date().toISOString(),
      sortOrder: records.length + 1
    };
  };

  const createServiceRecord = () => {
    const records = Array.isArray(data.services) ? data.services : [];
    const id = makeUniqueId(records, `service-${Date.now()}`, "service");
    return {
      id,
      title: "Dịch vụ mới",
      image: "assets/optimized/service-cnc.jpg",
      summary: "",
      features: ["Ý chính 1", "Ý chính 2"],
      active: true,
      createdAt: new Date().toISOString(),
      views: 0,
      sortOrder: records.length + 1
    };
  };

  const createBannerRecord = () => {
    const records = Array.isArray(data.banners) ? data.banners : [];
    const id = makeUniqueId(records, `banner-${Date.now()}`, "banner");
    return {
      id,
      title: "Banner mới",
      image: "assets/optimized/moxon-banner.jpg",
      alt: "Banner MOXON",
      page: "home",
      active: true,
      createdAt: new Date().toISOString(),
      views: 0,
      sortOrder: records.length + 1
    };
  };

  const createPartnerRecord = () => {
    const records = Array.isArray(data.partners) ? data.partners : [];
    return {
      id: makeUniqueId(records, `partner-${Date.now()}`, "partner"),
      name: "Đối tác mới",
      label: "",
      image: "",
      url: "#",
      tone: "",
      active: true,
      sortOrder: records.length + 1
    };
  };

  const partnerToneColorMap = {
    "brand-red": "#e31925",
    "brand-dark": "#111827",
    "brand-blue": "#2c74b8",
    "brand-cyan": "#04a9df",
    "brand-sumi": "#1594d2",
    "brand-cotto": "#111827"
  };

  const partnerToneColorOptions = [
    { value: "#111827", label: "Đen" },
    { value: "#0f4c9c", label: "Xanh dương" },
    { value: "#04a9df", label: "Xanh cyan" },
    { value: "#1594d2", label: "Xanh nhạt" },
    { value: "#e31925", label: "Đỏ" },
    { value: "#16a34a", label: "Xanh lá" }
  ];

  const partnerTonePaletteGroups = [
    {
      title: "Màu chủ đề",
      colors: [
        "#ffffff", "#111827", "#64748b", "#94a3b8", "#22c55e", "#06b6d4", "#e11d48", "#f97316",
        "#f8fafc", "#1f2937", "#cbd5e1", "#d9f99d", "#a7f3d0", "#bae6fd", "#fecdd3", "#fed7aa",
        "#e5e7eb", "#374151", "#9ca3af", "#bef264", "#5eead4", "#7dd3fc", "#fda4af", "#fdba74",
        "#9ca3af", "#111827", "#475569", "#65a30d", "#0d9488", "#0284c7", "#be123c", "#ea580c"
      ]
    },
    {
      title: "Màu chuẩn",
      colors: ["#dc2626", "#ef4444", "#f59e0b", "#facc15", "#84cc16", "#22c55e", "#0ea5e9", "#2563eb", "#1e3a8a", "#7e22ce"]
    }
  ];

  const normalizeColorInputValue = (value, fallback = "#111827") => {
    const rawValue = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(rawValue)) return rawValue;
    if (/^#[0-9a-f]{3}$/i.test(rawValue)) {
      return `#${rawValue[1]}${rawValue[1]}${rawValue[2]}${rawValue[2]}${rawValue[3]}${rawValue[3]}`;
    }
    return partnerToneColorMap[rawValue] || fallback;
  };

  const createNewsRecord = () => {
    const records = Array.isArray(data.news) ? data.news : [];
    return {
      id: makeUniqueId(records, `news-${Date.now()}`, "news"),
      title: "Tin tức mới",
      date: new Date().toLocaleDateString("vi-VN"),
      image: "assets/optimized/project-workshop-equipment.jpg",
      summary: "",
      content: "",
      url: "",
      active: true,
      sortOrder: records.length + 1
    };
  };

  const createJobRecord = () => {
    const records = Array.isArray(data.jobs) ? data.jobs : [];
    return {
      id: makeUniqueId(records, `job-${Date.now()}`, "job"),
      title: "Vị trí mới",
      description: "",
      active: true,
      sortOrder: records.length + 1
    };
  };

  const createProductCategoryRecord = () => {
    const records = Array.isArray(data.productCategories) ? data.productCategories : [];
    return {
      id: makeUniqueId(records, `category-${Date.now()}`, "category"),
      name: "Danh mục mới",
      active: true,
      sortOrder: records.length + 1
    };
  };

  const listEditorConfigs = {
    banners: {
      singular: "banner",
      addLabel: "Thêm banner",
      emptyTitle: "Chọn một banner để sửa",
      create: createBannerRecord,
      titleKey: "title",
      subtitleKey: "alt",
      imageKey: "image",
      imageAspect: "3:1",
      fields: [
        { key: "id", label: "ID banner", required: true, slugFrom: "title" },
        { key: "title", label: "Tiêu đề banner", required: true },
        {
          key: "page",
          label: "Vị trí hiển thị",
          input: "select",
          options: [
            { value: "home", label: "Trang chủ" },
            { value: "contact", label: "Liên hệ" }
          ]
        },
        { key: "image", label: "Ảnh banner (3:1)", input: "image", aspect: "3:1" },
        { key: "alt", label: "Mô tả ảnh / Alt text" },
        { key: "sortOrder", label: "Thứ tự", type: "number" },
        { key: "active", label: "Hiển thị banner", input: "checkbox" }
      ]
    },
    productCategories: {
      singular: "danh mục",
      addLabel: "Thêm danh mục",
      emptyTitle: "Chọn một danh mục để sửa",
      create: createProductCategoryRecord,
      titleKey: "name",
      subtitleKey: "id",
      fields: [
        { key: "id", label: "ID danh mục", required: true, slugFrom: "name" },
        { key: "name", label: "Tên danh mục", required: true },
        { key: "sortOrder", label: "Thứ tự", type: "number" },
        { key: "active", label: "Hiển thị danh mục", input: "checkbox" }
      ]
    },
    partners: {
      singular: "đối tác",
      addLabel: "Thêm đối tác",
      emptyTitle: "Chọn một đối tác để sửa",
      create: createPartnerRecord,
      titleKey: "name",
      subtitleKey: "label",
      imageKey: "image",
      imageOptional: true,
      fields: [
        { key: "id", label: "ID", required: true, slugFrom: "name" },
        { key: "name", label: "Tên thương hiệu / đối tác", required: true },
        { key: "label", label: "Dòng phụ" },
        { key: "image", label: "Logo ảnh (tùy chọn)", input: "image", optional: true },
        { key: "url", label: "Link", type: "url" },
        {
          key: "tone",
          label: "Màu chữ text logo",
          input: "palette",
          help: "Chỉ áp dụng khi không upload logo ảnh. Nếu có logo ảnh thì màu chữ không cần dùng."
        },
        { key: "sortOrder", label: "Thứ tự", type: "number" },
        { key: "active", label: "Hiển thị đối tác", input: "checkbox" }
      ]
    },
    news: {
      singular: "tin tức",
      addLabel: "Thêm tin tức",
      emptyTitle: "Chọn một tin tức để sửa",
      create: createNewsRecord,
      titleKey: "title",
      subtitleKey: "summary",
      imageKey: "image",
      imageAspect: "16:9",
      fields: [
        { key: "id", label: "ID", required: true, slugFrom: "title" },
        { key: "title", label: "Tiêu đề tin tức", required: true },
        { key: "date", label: "Ngày hiển thị" },
        { key: "image", label: "Ảnh tin tức", input: "image", aspect: "16:9" },
        { key: "summary", label: "Mô tả ngắn", input: "textarea" },
        { key: "content", label: "Nội dung chi tiết", input: "textarea" },
        {
          key: "url",
          label: "Link khi bấm vào tin",
          type: "url",
          placeholder: "Để trống nếu dùng trang chi tiết nội bộ",
          help: "Nhập link nếu muốn chuyển người dùng sang trang khác. Không có link thì tin sẽ mở trang chi tiết tự động."
        },
        { key: "sortOrder", label: "Thứ tự", type: "number" },
        { key: "active", label: "Hiển thị tin tức", input: "checkbox" }
      ]
    },
    jobs: {
      singular: "vị trí",
      addLabel: "Thêm vị trí",
      emptyTitle: "Chọn một vị trí để sửa",
      create: createJobRecord,
      titleKey: "title",
      subtitleKey: "description",
      fields: [
        { key: "id", label: "ID", required: true, slugFrom: "title" },
        { key: "title", label: "Tên vị trí", required: true },
        { key: "description", label: "Mô tả vị trí", input: "textarea" },
        { key: "sortOrder", label: "Thứ tự", type: "number" },
        { key: "active", label: "Hiển thị vị trí", input: "checkbox" }
      ]
    }
  };

  const renderSummary = () => {
    if (currentKey !== "overview") {
      summary.innerHTML = "";
      summary.style.display = "none";
      return;
    }

    summary.style.display = "";
    if (isInitialLoading) {
      summary.innerHTML = Array(6).fill(0).map(() => `
        <article class="admin-summary-card" style="cursor: default;">
          <div class="admin-summary-card-header">
            <span class="admin-skeleton" style="height: 14px; width: 60px;"></span>
            <div class="admin-summary-card-icon"><span class="admin-skeleton" style="height: 20px; width: 20px; border-radius: 50%;"></span></div>
          </div>
          <strong><span class="admin-skeleton" style="height: 28px; width: 45px; margin: 4px 0 6px 0;"></span></strong>
          <small><span class="admin-skeleton" style="height: 12px; width: 100px;"></span></small>
        </article>
      `).join("");
      return;
    }

    const summaryCards = [
      { key: "news", label: "Tin tức", value: countItems("news"), note: `${activeCount("news")} đang hiển thị` },
      { key: "products", label: "Sản phẩm", value: countItems("products"), note: `${activeCount("products")} đang hiển thị` },
      { key: "services", label: "Dịch vụ", value: countItems("services"), note: `${activeCount("services")} đang hiển thị` },
      { key: "jobs", label: "Ứng tuyển", value: countItems("jobs"), note: `${activeCount("jobs")} vị trí đang bật` },
      { key: "contactMessages", label: "Liên hệ", value: countItems("contactMessages"), note: "Yêu cầu từ khách hàng" },
      { key: "partners", label: "Đối tác", value: countItems("partners"), note: `${activeCount("partners")} đang hiển thị` }
    ];

    summary.innerHTML = summaryCards
      .map((card) => {
        const icon = sectionIcons[card.key] || "";
        return `
          <article class="admin-summary-card" data-section-jump="${card.key}" style="cursor: pointer;">
            <div class="admin-summary-card-header">
              <span>${card.label}</span>
              <div class="admin-summary-card-icon">${icon}</div>
            </div>
            <strong>${card.value}</strong>
            <small>${escapeHtml(card.note)}</small>
          </article>
        `;
      })
      .join("");

    summary.querySelectorAll("[data-section-jump]").forEach((card) => {
      card.addEventListener("click", () => {
        currentKey = card.dataset.sectionJump;
        render();
      });

      // Hiệu ứng tương tác nghiêng 3D (3D Card Tilt)
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Nghiêng tối đa 8 độ
        const rotateX = ((centerY - y) / centerY) * 8;
        const rotateY = ((x - centerX) / centerX) * 8;
        
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
        card.style.transition = "transform 0.08s ease";
        card.style.boxShadow = "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)";
      });
      
      card.style.transformStyle = "preserve-3d";
      card.style.backfaceVisibility = "hidden";

      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
        card.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.4s ease";
        card.style.boxShadow = "";
      });
    });
  };

  const handleProfileAction = async (action) => {
    const modal = document.getElementById("admin-general-modal");
    const title = document.getElementById("admin-modal-title");
    const body = document.getElementById("admin-modal-body-content");
    if (!modal || !title || !body) return;

    if (action === "logout") {
      if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi tài khoản admin?")) {
        if (supabaseClient) {
          await supabaseClient.auth.signOut();
        }
        window.location.href = "login.html";
      }
      return;
    }

    modal.classList.add("is-active");
    modal.setAttribute("aria-hidden", "false");
    const modalContent = modal.querySelector(".admin-cropper-content");
    if (modalContent) {
      modalContent.style.maxWidth = action === "logs" ? "720px" : "460px";
    }

    if (action === "info") {
      title.textContent = "Thông tin tài khoản";
      const currentAdmin = getCurrentAdmin();
      const currentName = currentAdmin.name;
      const currentEmail = currentAdmin.email;
      const currentRole = currentAdmin.role;
      const currentAvatar = currentAdmin.avatar;
      const initials = currentName.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "AD";
      
      const largeAvatarHtml = `
        <img id="profile-avatar-preview" src="${currentAvatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: ${currentAvatar ? 'block' : 'none'};" alt="Avatar">
        <div id="profile-avatar-initials" style="width: 100%; height: 100%; display: ${currentAvatar ? 'none' : 'flex'}; align-items: center; justify-content: center;">${escapeHtml(initials)}</div>
      `;
      
      body.innerHTML = `
        <form id="admin-profile-form" class="admin-form" style="padding: 10px 0;">
          <input type="hidden" id="profile-avatar-data" value="${escapeHtml(currentAvatar)}">
          <div class="admin-profile-card" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; margin-bottom: 20px; text-align: center;">
            <div id="profile-avatar-container" style="width: 68px; height: 68px; border-radius: 50%; background: var(--accent-green); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 700; margin: 0 auto 12px; box-shadow: 0 4px 10px rgba(16,185,129,0.2); border: 3px solid #ffffff; overflow: hidden; position: relative; cursor: pointer;" title="Bấm để đổi ảnh đại diện">
              ${largeAvatarHtml}
              <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: white; font-size: 0.55rem; padding: 2px 0; font-weight: bold; opacity: 0; transition: opacity 0.2s;" id="avatar-hover-label">ĐỔI ẢNH</div>
            </div>
            <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-main); font-weight: 700;">${escapeHtml(currentName)}</h4>
            <span class="admin-badge is-success" style="background: rgba(16, 185, 129, 0.1); color: var(--accent-green); border: none; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; margin-top: 8px; display: inline-block;">${escapeHtml(currentRole)}</span>
            <input type="file" id="profile-avatar-file" accept="image/*" style="display: none;">
          </div>
          
          <div style="display: grid; gap: 16px;">
            <label style="display: grid; gap: 6px; font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
              Tên hiển thị
              <input type="text" id="profile-name" value="${escapeHtml(currentName)}" required style="padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-weight: normal; background: #ffffff; color: var(--text-main); font-family: inherit; font-size: 0.9rem;">
            </label>
            <label style="display: grid; gap: 6px; font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
              Chức vụ
              <input type="text" id="profile-role" value="${escapeHtml(currentRole)}" required style="padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-weight: normal; background: #ffffff; color: var(--text-main); font-family: inherit; font-size: 0.9rem;">
            </label>
            <label style="display: grid; gap: 6px; font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
              Email liên hệ
              <input type="email" id="profile-email" value="${escapeHtml(currentEmail)}" required style="padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-weight: normal; background: #ffffff; color: var(--text-main); font-family: inherit; font-size: 0.9rem;">
            </label>
          </div>
          <button type="submit" class="admin-primary-btn" style="width: 100%; padding: 12px; margin-top: 24px; background: var(--accent-green); color: white;">Lưu thay đổi</button>
        </form>
      `;
      
      const avatarContainer = document.getElementById("profile-avatar-container");
      const avatarFile = document.getElementById("profile-avatar-file");
      const avatarDataInput = document.getElementById("profile-avatar-data");
      const previewImg = document.getElementById("profile-avatar-preview");
      
      avatarContainer?.addEventListener("mouseenter", () => {
        const label = document.getElementById("avatar-hover-label");
        if (label) label.style.opacity = "1";
      });
      avatarContainer?.addEventListener("mouseleave", () => {
        const label = document.getElementById("avatar-hover-label");
        if (label) label.style.opacity = "0";
      });
      avatarContainer?.addEventListener("click", () => {
        avatarFile?.click();
      });

      avatarFile?.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          openCropperModal(event.target.result, avatarDataInput, previewImg, 1);
        };
        reader.readAsDataURL(file);
      });

      avatarDataInput?.addEventListener("input", () => {
        if (avatarDataInput.value) {
          previewImg.src = avatarDataInput.value;
          previewImg.style.display = "block";
          const initialsDiv = document.getElementById("profile-avatar-initials");
          if (initialsDiv) initialsDiv.style.display = "none";
        }
      });
      
      const form = document.getElementById("admin-profile-form");
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newName = document.getElementById("profile-name").value.trim();
        const newEmail = document.getElementById("profile-email").value.trim();
        const newRole = document.getElementById("profile-role").value.trim();
        const newAvatar = document.getElementById("profile-avatar-data").value;
        
        if (!newName || !newEmail || !newRole) {
          showToast("Vui lòng nhập đủ tên, email và vai trò.", "error");
          return;
        }

        try {
          if (useClassicLocalAdmin) {
            writeLocalAdminProfile({
              name: newName,
              email: newEmail,
              role: newRole,
              avatar: newAvatar || ""
            });
            await addActivityLog("Cập nhật", "Tài khoản", `Đổi tên: ${newName}, Chức vụ: ${newRole}, Email: ${newEmail}`);
            renderNav();
            renderEditor();
            showToast("Đã lưu thông tin tài khoản thành công!", "success");
            modal.classList.remove("is-active");
            modal.setAttribute("aria-hidden", "true");
            return;
          }
          const { data: updatedUserData, error: updateUserError } = await supabaseClient.auth.updateUser({
            data: {
              displayName: newName,
              name: newName,
              role: newRole,
              contactEmail: newEmail,
              avatar: newAvatar || ""
            }
          });
          if (updateUserError) {
            throw updateUserError;
          }
          if (updatedUserData?.user) {
            currentAuthUser = updatedUserData.user;
          }

          await addActivityLog("Cập nhật", "Tài khoản", `Đổi tên: ${newName}, Chức vụ: ${newRole}, Email: ${newEmail}`);

          renderNav();
          renderEditor();

          showToast("Đã lưu thông tin tài khoản thành công!", "success");
          modal.classList.remove("is-active");
          modal.setAttribute("aria-hidden", "true");
        } catch (error) {
          console.error("Không lưu được thông tin tài khoản.", error);
          showToast("Không lưu được thông tin tài khoản. Vui lòng thử lại.", "error");
        }
      });
    } else if (action === "logs") {
      title.textContent = "Tất cả nhật ký hoạt động";
      try {
        await loadRemoteActivityLogs();
      } catch (error) {
        console.warn("Không tải được nhật ký hoạt động.", error);
      }
      const logs = activityLogs;
      
      if (logs.length === 0) {
        body.innerHTML = `
          <div class="admin-empty-state admin-empty-state-compact" style="padding: 30px 20px; text-align: center;">
            <h3 style="font-size: 0.95rem; margin-bottom: 4px;">Chưa có nhật ký hoạt động</h3>
            <p class="admin-muted" style="font-size: 0.8rem;">Các thao tác chỉnh sửa dữ liệu sẽ xuất hiện tại đây.</p>
          </div>
        `;
        return;
      }

      body.innerHTML = `
        <div style="max-height: 520px; overflow-y: auto; display: grid; gap: 10px; font-size: 0.85rem; padding-right: 4px;">
          ${logs.map(log => {
            let leftBorderColor = "var(--primary-color)";
            if (log.action === "Xóa") leftBorderColor = "#ef4444";
            if (log.action === "Thêm mới" || log.action === "Nhập dữ liệu" || log.action === "Gửi mới" || log.action === "Gui moi") leftBorderColor = "#3b82f6";
            const actorName = log.actorName || getCurrentAdmin().name;
            const actorRole = log.actorRole || "";
            const titleText = formatActivityTitle(log);
            
            return `
              <div style="padding: 10px 14px; border-left: 3px solid ${leftBorderColor}; background: rgba(0,0,0,0.02); border-radius: 0 4px 4px 0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom: 4px;">
                  <strong style="color:var(--text-main); font-weight:700; flex:1; min-width:0; word-break:break-word;">${escapeHtml(titleText)}</strong>
                  <small style="color:var(--text-muted); font-size: 0.75rem; flex-shrink:0; white-space:nowrap; margin-left:auto;">${escapeHtml(formatDateTime(log.time))}</small>
                </div>
                <span style="color:var(--text-muted); display: block; font-size: 0.8rem; margin-top: 2px;">
                  Từ: <b style="color:var(--accent-green);">${escapeHtml(actorName)}</b>${actorRole ? ` - ${escapeHtml(actorRole)}` : ""}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  };

  const setupGeneralModal = () => {
    const modal = document.getElementById("admin-general-modal");
    const closeBtn = document.getElementById("admin-modal-close-btn");
    if (!modal || !closeBtn) return;
    
    closeBtn.addEventListener("click", () => {
      modal.classList.remove("is-active");
      modal.setAttribute("aria-hidden", "true");
    });
    
    window.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("is-active");
        modal.setAttribute("aria-hidden", "true");
      }
    });
  };

  const sectionIcons = {
    overview: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>`,
    company: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="16"></line><line x1="15" y1="22" x2="15" y2="16"></line><line x1="9" y1="16" x2="15" y2="16"></line><path d="M9 6h6"></path><path d="M9 10h6"></path></svg>`,
    brand: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path></svg>`,
    aboutPage: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18"></path><path d="M7 3v18"></path><path d="M14 3v18"></path><path d="M3 15h18"></path></svg>`,
    recruitmentNotice: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
    banners: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
    partners: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    productCategories: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    products: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`,
    services: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
    news: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    jobs: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
    contactMessages: `<svg class="admin-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`
  };

  const activityIcons = {
    products: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5 9 5 9-5Z"></path><path d="M3 8v8l9 5 9-5V8"></path><path d="M12 13v8"></path></svg>`,
    services: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.6-3.6a6 6 0 0 1-8 8l-6.8 6.8a2 2 0 0 1-2.8-2.8l6.8-6.8a6 6 0 0 1 8-8l-3.8 3.8Z"></path></svg>`,
    news: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>`,
    jobs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path></svg>`,
    contactMessages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"></path><path d="m22 6-10 7L2 6"></path></svg>`,
    partners: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3"></path><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path><path d="M2 20a6 6 0 0 1 12 0"></path><path d="M14 20a5 5 0 0 1 8 0"></path></svg>`,
    banners: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="8" cy="10" r="1.5"></circle><path d="m21 16-5-5L5 19"></path></svg>`,
    brand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3"></circle></svg>`,
    company: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M9 8h6M9 12h6M9 21v-5h6v5"></path></svg>`,
    default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 2"></path><circle cx="12" cy="12" r="9"></circle></svg>`
  };

  const getActivitySectionKey = (target = "") => {
    const value = String(target).toLowerCase();
    if (value.includes("sản phẩm")) return "products";
    if (value.includes("dịch vụ")) return "services";
    if (value.includes("tin tức")) return "news";
    if (value.includes("thông báo tuyển dụng")) return "recruitmentNotice";
    if (value.includes("tuyển dụng") || value.includes("ứng tuyển") || value.includes("ung tuyen") || value.includes("vị trí")) return "jobs";
    if (value.includes("liên hệ") || value.includes("lien he")) return "contactMessages";
    if (value.includes("đối tác") || value.includes("thương hiệu")) return "partners";
    if (value.includes("banner")) return "banners";
    if (value.includes("nhận diện") || value.includes("tài khoản")) return "brand";
    if (value.includes("công ty")) return "company";
    return "default";
  };

  const getActivityTargetName = (target = "") => {
    const value = String(target).toLowerCase();
    if (value.includes("sản phẩm")) return "sản phẩm";
    if (value.includes("dịch vụ")) return "dịch vụ";
    if (value.includes("tin tức")) return "tin tức";
    if (value.includes("thông báo tuyển dụng")) return "thông báo tuyển dụng";
    if (value.includes("tuyển dụng") || value.includes("vị trí")) return "vị trí tuyển dụng";
    if (value.includes("ứng tuyển") || value.includes("ung tuyen")) return "ứng tuyển";
    if (value.includes("liên hệ") || value.includes("lien he")) return "yêu cầu liên hệ";
    if (value.includes("thương hiệu")) return "thương hiệu";
    if (value.includes("đối tác")) return "đối tác";
    if (value.includes("banner")) return "banner";
    if (value.includes("danh mục")) return "danh mục";
    if (value.includes("nhận diện")) return "nhận diện";
    if (value.includes("công ty")) return "thông tin công ty";
    if (value.includes("tài khoản")) return "tài khoản";
    return String(target || "nội dung").toLowerCase();
  };

  const formatActivityTitle = (log) => {
    const rawAction = String(log.action || "Hoạt động").trim();
    const actionMap = {
      "Thêm mới": "Thêm",
      "Tạo nháp": "Tạo nháp",
      "Cập nhật": "Cập nhật",
      "Xóa": "Xóa",
      "Ẩn": "Ẩn",
      "Hiện": "Hiện",
      "Chuẩn hóa": "Chuẩn hóa",
      "Gửi mới": "Gửi",
      "Gui moi": "Gửi"
    };
    const action = actionMap[rawAction] || rawAction;
    const targetName = getActivityTargetName(log.target);
    let detail = String(log.detail || "").trim();
    if (detail === "Thay đổi thông số cấu hình trực quan") {
      const sectionKey = getActivitySectionKey(log.target);
      const detailMap = {
        company: "Thông tin công ty, liên hệ và bản đồ",
        brand: "Logo, favicon, khẩu hiệu và kênh mạng xã hội",
        recruitmentNotice: "Thông báo đầu trang tuyển dụng"
      };
      detail = detailMap[sectionKey] || "Nội dung cấu hình";
    }
    return `${action} ${targetName}${detail ? `: ${detail}` : ""}`;
  };

  const renderNav = () => {
    const groups = [
      {
        label: "Hệ thống & Cấu hình",
        keys: ["overview", "company", "brand", "aboutPage"]
      },
      {
        label: "Quản lý sản phẩm",
        keys: ["productCategories", "products", "services", "banners"]
      },
      {
        label: "Truyền thông & Nhân lực",
        keys: ["news", "jobs", "recruitmentNotice"]
      },
      {
        label: "Khách hàng & Đối tác",
        keys: ["contactMessages", "partners"]
      }
    ];

    const renderGroup = (group) => {
      const buttonsHtml = group.keys
        .map((key) => sections.find((section) => section.key === key))
        .filter(Boolean)
        .map(
          (section) =>
            `<button type="button" data-section="${section.key}" class="${section.key === currentKey ? "is-active" : ""}">${sectionIcons[section.key] || ""}${section.label}</button>`
        )
        .join("");
      if (!buttonsHtml) return "";
      return `
        <div class="admin-nav-group">
          <span>${group.label}</span>
          ${buttonsHtml}
        </div>
      `;
    };

    const currentAdmin = getCurrentAdmin();
    const currentName = currentAdmin.name;
    const currentAvatar = currentAdmin.avatar;
    const currentRole = currentAdmin.role;
    const initials = currentName.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "AD";

    let avatarInnerHtml = "";
    if (currentAvatar) {
      avatarInnerHtml = `<img src="${currentAvatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" alt="Avatar">`;
    } else {
      avatarInnerHtml = escapeHtml(initials);
    }

    const adminProfileHtml = `
      <div class="admin-user-profile" data-admin-profile-toggle style="cursor: pointer;">
        <div class="admin-user-profile-header">
          <div class="admin-avatar-wrap">
            ${avatarInnerHtml}
            <span class="admin-status-dot pulse"></span>
          </div>
          <div class="admin-user-info">
            <strong>${escapeHtml(currentName)}</strong>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="${escapeHtml(currentRole)}">${escapeHtml(currentRole)}</span>
          </div>
          <svg class="admin-profile-arrow" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-left: auto; transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        
        <div class="admin-profile-menu-panel" data-admin-profile-dropdown style="display: none;">
          <button type="button" class="admin-profile-menu-item" data-profile-action="info">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Thông tin tài khoản
          </button>
          <button type="button" class="admin-profile-menu-item is-danger" data-profile-action="logout">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Đăng xuất
          </button>
        </div>
      </div>
    `;

    profileHosts.forEach((host) => {
      host.innerHTML = adminProfileHtml;
    });

    nav.innerHTML = groups.map(renderGroup).join("");

    // Handle profile toggle (Expandable Panel)
    profileHosts.forEach((profileRoot) => {
      const profileToggle = profileRoot.querySelector("[data-admin-profile-toggle]");
      const dropdown = profileRoot.querySelector("[data-admin-profile-dropdown]");
      const arrow = profileRoot.querySelector(".admin-profile-arrow");
      if (!profileToggle || !dropdown) return;
      profileToggle.addEventListener("click", (e) => {
        if (e.target.closest("[data-profile-action]")) return;

        const isOpen = dropdown.style.display === "block";
        dropdown.style.display = isOpen ? "none" : "block";
        if (arrow) {
          arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
        }
      });

      dropdown.querySelectorAll("[data-profile-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.dataset.profileAction;
          handleProfileAction(action);
        });
      });
    });

    nav.querySelectorAll("button[data-section]").forEach((button) => {
      button.addEventListener("click", () => {
        currentKey = button.dataset.section;
        setMobileMenuOpen(false);
        render();
      });
    });
  };

  const renderObjectEditor = (section) => {
    if (section.key === "aboutPage") {
      renderAboutPageEditor(section);
      return;
    }

    if (formSchemas[section.key]) {
      renderObjectFormEditor(section);
      return;
    }

    const value = data[section.key] || {};
    editor.innerHTML = `
      <div class="admin-empty-state">
        <h3>Chưa có form quản lý cho mục này</h3>
        <p>Mục này chưa cấu hình trực tiếp trên giao diện. Các nội dung thường dùng đã được tách thành form riêng ở menu bên trái.</p>
      </div>
    `;
  };

  const renderObjectFormEditor = (section) => {
    const schema = formSchemas[section.key];
    const value = data[section.key] || {};
    editor.innerHTML = `
      <div class="admin-editor-head">
        <div>
          <p class="admin-kicker">${section.label}</p>
          <h2>${schema.heading}</h2>
          <p class="admin-muted">${schema.note}</p>
        </div>
        <button class="admin-primary-btn" type="button" data-save-form>Lưu thay đổi</button>
      </div>
      <form class="admin-form admin-structured-form">
        <div class="admin-form-grid">
          ${schema.fields
            .map((field) => {
              const fieldValue = value[field.key];
              if (field.input === "checkbox") {
                return `
                  <label class="admin-checkbox-field">
                    <input type="checkbox" data-field="${field.key}" ${fieldValue !== false ? "checked" : ""}>
                    <span>${field.label}</span>
                  </label>
                `;
              }

              if (field.input === "textarea") {
                return `
                  <label class="admin-field-wide">
                    ${field.label}
                    <textarea data-field="${field.key}">${escapeHtml(fieldValue)}</textarea>
                  </label>
                `;
              }

              if (field.input === "image") {
                if (field.optional) {
                  return renderOptionalImagePicker(field.key, fieldValue, "data-field", field.label, field.aspect || "4:3");
                }
                return renderImagePicker(field.key, fieldValue, "data-field", field.aspect || "4:3", field.label);
              }

              return `
                <label>
                  ${field.label}
                  <input type="${field.type || "text"}" data-field="${field.key}" value="${escapeHtml(fieldValue)}">
                </label>
              `;
            })
            .join("")}
        </div>
        <p class="admin-form-status" data-editor-status aria-live="polite"></p>
      </form>
    `;
  };

  const renderAboutPageEditor = (section) => {
    const value = data.aboutPage || {};
    const values = Array.isArray(value.values) ? value.values : [];
    const heroImages = Array.isArray(value.heroImages) ? value.heroImages.slice(0, 3) : [];
    const capabilities = Array.isArray(value.capabilities) ? value.capabilities : [];
    const processSteps = Array.isArray(value.processSteps) ? value.processSteps : [];

    const renderRepeatRows = (group, items) =>
      items
        .map(
          (item, index) => `
            <div class="admin-repeat-row" data-repeat-row="${group}" data-row-index="${index}">
              ${
                group === "heroImages"
                  ? ""
                  : `
                    <label>
                      Tiêu đề
                      <input type="text" data-repeat-field="${group}" data-repeat-key="title" value="${escapeHtml(item.title || "")}">
                    </label>
                    <label class="admin-field-wide">
                      Nội dung
                      <textarea data-repeat-field="${group}" data-repeat-key="text">${escapeHtml(item.text || "")}</textarea>
                    </label>
                  `
              }
              ${
                group === "heroImages" || group === "capabilities"
                  ? `
                    <label>
                      Mô tả ảnh
                      <input type="text" data-repeat-field="${group}" data-repeat-key="alt" value="${escapeHtml(item.alt || "")}">
                    </label>
                    <label class="admin-field-wide admin-image-picker" data-image-aspect="4:3">
                      Ảnh hiển thị
                      <div class="admin-image-picker-row">
                        <div class="admin-image-upload">
                          <input type="hidden" data-repeat-field="${group}" data-repeat-key="image" value="${escapeHtml(item.image || "")}" data-image-value>
                          <input type="file" accept="image/*" data-image-upload>
                          <small>Chọn ảnh từ máy. Khi bấm lưu, ảnh sẽ được tải lên Supabase Storage.</small>
                        </div>
                        <div class="admin-image-preview-box ${item.image ? "" : "is-empty"}">
                          <img src="${escapeHtml(item.image ? imageSrc(item.image) : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")}" alt="Xem trước ảnh" data-image-preview>
                          <span>Chưa chọn ảnh</span>
                        </div>
                      </div>
                    </label>
                  `
                  : ""
              }
              <button class="admin-danger-btn admin-small-btn" type="button" data-remove-repeat-row="${group}">Xóa</button>
            </div>
          `
        )
        .join("");

    editor.innerHTML = `
      <div class="admin-editor-head">
        <div>
          <p class="admin-kicker">${section.label}</p>
          <h2>Chỉnh sửa nội dung trang giới thiệu</h2>
          <p class="admin-muted">Sửa nội dung hero và giá trị cốt lõi trên trang Giới thiệu.</p>
        </div>
        <button class="admin-primary-btn" type="button" data-save-form>Lưu thay đổi</button>
      </div>
      <form class="admin-form admin-structured-form" data-about-page-form>
        <div class="admin-form-grid">
          <label>
            <span class="admin-field-note">Nhãn hiệu hero</span>
            <input type="text" data-field="heroKicker" value="${escapeHtml(value.heroKicker)}">
          </label>
          <label>
            Tiêu đề hero
            <input type="text" data-field="heroTitle" value="${escapeHtml(value.heroTitle)}">
          </label>
          <label class="admin-field-wide">
            Đoạn mở đầu
            <textarea data-field="heroIntro">${escapeHtml(value.heroIntro)}</textarea>
          </label>
          <label class="admin-field-wide">
            Các đoạn nội dung bổ sung (mỗi dòng 1 đoạn)
            <textarea data-field="heroParagraphs">${escapeHtml(Array.isArray(value.heroParagraphs) ? value.heroParagraphs.join("\n") : value.heroParagraphs)}</textarea>
          </label>
        </div>

        <section class="admin-repeat-section">
          <div class="admin-repeat-header">
            <h3>Giá trị cốt lõi</h3>
            <button type="button" class="admin-secondary-btn" data-add-repeat-row="values">Thêm giá trị</button>
          </div>
          <div class="admin-repeat-group" data-array-group="values">
            ${renderRepeatRows("values", values)}
            ${values.length === 0 ? `<p class="admin-empty-note">Chưa có giá trị cốt lõi nào. Nhấn Thêm giá trị để tạo.</p>` : ""}
          </div>
        </section>

        <section class="admin-repeat-section">
          <div class="admin-repeat-header">
            <h3>Ảnh giới thiệu</h3>
            <button type="button" class="admin-secondary-btn" data-add-repeat-row="heroImages" ${heroImages.length >= 3 ? "disabled" : ""}>Thêm ảnh</button>
          </div>
          <p class="admin-muted">Chỉ dùng tối đa 3 ảnh: 2 ảnh nhỏ bên trái và 1 ảnh lớn bên phải.</p>
          <div class="admin-repeat-group" data-array-group="heroImages">
            ${renderRepeatRows("heroImages", heroImages)}
            ${heroImages.length === 0 ? `<p class="admin-empty-note">Chưa có ảnh giới thiệu nào. Nhấn Thêm ảnh để tạo.</p>` : ""}
          </div>
        </section>

        <section class="admin-repeat-section">
          <div class="admin-repeat-header">
            <h3>Năng lực cốt lõi</h3>
            <button type="button" class="admin-secondary-btn" data-add-repeat-row="capabilities">Thêm năng lực</button>
          </div>
          <div class="admin-repeat-group" data-array-group="capabilities">
            ${renderRepeatRows("capabilities", capabilities)}
            ${capabilities.length === 0 ? `<p class="admin-empty-note">Chưa có năng lực cốt lõi nào. Nhấn Thêm năng lực để tạo.</p>` : ""}
          </div>
        </section>

        <section class="admin-repeat-section">
          <div class="admin-repeat-header">
            <h3>Quy trình hợp tác</h3>
            <button type="button" class="admin-secondary-btn" data-add-repeat-row="processSteps">Thêm bước</button>
          </div>
          <div class="admin-repeat-group" data-array-group="processSteps">
            ${renderRepeatRows("processSteps", processSteps)}
            ${processSteps.length === 0 ? `<p class="admin-empty-note">Chưa có bước quy trình nào. Nhấn Thêm bước để tạo.</p>` : ""}
          </div>
        </section>

        <p class="admin-form-status" data-editor-status aria-live="polite"></p>
      </form>
    `;
  };

  const syncAboutPageForm = async (section) => {
    const status = getEditorStatus();
    const latestData = getData();
    const nextValue = { ...(latestData.aboutPage || {}) };

    editor.querySelectorAll("[data-field]").forEach((field) => {
      if (field.tagName === "TEXTAREA" || field.type === "text" || field.type === "url") {
        nextValue[field.dataset.field] = field.value.trim();
      }
    });

    const serializeRepeatGroup = (group) => {
      return Array.from(editor.querySelectorAll(`[data-repeat-row="${group}"]`))
        .map((row) => {
          const titleInput = row.querySelector(`[data-repeat-field="${group}"][data-repeat-key="title"]`);
          const textInput = row.querySelector(`[data-repeat-field="${group}"][data-repeat-key="text"]`);
          const imageInput = row.querySelector(`[data-repeat-field="${group}"][data-repeat-key="image"]`);
          const altInput = row.querySelector(`[data-repeat-field="${group}"][data-repeat-key="alt"]`);
          const title = titleInput?.value.trim() || "";
          const text = textInput?.value.trim() || "";
          const image = imageInput?.value.trim() || "";
          const alt = altInput?.value.trim() || "";
          if (!title && !text && !image && !alt) return null;
          return { title, text, image, alt };
        })
        .filter(Boolean);
    };

    nextValue.values = serializeRepeatGroup("values");
    nextValue.heroImages = serializeRepeatGroup("heroImages").slice(0, 3);
    nextValue.capabilities = serializeRepeatGroup("capabilities");
    nextValue.processSteps = serializeRepeatGroup("processSteps");
    nextValue.heroParagraphs = (nextValue.heroParagraphs || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      await saveSectionData("aboutPage", nextValue, { action: "Cập nhật", target: section.label, detail: "Trang giới thiệu" });
      status.textContent = `Đã lưu thay đổi vào ${saveDestinationText()}.`;
      status.style.color = "#138a5b";
      showToast("Đã lưu trang giới thiệu thành công!", "success");
      renderSummary();
      renderEditor();
    } catch (error) {
      status.textContent = error.message || "Lỗi lưu cấu hình.";
      status.style.color = "#c0392b";
      showToast("Không lưu được cấu hình!", "error");
    }
  };

  const renderArrayEditor = (section) => {
    if (listEditorConfigs[section.key]) {
      renderListFormEditor(section);
      return;
    }
    if (section.key === "contactMessages") {
      renderContactMessagesEditor(section);
      return;
    }
    if (section.key === "products") {
      renderProductEditor(section);
      return;
    }
    if (section.key === "services") {
      renderServiceEditor(section);
      return;
    }

    const records = Array.isArray(data[section.key]) ? data[section.key] : [];
    editor.innerHTML = `
      <div class="admin-editor-head">
        <div>
          <p class="admin-kicker">${section.label}</p>
          <h2>${records.length} bản ghi đang quản lý</h2>
          <p class="admin-muted">Mục này chưa có form riêng. Nên hoàn thiện form trước khi bàn giao cho khách hàng sử dụng.</p>
        </div>
        <div class="admin-actions">
        </div>
      </div>
      <div class="admin-record-list">
        ${records
          .map(
            (record, index) => `
              <article class="admin-record">
                <div>
                  <h3>${getRecordTitle(record, index)}</h3>
                  <p>${getRecordSubtitle(record)}</p>
                </div>
                <div class="admin-record-actions">
                  <button class="admin-small-btn" type="button" data-toggle-record="${index}">${record.active === false ? "Hiện" : "Ẩn"}</button>
                  <button class="admin-danger-btn" type="button" data-delete-record="${index}">Xóa</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
      <p class="admin-form-status" data-editor-status aria-live="polite"></p>
    `;
  };

  const renderOptionalImagePicker = (fieldName, value, datasetName, label, aspect = "4:3") => `
    <label class="admin-field-wide admin-image-picker" data-image-aspect="${aspect}">
      ${label}
      <div class="admin-image-picker-row">
        <div class="admin-image-upload">
          <input type="hidden" ${datasetName}="${fieldName}" value="${escapeHtml(value || "")}" data-image-value>
          <input type="file" accept="image/*" data-image-upload>
          <small>Chọn ảnh từ máy. Khi bấm lưu, ảnh sẽ được tải lên Supabase Storage.</small>
        </div>
        <div class="admin-image-preview-box ${value ? "" : "is-empty"}">
          <img src="${escapeHtml(value ? imageSrc(value) : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")}" alt="Xem trước ảnh" data-image-preview>
          <span>Chưa chọn ảnh</span>
        </div>
      </div>
    </label>
  `;

  const renderListField = (field, record, config) => {
    const dataset = `data-list-field="${field.key}"`;
    const value = record[field.key];
    if (field.input === "checkbox") {
      return `
        <label class="admin-checkbox-field">
          <input type="checkbox" ${dataset} ${value === false ? "" : "checked"}>
          <span>${field.label}</span>
        </label>
      `;
    }
    if (field.input === "textarea") {
      return `
        <label class="admin-field-wide">
          ${field.label}
          <textarea ${dataset} placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(value || "")}</textarea>
          ${field.help ? `<small>${escapeHtml(field.help)}</small>` : ""}
        </label>
      `;
    }
    if (field.input === "select") {
      const selectedValue = field.key === "tone" ? normalizeColorInputValue(value) : value;
      const options = (field.options || [])
        .map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return `<option value="${escapeHtml(optionValue)}" ${String(selectedValue || "") === String(optionValue) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
        })
        .join("");
      return `
        <label>
          ${field.label}
          <select ${dataset} ${field.required ? "required" : ""}>
            ${options}
          </select>
          ${field.help ? `<small>${escapeHtml(field.help)}</small>` : ""}
        </label>
      `;
    }
    if (field.input === "palette") {
      const selectedValue = normalizeColorInputValue(value);
      return `
        <label class="admin-field-wide">
          ${field.label}
          <div class="admin-color-palette" data-color-palette>
            <input type="hidden" ${dataset} value="${escapeHtml(selectedValue)}">
            <button class="admin-color-current" type="button" data-color-toggle>
              <span class="admin-color-current-dot" data-color-preview style="background: ${escapeHtml(selectedValue)}"></span>
              <strong data-color-value>${escapeHtml(selectedValue)}</strong>
              <span>Chọn màu</span>
            </button>
            <div class="admin-color-popover" data-color-popover>
              ${partnerTonePaletteGroups.map((group) => `
                <div class="admin-color-palette-group">
                  <span>${escapeHtml(group.title)}</span>
                  <div class="admin-color-grid">
                    ${group.colors.map((color) => `
                      <button class="admin-color-cell ${color.toLowerCase() === selectedValue.toLowerCase() ? "is-active" : ""}" type="button" data-color-option="${escapeHtml(color)}" style="background: ${escapeHtml(color)}" aria-label="${escapeHtml(color)}"></button>
                    `).join("")}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
          ${field.help ? `<small>${escapeHtml(field.help)}</small>` : ""}
        </label>
      `;
    }
    if (field.input === "image") {
      if (field.optional) {
        return renderOptionalImagePicker(field.key, value, "data-list-field", field.label, field.aspect || config.imageAspect || "4:3");
      }
      return renderImagePicker(field.key, value, "data-list-field", field.aspect || config.imageAspect || "4:3");
    }
    return `
      <label${field.key === "url" ? ' class="admin-field-wide"' : ""}>
        ${field.label}
        <input type="${field.type || "text"}" ${dataset} value="${escapeHtml(value || "")}" ${field.required ? "required" : ""} placeholder="${escapeHtml(field.placeholder || "")}">
        ${field.help ? `<small>${escapeHtml(field.help)}</small>` : ""}
      </label>
    `;
  };

  const renderListFormEditor = (section, editIndex = null) => {
    const config = listEditorConfigs[section.key];
    const records = Array.isArray(data[section.key]) ? data[section.key] : [];
    const isCreating = editIndex === "__new__";
    const editingRecord = isCreating ? config?.create() : Number.isInteger(editIndex) ? records[editIndex] : null;

    if (editingRecord) {
      editor.innerHTML = `
        <div class="admin-breadcrumb">
          <a href="#" data-back-to-list="${section.key}">Trang chủ</a>
          <span>&gt;</span>
          <a href="#" data-back-to-list="${section.key}">${section.label}</a>
          <span>&gt;</span>
          <span>${isCreating ? "Thêm mới" : "Chỉnh sửa"} ${config.singular}</span>
        </div>
        <div class="admin-editor-head">
          <div>
            <h2>${isCreating ? "Thêm mới" : "Chỉnh sửa"} ${config.singular}</h2>
            <p class="admin-muted">Bản ghi: <strong>${escapeHtml(editingRecord[config.titleKey] || editingRecord.title || editingRecord.name || "")}</strong></p>
          </div>
          <div class="admin-actions">
            <button class="admin-secondary-btn" type="button" data-back-to-list="${section.key}">Hủy</button>
            <button class="admin-primary-btn" type="button" data-submit-list-form>${isCreating ? "Lưu" : "Lưu thay đổi"}</button>
          </div>
        </div>

        <div class="admin-form-container">
          ${renderListRecordForm(section, config, editingRecord, isCreating ? "__new__" : editIndex)}
          <p class="admin-form-status" data-editor-status aria-live="polite"></p>
        </div>
      `;

      return;
    }

    editor.innerHTML = `
      <div class="admin-editor-head">
        <div>
          <p class="admin-kicker">${section.label}</p>
          <h2>${records.length} ${config.singular} đang quản lý</h2>
          <p class="admin-muted">Thêm, sửa, ẩn/hiện và sắp xếp danh sách dạng bảng trực quan.</p>
        </div>
        <div class="admin-actions">
          <button class="admin-primary-btn" type="button" data-add-list-record>${config.addLabel}</button>
        </div>
      </div>

      <div class="admin-table-toolbar">
        <div class="admin-table-filters">
          <input type="search" placeholder="Tìm kiếm nhanh..." data-table-search-input>
        </div>
      </div>

      <div class="admin-table-container">
        <div class="admin-table-wrapper">
          <table class="admin-table" data-list-table>
            <thead>
              <tr>
                <th style="width: 60px;">STT</th>
                ${config.imageKey ? '<th style="width: 80px;">Ảnh</th>' : ''}
                <th>Tiêu đề / Tên</th>
                <th>Dòng phụ / Thông tin</th>
                <th>Trạng thái</th>
                <th style="width: 100px;">Thứ tự</th>
                <th style="width: 150px; text-align: right;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${records.map((record, index) => {
                const title = record[config.titleKey] || record.title || record.name || `${section.label} ${index + 1}`;
                const subtitle = record[config.subtitleKey] || record.date || record.url || "";
                const image = config.imageKey ? record[config.imageKey] : "";
                
                return `
                  <tr>
                    <td>${index + 1}</td>
                    ${config.imageKey ? `
                      <td>
                        <img src="${escapeHtml(imageSrc(image))}" class="admin-table-thumb" alt="${escapeHtml(title)}">
                      </td>
                    ` : ''}
                    <td style="font-weight: 700;">${escapeHtml(title)}</td>
                    <td style="max-width: 300px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(subtitle)}</td>
                    <td>
                      <span class="admin-badge ${record.active === false ? "is-gray" : "is-success"}">
                        ${record.active === false ? "Ẩn" : "Hiển thị"}
                      </span>
                    </td>
                    <td>${record.sortOrder || index + 1}</td>
                    <td style="text-align: right;">
                      <div class="admin-action-btn-group">
                        <button class="admin-action-icon-btn is-edit" type="button" data-edit-list-record="${index}" title="Sửa">
                          <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="admin-action-icon-btn" type="button" data-toggle-list-record="${index}" title="Ẩn/Hiện">
                          <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        <button class="admin-action-icon-btn is-delete" type="button" data-delete-list-record="${index}" title="Xóa">
                          <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-pagination">
        <button class="admin-pagination-btn" disabled>&lt;</button>
        <button class="admin-pagination-btn is-active">1</button>
        <button class="admin-pagination-btn">&gt;</button>
      </div>

      <p class="admin-form-status" data-editor-status aria-live="polite"></p>
    `;

    setupTablePaginationAndFilters(editor, "[data-list-table]", "[data-table-search-input]");
  };

  const renderListRecordForm = (section, config, record, index) => `
    <form class="admin-form admin-product-form" data-list-form data-list-key="${section.key}" data-list-index="${index}">
      <div class="admin-form-grid">
        ${config.fields.map((field) => renderListField(field, record, config)).join("")}
      </div>
    </form>
  `;

  const renderBannerEditor = (section, editIndex = null) => {
    renderListFormEditor(section, editIndex);
  };

  const contactFieldLabels = {
    id: "ID",
    type: "Loại yêu cầu",
    title: "Tiêu đề",
    name: "Họ và tên",
    ho_ten: "Họ và tên",
    fullName: "Họ và tên",
    phone: "Số điện thoại",
    dien_thoai: "Số điện thoại",
    email: "Email",
    company: "Công ty",
    service: "Dịch vụ quan tâm",
    vi_tri: "Vị trí quan tâm",
    position: "Vị trí quan tâm",
    message: "Nội dung yêu cầu",
    gioi_thieu: "Kinh nghiệm / giới thiệu",
    note: "Ghi chú",
    attachment: "File đính kèm",
    cv: "CV",
    createdAt: "Ngày gửi",
    seen: "Trạng thái xem",
    active: "Trạng thái lưu",
    sortOrder: "Thứ tự"
  };

  const formatContactValue = (key, value) => {
    if (value === undefined || value === null || value === "") return "Chưa cung cấp";
        if (key === "seen") return value ? "Đã xem" : "Chưa xem";
    if (key === "active") return value === false ? "Đang ẩn" : "Đang lưu";
    if (key === "type") return value === "application" || value === "recruitment" ? "Ứng tuyển" : value === "contact" ? "Liên hệ" : value;
    if (key === "createdAt") return formatDate(value);
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getContactAttachmentPath = (record, attachmentData) => {
    const rawFields = record.rawFields && typeof record.rawFields === "object" ? record.rawFields : {};
    const directPath = rawFields.attachmentPath || rawFields.cvPath || "";
    if (directPath) return directPath;

    const value = String(attachmentData || "");
    if (!value || value.startsWith("data:")) return "";
    if (value.startsWith("contact-attachments/")) return value;

    try {
      const url = new URL(value);
      const marker = "/storage/v1/object/public/";
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex === -1) return "";
      const objectPath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      const bucket = supabaseConfig.privateBucket || supabaseConfig.mediaBucket || "moxon-media";
      return objectPath.startsWith(`${bucket}/`) ? objectPath.slice(bucket.length + 1) : objectPath;
    } catch {
      return "";
    }
  };

  const getSignedContactAttachmentUrl = async (record, attachmentData) => {
    const value = String(attachmentData || "");
    if (!value || value.startsWith("data:")) return value;
    if (!supabaseClient) return value.startsWith("http") ? value : "";

    const path = getContactAttachmentPath(record, value);
    if (!path) return value.startsWith("http") ? value : "";

    const { data: signedData, error } = await supabaseClient.storage
      .from(supabaseConfig.privateBucket || supabaseConfig.mediaBucket || "moxon-media")
      .createSignedUrl(path, 300, {
        download: record.attachment || record.rawFields?.attachment || record.rawFields?.cv || undefined
      });
    if (error) {
      console.warn("Không tạo được signed URL cho tệp liên hệ.", error);
      return value.startsWith("http") ? value : "";
    }
    return signedData?.signedUrl || "";
  };

  const openContactMessageDetail = async (record, index) => {
    const modal = document.getElementById("admin-general-modal");
    const title = document.getElementById("admin-modal-title");
    const body = document.getElementById("admin-modal-body-content");
    if (!modal || !title || !body) return;

    const wasUnseen = !record.seen;
    if (wasUnseen) {
      record.seen = true;
      const latestData = getData();
      const records = Array.isArray(latestData.contactMessages) ? latestData.contactMessages : [];
      if (records[index]) {
        records[index] = { ...records[index], seen: true };
        saveSectionData("contactMessages", records);
      }
    }

    const isApp = record.type === "application" || record.type === "recruitment";
    title.textContent = isApp ? "Chi tiết ứng tuyển" : "Chi tiết liên hệ";

    const name = record.name || record.fullName || record.rawFields?.name || record.rawFields?.ho_ten || "Người gửi";
    const phone = record.phone || record.rawFields?.phone || record.rawFields?.dien_thoai || "Chưa cung cấp";
    const email = record.email || record.rawFields?.email || "Chưa cung cấp";
    const company = record.company || record.rawFields?.company || "Chưa cung cấp";
    const service = record.service || record.rawFields?.service || record.rawFields?.vi_tri || record.position || "Không có";
    const message = record.message || record.rawFields?.message || record.rawFields?.gioi_thieu || record.note || "Không có";
    const attachment = record.attachment || record.rawFields?.attachment || record.rawFields?.cv || "";
    const attachmentData =
      record.attachmentData ||
      record.rawFields?.attachmentData ||
      record.rawFields?.cvData ||
      record.rawFields?.attachmentPath ||
      record.rawFields?.cvPath ||
      "";
    
    let dateStr = "Chưa rõ";
    if (record.createdAt) {
      try {
        const d = new Date(record.createdAt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleString("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        } else {
          dateStr = record.createdAt;
        }
      } catch {
        dateStr = record.createdAt;
      }
    }

    let attachmentHtml = "";
    if (attachment) {
      if (attachmentData) {
        const signedAttachmentUrl = await getSignedContactAttachmentUrl(record, attachmentData);
        const isImage = String(attachmentData).startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment);
        const attachmentActions = `
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
            <a href="${signedAttachmentUrl || "#"}" target="_blank" rel="noopener" class="admin-primary-btn" style="display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; font-size: 0.8rem; text-decoration: none; width: auto; background: var(--accent-green); color: white;${signedAttachmentUrl ? "" : " opacity: 0.55; pointer-events: none;"}">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Xem tệp
            </a>
            <a href="${signedAttachmentUrl || "#"}" download="${escapeHtml(attachment)}" class="admin-primary-btn" style="display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; font-size: 0.8rem; text-decoration: none; width: auto; background: var(--accent-blue); color: white;${signedAttachmentUrl ? "" : " opacity: 0.55; pointer-events: none;"}">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Tải xuống
            </a>
          </div>
        `;
        if (isImage) {
          attachmentHtml = `
            <div style="margin-top: 6px;">
              <a href="${signedAttachmentUrl || "#"}" target="_blank" title="Xem ảnh kích thước đầy đủ" style="display: inline-block; margin-bottom: 10px;${signedAttachmentUrl ? "" : " opacity: 0.55; pointer-events: none;"}">
                <img src="${signedAttachmentUrl || ""}" style="max-width: 100%; max-height: 160px; border-radius: var(--radius-md); border: 1px solid var(--border-color); object-fit: contain; display: block; box-shadow: var(--shadow-sm); cursor: pointer;">
              </a>
              ${attachmentActions}
            </div>
          `;
        } else {
          attachmentHtml = `
            <div style="margin-top: 6px;">
              <div style="background: #f8fafc; padding: 9px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color); font-size: 0.82rem; font-weight: 700; color: var(--text-main);">${escapeHtml(attachment)}</div>
              ${attachmentActions}
            </div>
          `;
        }
      } else {
        attachmentHtml = `
          <div style="margin-top: 6px;">
            <div style="background: #f1f5f9; padding: 8px 12px; border-radius: var(--radius-md); border: 1px dashed var(--border-color); display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <span style="font-size: 0.8rem; color: var(--text-main); font-weight: 500;">${escapeHtml(attachment)}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Không có dữ liệu tệp để tải xuống</span>
            </div>
          </div>
        `;
      }
    } else {
      attachmentHtml = `<span style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">Không có tệp đính kèm</span>`;
    }

    body.innerHTML = `
      <div class="admin-message-detail" style="padding: 4px 0;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div>
            <h4 style="margin: 0; font-size: 1.05rem; color: var(--text-main); font-weight: 700;">${escapeHtml(name)}</h4>
            <span style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; display: inline-block;">Gửi lúc: ${escapeHtml(dateStr)}</span>
          </div>
          <span class="admin-badge is-success" style="background: rgba(16, 185, 129, 0.1); color: var(--accent-green); border: none; padding: 4px 12px; border-radius: 20px; font-size: 0.72rem; font-weight: 700;">Đã xem</span>
        </div>
        
        <div style="display: grid; gap: 12px;">
          <div style="display: grid; grid-template-columns: 130px 1fr; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; font-size: 0.85rem;">
            <span style="font-weight: 700; color: var(--text-muted);">Loại yêu cầu</span>
            <span style="color: var(--text-main); font-weight: 600;">${isApp ? 'Ứng tuyển nhân sự' : 'Liên hệ tư vấn'}</span>
          </div>
          <div style="display: grid; grid-template-columns: 130px 1fr; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; font-size: 0.85rem;">
            <span style="font-weight: 700; color: var(--text-muted);">Số điện thoại</span>
            <a href="tel:${escapeHtml(phone)}" style="color: var(--accent-blue); text-decoration: none; font-weight: 600;">${escapeHtml(phone)}</a>
          </div>
          <div style="display: grid; grid-template-columns: 130px 1fr; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; font-size: 0.85rem;">
            <span style="font-weight: 700; color: var(--text-muted);">Email liên hệ</span>
            <a href="mailto:${escapeHtml(email)}" style="color: var(--accent-blue); text-decoration: none; font-weight: 600;">${escapeHtml(email)}</a>
          </div>
          ${!isApp ? `
          <div style="display: grid; grid-template-columns: 130px 1fr; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; font-size: 0.85rem;">
            <span style="font-weight: 700; color: var(--text-muted);">Công ty</span>
            <span style="color: var(--text-main);">${escapeHtml(company)}</span>
          </div>
          <div style="display: grid; grid-template-columns: 130px 1fr; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; font-size: 0.85rem;">
            <span style="font-weight: 700; color: var(--text-muted);">Dịch vụ quan tâm</span>
            <span style="color: var(--text-main); font-weight: 600;">${escapeHtml(service)}</span>
          </div>
          ` : `
          <div style="display: grid; grid-template-columns: 130px 1fr; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; font-size: 0.85rem;">
            <span style="font-weight: 700; color: var(--text-muted);">Vị trí ứng tuyển</span>
            <span style="color: var(--text-main); font-weight: 600;">${escapeHtml(service)}</span>
          </div>
          `}
          
          <div style="display: grid; gap: 4px; padding: 10px 12px; background: #f8fafc; border-radius: var(--radius-md); border: 1px solid var(--border-color); font-size: 0.85rem;">
            <span style="font-weight: 700; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Nội dung lời nhắn</span>
            <div style="color: var(--text-main); white-space: pre-line; line-height: 1.5; margin-top: 2px;">${escapeHtml(message)}</div>
          </div>
          
          <div style="display: grid; gap: 4px; padding: 10px 12px; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color); font-size: 0.85rem;">
            <span style="font-weight: 700; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Tệp đính kèm / Hồ sơ CV</span>
            <div>${attachmentHtml}</div>
          </div>
        </div>

      </div>
    `;

    modal.classList.add("is-active");
    modal.setAttribute("aria-hidden", "false");

    if (wasUnseen) {
      const contactSection = { key: "contactMessages", label: "Liên hệ", type: "array" };
      renderContactMessagesEditor(contactSection);
      wireEditorActions(contactSection);
    }
  };

  const renderContactMessagesEditor = (section) => {
    data = getData();
    const records = Array.isArray(data.contactMessages) ? data.contactMessages : [];
    editor.innerHTML = `
      <div class="admin-editor-head">
        <div>
          <p class="admin-kicker">${section.label}</p>
          <h2>${records.length} yêu cầu đang lưu</h2>
          <p class="admin-muted">Danh sách yêu cầu liên hệ / tuyển dụng của MOXON Tech dạng bảng B2B.</p>
        </div>
      </div>

      <div class="admin-table-toolbar">
        <div class="admin-table-filters">
          <input type="search" placeholder="Tìm kiếm nhanh..." data-table-search-input>
          <select data-table-filter-seen>
            <option value="">Tất cả trạng thái</option>
              <option value="seen">Đã xem</option>
            <option value="unseen">Chưa xem</option>
          </select>
        </div>
      </div>

      <div class="admin-table-container">
        <div class="admin-table-wrapper">
          <table class="admin-table" data-messages-table>
            <thead>
              <tr>
                <th style="width: 60px;">STT</th>
                <th>Khách hàng / Ứng viên</th>
                <th>Nội dung yêu cầu / Ghi chú</th>
                <th>Nguồn</th>
                <th style="width: 140px;">Ngày gửi</th>
                <th style="width: 120px;">Trạng thái</th>
                <th style="width: 150px; text-align: right;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${records.length ? records.map((record, index) => {
                const rawFields = record.rawFields && typeof record.rawFields === "object" ? record.rawFields : {};
                const displayName = record.name || record.fullName || rawFields.name || rawFields.ho_ten || "Khách ẩn";
                const displayPhone = record.phone || rawFields.phone || rawFields.dien_thoai || "";
                const displayEmail = record.email || rawFields.email || "";
                const customerInfo = `
                  <strong>${escapeHtml(displayName)}</strong>
                  <br><small>${escapeHtml(displayEmail)}${displayPhone ? ` - ${escapeHtml(displayPhone)}` : ""}</small>
                `;
                const content = escapeHtml(record.message || rawFields.message || rawFields.gioi_thieu || record.note || record.service || rawFields.service || rawFields.vi_tri || record.position || "Không có nội dung");
                const source = escapeHtml(record.type === "application" || record.type === "recruitment" ? "Ứng tuyển" : "Liên hệ");
                const date = formatContactTimestamp(record.createdAt || "");
                const statusClass = record.seen ? "is-success" : "is-warning";
        const statusLabel = record.seen ? "Đã xem" : "Chưa xem";
                
                return `
                  <tr data-seen="${record.seen ? 'seen' : 'unseen'}">
                    <td>${index + 1}</td>
                    <td>${customerInfo}</td>
                    <td style="max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${content}">${content}</td>
                    <td><span class="admin-category-badge category-cnc">${source}</span></td>
                    <td class="admin-date-cell">${date}</td>
                    <td>
                      <span class="admin-badge ${statusClass}">${statusLabel}</span>
                    </td>
                    <td style="text-align: right;">
            <button class="admin-action-icon-btn is-edit" type="button" data-toggle-message="${index}" title="${record.seen ? "Đánh dấu chưa xem" : "Đánh dấu đã xem"}">
                        <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </button>
                      <button class="admin-action-icon-btn" type="button" data-view-message="${index}" title="Xem đầy đủ thông tin">
                        <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>
                      </button>
                      <button class="admin-action-icon-btn is-delete" type="button" data-delete-message="${index}" title="Xóa">
                        <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="7" class="admin-empty-note" style="text-align: center;">Chưa có yêu cầu liên hệ/ứng tuyển nào.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-pagination">
        <button class="admin-pagination-btn" disabled>&lt;</button>
        <button class="admin-pagination-btn is-active">1</button>
        <button class="admin-pagination-btn">&gt;</button>
      </div>

      <p class="admin-form-status" data-editor-status aria-live="polite"></p>
    `;

    setupTablePaginationAndFilters(editor, "[data-messages-table]", "[data-table-search-input]", "[data-table-filter-seen]", "data-seen");
  };



  const renderProductEditor = (section, editIndex = null) => {
    let records = Array.isArray(data.products) ? data.products : [];
    const normalized = normalizeUniqueIds(records, "product");
    if (normalized.changed) {
      records = normalized.records;
      saveSectionData("products", records, { action: "Chuẩn hóa", target: "Sản phẩm", detail: "Tự động sửa ID sản phẩm bị trùng hoặc rỗng" });
        showToast("Đã tự động sửa ID sản phẩm bị trùng.", "info");
    }
    const categories = getProductCategories();
    const isCreating = editIndex === "__new__";
    const editingProduct = isCreating ? createProductRecord() : Number.isInteger(editIndex) ? records[editIndex] : null;
    const categoryName = (categoryId) => categories.find((category) => category.id === categoryId)?.name || categoryId || "Chưa có danh mục";
    const formCategories =
      editingProduct?.category && !categories.some((category) => category.id === editingProduct.category)
        ? [...categories, { id: editingProduct.category, name: `${categoryName(editingProduct.category)} (đang ẩn hoặc chưa có trong danh mục)` }]
        : categories;

    if (editingProduct) {
      editor.innerHTML = `
        <div class="admin-breadcrumb">
          <a href="#" data-back-to-list="products">Trang chủ</a>
          <span>&gt;</span>
          <a href="#" data-back-to-list="products">${section.label}</a>
          <span>&gt;</span>
          <span>${isCreating ? "Thêm mới" : "Chỉnh sửa"} sản phẩm</span>
        </div>
        <div class="admin-editor-head">
          <div>
            <h2>${isCreating ? "Thêm mới" : "Chỉnh sửa"} sản phẩm</h2>
            <p class="admin-muted">Bản ghi: <strong>${escapeHtml(editingProduct.title)}</strong></p>
          </div>
          <div class="admin-actions">
            <button class="admin-secondary-btn" type="button" data-back-to-list="products">Hủy</button>
            <button class="admin-primary-btn" type="button" data-submit-product-form>${isCreating ? "Lưu" : "Lưu thay đổi"}</button>
          </div>
        </div>

        <div class="admin-form-container">
          ${renderProductForm(editingProduct, isCreating ? "__new__" : editIndex, formCategories)}
          <p class="admin-form-status" data-editor-status aria-live="polite"></p>
        </div>
      `;

      editor.querySelectorAll("[data-back-to-list]").forEach(el => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          renderProductEditor(section, null);
          wireEditorActions(section);
        });
      });

      const saveBtn = editor.querySelector("[data-submit-product-form]");
      if (saveBtn) {
        saveBtn.addEventListener("click", () => {
          if (saveBtn.disabled) return;
          saveBtn.disabled = true;
          runFormSave(editor.querySelector("[data-product-form]"), syncProductForm);
          window.setTimeout(() => {
            if (document.body.contains(saveBtn)) saveBtn.disabled = false;
          }, 700);
        });
      }

      return;
    }

    editor.innerHTML = `
      <div class="admin-editor-head">
        <div>
          <p class="admin-kicker">${section.label}</p>
          <h2>${records.length} sản phẩm đang quản lý</h2>
          <p class="admin-muted">Thêm, sửa, ẩn/hiện và sắp xếp sản phẩm. Bố cục dạng bảng giúp quản trị trực quan hơn.</p>
        </div>
        <div class="admin-actions">
          <button class="admin-secondary-btn" type="button" data-restore-catalog>Khôi phục dữ liệu mẫu</button>
          <button class="admin-primary-btn" type="button" data-add-product>+ Thêm sản phẩm</button>
        </div>
      </div>

      <div class="admin-table-toolbar">
        <div class="admin-table-filters">
          <input type="search" placeholder="Tìm kiếm nhanh..." data-table-search-input>
          <select data-table-filter-category>
            <option value="">Tất cả danh mục</option>
            ${categories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="admin-table-container">
        <div class="admin-table-wrapper">
          <table class="admin-table" data-products-table>
            <thead>
              <tr>
                <th style="width: 60px;">STT</th>
                <th style="width: 80px;">Ảnh</th>
                <th>Tên sản phẩm</th>
                <th>Danh mục</th>
                <th>Trạng thái</th>
                <th style="width: 110px;">Thứ tự</th>
                <th style="width: 120px;">Ngày tạo</th>
                <th style="width: 120px; text-align: right;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${records.map((product, index) => {
                return `
                  <tr data-row-category="${escapeHtml(product.category || '')}">
                    <td>${index + 1}</td>
                    <td>
                      <img src="${escapeHtml(imageSrc(product.image))}" class="admin-table-thumb" alt="${escapeHtml(product.title)}">
                    </td>
                    <td style="font-weight: 700;">${escapeHtml(product.title)}</td>
                    <td>
                      <span class="admin-category-badge category-${product.category}">${escapeHtml(categoryName(product.category))}</span>
                    </td>
                    <td>
                      <span class="admin-badge ${product.active === false ? "is-gray" : "is-success"}">
                        ${product.active === false ? "Ẩn" : "Hiển thị"}
                      </span>
                    </td>
                    <td>${product.sortOrder || index + 1}</td>
                    <td>${formatDateTime(product.createdAt)}</td>
                    <td style="text-align: right;">
                      <div class="admin-action-btn-group">
                        <button class="admin-action-icon-btn is-edit" type="button" data-edit-product="${index}" title="Sửa">
                          <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="admin-action-icon-btn" type="button" data-toggle-product="${index}" title="Ẩn/Hiện">
                          <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        <button class="admin-action-icon-btn is-delete" type="button" data-delete-product="${index}" title="Xóa">
                          <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-pagination">
        <button class="admin-pagination-btn" disabled>&lt;</button>
        <button class="admin-pagination-btn is-active">1</button>
        <button class="admin-pagination-btn">2</button>
        <button class="admin-pagination-btn">&gt;</button>
      </div>

      <p class="admin-form-status" data-editor-status aria-live="polite"></p>
    `;

    setupTablePaginationAndFilters(editor, "[data-products-table]", "[data-table-search-input]", "[data-table-filter-category]", "data-row-category");
  };

  const renderProductForm = (product, index, categories) => `
    <form class="admin-form admin-product-form" data-product-form data-product-index="${index}">
      <div class="admin-form-section">
        <h4 class="admin-form-section-title">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          Thông tin cơ bản
        </h4>
        <div class="admin-form-grid">
          <label>
            ID sản phẩm
            <input type="text" data-product-field="id" value="${escapeHtml(product.id)}" data-manually-edited="${!product.id || product.id === 'product-new' || /^product-\d+$/.test(product.id) ? 'false' : 'true'}" required>
          </label>
          <label>
            Danh mục
            <select data-product-field="category">
              ${categories
                .map(
                  (category) =>
                    `<option value="${escapeHtml(category.id)}" ${category.id === product.category ? "selected" : ""}>${escapeHtml(category.name)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label>
            Tên sản phẩm
            <input type="text" data-product-field="title" value="${escapeHtml(product.title)}" required>
          </label>
          <label>
            <span class="admin-field-note">Nhãn hiệu</span>
            <input type="text" data-product-field="kicker" value="${escapeHtml(product.kicker)}">
          </label>
          <label class="admin-field-wide">
            Mô tả kỹ thuật
            <textarea data-product-field="description">${escapeHtml(product.description)}</textarea>
          </label>
          <label class="admin-field-wide">
            Từ khóa tìm kiếm
            <input type="text" data-product-field="search" value="${escapeHtml(product.search)}">
          </label>
        </div>
      </div>

      <div class="admin-form-section">
        <h4 class="admin-form-section-title">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          Hình ảnh hiển thị
        </h4>
        ${renderImagePicker("image", product.image, "data-product-field")}
      </div>

      <div class="admin-form-section">
        <h4 class="admin-form-section-title">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Cấu hình hiển thị
        </h4>
        <div class="admin-form-grid">
          <label>
            Thứ tự sắp xếp
            <input type="number" data-product-field="sortOrder" value="${escapeHtml(product.sortOrder)}" min="1">
          </label>
          <label class="admin-checkbox-field">
            <input type="checkbox" data-product-field="active" ${product.active === false ? "" : "checked"}>
            <span>Hiển thị sản phẩm</span>
          </label>
          <label class="admin-checkbox-field">
            <input type="checkbox" data-product-field="featured" ${product.featured === false ? "" : "checked"}>
            <span>Hiển thị ở trang chủ</span>
          </label>
        </div>
      </div>
    </form>
  `;

  const renderServiceEditor = (section, editIndex = null) => {
    const records = Array.isArray(data.services) ? data.services : [];
    const isCreating = editIndex === "__new__";
    const editingService = isCreating ? createServiceRecord() : Number.isInteger(editIndex) ? records[editIndex] : null;

    if (editingService) {
      editor.innerHTML = `
        <div class="admin-breadcrumb">
          <a href="#" data-back-to-list="services">Trang chủ</a>
          <span>&gt;</span>
          <a href="#" data-back-to-list="services">${section.label}</a>
          <span>&gt;</span>
          <span>${isCreating ? "Thêm mới" : "Chỉnh sửa"} dịch vụ</span>
        </div>
        <div class="admin-editor-head">
          <div>
            <h2>${isCreating ? "Thêm mới" : "Chỉnh sửa"} dịch vụ</h2>
            <p class="admin-muted">Bản ghi: <strong>${escapeHtml(editingService.title)}</strong></p>
          </div>
          <div class="admin-actions">
            <button class="admin-secondary-btn" type="button" data-back-to-list="services">Hủy</button>
            <button class="admin-primary-btn" type="button" data-submit-service-form>${isCreating ? "Lưu" : "Lưu thay đổi"}</button>
          </div>
        </div>

        <div class="admin-form-container">
          ${renderServiceForm(editingService, isCreating ? "__new__" : editIndex)}
          <p class="admin-form-status" data-editor-status aria-live="polite"></p>
        </div>
      `;

      editor.querySelectorAll("[data-back-to-list]").forEach(el => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          renderServiceEditor(section, null);
          wireEditorActions(section);
        });
      });

      const saveBtn = editor.querySelector("[data-submit-service-form]");
      if (saveBtn) {
        saveBtn.addEventListener("click", () => {
          runFormSave(editor.querySelector("[data-service-form]"), syncServiceForm);
        });
      }
      return;
    }

    editor.innerHTML = `
      <div class="admin-editor-head">
        <div>
          <p class="admin-kicker">${section.label}</p>
          <h2>${records.length} dịch vụ đang quản lý</h2>
          <p class="admin-muted">Thêm, sửa, ẩn/hiện và sắp xếp dịch vụ MOXON Tech dạng bảng trực quan.</p>
        </div>
        <div class="admin-actions">
          <button class="admin-primary-btn" type="button" data-add-service>+ Thêm dịch vụ</button>
        </div>
      </div>

      <div class="admin-table-toolbar">
        <div class="admin-table-filters">
          <input type="search" placeholder="Tìm kiếm nhanh..." data-table-search-input>
        </div>
      </div>

      <div class="admin-table-container">
        <div class="admin-table-wrapper">
          <table class="admin-table" data-services-table>
            <thead>
              <tr>
                <th style="width: 60px;">STT</th>
                <th style="width: 80px;">Ảnh</th>
                <th>Tên dịch vụ</th>
                <th>Mô tả ngắn</th>
                <th>Trạng thái</th>
                <th style="width: 100px;">Thứ tự</th>
                <th style="width: 120px; text-align: right;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${records.map((service, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>
                    <img src="${escapeHtml(imageSrc(service.image))}" class="admin-table-thumb" alt="${escapeHtml(service.title)}">
                  </td>
                  <td style="font-weight: 700;">${escapeHtml(service.title)}</td>
                  <td style="max-width: 320px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(service.summary || "")}</td>
                  <td>
                    <span class="admin-badge ${service.active === false ? "is-gray" : "is-success"}">
                      ${service.active === false ? "Ẩn" : "Hiển thị"}
                    </span>
                  </td>
                  <td>${service.sortOrder || index + 1}</td>
                  <td style="text-align: right;">
                    <div class="admin-action-btn-group">
                      <button class="admin-action-icon-btn is-edit" type="button" data-edit-service="${index}" title="Sửa">
                        <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button class="admin-action-icon-btn" type="button" data-toggle-service="${index}" title="Ẩn/Hiện">
                        <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </button>
                      <button class="admin-action-icon-btn is-delete" type="button" data-delete-service="${index}" title="Xóa">
                        <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-pagination">
        <button class="admin-pagination-btn" disabled>&lt;</button>
        <button class="admin-pagination-btn is-active">1</button>
        <button class="admin-pagination-btn">&gt;</button>
      </div>

      <p class="admin-form-status" data-editor-status aria-live="polite"></p>
    `;

    setupTablePaginationAndFilters(editor, "[data-services-table]", "[data-table-search-input]");
  };

  const renderServiceForm = (service, index) => `
    <form class="admin-form admin-product-form" data-service-form data-service-index="${index}">
      <div class="admin-form-section">
        <h4 class="admin-form-section-title">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          Thông tin cơ bản
        </h4>
        <div class="admin-form-grid">
          <label>
            ID dịch vụ
            <input type="text" data-service-field="id" value="${escapeHtml(service.id)}" data-manually-edited="${!service.id || /^service-\d+$/.test(service.id) ? 'false' : 'true'}" required>
          </label>
          <label>
            Tiêu đề dịch vụ
            <input type="text" data-service-field="title" value="${escapeHtml(service.title)}" required>
          </label>
          <label class="admin-field-wide">
            Mô tả ngắn
            <textarea data-service-field="summary">${escapeHtml(service.summary)}</textarea>
          </label>
          <label class="admin-field-wide">
            Danh sách ý chính (Mỗi ý một dòng)
            <textarea data-service-field="features">${escapeHtml(Array.isArray(service.features) ? service.features.join("\n") : "")}</textarea>
          </label>
        </div>
      </div>

      <div class="admin-form-section">
        <h4 class="admin-form-section-title">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          Hình ảnh hiển thị
        </h4>
        ${renderImagePicker("image", service.image, "data-service-field")}
      </div>

      <div class="admin-form-section">
        <h4 class="admin-form-section-title">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Cấu hình hiển thị
        </h4>
        <div class="admin-form-grid">
          <label>
            Thứ tự sắp xếp
            <input type="number" data-service-field="sortOrder" value="${escapeHtml(service.sortOrder)}" min="1">
          </label>
          <label class="admin-checkbox-field">
            <input type="checkbox" data-service-field="active" ${service.active === false ? "" : "checked"}>
            <span>Hiển thị dịch vụ</span>
          </label>
        </div>
      </div>
    </form>
  `;

  const syncFromObjectForm = async (section) => {
    const status = getEditorStatus();
    const latestData = getData();
    const currentValue = latestData[section.key] && typeof latestData[section.key] === "object" ? latestData[section.key] : {};
    const nextValue = { ...currentValue };
    const objectUpdateDetails = {
      company: "Thông tin công ty, liên hệ và bản đồ",
      brand: "Logo, favicon, khẩu hiệu và kênh mạng xã hội",
      recruitmentNotice: "Thông báo đầu trang tuyển dụng"
    };

    editor.querySelectorAll("[data-field]").forEach((field) => {
      const key = field.dataset.field;
      nextValue[key] = field.type === "checkbox" ? field.checked : field.value.trim();
    });

    try {
      await saveSectionData(section.key, nextValue, { action: "Cập nhật", target: section.label, detail: objectUpdateDetails[section.key] || "Nội dung cấu hình" });
      status.textContent = `Đã lưu thay đổi vào ${saveDestinationText()}.`;
      status.style.color = "#138a5b";
      showToast("Đã lưu cấu hình thành công!", "success");
      renderSummary();
    } catch (error) {
      status.textContent = error.message || "Lỗi lưu cấu hình.";
      status.style.color = "#c0392b";
      showToast("Không lưu được cấu hình!", "error");
    }
  };

  const syncBannerForm = async (form) => {
    const status = getEditorStatus();
    const index = Number(form.dataset.bannerIndex);
    const latestData = getData();
    const records = Array.isArray(latestData.banners) ? latestData.banners : [];
    const currentBanner = records[index];
    if (!currentBanner) return;

    const newId = form.querySelector('[data-banner-field="id"]').value.trim();
    if (!newId) {
      status.textContent = "ID không được để trống.";
      status.style.color = "#c0392b";
      showToast("ID không được để trống!", "error");
      return;
    }

    if (!/^[a-z0-9\-]+$/.test(newId)) {
      status.textContent = "ID chỉ chứa chữ cái thường, số và dấu gạch ngang.";
      status.style.color = "#c0392b";
      showToast("ID banner chưa hợp lệ!", "error");
      return;
    }

    const isDuplicate = records.some((banner, idx) => idx !== index && banner.id === newId);
    if (isDuplicate) {
      status.textContent = "ID này đã tồn tại ở banner khác, vui lòng đổi ID khác.";
      status.style.color = "#c0392b";
      showToast("ID banner bị trùng!", "error");
      return;
    }

    const nextBanner = { ...currentBanner };
    form.querySelectorAll("[data-banner-field]").forEach((field) => {
      const key = field.dataset.bannerField;
      if (field.type === "checkbox") {
        nextBanner[key] = field.checked;
      } else if (field.type === "number") {
        nextBanner[key] = Number(field.value) || 0;
      } else {
        nextBanner[key] = field.value.trim();
      }
    });

    records[index] = nextBanner;
    try {
      await saveSectionData("banners", records, { action: "Cập nhật", target: "Banner", detail: nextBanner.title || nextBanner.id });
      status.textContent = `Đã lưu banner vào ${saveDestinationText()}.`;
      status.style.color = "#138a5b";
      afterListSave(
        { key: "banners", label: "Banner", type: "array" },
        () => renderBannerEditor({ key: "banners", label: "Banner", type: "array" }),
        "Đã lưu banner thành công!"
      );
    } catch (error) {
      status.textContent = error.message || "Không lưu được banner.";
      status.style.color = "#c0392b";
      showToast(error.message || "Không lưu được banner!", "error");
    }
  };

  const syncProductForm = async (form) => {
    const status = getEditorStatus();
    const isNewRecord = form.dataset.productIndex === "__new__";
    const index = isNewRecord ? -1 : Number(form.dataset.productIndex);
    const latestData = getData();
    const records = Array.isArray(latestData.products) ? latestData.products : [];
    const currentProduct = isNewRecord ? createProductRecord() : records[index];
    if (!currentProduct) return;

    // Lấy ID nhập vào
    const newId = form.querySelector('[data-product-field="id"]').value.trim();
    if (!newId) {
      status.textContent = "ID không được để trống.";
      status.style.color = "#c0392b";
      showToast("ID không được để trống!", "error");
      return;
    }

    // Kiểm tra định dạng slug
    if (!/^[a-z0-9\-]+$/.test(newId)) {
      status.textContent = "ID chỉ chứa chữ cái thường, số và dấu gạch ngang (không khoảng trắng, không ký tự đặc biệt).";
      status.style.color = "#c0392b";
      showToast("ID chứa ký tự không hợp lệ!", "error");
      return;
    }

    // Kiểm tra trùng lặp ID
    const duplicateProduct = records.find((prod, idx) => idx !== index && String(prod.id || "").trim() === newId);
    if (duplicateProduct) {
      const duplicateIndex = records.indexOf(duplicateProduct) + 1;
      const duplicateTitle = duplicateProduct.title || duplicateProduct.id || `Sản phẩm dòng ${duplicateIndex}`;
      const duplicateState = duplicateProduct.active === false ? "đang ẩn" : "đang hiển thị";
      const message = `ID "${newId}" đã được dùng bởi "${duplicateTitle}" ở dòng ${duplicateIndex} (${duplicateState}).`;
      status.textContent = message;
      status.style.color = "#c0392b";
      showToast(message, "error");
      return;
    }

    const nextProduct = { ...currentProduct };
    form.querySelectorAll("[data-product-field]").forEach((field) => {
      const key = field.dataset.productField;
      if (field.type === "checkbox") {
        nextProduct[key] = field.checked;
      } else if (field.type === "number") {
        nextProduct[key] = Number(field.value) || 0;
      } else {
        nextProduct[key] = field.value.trim();
      }
    });
    nextProduct.material = "";
    nextProduct.tolerance = "";
    nextProduct.machining = "";

    const nextRecords = isNewRecord ? [nextProduct, ...records] : records.map((record, idx) => (idx === index ? nextProduct : record));
    const nextProducts = nextRecords.map((record, idx) => ({ ...record, sortOrder: record.sortOrder || idx + 1 }));
    try {
      await saveSectionData("products", nextProducts, { action: isNewRecord ? "Thêm mới" : "Cập nhật", target: "Sản phẩm", detail: nextProduct.title });
      status.textContent = `Đã lưu sản phẩm vào ${saveDestinationText()}.`;
      status.style.color = "#138a5b";
      afterListSave(
        { key: "products", label: "Sản phẩm", type: "array" },
        () => renderProductEditor({ key: "products", label: "Sản phẩm", type: "array" }),
        "Đã lưu sản phẩm thành công!"
      );
    } catch (error) {
      status.textContent = error.message || "Không lưu được sản phẩm.";
      status.style.color = "#c0392b";
      showToast(error.message || "Không lưu được sản phẩm!", "error");
    }
  };

  const syncServiceForm = async (form) => {
    const status = getEditorStatus();
    const isNewRecord = form.dataset.serviceIndex === "__new__";
    const index = isNewRecord ? -1 : Number(form.dataset.serviceIndex);
    const latestData = getData();
    const records = Array.isArray(latestData.services) ? latestData.services : [];
    const currentService = isNewRecord ? createServiceRecord() : records[index];
    if (!currentService) return;

    // Lấy ID nhập vào
    const newId = form.querySelector('[data-service-field="id"]').value.trim();
    if (!newId) {
      status.textContent = "ID không được để trống.";
      status.style.color = "#c0392b";
      showToast("ID không được để trống!", "error");
      return;
    }

    // Kiểm tra định dạng slug
    if (!/^[a-z0-9\-]+$/.test(newId)) {
      status.textContent = "ID chỉ chứa chữ cái thường, số và dấu gạch ngang (không khoảng trắng, không ký tự đặc biệt).";
      status.style.color = "#c0392b";
      showToast("ID chứa ký tự không hợp lệ!", "error");
      return;
    }

    // Kiểm tra trùng lặp ID
    const isDuplicate = records.some((serv, idx) => idx !== index && serv.id === newId);
    if (isDuplicate) {
      status.textContent = "ID này đã tồn tại ở dịch vụ khác, vui lòng đổi ID khác.";
      status.style.color = "#c0392b";
      showToast("Lỗi: ID dịch vụ bị trùng lặp!", "error");
      return;
    }

    const nextService = { ...currentService };
    form.querySelectorAll("[data-service-field]").forEach((field) => {
      const key = field.dataset.serviceField;
      if (field.type === "checkbox") {
        nextService[key] = field.checked;
      } else if (field.type === "number") {
        nextService[key] = Number(field.value) || 0;
      } else if (key === "features") {
        nextService[key] = field.value
          .split(/\n+/)
          .map((item) => item.trim())
          .filter(Boolean);
      } else {
        nextService[key] = field.value.trim();
      }
    });

    const nextRecords = isNewRecord ? [nextService, ...records] : records.map((record, idx) => (idx === index ? nextService : record));
    const nextServices = nextRecords.map((record, idx) => ({ ...record, sortOrder: record.sortOrder || idx + 1 }));
    try {
      await saveSectionData("services", nextServices, { action: isNewRecord ? "Thêm mới" : "Cập nhật", target: "Dịch vụ", detail: nextService.title || nextService.name });
      status.textContent = `Đã lưu dịch vụ vào ${saveDestinationText()}.`;
      status.style.color = "#138a5b";
      afterListSave(
        { key: "services", label: "Dịch vụ", type: "array" },
        () => renderServiceEditor({ key: "services", label: "Dịch vụ", type: "array" }),
        "Đã lưu dịch vụ thành công!"
      );
    } catch (error) {
      status.textContent = error.message || "Không lưu được dịch vụ.";
      status.style.color = "#c0392b";
      showToast("Không lưu được dịch vụ!", "error");
    }
  };

  const validateRecordId = (records, index, id, label) => {
    if (!id) return "ID không được để trống.";
    if (!/^[a-z0-9\-]+$/.test(id)) return "ID chỉ chứa chữ cái thường, số và dấu gạch ngang.";
    if (records.some((record, idx) => idx !== index && record.id === id)) return `ID ${label} bị trùng.`;
    return "";
  };

  const syncListForm = async (form) => {
    const status = getEditorStatus();
    const key = form.dataset.listKey;
    const isNewRecord = form.dataset.listIndex === "__new__";
    const index = isNewRecord ? -1 : Number(form.dataset.listIndex);
    const config = listEditorConfigs[key];
    const latestData = getData();
    const records = Array.isArray(latestData[key]) ? latestData[key] : [];
    const currentRecord = isNewRecord ? config?.create() : records[index];
    if (!config || !currentRecord) return;

    const nextRecord = { ...currentRecord };
    form.querySelectorAll("[data-list-field]").forEach((field) => {
      const fieldKey = field.dataset.listField;
      if (field.type === "checkbox") {
        nextRecord[fieldKey] = field.checked;
      } else if (field.type === "number") {
        nextRecord[fieldKey] = Number(field.value) || 0;
      } else {
        nextRecord[fieldKey] = field.value.trim();
      }
    });
    if (key === "banners") {
      nextRecord.page = nextRecord.page || "home";
    }

    const idError = validateRecordId(records, index, nextRecord.id, config.singular);
    if (idError) {
      status.textContent = idError;
      status.style.color = "#c0392b";
      showToast(idError, "error");
      return;
    }

    const nextRecords = isNewRecord ? [nextRecord, ...records] : records.map((record, idx) => (idx === index ? nextRecord : record));
    const nextSectionRecords = nextRecords.map((record, idx) => ({ ...record, sortOrder: record.sortOrder || idx + 1 }));
    try {
      await saveSectionData(key, nextSectionRecords, { 
        action: isNewRecord ? "Thêm mới" : "Cập nhật", 
        target: sections.find((item) => item.key === key)?.label || key, 
        detail: nextRecord.title || nextRecord.name || nextRecord.id 
      });
      status.textContent = `Đã lưu ${config.singular} vào ${saveDestinationText()}.`;
      status.style.color = "#138a5b";
      const nextSection = { key, label: sections.find((item) => item.key === key)?.label || key, type: "array" };
      afterListSave(nextSection, () => renderListFormEditor(nextSection), `Đã lưu ${config.singular} thành công!`);
    } catch (error) {
      status.textContent = error.message || `Không lưu được ${config.singular}.`;
      status.style.color = "#c0392b";
      showToast(error.message || `Không lưu được ${config.singular}!`, "error");
    }
  };

  const countItems = (key) => (Array.isArray(data[key]) ? data[key].length : 0);
  const activeCount = (key) => (Array.isArray(data[key]) ? data[key].filter((item) => item.active !== false).length : 0);
  const renderSupabaseLoadBadge = (status) => {
    const map = {
      ok: { className: "is-success", label: "OK" },
      empty: { className: "is-warning", label: "0 rows" },
      error: { className: "is-warning", label: "Lỗi" },
      pending: { className: "is-gray", label: "Đang tải" }
    };
    const current = map[status] || map.pending;
    return `<span class="admin-badge ${current.className}">${current.label}</span>`;
  };
  const renderSupabaseStatusCard = () => {
    const errors = supabaseLoadStatus.errors || [];
    return `
      <section class="admin-dashboard-card admin-dashboard-card-wide">
        <div class="admin-card-head">
          <h3>Trạng thái Supabase</h3>
          <span class="admin-muted">${escapeHtml(supabaseLoadStatus.lastUpdated || "Đang kiểm tra...")}</span>
        </div>
        <div style="display: grid; gap: 10px;">
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <span>Public snapshot: ${renderSupabaseLoadBadge(supabaseLoadStatus.publicSnapshot)}</span>
            <span>Authenticated: ${renderSupabaseLoadBadge(supabaseLoadStatus.authenticated)}</span>
            <span>Liên hệ: ${renderSupabaseLoadBadge(supabaseLoadStatus.contacts)}</span>
            <span>Nhật ký: ${renderSupabaseLoadBadge(supabaseLoadStatus.logs)}</span>
          </div>
          <p class="admin-muted" style="margin: 0;">
            Đã nạp: ${countItems("productCategories")} danh mục, ${countItems("products")} sản phẩm,
            ${supabaseLoadStatus.cmsSections || remoteCmsSectionKeys.size} CMS section,
            ${supabaseLoadStatus.contactRows} liên hệ, ${supabaseLoadStatus.logRows} nhật ký.
          </p>
          <p class="admin-muted" style="margin: 0;">
            Project: ${escapeHtml(String(supabaseConfig.url || "").replace(/\/+$/, ""))} | Admin: ${escapeHtml(currentAuthUser?.email || "không rõ")}
            | Bảng đọc: contact_messages, admin_activity_logs.
          </p>
          <p class="admin-muted" style="margin: 0;">
            JWT role: ${escapeHtml(supabaseLoadStatus.jwtRole || "chưa rõ")} | User ID: ${escapeHtml(supabaseLoadStatus.userId || currentAuthUser?.id || "chưa rõ")}
          </p>
          <p class="admin-muted" style="margin: 0;">
            Nguồn private: Liên hệ ${escapeHtml(supabaseLoadStatus.contactSource || "chưa có")} |
            Nhật ký ${escapeHtml(supabaseLoadStatus.logSource || "chưa có")}
          </p>
          ${
            errors.length
              ? `<p class="admin-empty-note" style="margin: 0;">Lỗi gần nhất: ${escapeHtml(errors.join(" | "))}</p>`
              : `<p class="admin-empty-note" style="margin: 0;">${
                  supabaseLoadStatus.contacts === "empty" || supabaseLoadStatus.logs === "empty"
                    ? "Nếu Supabase Table Editor có dữ liệu nhưng admin vẫn 0 rows, hãy kiểm tra RLS policy SELECT cho role authenticated."
                    : "Không ghi nhận lỗi tải dữ liệu trong phiên này."
                }</p>`
          }
        </div>
      </section>
    `;
  };

  const getItemTimestamp = (item) => {
    const created = item?.createdAt || "";
    const rawDate = created && !isDateOnlyValue(created)
      ? created
      : getProductActivityTime(item) || created || "";
    const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const isDateOnlyValue = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());

  const getProductActivityTime = (product) => {
    const title = String(product?.title || product?.name || "").trim().toLowerCase();
    const id = String(product?.id || "").trim().toLowerCase();
    if (!title && !id) return "";
    const matchedLog = activityLogs.find((log) => {
      const target = String(log.target || "").toLowerCase();
      const detail = String(log.detail || "").toLowerCase();
      const action = String(log.action || "").toLowerCase();
      const isProductLog = target.includes("sản phẩm") || target.includes("san pham");
      const isMatchingProduct = (title && detail.includes(title)) || (id && detail.includes(id));
      const isCreateOrUpdate = action.includes("thêm") || action.includes("cập nhật") || action.includes("them") || action.includes("cap nhat");
      return isProductLog && isMatchingProduct && isCreateOrUpdate;
    });
    return matchedLog?.time || "";
  };

  const getLatestItems = (key, limit = 5) => {
    const items = Array.isArray(data[key]) ? data[key] : [];
    let mapped = items.map((item, index) => ({ ...item, _originalIndex: index }));
    if (key === "products") {
      mapped = mapped.filter((item) => item.active !== false);
    }
    if (key === "contactMessages" || key === "products") {
      return mapped
        .sort((a, b) => {
          const dateDiff = getItemTimestamp(b) - getItemTimestamp(a);
          if (dateDiff) return dateDiff;
          return (Number(b.sortOrder) || 0) - (Number(a.sortOrder) || 0);
        })
        .slice(0, limit);
    }
    return mapped
      .sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0))
      .slice(0, limit);
  };

  const getCleanDashboardDetail = (item, key) => {
    const raw = key === "products"
      ? item.description || item.summary || item.category || item.createdAt || ""
      : item.description ||
        item.summary ||
        item.message ||
        item.note ||
        item.service ||
        item.position ||
        item.date ||
        item.createdAt ||
        "";
    const value = String(raw || "");
    if (value.startsWith("data:image") || value.includes("base64,")) {
      return key === "products" ? item.category || "Sản phẩm" : key === "news" ? item.date || "Tin tức" : "Dữ liệu demo";
    }
    return value || (item.active === false ? "Đang ẩn" : "Đang hiển thị");
  };

  const getDashboardThumb = (item, title) => {
    const src = item.image || item.logo || "";
    if (src) {
      return `<img src="${escapeHtml(imageSrc(src))}" alt="${escapeHtml(title)}" loading="lazy">`;
    }
    return `<span>${escapeHtml(String(title || "MO").slice(0, 2).toUpperCase())}</span>`;
  };

  const renderDashboardListClean = (items, key) => {
    if (!items.length) {
      return `<div class="admin-empty-state admin-empty-state-compact">
        <h3>Chưa có dữ liệu</h3>
        <p class="admin-muted">Dữ liệu mới sẽ xuất hiện tại đây sau khi được thêm trong admin.</p>
      </div>`;
    }

    return `
      <div class="admin-dashboard-list admin-dashboard-list-rich">
        ${items
          .map((item) => {
            const title = item.title || item.name || item.service || item.email || item.phone || item.id || "Bản ghi";
            const detail = getCleanDashboardDetail(item, key);
            const badge = item.active === false ? "Đang ẩn" : key === "contactMessages" ? item.type || (item.seen ? "Đã xem" : "Chưa xem") : "Đang hiển thị";
            return `
              <article data-dashboard-jump-edit="${key}" data-dashboard-index="${item._originalIndex}" style="cursor: pointer;">
                <div class="admin-dashboard-thumb">${getDashboardThumb(item, title)}</div>
                <div style="flex: 1;">
                  <strong>${escapeHtml(title)}</strong>
                  <span>${escapeHtml(detail)}</span>
                </div>
                <small>${escapeHtml(badge)}</small>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const getContactSummary = (record) => {
    const rawFields = record.rawFields || {};
    const isApp = record.type === "application" || record.type === "recruitment";
    return {
      name: record.name || record.fullName || rawFields.name || rawFields.ho_ten || "Người gửi",
      phone: record.phone || rawFields.phone || rawFields.dien_thoai || "Chưa cung cấp",
      email: record.email || rawFields.email || "Chưa cung cấp",
      subject: record.service || rawFields.service || record.position || rawFields.vi_tri || (isApp ? "Ứng tuyển" : "Liên hệ tư vấn"),
      message: record.message || rawFields.message || rawFields.gioi_thieu || record.note || "Không có nội dung",
      date: record.createdAt || record.date || "",
      type: isApp ? "Ứng tuyển" : "Liên hệ",
      seen: Boolean(record.seen)
    };
  };

  const renderDashboardProductTable = (items) => {
    if (!items.length) {
      return `<div class="admin-empty-state admin-empty-state-compact">
        <h3>Chưa có sản phẩm</h3>
        <p class="admin-muted">Sản phẩm mới sẽ xuất hiện tại đây sau khi được thêm trong admin.</p>
      </div>`;
    }

    return `
      <div class="admin-dashboard-product-table">
        <div class="admin-dashboard-table-head">
          <span>Sản phẩm</span>
          <span>Danh mục</span>
          <span>Ngày tạo</span>
        </div>
        ${items
          .map((item) => {
            const title = item.title || item.name || "Sản phẩm";
            const category = item.categoryName || getProductCategoryName(item.category);
            const created = item.createdAt && !isDateOnlyValue(item.createdAt)
              ? item.createdAt
              : getProductActivityTime(item) || item.createdAt || "";
            const timeInfo = formatActivityTime(created);
            return `
              <article class="admin-dashboard-product-row" data-dashboard-jump-edit="products" data-dashboard-index="${item._originalIndex}">
                <div class="admin-dashboard-product-main">
                  <div class="admin-dashboard-product-thumb">${getDashboardThumb(item, title)}</div>
                  <strong>${escapeHtml(title)}</strong>
                </div>
                <span>${escapeHtml(category)}</span>
                <time class="admin-dashboard-product-time">
                  ${timeInfo.time
                    ? `<strong>${escapeHtml(timeInfo.time)}</strong><span>${escapeHtml(timeInfo.day)}</span>`
                    : `<strong>${escapeHtml(timeInfo.day)}</strong>`
                  }
                </time>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const renderDashboardContactList = (items) => {
    if (!items.length) {
      return `<div class="admin-empty-state admin-empty-state-compact">
        <h3>Chưa có liên hệ</h3>
        <p class="admin-muted">Yêu cầu từ khách hàng sẽ xuất hiện tại đây.</p>
      </div>`;
    }

    return `
      <div class="admin-dashboard-contact-list">
        ${items
          .map((record) => {
            const contact = getContactSummary(record);
            const timeInfo = formatActivityTime(contact.date || "");
            return `
              <article data-dashboard-jump-edit="contactMessages" data-dashboard-index="${record._originalIndex}">
                <div class="admin-contact-avatar-wrapper">
                  <div class="admin-contact-avatar">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span class="admin-contact-status-dot"></span>
                  </div>
                </div>
                
                <div class="admin-contact-info">
                  <strong class="admin-contact-name">${escapeHtml(contact.name)}</strong>
                  <div class="admin-contact-sub">
                    <span class="admin-contact-type is-${contact.type === "Ứng tuyển" ? "apply" : "contact"}">
                      ${
                        contact.type === "Ứng tuyển"
                          ? `
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-top: -2px;">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                        </svg>
                        Ứng tuyển
                      `
                          : `
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-top: -2px;">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg>
                        Liên hệ
                      `
                      }
                    </span>
                    <span class="admin-contact-badge is-${contact.seen ? "seen" : "unseen"}">
                      ${contact.seen ? "✓ Đã xem" : "â€¢ Chưa xem"}
                    </span>
                  </div>
                </div>

                <div class="admin-contact-time-section">
                  <time class="admin-contact-time-block">
                    <strong>${escapeHtml(timeInfo.time)}</strong>
                    <span>${escapeHtml(timeInfo.day)}</span>
                  </time>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const renderDashboardV2 = () => {
    data = getData();
    const products = getLatestItems("products", 5);
    const messages = getLatestItems("contactMessages", 5);
    const logs = activityLogs.slice(0, 6);

    if (isInitialLoading) {
      editor.innerHTML = `
        <div class="admin-dashboard-layout">
          <section class="admin-dashboard-card admin-dashboard-card-contact">
            <div class="admin-card-head">
              <h3><span class="admin-skeleton" style="height: 18px; width: 120px;"></span></h3>
              <span class="admin-skeleton" style="height: 14px; width: 80px;"></span>
            </div>
            <div style="display: grid; gap: 12px;">
              ${Array(4).fill(0).map(() => `
                <div style="display: flex; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                  <div class="admin-skeleton" style="height: 40px; width: 40px; border-radius: 50%; flex-shrink: 0;"></div>
                  <div style="flex: 1; display: grid; gap: 6px;">
                    <span class="admin-skeleton" style="height: 14px; width: 40%;"></span>
                    <span class="admin-skeleton" style="height: 12px; width: 70%;"></span>
                  </div>
                </div>
              `).join("")}
            </div>
          </section>

          <section class="admin-dashboard-card admin-dashboard-card-products">
            <div class="admin-card-head">
              <h3><span class="admin-skeleton" style="height: 18px; width: 120px;"></span></h3>
              <span class="admin-skeleton" style="height: 14px; width: 80px;"></span>
            </div>
            <div style="display: grid; gap: 12px;">
              <div style="display: flex; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                <span class="admin-skeleton" style="height: 14px; width: 45%;"></span>
                <span class="admin-skeleton" style="height: 14px; width: 25%; margin-left: auto;"></span>
                <span class="admin-skeleton" style="height: 14px; width: 20%; margin-left: 12px;"></span>
              </div>
              ${Array(4).fill(0).map(() => `
                <div style="display: flex; gap: 12px; align-items: center; padding: 10px 0;">
                  <div class="admin-skeleton" style="height: 38px; width: 38px; border-radius: 8px; flex-shrink: 0;"></div>
                  <div style="flex: 1; display: grid; gap: 6px;">
                    <span class="admin-skeleton" style="height: 14px; width: 50%;"></span>
                    <span class="admin-skeleton" style="height: 11px; width: 30%;"></span>
                  </div>
                  <span class="admin-skeleton" style="height: 12px; width: 60px; margin-left: auto;"></span>
                </div>
              `).join("")}
            </div>
          </section>

          <section class="admin-dashboard-card">
            <div class="admin-card-head">
              <h3><span class="admin-skeleton" style="height: 18px; width: 120px;"></span></h3>
              <span class="admin-skeleton" style="height: 14px; width: 80px;"></span>
            </div>
            <div style="display: grid; gap: 12px;">
              ${Array(5).fill(0).map(() => `
                <div style="display: flex; gap: 12px; align-items: flex-start; padding: 10px 0;">
                  <div class="admin-skeleton" style="height: 32px; width: 32px; border-radius: 50%; flex-shrink: 0;"></div>
                  <div style="flex: 1; display: grid; gap: 6px;">
                    <div style="display: flex; justify-content: space-between;">
                      <span class="admin-skeleton" style="height: 13px; width: 60%;"></span>
                      <span class="admin-skeleton" style="height: 11px; width: 50px;"></span>
                    </div>
                    <span class="admin-skeleton" style="height: 11px; width: 35%;"></span>
                  </div>
                </div>
              `).join("")}
            </div>
          </section>
        </div>
      `;
      return;
    }

    const renderActivityList = () => {
      if (!logs.length) {
        return `<p class="admin-empty-note">Chưa có hoạt động gần đây.</p>`;
      }
      const fallbackActor = getCurrentAdmin();
      return `
        <div class="admin-activity-list">
          ${logs
            .map((log) => {
              const actorName = log.actorName || fallbackActor.name;
              const sectionKey = getActivitySectionKey(log.target);
              const activityIcon = activityIcons[sectionKey] || activityIcons.default;
              const actionText = formatActivityTitle(log);
              const timeInfo = formatActivityTime(log.time || "");
              return `
                <article>
                  <span class="admin-activity-icon is-${escapeHtml(sectionKey)}">${activityIcon}</span>
                  <div class="admin-activity-body">
                    <div class="admin-activity-main">
                      <strong>${escapeHtml(actionText)}</strong>
                      <span>Từ: <b>${escapeHtml(actorName)}</b></span>
                    </div>
                    <time>
                      <strong>${escapeHtml(timeInfo.time)}</strong>
                      <span>${escapeHtml(timeInfo.day)}</span>
                    </time>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      `;
    };
    editor.innerHTML = `
      <div class="admin-dashboard-layout">
        ${renderSupabaseStatusCard()}

        <section class="admin-dashboard-card admin-dashboard-card-contact">
          <div class="admin-card-head">
            <h3>Liên hệ mới nhất</h3>
            <button class="admin-link-btn" type="button" data-section-jump="contactMessages">Xem liên hệ</button>
          </div>
          ${renderDashboardContactList(messages.slice(0, 4))}
        </section>

        <section class="admin-dashboard-card admin-dashboard-card-products">
          <div class="admin-card-head">
            <h3>Sản phẩm mới nhất</h3>
            <button class="admin-link-btn" type="button" data-section-jump="products">Xem sản phẩm</button>
          </div>
          ${renderDashboardProductTable(products)}
        </section>

        <section class="admin-dashboard-card">
          <div class="admin-card-head">
            <h3>Hoạt động gần đây</h3>
            <button class="admin-link-btn" type="button" data-dashboard-logs>Xem tất cả hoạt động</button>
          </div>
          ${renderActivityList()}
        </section>
      </div>
    `;

    editor.querySelectorAll("[data-section-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        currentKey = button.dataset.sectionJump;
        render();
      });
    });

    editor.querySelector("[data-dashboard-logs]")?.addEventListener("click", () => {
      handleProfileAction("logs");
    });

    editor.querySelectorAll("[data-dashboard-jump-edit]").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.dataset.dashboardJumpEdit;
        const idx = Number(el.dataset.dashboardIndex);
        currentKey = key;
        render();
        const section = sections.find((s) => s.key === key);
        if (key === "products") {
          renderProductEditor(section, idx);
        } else if (key === "services") {
          renderServiceEditor(section, idx);
        } else if (key === "contactMessages") {
          renderContactMessagesEditor(section);
        } else {
          renderListFormEditor(section, idx);
        }
        wireEditorActions(section);
      });
    });
  };

  const wireEditorActions = (section) => {
    const saveFormBtn = editor.querySelector("[data-save-form]");
    if (saveFormBtn) saveFormBtn.onclick = () => {
      const form = section.key === "aboutPage" ? editor.querySelector("[data-about-page-form]") : editor.querySelector(".admin-structured-form");
      if (section.key === "aboutPage") {
        runFormSave(form, () => syncAboutPageForm(section));
      } else {
        runFormSave(form, () => syncFromObjectForm(section));
      }
    };
    editor.querySelectorAll("[data-image-upload]").forEach((input) => {
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        const picker = input.closest(".admin-image-picker");
        const preview = picker?.querySelector("[data-image-preview]");
        const valueInput = picker?.querySelector("[data-image-value]");
        if (!file || !preview || !valueInput) return;

        try {
          const optimizedImage = await fileToOptimizedDataUrl(file);
          const aspect = getAspectValue(picker?.dataset.imageAspect);
          openCropperModal(optimizedImage, valueInput, preview, aspect);
          showToast("Đã chọn ảnh mới. Bạn có thể căn chỉnh hoặc bấm lưu để cập nhật.", "info");
        } catch (error) {
          const status = document.querySelector("[data-editor-status]");
          if (status) {
            status.textContent = error.message || "Không đọc được ảnh đã chọn.";
            status.style.color = "#c0392b";
          }
          showToast(error.message || "Không đọc được ảnh đã chọn.", "error");
        }
      });
    });

    editor.querySelectorAll("[data-image-preview]").forEach((img) => {
      img.addEventListener("click", () => {
        const picker = img.closest(".admin-image-picker");
        const valueInput = picker?.querySelector("[data-image-value]");
        if (img.closest(".admin-image-preview-box")?.classList.contains("is-empty")) {
          showToast("Chọn ảnh từ máy trước khi căn chỉnh.", "info");
          return;
        }
        const currentValue = imageSrc(valueInput?.value || img.getAttribute("src") || img.src);
        if (!valueInput) return;
        if (!currentValue) {
          showToast("Chọn ảnh từ máy trước khi căn chỉnh.", "info");
          return;
        }
        const aspect = getAspectValue(picker?.dataset.imageAspect);
        openCropperModal(currentValue, valueInput, img, aspect);
      });
    });

    // Tự động gợi ý sinh SEO Slug khi gõ tiêu đề sản phẩm
    const bannerForm = editor.querySelector("[data-banner-form]");
    if (bannerForm) {
      const titleInput = bannerForm.querySelector('[data-banner-field="title"]');
      const idInput = bannerForm.querySelector('[data-banner-field="id"]');
      if (titleInput && idInput) {
        idInput.addEventListener("input", () => {
          idInput.dataset.manuallyEdited = "true";
        });
        titleInput.addEventListener("input", () => {
          if (idInput.dataset.manuallyEdited !== "true") {
            const index = Number(bannerForm.dataset.bannerIndex);
            const records = Array.isArray(data.banners) ? data.banners : [];
            const otherRecords = records.filter((_, recordIndex) => recordIndex !== index);
            idInput.value = makeUniqueId(otherRecords, titleInput.value, "banner");
          }
        });
      }
    }

    const productForm = editor.querySelector("[data-product-form]");
    if (productForm) {
      const titleInput = productForm.querySelector('[data-product-field="title"]');
      const idInput = productForm.querySelector('[data-product-field="id"]');
      if (titleInput && idInput) {
        idInput.addEventListener("input", () => {
          idInput.dataset.manuallyEdited = "true";
        });
        titleInput.addEventListener("input", () => {
          if (idInput.dataset.manuallyEdited !== "true") {
            const rawIndex = productForm.dataset.productIndex;
            const currentIndex = rawIndex === "__new__" ? -1 : Number(rawIndex);
            const latestData = getData();
            const records = Array.isArray(latestData.products) ? latestData.products : [];
            const otherRecords = records.filter((_, recordIndex) => recordIndex !== currentIndex);
            idInput.value = makeUniqueId(otherRecords, titleInput.value, "product");
          }
        });
      }
    }

    // Tự động gợi ý sinh SEO Slug khi gõ tiêu đề dịch vụ
    const serviceForm = editor.querySelector("[data-service-form]");
    if (serviceForm) {
      const titleInput = serviceForm.querySelector('[data-service-field="title"]');
      const idInput = serviceForm.querySelector('[data-service-field="id"]');
      if (titleInput && idInput) {
        idInput.addEventListener("input", () => {
          idInput.dataset.manuallyEdited = "true";
        });
        titleInput.addEventListener("input", () => {
          if (idInput.dataset.manuallyEdited !== "true") {
            idInput.value = slugify(titleInput.value);
          }
        });
      }
    }

    const listForm = editor.querySelector("[data-list-form]");
    if (listForm) {
      const key = listForm.dataset.listKey;
      const config = listEditorConfigs[key];
      const slugField = config?.fields.find((field) => field.slugFrom);
      const idInput = listForm.querySelector('[data-list-field="id"]');
      const sourceInput = slugField ? listForm.querySelector(`[data-list-field="${slugField.slugFrom}"]`) : null;
      if (idInput && sourceInput) {
        idInput.addEventListener("input", () => {
          idInput.dataset.manuallyEdited = "true";
        });
        sourceInput.addEventListener("input", () => {
          if (idInput.dataset.manuallyEdited !== "true") {
            const rawIndex = listForm.dataset.listIndex;
            const currentIndex = rawIndex === "__new__" ? -1 : Number(rawIndex);
            const latestData = getData();
            const records = Array.isArray(latestData[key]) ? latestData[key] : [];
            const otherRecords = records.filter((_, recordIndex) => recordIndex !== currentIndex);
            idInput.value = makeUniqueId(otherRecords, sourceInput.value, key.replace(/s$/, "") || "record");
          }
        });
      }
    }

    editor.querySelectorAll("[data-back-to-list]").forEach((button) => {
      if (!listEditorConfigs[section.key]) return;
      button.onclick = (event) => {
        event.preventDefault();
        renderListFormEditor(section);
        wireEditorActions(section);
      };
    });

    const submitListFormBtn = editor.querySelector("[data-submit-list-form]");
    if (submitListFormBtn) submitListFormBtn.onclick = () => {
      runFormSave(editor.querySelector("[data-list-form]"), syncListForm);
    };

    const addListRecordBtn = editor.querySelector("[data-add-list-record]");
    if (addListRecordBtn) addListRecordBtn.onclick = () => {
      const config = listEditorConfigs[section.key];
      if (!config) return;
      renderListFormEditor(section, "__new__");
      wireEditorActions(section);
    };

    editor.querySelectorAll("[data-edit-list-record]").forEach((button) => {
      button.onclick = () => {
        renderListFormEditor(section, Number(button.dataset.editListRecord));
        wireEditorActions(section);
      };
    });

    editor.querySelectorAll("[data-toggle-list-record]").forEach((button) => {
      button.onclick = async () => {
        await runAdminAction(button, async () => {
          const latestData = getData();
          const records = Array.isArray(latestData[section.key]) ? latestData[section.key] : [];
          const index = Number(button.dataset.toggleListRecord);
          if (!records[index]) return;
          records[index].active = records[index].active === false;
          const action = records[index].active === false ? "Ẩn" : "Hiện";
          const targetName = getRecordTitle(records[index], index);
          await saveSectionData(section.key, records, { action, target: section.label, detail: targetName });
          renderSummary();
          renderListFormEditor(section);
          wireEditorActions(section);
          showToast("Đã cập nhật trạng thái hiển thị!", "success");
        }, { errorMessage: "Không cập nhật được trạng thái hiển thị." });
      };
    });

    editor.querySelectorAll("[data-delete-list-record]").forEach((button) => {
      button.onclick = async () => {
        if (confirm("Bạn có chắc chắn muốn xóa bản ghi này?")) {
          await runAdminAction(button, async () => {
            const latestData = getData();
            const records = Array.isArray(latestData[section.key]) ? latestData[section.key] : [];
            const index = Number(button.dataset.deleteListRecord);
            const targetName = records[index] ? getRecordTitle(records[index], index) : "";
            records.splice(index, 1);
            await saveSectionData(section.key, records, { action: "Xóa", target: section.label, detail: targetName });
            renderSummary();
            renderListFormEditor(section);
            wireEditorActions(section);
            showToast("Đã xóa bản ghi thành công!", "success");
          }, { errorMessage: "Không xóa được bản ghi." });
        }
      };
    });

    const listFormElement = editor.querySelector("[data-list-form]");
    if (listFormElement) {
      listFormElement.querySelectorAll("[data-color-toggle]").forEach((button) => {
        button.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          const palette = button.closest("[data-color-palette]");
          if (!palette) return;
          listFormElement.querySelectorAll("[data-color-palette].is-open").forEach((item) => {
            if (item !== palette) item.classList.remove("is-open");
          });
          palette.classList.toggle("is-open");
          if (palette.classList.contains("is-open")) {
            setTimeout(() => {
              document.addEventListener("click", () => {
                listFormElement.querySelectorAll("[data-color-palette].is-open").forEach((item) => item.classList.remove("is-open"));
              }, { once: true });
            }, 0);
          }
        };
      });
      listFormElement.querySelectorAll("[data-color-option]").forEach((button) => {
        button.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          const palette = button.closest("[data-color-palette]");
          const value = button.dataset.colorOption || "#111827";
          if (!palette) return;
          const input = palette.querySelector("[data-list-field]");
          const preview = palette.querySelector("[data-color-preview]");
          const valueLabel = palette.querySelector("[data-color-value]");
          palette.querySelectorAll("[data-color-option]").forEach((item) => item.classList.remove("is-active"));
          button.classList.add("is-active");
          if (input) input.value = value;
          if (preview) preview.style.background = value;
          if (valueLabel) valueLabel.textContent = value;
          palette.classList.remove("is-open");
        };
      });
      listFormElement.onsubmit = (event) => {
        event.preventDefault();
        runFormSave(event.currentTarget, syncListForm);
      };
    }

    editor.querySelectorAll("[data-toggle-message]").forEach((button) => {
      button.onclick = async () => {
        await runAdminAction(button, async () => {
          const latestData = getData();
          const records = Array.isArray(latestData.contactMessages) ? latestData.contactMessages : [];
          const index = Number(button.dataset.toggleMessage);
          if (!records[index]) return;
          records[index].seen = !records[index].seen;
          const action = records[index].seen ? "Cập nhật" : "Cập nhật";
          const targetName = records[index].name || records[index].email || records[index].phone || "Yêu cầu";
          await saveSectionData("contactMessages", records, { action, target: "Liên hệ", detail: `${records[index].seen ? "đã xem" : "chưa xem"} ${targetName}` });
          renderContactMessagesEditor(section);
          wireEditorActions(section);
          showToast("Đã cập nhật trạng thái yêu cầu!", "success");
        }, { errorMessage: "Không cập nhật được trạng thái liên hệ." });
      };
    });

    editor.querySelectorAll("[data-view-message]").forEach((button) => {
      button.onclick = async () => {
        const records = Array.isArray(data.contactMessages) ? data.contactMessages : [];
        const index = Number(button.dataset.viewMessage);
        if (!records[index]) return;
        try {
          await openContactMessageDetail(records[index], index);
        } catch (error) {
          showToast(error.message || "Không mở được chi tiết yêu cầu.", "error");
        }
      };
    });

    editor.querySelectorAll("[data-add-repeat-row]").forEach((button) => {
      button.onclick = () => {
        const group = button.dataset.addRepeatRow;
        const container = editor.querySelector(`[data-array-group="${group}"]`);
        if (!container) return;
        const rowCount = container.querySelectorAll("[data-repeat-row]").length;
        if (group === "heroImages" && rowCount >= 3) {
          showToast("Phần giới thiệu chỉ dùng tối đa 3 ảnh.", "info");
          return;
        }
        const imageControls =
          group === "heroImages" || group === "capabilities"
            ? `
              <label>
                Mô tả ảnh
                <input type="text" data-repeat-field="${group}" data-repeat-key="alt" value="">
              </label>
              <label class="admin-field-wide admin-image-picker" data-image-aspect="4:3">
                Ảnh hiển thị
                <div class="admin-image-picker-row">
                  <div class="admin-image-upload">
                    <input type="hidden" data-repeat-field="${group}" data-repeat-key="image" value="" data-image-value>
                    <input type="file" accept="image/*" data-image-upload>
                    <small>Chọn ảnh từ máy. Khi bấm lưu, ảnh sẽ được tải lên Supabase Storage.</small>
                  </div>
                  <div class="admin-image-preview-box is-empty">
                    <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="Xem trước ảnh" data-image-preview>
                    <span>Chưa chọn ảnh</span>
                  </div>
                </div>
              </label>
            `
            : "";
        const textControls =
          group === "heroImages"
            ? ""
            : `
              <label>
                Tiêu đề
                <input type="text" data-repeat-field="${group}" data-repeat-key="title" value="">
              </label>
              <label class="admin-field-wide">
                Nội dung
                <textarea data-repeat-field="${group}" data-repeat-key="text"></textarea>
              </label>
            `;
        const rowHtml = `
          <div class="admin-repeat-row" data-repeat-row="${group}" data-row-index="${rowCount}">
            ${textControls}
            ${imageControls}
            <button class="admin-danger-btn admin-small-btn" type="button" data-remove-repeat-row="${group}">Xóa</button>
          </div>
        `;
        container.insertAdjacentHTML("beforeend", rowHtml);
        container.querySelectorAll(".admin-empty-note").forEach((note) => note.remove());
    showToast("Đã thêm một dòng nội dung. Nhớ bấm lưu để cập nhật.", "info");
        const newRow = container.querySelector(`[data-repeat-row="${group}"][data-row-index="${rowCount}"]`);
        const newImageInput = newRow?.querySelector("[data-image-upload]");
        if (newImageInput) {
          newImageInput.onchange = async () => {
            const file = newImageInput.files?.[0];
            const picker = newImageInput.closest(".admin-image-picker");
            const preview = picker?.querySelector("[data-image-preview]");
            const valueInput = picker?.querySelector("[data-image-value]");
            if (!file || !preview || !valueInput) return;

            try {
              const optimizedImage = await fileToOptimizedDataUrl(file);
              const aspect = getAspectValue(picker?.dataset.imageAspect);
              openCropperModal(optimizedImage, valueInput, preview, aspect);
    showToast("Đã chọn ảnh mới. Bạn có thể căn chỉnh hoặc bấm lưu để cập nhật.", "info");
            } catch (error) {
              const status = document.querySelector("[data-editor-status]");
              if (status) {
    status.textContent = error.message || "Không đọc được ảnh đã chọn.";
                status.style.color = "#c0392b";
              }
    showToast(error.message || "Không đọc được ảnh đã chọn.", "error");
            }
          };
        }
        const removeButton = newRow?.querySelector("[data-remove-repeat-row]");
        if (removeButton) {
          removeButton.onclick = () => {
            newRow?.remove();
            if (!container.querySelector("[data-repeat-row]")) {
              container.insertAdjacentHTML("beforeend", `<p class="admin-empty-note">Chưa có mục nào. Nhấn Thêm giá trị để tạo.</p>`);
            }
            showToast("Đã xóa dòng nội dung. Nhớ bấm lưu để cập nhật.", "info");
          };
        }
      };
    });

    editor.querySelectorAll("[data-remove-repeat-row]").forEach((button) => {
      button.onclick = () => {
        const row = button.closest("[data-repeat-row]");
        row?.remove();
        const container = row?.closest("[data-array-group]");
        if (container && container.querySelectorAll("[data-repeat-row]").length === 0) {
          container.insertAdjacentHTML("beforeend", `<p class="admin-empty-note">Chưa có mục nào. Nhấn Thêm giá trị để tạo.</p>`);
        }
    showToast("Đã xóa dòng nội dung. Nhớ bấm lưu để cập nhật.", "info");
      };
    });

    editor.querySelectorAll("[data-delete-message]").forEach((button) => {
      button.onclick = async () => {
        if (confirm("Bạn có chắc chắn muốn xóa yêu cầu này?")) {
          await runAdminAction(button, async () => {
            const latestData = getData();
            const records = Array.isArray(latestData.contactMessages) ? latestData.contactMessages : [];
            const index = Number(button.dataset.deleteMessage);
            const targetName = records[index]?.name || records[index]?.email || records[index]?.phone || "Yêu cầu";
            records.splice(index, 1);
            await saveSectionData("contactMessages", records, { action: "Xóa", target: "Liên hệ", detail: targetName });
            renderSummary();
            renderContactMessagesEditor(section);
            wireEditorActions(section);
            showToast("Đã xóa yêu cầu thành công!", "success");
          }, { errorMessage: "Không xóa được liên hệ." });
        }
      };
    });

    const addBannerBtn = editor.querySelector("[data-add-banner]");
    if (addBannerBtn) addBannerBtn.onclick = () => {
      renderBannerEditor(section, "__new__");
      wireEditorActions(section);
    };

    editor.querySelectorAll("[data-edit-banner]").forEach((button) => {
      button.onclick = () => {
        renderBannerEditor(section, Number(button.dataset.editBanner));
        wireEditorActions(section);
      };
    });

    editor.querySelectorAll("[data-toggle-banner]").forEach((button) => {
      button.onclick = async () => {
        await runAdminAction(button, async () => {
          const latestData = getData();
          const records = Array.isArray(latestData.banners) ? latestData.banners : [];
          const index = Number(button.dataset.toggleBanner);
          if (!records[index]) return;
          records[index].active = records[index].active === false;
          const action = records[index].active === false ? "Ẩn" : "Hiện";
          await saveSectionData("banners", records, { action, target: "Banner", detail: records[index].title || records[index].id });
          renderSummary();
          renderBannerEditor(section);
          wireEditorActions(section);
          showToast("Đã cập nhật trạng thái banner!", "success");
        }, { errorMessage: "Không cập nhật được trạng thái banner." });
      };
    });

    editor.querySelectorAll("[data-delete-banner]").forEach((button) => {
      button.onclick = async () => {
        if (confirm("Bạn có chắc chắn muốn xóa banner này?")) {
          await runAdminAction(button, async () => {
            const latestData = getData();
            const records = Array.isArray(latestData.banners) ? latestData.banners : [];
            const index = Number(button.dataset.deleteBanner);
            const targetName = records[index]?.title || records[index]?.id || "";
            records.splice(index, 1);
            await saveSectionData("banners", records, { action: "Xóa", target: "Banner", detail: targetName });
            renderSummary();
            renderBannerEditor(section);
            wireEditorActions(section);
            showToast("Đã xóa banner thành công!", "success");
          }, { errorMessage: "Không xóa được banner." });
        }
      };
    });

    const bannerFormElement = editor.querySelector("[data-banner-form]");
    if (bannerFormElement) {
      bannerFormElement.onsubmit = (event) => {
        event.preventDefault();
        runFormSave(event.currentTarget, syncBannerForm);
      };
    }

    const restoreCatalogBtn = editor.querySelector("[data-restore-catalog]");
    if (restoreCatalogBtn) restoreCatalogBtn.onclick = async () => {
      const ok = confirm("Khôi phục lại danh mục và sản phẩm mẫu cũ? Dữ liệu danh mục/sản phẩm hiện tại trên Supabase sẽ được thay bằng bộ mẫu này.");
      if (!ok) return;
      restoreCatalogBtn.disabled = true;
      const oldText = restoreCatalogBtn.textContent;
      restoreCatalogBtn.textContent = "Đang khôi phục...";
      try {
        await restoreOriginalCatalogData();
        renderSummary();
        renderProductEditor(section);
        wireEditorActions(section);
    showToast("Đã khôi phục danh mục và sản phẩm mẫu cũ lên Supabase.", "success");
      } catch (error) {
        showToast(error.message || "Không khôi phục được dữ liệu mẫu.", "error");
      } finally {
        if (document.body.contains(restoreCatalogBtn)) {
          restoreCatalogBtn.disabled = false;
          restoreCatalogBtn.textContent = oldText;
        }
      }
    };

    const addProductBtn = editor.querySelector("[data-add-product]");
    if (addProductBtn) addProductBtn.onclick = () => {
      renderProductEditor(section, "__new__");
      wireEditorActions(section);
    };

    editor.querySelectorAll("[data-edit-product]").forEach((button) => {
      button.onclick = () => {
        renderProductEditor(section, Number(button.dataset.editProduct));
        wireEditorActions(section);
      };
    });

    editor.querySelectorAll("[data-toggle-product]").forEach((button) => {
      button.onclick = async () => {
        await runAdminAction(button, async () => {
          const latestData = getData();
          const records = Array.isArray(latestData.products) ? latestData.products : [];
          const index = Number(button.dataset.toggleProduct);
          if (!records[index]) return;
          records[index].active = records[index].active === false;
          const action = records[index].active === false ? "Ẩn" : "Hiện";
          await saveSectionData("products", records, { action, target: "Sản phẩm", detail: records[index].title || records[index].id });
          renderProductEditor(section);
          wireEditorActions(section);
          showToast("Đã cập nhật trạng thái hiển thị sản phẩm!", "success");
        }, { errorMessage: "Không cập nhật được trạng thái sản phẩm." });
      };
    });

    editor.querySelectorAll("[data-delete-product]").forEach((button) => {
      button.onclick = async () => {
        if (confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) {
          await runAdminAction(button, async () => {
            const latestData = getData();
            const records = Array.isArray(latestData.products) ? latestData.products : [];
            const index = Number(button.dataset.deleteProduct);
            const targetRecord = records[index];
            const targetName = targetRecord?.title || "";
            const targetId = targetRecord?.id || "";
            records.splice(index, 1);
            await saveSectionData("products", records, { action: "Xóa", target: "Sản phẩm", detail: targetName });
            if (targetId && getData().products.some((product) => product.id === targetId)) {
              showToast(`Sản phẩm "${targetName || targetId}" vẫn còn trong Supabase. Vui lòng kiểm tra bảng products.`, "error");
            }
            renderSummary();
            renderProductEditor(section);
            wireEditorActions(section);
            showToast("Đã xóa sản phẩm thành công!", "success");
          }, { errorMessage: "Không xóa được sản phẩm." });
        }
      };
    });

    const productFormElement = editor.querySelector("[data-product-form]");
    if (productFormElement) {
      productFormElement.onsubmit = (event) => {
        event.preventDefault();
        runFormSave(event.currentTarget, syncProductForm);
      };
    }

    const addServiceBtn = editor.querySelector("[data-add-service]");
    if (addServiceBtn) addServiceBtn.onclick = () => {
      renderServiceEditor(section, "__new__");
      wireEditorActions(section);
    };

    editor.querySelectorAll("[data-edit-service]").forEach((button) => {
      button.onclick = () => {
        renderServiceEditor(section, Number(button.dataset.editService));
        wireEditorActions(section);
      };
    });

    editor.querySelectorAll("[data-toggle-service]").forEach((button) => {
      button.onclick = async () => {
        await runAdminAction(button, async () => {
          const latestData = getData();
          const records = Array.isArray(latestData.services) ? latestData.services : [];
          const index = Number(button.dataset.toggleService);
          if (!records[index]) return;
          records[index].active = records[index].active === false;
          const action = records[index].active === false ? "Ẩn" : "Hiện";
          await saveSectionData("services", records, { action, target: "Dịch vụ", detail: records[index].title || records[index].name || records[index].id });
          renderServiceEditor(section);
          wireEditorActions(section);
          showToast("Đã cập nhật trạng thái hiển thị dịch vụ!", "success");
        }, { errorMessage: "Không cập nhật được trạng thái dịch vụ." });
      };
    });

    editor.querySelectorAll("[data-delete-service]").forEach((button) => {
      button.onclick = async () => {
        if (confirm("Bạn có chắc chắn muốn xóa dịch vụ này?")) {
          await runAdminAction(button, async () => {
            const latestData = getData();
            const records = Array.isArray(latestData.services) ? latestData.services : [];
            const index = Number(button.dataset.deleteService);
            const targetName = records[index]?.title || records[index]?.name || "";
            records.splice(index, 1);
            await saveSectionData("services", records, { action: "Xóa", target: "Dịch vụ", detail: targetName });
            renderSummary();
            renderServiceEditor(section);
            wireEditorActions(section);
            showToast("Đã xóa dịch vụ thành công!", "success");
          }, { errorMessage: "Không xóa được dịch vụ." });
        }
      };
    });

    const serviceFormElement = editor.querySelector("[data-service-form]");
    if (serviceFormElement) {
      serviceFormElement.onsubmit = (event) => {
        event.preventDefault();
        runFormSave(event.currentTarget, syncServiceForm);
      };
    }

    editor.querySelectorAll("[data-toggle-record]").forEach((button) => {
      button.onclick = async () => {
        await runAdminAction(button, async () => {
          const latestData = getData();
          const records = Array.isArray(latestData[section.key]) ? latestData[section.key] : [];
          const index = Number(button.dataset.toggleRecord);
          if (!records[index]) return;
          records[index].active = records[index].active === false;
          const action = records[index].active === false ? "Ẩn" : "Hiện";
          const targetName = getRecordTitle(records[index], index);
          await saveSectionData(section.key, records, { action, target: section.label, detail: targetName });
          render();
          showToast("Đã cập nhật trạng thái bản ghi!", "success");
        }, { errorMessage: "Không cập nhật được trạng thái bản ghi." });
      };
    });

    editor.querySelectorAll("[data-delete-record]").forEach((button) => {
      button.onclick = async () => {
        if (confirm("Bạn có chắc chắn muốn xóa bản ghi này?")) {
          await runAdminAction(button, async () => {
            const index = Number(button.dataset.deleteRecord);
            const latestData = getData();
            const records = Array.isArray(latestData[section.key]) ? latestData[section.key] : [];
            const targetName = records[index]?.title || records[index]?.name || records[index]?.id || "";
            records.splice(index, 1);
            await saveSectionData(section.key, records, { action: "Xóa", target: section.label, detail: targetName });
            render();
            showToast("Đã xóa bản ghi thành công!", "success");
          }, { errorMessage: "Không xóa được bản ghi." });
        }
      };
    });
  };

  const renderEditor = () => {
    const section = sections.find((item) => item.key === currentKey) || sections[0];
    const currentAdmin = getCurrentAdmin();
    const currentName = currentAdmin.name;
    const currentRole = currentAdmin.role;
    if (headingHost && section.type === "dashboard") {
      headingHost.classList.add("is-dashboard-welcome");
      headingHost.innerHTML = `
        <h1>Xin chào, ${escapeHtml(currentName)}</h1>
        <p>Vai trò hiện tại: ${escapeHtml(currentRole)}. Các số liệu bên dưới được lấy từ dữ liệu website đang lưu trong admin.</p>
      `;
    } else if (headingHost) {
      headingHost.classList.remove("is-dashboard-welcome");
      headingHost.innerHTML = `
        <p class="admin-kicker">Quản trị nội dung</p>
        <h1 data-admin-title>${escapeHtml(section.label)}</h1>
      `;
    } else if (title) {
      title.textContent = section.label;
    }
    if (isInitialLoading) {
      if (section.type === "dashboard") {
        renderDashboardV2();
        return;
      }
      editor.innerHTML = `
        <div class="admin-editor-head">
          <div>
            <p class="admin-kicker"><span class="admin-skeleton" style="height: 12px; width: 60px;"></span></p>
            <h2><span class="admin-skeleton" style="height: 24px; width: 180px;"></span></h2>
          </div>
          <div class="admin-actions">
            <span class="admin-skeleton" style="height: 38px; width: 120px; border-radius: 8px;"></span>
          </div>
        </div>
        <div class="admin-card" style="padding: 24px; background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-lg); display: grid; gap: 20px;">
          ${Array(5).fill(0).map(() => `
            <div style="display: flex; gap: 16px; align-items: center; padding: 14px 0; border-bottom: 1px solid #f1f5f9;">
              <span class="admin-skeleton" style="height: 16px; width: 40px;"></span>
              <span class="admin-skeleton" style="height: 16px; width: 250px;"></span>
              <span class="admin-skeleton" style="height: 16px; width: 120px; margin-left: auto;"></span>
            </div>
          `).join("")}
        </div>
      `;
      return;
    }
    if (section.type === "dashboard") {
      renderDashboardV2();
      return;
    }
    if (section.type === "array") {
      renderArrayEditor(section);
    } else {
      renderObjectEditor(section);
    }
    wireEditorActions(section);
  };

  const render = () => {
    try {
      renderNav();
      renderSummary();
      renderEditor();
    } catch (e) {
      console.error("Lỗi render Admin:", e);
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText = "position:fixed;top:0;left:0;right:0;background:#ef4444;color:white;padding:24px;z-index:999999;font-family:monospace;white-space:pre-wrap;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);";
      errorDiv.innerHTML = `
        <h3 style="margin-top:0;font-size:1.2rem;font-weight:700;">🔴 Lỗi thực thi Giao diện Admin:</h3>
        <p><strong>Thông điệp:</strong> ${e.message}</p>
        <pre style="margin:12px 0 0 0;background:rgba(0,0,0,0.2);padding:12px;border-radius:4px;overflow-x:auto;">${e.stack}</pre>
      `;
      document.body.appendChild(errorDiv);
    }
  };


  document.querySelector("[data-admin-view-site]")?.addEventListener("click", () => {
    showToast("Đang mở website public trong tab mới.", "info");
  });

  mobileMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    setMobileMenuOpen(!nav?.classList.contains("is-open"));
  });

  document.addEventListener("click", (event) => {
    if (!nav?.classList.contains("is-open")) return;
    if (nav.contains(event.target) || mobileMenuToggle?.contains(event.target)) return;
    setMobileMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMobileMenuOpen(false);
    }
  });

  document.querySelector("[data-admin-quick-search]")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = event.currentTarget.value.trim().toLowerCase();
    if (!query) return;
    const targetSection = sections.find((section) => section.label.toLowerCase().includes(query) || section.key.toLowerCase().includes(query));
    if (!targetSection) {
      showToast("Không tìm thấy mục quản trị phù hợp.", "error");
      return;
    }
    currentKey = targetSection.key;
    render();
  });

  // Set up static cropper modal event listeners (Hủy bỏ / Xác nhận & Cắt)
  document.getElementById("cropper-cancel-btn")?.addEventListener("click", () => {
    const modal = document.getElementById("cropper-modal");
    modal?.classList.remove("is-active");
    modal?.setAttribute("aria-hidden", "true");
    if (currentCropper) {
      currentCropper.destroy();
      currentCropper = null;
    }
    showToast("Đã hủy căn chỉnh. Ảnh vừa chọn vẫn được giữ, hãy bấm lưu nếu muốn cập nhật.", "info");
  });

  document.getElementById("cropper-save-btn")?.addEventListener("click", () => {
    if (!currentCropper || !activeImageValueInput || !activeImagePreviewImg) return;

    const cropOptions = {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high"
    };

    if (Number.isFinite(activeCropAspectRatio)) {
      let outputWidth = 1600;
      let outputHeight = 1200;
      if (activeCropAspectRatio > 2.5) {
        outputWidth = 2200;
        outputHeight = Math.round(2200 / activeCropAspectRatio);
      } else if (activeCropAspectRatio > 1.5) {
        outputWidth = 1800;
        outputHeight = Math.round(1800 / activeCropAspectRatio);
      } else {
        outputWidth = 1400;
        outputHeight = Math.round(1400 / activeCropAspectRatio);
      }
      cropOptions.width = outputWidth;
      cropOptions.height = outputHeight;
    } else {
      cropOptions.maxWidth = 1400;
      cropOptions.maxHeight = 1400;
    }

    const canvas = currentCropper.getCroppedCanvas(cropOptions);

    const croppedBase64 = canvasToCompactJpeg(canvas);
    activeImageValueInput.value = croppedBase64;
    activeImagePreviewImg.src = croppedBase64;
    activeImagePreviewImg.classList?.remove("is-empty");
    activeImagePreviewImg.closest(".admin-image-preview-box")?.classList.remove("is-empty");

    const modal = document.getElementById("cropper-modal");
    modal?.classList.remove("is-active");
    modal?.setAttribute("aria-hidden", "true");

    currentCropper.destroy();
    currentCropper = null;

    const status = document.querySelector("[data-editor-status]");
    if (status) {
    status.textContent = "Đã căn chỉnh ảnh thành công. Nhớ bấm lưu thông tin/sản phẩm để xác nhận.";
      status.style.color = "#138a5b";
    }
    showToast("Đã căn chỉnh ảnh. Nhớ bấm lưu để cập nhật dữ liệu.", "success");
  });

  setupGeneralModal();
  
  // Render giao diện Skeleton Loader lập tức khi load trang
  render();

  // Tải bất đồng bộ dữ liệu mới nhất từ Supabase dưới nền
  (async () => {
    if (supabaseClient && !useClassicLocalAdmin) {
      const currentSession = (await supabaseClient.auth.getSession())?.data?.session || sessionData.session;
      const accessToken = currentSession?.access_token || "";
      const jwtPayload = decodeJwtPayload(accessToken);
      supabaseLoadStatus.jwtRole = jwtPayload.role || "";
      supabaseLoadStatus.userId = jwtPayload.sub || currentAuthUser?.id || "";

      try {
        const publicSnapshot = await loadPublicCatalogSnapshot();
        data = saveData(publicSnapshot);
        markSupabaseLoad("publicSnapshot", "ok");
        isInitialLoading = false;
        render();
      } catch (error) {
        markSupabaseLoad("publicSnapshot", "error", error);
        console.warn("Không tải được snapshot public từ Supabase.", error);
      }
    }

    isInitialLoading = false;
    render();

    if (!useClassicLocalAdmin) {
      const loadAuthenticatedCatalog = async () => {
        markSupabaseLoad("authenticated", "pending");
        render();
        try {
          const remoteCatalogData = await runWithDeadline(loadRemoteCatalogData(), 35000, "authenticated catalog");
          if (remoteCatalogData) {
            data = saveData(remoteCatalogData);
          }
          markSupabaseLoad("authenticated", "ok");
        } catch (error) {
          markSupabaseLoad("authenticated", "error", error);
          console.warn("Không tải được sản phẩm/danh mục từ Supabase.", error);
        }
        render();
      };

      const loadContacts = async () => {
        markSupabaseLoad("contacts", "pending");
        render();
        try {
          const remoteMessages = await runWithDeadline(loadRemoteContactMessages(), 20000, "contact messages");
          data = saveData({ ...getData(), contactMessages: remoteMessages });
          supabaseLoadStatus.contactRows = remoteMessages.length;
          markSupabaseLoad("contacts", remoteMessages.length ? "ok" : "empty");
        } catch (error) {
          markSupabaseLoad("contacts", "error", error);
          console.warn("Không tải được liên hệ.", error);
        }
        render();
      };

      const loadLogs = async () => {
        markSupabaseLoad("logs", "pending");
        render();
        try {
          await runWithDeadline(loadRemoteActivityLogs(), 20000, "activity logs");
          supabaseLoadStatus.logRows = activityLogs.length;
          markSupabaseLoad("logs", activityLogs.length ? "ok" : "empty");
        } catch (error) {
          markSupabaseLoad("logs", "error", error);
          console.warn("Không tải được nhật ký hoạt động.", error);
        }
        render();
      };

      await Promise.allSettled([loadAuthenticatedCatalog(), loadContacts(), loadLogs()]);
    }
    render();
  })();
})();
