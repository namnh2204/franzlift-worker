document.addEventListener('DOMContentLoaded', function () {
  // Animate On Scroll
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 800, once: true, offset: 80 });
  }

  // Hero carousel
  if (document.querySelector('.hero-swiper') && typeof Swiper !== 'undefined') {
    new Swiper('.hero-swiper', {
      loop: true,
      speed: 900,
      autoplay: { delay: 5000, disableOnInteraction: false },
      effect: 'fade',
      fadeEffect: { crossFade: true },
      pagination: { el: '.hero-swiper .swiper-pagination', clickable: true }
    });
  }

  // Cases carousel
  if (document.querySelector('.case-swiper') && typeof Swiper !== 'undefined') {
    new Swiper('.case-swiper', {
      loop: true,
      slidesPerView: 1.15,
      spaceBetween: 20,
      breakpoints: {
        640: { slidesPerView: 2.2 },
        1024: { slidesPerView: 3.4 }
      },
      pagination: { el: '.case-swiper .swiper-pagination', clickable: true }
    });
  }

  document.querySelectorAll('[data-case-rotator]').forEach(function (rotator) {
    var images = rotator.querySelectorAll('img');
    if (images.length < 2) return;
    var index = 0;
    setInterval(function () {
      images[index].classList.remove('is-active');
      index = (index + 1) % images.length;
      images[index].classList.add('is-active');
    }, 4000);
  });

  if (document.querySelector('.fl-gallery-swiper') && typeof Swiper !== 'undefined') {
    new Swiper('.fl-gallery-swiper', {
      slidesPerView: 1.05,
      spaceBetween: 16,
      grabCursor: true,
      navigation: { nextEl: '.fl-gallery-swiper .swiper-button-next', prevEl: '.fl-gallery-swiper .swiper-button-prev' },
      pagination: { el: '.fl-gallery-swiper .swiper-pagination', clickable: true },
      breakpoints: {
        640: { slidesPerView: 2.05 },
        1024: { slidesPerView: 3 }
      }
    });
  }

  // Product image tabs
  var productButtons = document.querySelectorAll('[data-product-index]');
  var stageImages = document.querySelectorAll('[data-stage-index]');

  if (productButtons.length) {
    var setActive = function (i) {
      productButtons.forEach(function (btn) {
        btn.classList.remove('is-active');
      });
      stageImages.forEach(function (stage) {
        stage.classList.remove('is-active');
      });

      var activeButton = document.querySelector('[data-product-index="' + i + '"]');
      var activeStage = document.querySelector('[data-stage-index="' + i + '"]');

      if (activeButton) {
        activeButton.classList.add('is-active');
        var nameEl = document.querySelector('[data-product-name]');
        var descEl = document.querySelector('[data-product-desc]');
        if (nameEl && activeButton.getAttribute('data-name')) {
          nameEl.textContent = activeButton.getAttribute('data-name');
        }
        if (descEl && activeButton.getAttribute('data-desc')) {
          descEl.textContent = activeButton.getAttribute('data-desc');
        }
      }
      if (activeStage) {
        activeStage.classList.add('is-active');
      }
    };

    productButtons.forEach(function (btn) {
      var index = btn.getAttribute('data-product-index');
      var handler = function () {
        setActive(index);
      };
      btn.addEventListener('mouseover', handler);
      btn.addEventListener('click', handler);
      btn.addEventListener('focus', handler);
    });

    setActive(productButtons[0].getAttribute('data-product-index'));
  }

  // Header scroll state
  var h = document.getElementById('siteHeader');
  if (h) {
    var onScroll = function () {
      if (window.scrollY > 20) {
        h.classList.add('scrolled');
      } else {
        h.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', onScroll);
    onScroll();
  }

  // Mobile nav toggle
  var mobileMenuButton = document.getElementById('mobileMenuButton');
  var mobileNav = document.getElementById('mobileNav');
  if (mobileMenuButton && mobileNav) {
    mobileMenuButton.addEventListener('click', function () {
      mobileNav.classList.toggle('hidden');
    });
  }
});
