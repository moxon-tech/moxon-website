/**
 * MOXON Tech - Public Forms
 * Handles contact/recruitment validation, Supabase submissions, attachments, and quote pre-fill.
 */

document.addEventListener("DOMContentLoaded", () => {
  const MAX_PUBLIC_ATTACHMENT_SIZE = 8 * 1024 * 1024;
  const ALLOWED_PUBLIC_ATTACHMENT_EXTENSIONS = new Set([
    "pdf",
    "dwg",
    "step",
    "stp",
    "doc",
    "docx",
    "jpg",
    "jpeg",
    "png",
    "webp"
  ]);
  const ALLOWED_PUBLIC_ATTACHMENT_MIME_PREFIXES = ["image/"];
  const ALLOWED_PUBLIC_ATTACHMENT_MIME_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]);

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

  const getFileExtension = (fileName) => {
    const parts = String(fileName || "").toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  };

  const formatMegabytes = (bytes) => `${Math.round(bytes / 1024 / 1024)}MB`;

  const validatePublicAttachment = (file) => {
    if (!file) return;
    if (file.size > MAX_PUBLIC_ATTACHMENT_SIZE) {
      throw new Error(`Tệp đính kèm quá lớn. Vui lòng chọn tệp dưới ${formatMegabytes(MAX_PUBLIC_ATTACHMENT_SIZE)}.`);
    }

    const extension = getFileExtension(file.name);
    const hasAllowedExtension = ALLOWED_PUBLIC_ATTACHMENT_EXTENSIONS.has(extension);
    const hasAllowedMime =
      ALLOWED_PUBLIC_ATTACHMENT_MIME_TYPES.has(file.type) ||
      ALLOWED_PUBLIC_ATTACHMENT_MIME_PREFIXES.some((prefix) => String(file.type || "").startsWith(prefix));

    if (!hasAllowedExtension && !hasAllowedMime) {
      throw new Error("Định dạng tệp chưa được hỗ trợ. Vui lòng gửi PDF, DWG, STEP/STP, DOC/DOCX hoặc ảnh.");
    }
  };

  const getSubmitterFolderName = (fields) =>
    safeFileName(
      fields.name ||
        fields.ho_ten ||
        fields.company ||
        fields.email ||
        fields.phone ||
        fields.dien_thoai ||
        "khach-hang"
    );

  const uploadMessageAttachment = async (client, file, type, messageId, fieldName, submitterFolderName) => {
    const bucket = window.MOXON_SUPABASE_CONFIG?.privateBucket || window.MOXON_SUPABASE_CONFIG?.mediaBucket || "moxon-media";
    const folderName = `${submitterFolderName}-${messageId}`;
    const path = `contact-attachments/${type}/${folderName}/${Date.now()}-${fieldName}-${safeFileName(file.name)}`;
    const { error } = await client.storage.from(bucket).upload(path, file, {
      cacheControl: "31536000",
      upsert: false
    });
    if (error) throw error;

    return {
      path
    };
  };

  const notifyManagedMessage = async (client, messageId) => {
    if (!client?.functions?.invoke) return;
    try {
      const { error } = await client.functions.invoke("notify-form-submission", {
        body: {
          messageId
        }
      });
      if (error) throw error;
    } catch (error) {
      console.warn("Khong gui duoc email thong bao, du lieu form da duoc luu.", error);
    }
  };

  const saveManagedMessage = async (form, type) => {
    const formData = new FormData(form);
    const fields = {};
    const client = window.MOXON_SUPABASE_CLIENT || null;

    if (!client) {
      throw new Error("Kh\u00f4ng k\u1ebft n\u1ed1i \u0111\u01b0\u1ee3c h\u1ec7 th\u1ed1ng l\u01b0u d\u1eef li\u1ec7u. Vui l\u00f2ng th\u1eed l\u1ea1i sau ho\u1eb7c li\u00ean h\u1ec7 tr\u1ef1c ti\u1ebfp qua hotline.");
    }

    formData.forEach((value, key) => {
      if (key.startsWith("_")) return;
      fields[key] = value instanceof File ? value.name : value;
    });

    const messageId = `${type}-${Date.now()}`;
    const submitterFolderName = getSubmitterFolderName(fields);
    const fileInputs = Array.from(form.querySelectorAll("input[type='file']"));
    await Promise.all(fileInputs.map(async (fileInput) => {
      const name = fileInput.name;
      const file = fileInput.files?.[0];
      if (!name || !file) return;

      validatePublicAttachment(file);
      fields[name] = file.name;
      if (client) {
        try {
          const uploaded = await uploadMessageAttachment(client, file, type, messageId, name, submitterFolderName);
          fields[name + "Data"] = uploaded.path;
          fields[name + "Path"] = uploaded.path;
          return;
        } catch (error) {
          console.warn("Không upload được tệp lên Supabase Storage.", error);
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

    await notifyManagedMessage(client, messageRecord.id);
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
