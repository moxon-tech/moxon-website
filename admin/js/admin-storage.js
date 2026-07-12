(function exposeMoxonAdminStorage() {
  const createAdminStorage = ({ supabaseClient, supabaseConfig, slugify, dataUrlToBlob }) => {
    const getStorageNameHint = (value, fallback = "hinh-anh") => {
      if (!value || typeof value !== "object") return slugify(fallback) || "hinh-anh";
      return (
        slugify(
          value.title ||
            value.name ||
            value.displayName ||
            value.legalName ||
            value.id ||
            value.alt ||
            fallback
        ) || slugify(fallback) || "hinh-anh"
      );
    };

    const uploadProductImageIfNeeded = async (record) => {
      if (!supabaseClient || !String(record.image || "").startsWith("data:image/")) return record;
      const blob = dataUrlToBlob(record.image);
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const nameHint = getStorageNameHint(record, "san-pham");
      const idHint = slugify(record.id || nameHint) || nameHint;
      const path = `products/${nameHint}-${idHint}-${Date.now()}.${ext}`;
      const { error } = await supabaseClient.storage
        .from(supabaseConfig.mediaBucket || "moxon-media")
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (error) throw error;
      const { data: publicData } = supabaseClient.storage
        .from(supabaseConfig.mediaBucket || "moxon-media")
        .getPublicUrl(path);
      return { ...record, image: publicData.publicUrl };
    };

    const uploadCmsImageValue = async (value, sectionKey = "cms", nameHint = "hinh-anh", fieldHint = "image") => {
      if (!supabaseClient || !String(value || "").startsWith("data:image/")) return value;
      const blob = dataUrlToBlob(value);
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const safeSection = slugify(sectionKey) || "cms";
      const safeName = slugify(nameHint) || safeSection;
      const safeField = slugify(fieldHint) || "image";
      const path = `${safeSection}/${safeName}-${safeField}-${Date.now()}.${ext}`;
      const { error } = await supabaseClient.storage
        .from(supabaseConfig.mediaBucket || "moxon-media")
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (error) throw error;
      const { data: publicData } = supabaseClient.storage
        .from(supabaseConfig.mediaBucket || "moxon-media")
        .getPublicUrl(path);
      return publicData.publicUrl;
    };

    const uploadCmsImagesInValue = async (value, sectionKey = "cms", nameHint = sectionKey, fieldHint = "image") => {
      if (typeof value === "string") return uploadCmsImageValue(value, sectionKey, nameHint, fieldHint);
      if (Array.isArray(value)) {
        return Promise.all(
          value.map((item, index) =>
            uploadCmsImagesInValue(item, sectionKey, getStorageNameHint(item, `${sectionKey}-${index + 1}`), fieldHint)
          )
        );
      }
      if (value && typeof value === "object") {
        const objectNameHint = getStorageNameHint(value, nameHint);
        const entries = await Promise.all(
          Object.entries(value).map(async ([key, childValue]) => [
            key,
            await uploadCmsImagesInValue(childValue, sectionKey, objectNameHint, key)
          ])
        );
        return Object.fromEntries(entries);
      }
      return value;
    };

    const getStorageObjectRef = (value) => {
      const rawValue = String(value || "").trim();
      if (!rawValue || rawValue.startsWith("data:") || rawValue.startsWith("assets/")) return null;

      const mediaBucket = supabaseConfig.mediaBucket || "moxon-media";
      const privateBucket = supabaseConfig.privateBucket || "moxon-private";
      const knownBuckets = [mediaBucket, privateBucket].filter(Boolean);

      if (rawValue.startsWith("contact-attachments/")) {
        return { bucket: privateBucket, path: rawValue };
      }

      for (const bucket of knownBuckets) {
        if (rawValue.startsWith(`${bucket}/`)) {
          return { bucket, path: rawValue.slice(bucket.length + 1) };
        }
      }

      try {
        const url = new URL(rawValue);
        const publicMarker = "/storage/v1/object/public/";
        const signedMarker = "/storage/v1/object/sign/";
        const marker = url.pathname.includes(publicMarker) ? publicMarker : url.pathname.includes(signedMarker) ? signedMarker : "";
        if (!marker) return null;

        const objectPath = decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + marker.length));
        const [bucket, ...pathParts] = objectPath.split("/");
        if (!knownBuckets.includes(bucket) || !pathParts.length) return null;
        return { bucket, path: pathParts.join("/") };
      } catch {
        return null;
      }
    };

    const collectStorageObjectRefs = (value, refs = new Map()) => {
      if (!value) return refs;
      if (typeof value === "string") {
        const ref = getStorageObjectRef(value);
        if (ref) refs.set(`${ref.bucket}/${ref.path}`, ref);
        return refs;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => collectStorageObjectRefs(item, refs));
        return refs;
      }
      if (typeof value === "object") {
        Object.values(value).forEach((item) => collectStorageObjectRefs(item, refs));
      }
      return refs;
    };

    const deleteStorageRefsNoLongerUsed = async (previousValue, nextData) => {
      if (!supabaseClient) return 0;
      const previousRefs = collectStorageObjectRefs(previousValue);
      if (!previousRefs.size) return 0;

      const stillUsedRefs = collectStorageObjectRefs(nextData);
      const refsToDelete = Array.from(previousRefs.values()).filter((ref) => !stillUsedRefs.has(`${ref.bucket}/${ref.path}`));
      if (!refsToDelete.length) return 0;

      const refsByBucket = refsToDelete.reduce((groups, ref) => {
        if (!groups[ref.bucket]) groups[ref.bucket] = [];
        groups[ref.bucket].push(ref.path);
        return groups;
      }, {});

      let deletedCount = 0;
      await Promise.all(
        Object.entries(refsByBucket).map(async ([bucket, paths]) => {
          const { error } = await supabaseClient.storage.from(bucket).remove(paths);
          if (error) throw error;
          deletedCount += paths.length;
        })
      );
      return deletedCount;
    };

    return {
      deleteStorageRefsNoLongerUsed,
      uploadCmsImagesInValue,
      uploadProductImageIfNeeded
    };
  };

  window.MOXON_ADMIN_STORAGE = { createAdminStorage };
})();
