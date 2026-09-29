(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function initSparks(scope) {
    scope.querySelectorAll('[data-food-sparks]:not([data-ready])').forEach((layer) => {
      layer.dataset.ready = 'true';
      if (reduceMotion) return;
      const mobile = window.innerWidth < 750;
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < (mobile ? 18 : 38); i++) {
        const spark = document.createElement('span');
        spark.style.cssText = [
          `--l:${random(mobile ? 5 : 42, 98).toFixed(1)}%`,
          `--b:${random(4, 70).toFixed(1)}%`,
          `--s:${random(2, 5).toFixed(1)}px`,
          `--dx:${random(-70, 70).toFixed(0)}px`,
          `--dy:${random(-380, -140).toFixed(0)}px`,
          `--d:${random(3, 7).toFixed(2)}s`,
          `--delay:${random(-7, 0).toFixed(2)}s`,
        ].join(';');
        fragment.appendChild(spark);
      }
      layer.appendChild(fragment);
    });
  }

  // Uses the individual `translate` property so GSAP entrance tweens on `transform` stay independent.
  function initPointerParallax(scope) {
    scope.querySelectorAll('[data-food-parallax]:not([data-ready])').forEach((media) => {
      media.dataset.ready = 'true';
      if (reduceMotion || window.matchMedia('(hover: none)').matches) return;
      const area = media.closest('.food-hero') || media;
      const layers = Array.from(media.querySelectorAll('[data-depth]'));
      const target = { x: 0, y: 0 };
      const current = { x: 0, y: 0 };
      let frame = 0;

      const tick = () => {
        current.x += (target.x - current.x) * 0.08;
        current.y += (target.y - current.y) * 0.08;
        layers.forEach((layer) => {
          const depth = Number(layer.dataset.depth) || 0;
          layer.style.translate = `${(current.x * depth * 5).toFixed(2)}px ${(current.y * depth * 5).toFixed(2)}px`;
        });
        const moving = Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001;
        frame = moving ? requestAnimationFrame(tick) : 0;
      };
      const start = () => {
        if (!frame) frame = requestAnimationFrame(tick);
      };

      area.addEventListener('pointermove', (event) => {
        const rect = area.getBoundingClientRect();
        target.x = (event.clientX - rect.left) / rect.width - 0.5;
        target.y = (event.clientY - rect.top) / rect.height - 0.5;
        start();
      });
      area.addEventListener('pointerleave', () => {
        target.x = 0;
        target.y = 0;
        start();
      });
    });
  }

  class FoodMenu extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;

      try {
        this.items = JSON.parse(this.querySelector('[data-food-items]').textContent);
      } catch (error) {
        this.items = [];
      }
      this.cards = Array.from(this.querySelectorAll('.food-card'));
      this.tabs = Array.from(this.querySelectorAll('.food-tab'));
      this.moreButton = this.querySelector('[data-more]');
      this.emptyMessage = this.querySelector('[data-empty]');
      this.toastEl = this.querySelector('[data-toast]');
      this.perPage = Number(this.dataset.perPage) || 8;
      this.filter = 'all';
      this.shown = this.perPage;
      this.current = Math.max(0, this.cards.findIndex((card) => card.classList.contains('is-current')));

      this.bindTabs();
      this.bindCards();
      this.spot = this.querySelector('[data-spot]');
      if (this.spot) this.initSpot();
      if (this.moreButton) {
        this.moreButton.addEventListener('click', () => {
          this.shown += this.perPage;
          this.applyFilter(true);
        });
      }
      this.applyFilter(false);

      this.addEventListener('shopify:block:select', (event) => {
        const card = event.target.closest('.food-card');
        if (card) {
          this.showCard(card);
          this.select(Number(card.dataset.index), false);
          return;
        }
        const tab = event.target.closest('.food-tab');
        if (tab) this.setFilter(tab);
      });
    }

    /* Filtering and pagination */

    bindTabs() {
      this.tabs.forEach((tab) => tab.addEventListener('click', () => this.setFilter(tab, true)));

      this.tabBar = this.querySelector('[data-tabs]');
      this.pill = this.querySelector('[data-tabs-pill]');
      if (!this.tabBar || !this.pill) return;
      this.tabBar.classList.add('has-pill');
      this.movePill();
      if ('ResizeObserver' in window) {
        new ResizeObserver(() => this.movePill()).observe(this.tabBar);
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.movePill());
      requestAnimationFrame(() => requestAnimationFrame(() => this.tabBar.classList.add('is-ready')));
    }

    movePill() {
      if (!this.pill) return;
      const tab = this.tabs.find((item) => item.classList.contains('is-active')) || this.tabs[0];
      if (!tab) return;
      this.pill.style.width = `${tab.offsetWidth}px`;
      this.pill.style.transform = `translateX(${tab.offsetLeft}px)`;
    }

    scrollTabIntoView(tab) {
      const bar = this.tabBar;
      if (!bar || bar.scrollWidth <= bar.clientWidth) return;
      const left = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
      bar.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    setFilter(tab, updateSpot) {
      this.tabs.forEach((other) => {
        const active = other === tab;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      this.movePill();
      this.scrollTabIntoView(tab);
      this.filter = tab.dataset.filter || 'all';
      this.shown = this.perPage;
      const matches = this.applyFilter(true);
      if (updateSpot && matches.length && !matches.includes(this.cards[this.current])) {
        this.select(Number(matches[0].dataset.index), false);
      }
    }

    matches() {
      if (this.filter === 'all') return this.cards;
      return this.cards.filter((card) => (card.dataset.cats || '').split(' ').includes(this.filter));
    }

    applyFilter(animate) {
      const matches = this.matches();
      const visible = matches.slice(0, this.shown);
      const revealed = [];
      this.cards.forEach((card) => {
        const show = visible.includes(card);
        // Cards still waiting for their scroll reveal are hidden with visibility, so they are revealed here too.
        if (show && (card.hidden || card.style.visibility === 'hidden')) revealed.push(card);
        card.hidden = !show;
      });
      if (this.moreButton) this.moreButton.hidden = matches.length <= this.shown;
      if (this.emptyMessage) this.emptyMessage.hidden = matches.length > 0;
      if (animate && window.ScrollTrigger) window.ScrollTrigger.refresh();

      if (animate && revealed.length && window.gsap && !reduceMotion) {
        window.gsap.fromTo(
          revealed,
          { autoAlpha: 0, y: 36, scale: 0.96 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.55,
            stagger: 0.06,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
          }
        );
      }
      return matches;
    }

    showCard(card) {
      if (!card.hidden) return;
      this.filter = 'all';
      this.tabs.forEach((tab) => {
        const active = tab.dataset.filter === 'all';
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      this.movePill();
      this.shown = Math.max(this.perPage, Number(card.dataset.index) + 1);
      this.applyFilter(false);
    }

    /* Cards */

    bindCards() {
      const saved = this.savedList();
      this.cards.forEach((card) => {
        const index = Number(card.dataset.index);
        const item = this.items[index] || {};
        card.querySelector('[data-card-select]').addEventListener('click', () => this.select(index, true));
        card.querySelector('[data-card-add]').addEventListener('click', (event) => {
          this.addToCart(index, 1, event.currentTarget);
        });

        const heart = card.querySelector('[data-heart]');
        if (heart) {
          heart.setAttribute('aria-pressed', saved.includes(item.title) ? 'true' : 'false');
          heart.addEventListener('click', () => this.toggleSaved(heart, item.title));
        }
      });
    }

    savedList() {
      try {
        return JSON.parse(localStorage.getItem('food-saved') || '[]');
      } catch (error) {
        return [];
      }
    }

    toggleSaved(heart, title) {
      const saved = this.savedList();
      const index = saved.indexOf(title);
      if (index === -1) saved.push(title);
      else saved.splice(index, 1);
      heart.setAttribute('aria-pressed', index === -1 ? 'true' : 'false');
      try {
        localStorage.setItem('food-saved', JSON.stringify(saved));
      } catch (error) {
        /* Storage can be unavailable in private browsing; the heart still toggles for this visit. */
      }
      if (window.gsap && !reduceMotion) {
        window.gsap.fromTo(heart, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', clearProps: 'transform' });
      }
    }

    /* Spotlight */

    initSpot() {
      const spot = this.spot;
      this.stage = spot.querySelector('[data-spot-stage]');
      this.disc = spot.querySelector('[data-spot-disc]');
      this.product = spot.querySelector('[data-spot-product]');
      this.turn = spot.querySelector('[data-spot-turn]');
      this.thumbs = spot.querySelector('[data-spot-thumbs]');
      this.thumbsNext = spot.querySelector('[data-spot-thumbs-next]');
      this.spinButton = spot.querySelector('[data-spot-spin]');
      this.qtyInput = spot.querySelector('[data-qty-input]');
      this.addButton = spot.querySelector('[data-spot-add]');
      this.angle = 0;
      this.velocity = 0;
      this.lean = 0;
      this.autoSpin = false;
      this.dragging = false;
      this.frames = [];
      this.frameIndex = -1;

      this.renderThumbs(this.items[this.current]);
      this.setFrames(this.items[this.current]);
      this.bindRotation();

      spot.querySelectorAll('[data-qty]').forEach((button) => {
        button.addEventListener('click', () => {
          this.qtyInput.value = clamp((Number(this.qtyInput.value) || 1) + Number(button.dataset.qty), 1, 99);
        });
      });
      this.qtyInput.addEventListener('change', () => {
        this.qtyInput.value = clamp(Math.round(Number(this.qtyInput.value) || 1), 1, 99);
      });
      this.addButton.addEventListener('click', () => {
        this.addToCart(this.current, Number(this.qtyInput.value) || 1, this.addButton);
      });
      this.spinButton.addEventListener('click', () => {
        this.autoSpin = !this.autoSpin;
        this.spinButton.setAttribute('aria-pressed', this.autoSpin ? 'true' : 'false');
        this.loop();
      });
      this.thumbsNext.addEventListener('click', () => {
        const vertical = this.thumbs.scrollHeight > this.thumbs.clientHeight + 1;
        this.thumbs.scrollBy(vertical ? { top: 60 } : { left: 60 });
      });
    }

    currentImage() {
      return this.turn.querySelector('img.food-spot__img');
    }

    renderThumbs(item) {
      const images = (item && item.images) || [];
      this.thumbs.innerHTML = '';
      images.forEach((src, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `food-spot__thumb${index === 0 ? ' is-active' : ''}`;
        button.setAttribute('aria-label', `${item.title} ${index + 1}`);
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        button.appendChild(img);
        button.addEventListener('click', () => {
          this.thumbs.querySelectorAll('.food-spot__thumb').forEach((thumb) => thumb.classList.toggle('is-active', thumb === button));
          this.setImage(src, item.title);
        });
        this.thumbs.appendChild(button);
      });
      this.thumbsNext.hidden = images.length <= 3;
    }

    setImage(src, alt) {
      let img = this.currentImage();
      if (!src) {
        const template = this.querySelector('[data-food-placeholder]');
        this.turn.innerHTML = '';
        if (template) this.turn.appendChild(template.content.cloneNode(true));
        return;
      }
      if (!img) {
        this.turn.innerHTML = '';
        img = document.createElement('img');
        img.className = 'food-spot__img';
        img.draggable = false;
        this.turn.appendChild(img);
      }
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.src = src;
      img.alt = alt || '';
    }

    setFrames(item) {
      this.frames = (item && item.frames) || [];
      this.frameIndex = -1;
      this.frames.forEach((src) => {
        const preload = new Image();
        preload.src = src;
      });
    }

    select(index, scroll) {
      const item = this.items[index];
      if (!item || !this.spot) return;
      this.cards.forEach((card) => card.classList.toggle('is-current', Number(card.dataset.index) === index));
      if (scroll) {
        const rect = this.spot.getBoundingClientRect();
        if (rect.top < 0 || rect.top > window.innerHeight * 0.4) {
          const offset = (document.querySelector('.section-header')?.offsetHeight || 0) + 16;
          window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      }
      if (index === this.current) return;
      this.current = index;

      const swap = () => {
        this.fillInfo(item);
        this.renderThumbs(item);
        this.setImage(item.images[0], item.title);
        this.setFrames(item);
        this.angle = 0;
        this.velocity = 0;
        this.render();
        this.qtyInput.value = 1;
      };

      const gsap = window.gsap;
      if (!gsap || reduceMotion) {
        swap();
        return;
      }
      const info = this.spot.querySelector('.food-spot__info');
      const infoParts = () => Array.from(info.children).filter((child) => !child.classList.contains('is-hidden'));
      gsap
        .timeline({ defaults: { ease: 'power2.in' } })
        .to(this.product, { autoAlpha: 0, scale: 0.8, y: 30, duration: 0.28 }, 0)
        .to(infoParts(), { autoAlpha: 0, y: -12, duration: 0.22, stagger: 0.02 }, 0)
        .add(swap)
        .fromTo(
          this.product,
          { autoAlpha: 0, scale: 0.75, y: -40, rotate: -8 },
          { autoAlpha: 1, scale: 1, y: 0, rotate: 0, duration: 0.8, ease: 'back.out(1.6)', clearProps: 'transform,opacity,visibility' }
        )
        .add(() => {
          gsap.fromTo(
            infoParts(),
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity,visibility' }
          );
        }, '<0.1');
    }

    fillInfo(item) {
      const spot = this.spot;
      const badge = spot.querySelector('[data-spot-badge]');
      badge.className = `food-badge food-badge--${item.badgeStyle || 'new'}${item.badge ? '' : ' is-hidden'}`;
      spot.querySelector('[data-spot-badge-text]').textContent = item.badge || '';
      spot.querySelector('[data-spot-title]').textContent = item.title || '';
      spot.querySelector('[data-spot-price]').textContent = item.price || '';
      spot.querySelector('[data-spot-desc]').textContent = item.desc || '';
      spot.querySelectorAll('[data-spot-fact]').forEach((fact) => {
        fact.textContent = item[fact.dataset.spotFact] || '–';
      });
      this.addButton.disabled = Boolean(item.variant) && !item.available;
    }

    /* Drag to rotate */

    bindRotation() {
      const stage = this.stage;
      stage.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.target.closest('button')) return;
        this.dragging = true;
        this.pointerX = event.clientX;
        this.velocity = 0;
        stage.classList.add('is-dragging');
        try {
          stage.setPointerCapture(event.pointerId);
        } catch (error) {
          /* Capture fails for synthetic pointers; dragging still works while the pointer stays on the stage. */
        }
        this.loop();
      });
      stage.addEventListener('pointermove', (event) => {
        if (!this.dragging) return;
        const delta = (event.clientX - this.pointerX) * 0.55;
        this.pointerX = event.clientX;
        this.angle += delta;
        this.velocity = delta;
      });
      const end = () => {
        if (!this.dragging) return;
        this.dragging = false;
        stage.classList.remove('is-dragging');
        this.loop();
      };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
      stage.addEventListener('lostpointercapture', end);
      stage.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        this.velocity = event.key === 'ArrowLeft' ? -9 : 9;
        this.loop();
      });
      this.render();
    }

    loop() {
      if (this.frame) return;
      const step = () => {
        if (!this.dragging) {
          if (this.autoSpin && !reduceMotion) {
            this.velocity += (0.8 - this.velocity) * 0.05;
          } else {
            this.velocity *= 0.93;
            if (Math.abs(this.velocity) < 0.02) this.velocity = 0;
          }
          this.angle += this.velocity;
        }
        const targetLean = this.dragging || this.velocity ? clamp(this.velocity * 2.4, -26, 26) : 0;
        this.lean += (targetLean - this.lean) * 0.14;
        this.render();

        const settled = !this.dragging && !this.autoSpin && this.velocity === 0 && Math.abs(this.lean) < 0.05;
        if (settled) {
          this.lean = 0;
          this.render();
          this.frame = 0;
          return;
        }
        this.frame = requestAnimationFrame(step);
      };
      this.frame = requestAnimationFrame(step);
    }

    render() {
      if (!this.disc) return;
      this.disc.style.setProperty('--spin', `${this.angle.toFixed(2)}deg`);
      const count = this.frames.length;
      if (count > 1) {
        const index = (((Math.round(this.angle / (360 / count)) % count) + count) % count);
        if (index !== this.frameIndex) {
          this.frameIndex = index;
          this.setImage(this.frames[index], this.items[this.current].title);
        }
      }
      const lean = count > 1 ? this.lean * 0.3 : this.lean;
      this.turn.style.transform = lean
        ? `rotateY(${lean.toFixed(2)}deg) translateX(${(lean * 0.12).toFixed(2)}%)`
        : '';
    }

    /* Cart */

    async addToCart(index, quantity, button) {
      const item = this.items[index];
      if (!item) return;
      if (!item.variant) {
        if (item.link) window.location.href = item.link;
        else this.toast(`${item.title}: connect a product in the theme editor to sell it.`);
        return;
      }
      if (!item.available) return;

      const drawer = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
      const sections = drawer && typeof drawer.getSectionsToRender === 'function'
        ? drawer.getSectionsToRender().map((section) => section.id)
        : ['cart-icon-bubble'];

      button.classList.add('is-loading');
      try {
        const response = await fetch(`${(window.routes && window.routes.cart_add_url) || '/cart/add'}.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            items: [{ id: item.variant, quantity }],
            sections,
            sections_url: window.location.pathname,
          }),
        });
        const data = await response.json();
        if (!response.ok || data.status) throw new Error(data.description || data.message || 'Could not add to cart');

        if (drawer && typeof drawer.renderContents === 'function') {
          drawer.classList.remove('is-empty');
          drawer.renderContents({ ...(data.items ? data.items[0] : data), sections: data.sections });
        } else {
          this.updateCartBubble(data.sections);
          this.toast(`${item.title} ${this.dataset.added || 'added to cart'}`, true);
        }
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'food-menu', cartData: data });
        }
      } catch (error) {
        this.toast(error.message);
      } finally {
        button.classList.remove('is-loading');
      }
    }

    updateCartBubble(sections) {
      const html = sections && sections['cart-icon-bubble'];
      const bubble = document.getElementById('cart-icon-bubble');
      if (!html || !bubble) return;
      const source = new DOMParser().parseFromString(html, 'text/html').querySelector('.shopify-section');
      if (source) bubble.innerHTML = source.innerHTML;
    }

    toast(message, withCartLink) {
      const toast = this.toastEl;
      if (!toast) return;
      toast.textContent = message;
      if (withCartLink) {
        const link = document.createElement('a');
        link.href = this.dataset.cartUrl || '/cart';
        link.textContent = this.dataset.viewCart || 'View cart';
        toast.appendChild(link);
      }
      toast.classList.add('is-visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3600);
    }
  }

  if (!customElements.get('food-menu')) customElements.define('food-menu', FoodMenu);

  const init = (scope) => {
    initSparks(scope);
    initPointerParallax(scope);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(document));
  else init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
})();
