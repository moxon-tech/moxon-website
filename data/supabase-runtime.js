(function loadMoxonSupabaseRuntime() {
  const client = window.MOXON_SUPABASE_CLIENT;
  window.MOXON_SUPABASE_DATA_STATE = client ? "loading" : "unavailable";
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
  const byOrder = (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0);

  const sdkQuery = async (queryPromise, timeoutMs = 15000) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error("Supabase timeout")), timeoutMs);
    });
    const result = await Promise.race([queryPromise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
    if (result.error) throw result.error;
    return result.data || [];
  };

  const mapCategory = (row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order || 0,
    active: row.active !== false,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  });

  const mapProduct = (row) => ({
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

  window.MOXON_SUPABASE_DATA_READY = (async () => {
    if (!client) {
      console.warn("Supabase client chua san sang, dung du lieu fallback.");
      window.MOXON_SUPABASE_DATA_STATE = "unavailable";
      return window.MOXON_DATA || {};
    }

    const nextData = { ...(window.MOXON_DATA || {}) };

    const [categoriesResult, productsResult, cmsResult] = await Promise.allSettled([
      sdkQuery(client.from("product_categories").select("*").eq("active", true).order("sort_order", { ascending: true })),
      sdkQuery(client.from("products").select("*").eq("active", true).order("sort_order", { ascending: true })),
      sdkQuery(client.from("cms_sections").select("*"))
    ]);

    if (categoriesResult.status === "fulfilled") {
      nextData.productCategories = (categoriesResult.value || []).map(mapCategory).sort(byOrder);
    } else {
      console.warn("Khong tai duoc danh muc Supabase.", categoriesResult.reason);
    }

    if (productsResult.status === "fulfilled") {
      nextData.products = (productsResult.value || []).map(mapProduct).sort(byOrder);
    } else {
      console.warn("Khong tai duoc san pham Supabase.", productsResult.reason);
    }

    if (cmsResult.status === "fulfilled") {
      (cmsResult.value || []).forEach((row) => {
        if (row.section_key) nextData[row.section_key] = deepMerge(nextData[row.section_key], row.section_value);
      });
    } else {
      console.warn("Khong tai duoc CMS Supabase.", cmsResult.reason);
    }

    window.MOXON_DATA = nextData;
    window.MOXON_SUPABASE_DATA_STATE = "ready";
    return window.MOXON_DATA;
  })().catch((error) => {
    console.warn("Khong tai duoc du lieu Supabase, dung du lieu fallback.", error);
    window.MOXON_SUPABASE_DATA_STATE = "error";
    return window.MOXON_DATA || {};
  });
})();
