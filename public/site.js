document.addEventListener("DOMContentLoaded", () => {
	// Animate On Scroll
	if (typeof AOS !== "undefined") {
		AOS.init({ duration: 800, once: true, offset: 80 });
	}

	// Hero carousel
	if (document.querySelector(".hero-swiper") && typeof Swiper !== "undefined") {
		new Swiper(".hero-swiper", {
			loop: true,
			speed: 900,
			autoplay: { delay: 5000, disableOnInteraction: false },
			effect: "fade",
			fadeEffect: { crossFade: true },
			pagination: { el: ".hero-swiper .swiper-pagination", clickable: true },
		});
	}

	// Cases carousel
	if (document.querySelector(".case-swiper") && typeof Swiper !== "undefined") {
		new Swiper(".case-swiper", {
			loop: true,
			slidesPerView: 1.15,
			spaceBetween: 20,
			breakpoints: {
				640: { slidesPerView: 2.2 },
				1024: { slidesPerView: 3.4 },
			},
			pagination: { el: ".case-swiper .swiper-pagination", clickable: true },
		});
	}

	// Testimonials carousel
	if (document.querySelector(".fl-testimonial-swiper") && typeof Swiper !== "undefined") {
		new Swiper(".fl-testimonial-swiper", {
			loop: true,
			slidesPerView: 1.1,
			spaceBetween: 20,
			navigation: {
				nextEl: ".fl-testi-btn-next",
				prevEl: ".fl-testi-btn-prev",
			},
			pagination: { el: ".fl-testimonial-swiper .swiper-pagination", clickable: true },
			breakpoints: {
				640: { slidesPerView: 2.1, spaceBetween: 24 },
				1024: { slidesPerView: 3, spaceBetween: 24 },
			},
		});
	}

	// Why reasons interactive image switch
	var reasonDetails = document.querySelectorAll(".tp-reasons details");
	var whyMediaImg = document.querySelector(".tp-why-media img");
	if (reasonDetails.length && whyMediaImg) {
		reasonDetails.forEach((detail) => {
			detail.addEventListener("toggle", () => {
				if (detail.open) {
					reasonDetails.forEach((other) => {
						if (other !== detail && other.open) other.open = false;
					});
					var newSrc = detail.getAttribute("data-img");
					if (newSrc) {
						whyMediaImg.src = newSrc;
					}
				}
			});
		});
	}

	document.querySelectorAll("[data-case-rotator]").forEach((rotator) => {
		var images = rotator.querySelectorAll("img");
		if (images.length < 2) return;
		var index = 0;
		setInterval(() => {
			images[index].classList.remove("is-active");
			index = (index + 1) % images.length;
			images[index].classList.add("is-active");
		}, 4000);
	});

	if (
		document.querySelector(".fl-gallery-swiper") &&
		typeof Swiper !== "undefined"
	) {
		new Swiper(".fl-gallery-swiper", {
			slidesPerView: 1.05,
			spaceBetween: 16,
			grabCursor: true,
			navigation: {
				nextEl: ".fl-gallery-swiper .swiper-button-next",
				prevEl: ".fl-gallery-swiper .swiper-button-prev",
			},
			pagination: {
				el: ".fl-gallery-swiper .swiper-pagination",
				clickable: true,
			},
			breakpoints: {
				640: { slidesPerView: 2.05 },
				1024: { slidesPerView: 3 },
			},
		});
	}

	// Product image tabs
	var productButtons = document.querySelectorAll("[data-product-index]");
	var stageImages = document.querySelectorAll("[data-stage-index]");

	if (productButtons.length) {
		var setActive = (i) => {
			productButtons.forEach((btn) => {
				btn.classList.remove("is-active");
			});
			stageImages.forEach((stage) => {
				stage.classList.remove("is-active");
			});

			var activeButton = document.querySelector(
				'[data-product-index="' + i + '"]',
			);
			var activeStage = document.querySelector(
				'[data-stage-index="' + i + '"]',
			);

			if (activeButton) {
				activeButton.classList.add("is-active");
				var nameEl = document.querySelector("[data-product-name]");
				var descEl = document.querySelector("[data-product-desc]");
				if (nameEl && activeButton.getAttribute("data-name")) {
					nameEl.textContent = activeButton.getAttribute("data-name");
				}
				if (descEl && activeButton.getAttribute("data-desc")) {
					descEl.textContent = activeButton.getAttribute("data-desc");
				}
			}
			if (activeStage) {
				activeStage.classList.add("is-active");
			}
		};

		productButtons.forEach((btn) => {
			var index = btn.getAttribute("data-product-index");
			var handler = () => {
				setActive(index);
			};
			btn.addEventListener("mouseover", handler);
			btn.addEventListener("click", handler);
			btn.addEventListener("focus", handler);
		});

		setActive(productButtons[0].getAttribute("data-product-index"));
	}

	// Project image lightbox
	var lightbox = document.getElementById("projectLightbox");
	if (lightbox && typeof lightbox.showModal === "function") {
		var lightboxImage = lightbox.querySelector("img");
		var lightboxCaption = lightbox.querySelector("p");
		var lightboxClose = lightbox.querySelector("button");

		var openLightbox = (src, title) => {
			if (!src) return;
			lightboxImage.src = src;
			lightboxImage.alt = title || "";
			lightboxCaption.textContent = title || "";
			lightbox.showModal();
		};

		document.querySelectorAll("[data-lightbox]").forEach((link) => {
			link.addEventListener("click", (event) => {
				event.preventDefault();
				openLightbox(link.href, link.getAttribute("data-title") || "");
			});
		});

		document.querySelectorAll("[data-lightbox-trigger]").forEach((btn) => {
			btn.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				var src = btn.getAttribute("data-href");
				var title = btn.getAttribute("data-title");
				openLightbox(src, title);
			});
		});

		lightboxClose.addEventListener("click", () => {
			lightbox.close();
		});
		lightbox.addEventListener("click", (event) => {
			if (event.target === lightbox) lightbox.close();
		});
	}

	// Header scroll state
	var h = document.getElementById("siteHeader");
	if (h) {
		var onScroll = () => {
			if (window.scrollY > 20) {
				h.classList.add("scrolled");
			} else {
				h.classList.remove("scrolled");
			}
		};
		window.addEventListener("scroll", onScroll);
		onScroll();
	}

	// Mobile nav toggle
	var mobileMenuButton = document.getElementById("mobileMenuButton");
	var mobileNav = document.getElementById("mobileNav");
	if (mobileMenuButton && mobileNav) {
		mobileMenuButton.addEventListener("click", () => {
			mobileNav.classList.toggle("hidden");
		});
	}
});
