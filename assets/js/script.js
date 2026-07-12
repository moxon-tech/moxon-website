/**
 * MOXON Tech - Public Motion
 * Handles scroll reveal, counters, homepage auto-scroll, and hero slideshow.
 */

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

