(function exposeMoxonAdminUtils() {
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

  const dataUrlToBlob = (dataUrl) => {
    const [meta, content] = String(dataUrl).split(",");
    const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
    const binary = atob(content || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  };

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

  window.MOXON_ADMIN_UTILS = {
    dataUrlToBlob,
    decodeJwtPayload,
    deepClone,
    deepMerge,
    readLocalJson,
    slugify,
    writeLocalJson
  };
})();
