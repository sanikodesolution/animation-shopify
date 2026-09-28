(() => {
  if (customElements.get('cm-arc-carousel')) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mod = (value, size) => ((value % size) + size) % size;
  const WAVE_FREQUENCY = 0.62;

  class CmArcCarousel extends HTMLElement {
    connectedCallback() {
      this.stage = this.querySelector('.cm-arc__stage');
      if (!this.stage) return;
      this.originals = Array.from(this.stage.querySelectorAll('.cm-arc__item'));
      if (!this.originals.length) return;

      this.section = this.closest('.cm-arc');
      this.titleEl = this.querySelector('.cm-arc__title');
      this.subtitleEl = this.querySelector('.cm-arc__subtitle');
      this.buttonEl = this.querySelector('.cm-arc__btn');
      this.progressEl = this.querySelector('.cm-arc__progress');
      this.wave = parseFloat(this.dataset.curve) || 0;
      this.tilt = parseFloat(this.dataset.tilt) || 0;
      this.gap = parseFloat(this.dataset.gap) || 0;
      this.delay = (parseFloat(this.dataset.autoplay) || 0) * 1000;
      this.position = 0;
      this.target = 0;
      this.activeIndex = -1;
      this.items = [];

      this.originals = this.originals.filter((item) => {
        const img = item.querySelector('img.cm-arc__img');
        if (!img) return true;
        if (img.complete && img.naturalWidth === 0 && img.currentSrc) {
          item.remove();
          return false;
        }
        img.addEventListener('error', () => this.dropItem(item), { once: true });
        return true;
      });
      if (!this.originals.length) return this.hideSection();

      this.bindEvents();
      this.build();
      this.resizeObserver = new ResizeObserver(() => this.build());
      this.resizeObserver.observe(this.stage);
    }

    disconnectedCallback() {
      clearInterval(this.timer);
      cancelAnimationFrame(this.raf);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.visibility) this.visibility.disconnect();
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
    }

    bindEvents() {
      this.querySelector('[data-arc-prev]')?.addEventListener('click', () => this.step(-1));
      this.querySelector('[data-arc-next]')?.addEventListener('click', () => this.step(1));

      this.stage.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') this.step(-1);
        if (event.key === 'ArrowRight') this.step(1);
      });

      this.stage.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        this.pointer = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          target: this.target,
          item: event.target.closest('.cm-arc__item'),
          moved: false,
        };
        clearInterval(this.timer);
      });

      this.stage.addEventListener('pointermove', (event) => {
        const pointer = this.pointer;
        if (!pointer || event.pointerId !== pointer.id) return;
        const dx = event.clientX - pointer.x;

        if (!pointer.moved) {
          if (Math.abs(dx) < 6) return;
          if (Math.abs(event.clientY - pointer.y) > Math.abs(dx)) {
            this.pointer = null;
            return;
          }
          pointer.moved = true;
          this.dragging = true;
          try {
            this.stage.setPointerCapture(event.pointerId);
          } catch (error) {}
          this.stage.classList.add('is-dragging');
        }

        this.target = pointer.target - dx / this.spacing;
        this.animate();
      });

      const endPointer = (event) => {
        const pointer = this.pointer;
        if (!pointer || event.pointerId !== pointer.id) return;
        this.pointer = null;

        if (!pointer.moved) {
          if (event.type === 'pointerup' && pointer.item) this.onItemClick(pointer.item);
          this.startAutoplay();
          return;
        }

        this.dragging = false;
        this.stage.classList.remove('is-dragging');
        const dx = event.clientX - pointer.x;
        let target = Math.round(this.target);
        if (target === Math.round(pointer.target) && Math.abs(dx) > 30) target -= Math.sign(dx);
        this.target = target;
        this.animate();
        this.startAutoplay();
      };
      this.stage.addEventListener('pointerup', endPointer);
      this.stage.addEventListener('pointercancel', endPointer);

      this.addEventListener('mouseenter', () => clearInterval(this.timer));
      this.addEventListener('mouseleave', () => this.startAutoplay());
      this.addEventListener('focusin', () => clearInterval(this.timer));
      this.addEventListener('focusout', () => this.startAutoplay());

      this.visibility = new IntersectionObserver(([entry]) => {
        this.inView = entry.isIntersecting;
        if (this.inView) this.startAutoplay();
        else clearInterval(this.timer);
      });
      this.visibility.observe(this);

      this.onBlockSelect = (event) => {
        const index = this.originals.indexOf(event.target);
        if (index > -1) this.goTo(index);
      };
      document.addEventListener('shopify:block:select', this.onBlockSelect);
    }

    build() {
      const width = this.stage.clientWidth;
      const itemWidth = this.originals[0].offsetWidth;
      if (!width || !itemWidth) return;

      const gap = this.gap * (width < 750 ? 0.5 : 1);
      this.spacing = itemWidth * 1.02 + gap;
      this.style.setProperty('--cm-arc-gap', `${gap}px`);

      const needed = Math.ceil(width / this.spacing) + 4;
      const sets = Math.max(1, Math.ceil(needed / this.originals.length));
      if (sets * this.originals.length !== this.items.length) {
        this.stage.querySelectorAll('[data-arc-clone]').forEach((clone) => clone.remove());
        const fragment = document.createDocumentFragment();
        for (let set = 1; set < sets; set++) {
          this.originals.forEach((item) => {
            const clone = item.cloneNode(true);
            clone.setAttribute('data-arc-clone', '');
            clone.setAttribute('aria-hidden', 'true');
            clone.removeAttribute('data-shopify-editor-block');
            fragment.appendChild(clone);
          });
        }
        this.stage.appendChild(fragment);
        this.items = Array.from(this.stage.querySelectorAll('.cm-arc__item'));
      }

      this.render();
    }

    render() {
      const total = this.items.length;
      const count = this.originals.length;
      const current = mod(Math.round(this.position), total);

      this.items.forEach((item, index) => {
        const offset = mod(index - this.position + total / 2, total) - total / 2;
        const distance = Math.abs(offset);
        const focus = Math.max(0, 1 - distance);

        const x = offset * this.spacing;
        const y = Math.sin(offset * WAVE_FREQUENCY) * this.wave;
        const rotate = this.tilt * (0.72 + 0.28 * Math.sin(offset * 1.3));
        const scale = 0.86 - Math.min(distance, 8) * 0.012 + 0.28 * focus * focus;
        const brightness = focus + (1 - focus) * Math.max(0.3, 0.62 - distance * 0.035);
        const edge = Math.min(1, (total / 2 - distance) / 0.75);

        item.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        item.style.filter =
          brightness > 0.995
            ? 'none'
            : `brightness(${brightness.toFixed(3)}) saturate(${(0.55 + 0.45 * focus).toFixed(3)})`;
        item.style.opacity = String(Math.max(0, edge));
        item.style.zIndex = String(200 - Math.round(distance * 4));
        item.classList.toggle('is-active', index === current);
      });

      const active = mod(Math.round(this.position), count);
      if (active !== this.activeIndex) {
        const initial = this.activeIndex === -1;
        this.activeIndex = active;
        this.updateInfo(!initial);
      }
    }

    animate() {
      if (reduceMotion.matches && !this.dragging) {
        this.position = this.target;
        this.render();
        return;
      }
      if (this.raf) return;

      let last = performance.now();
      const tick = (now) => {
        const ease = 1 - Math.pow(0.88, Math.min(64, now - last) / 16.67);
        last = now;
        this.position += (this.target - this.position) * ease;

        if (!this.dragging && Math.abs(this.target - this.position) < 0.0005) {
          const shift = Math.floor(this.target / this.items.length) * this.items.length;
          this.target -= shift;
          this.position = this.target;
          this.render();
          this.raf = null;
          return;
        }

        this.render();
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }

    step(delta) {
      this.target = Math.round(this.target) + delta;
      this.animate();
    }

    goTo(index) {
      const count = this.originals.length;
      let delta = mod(index - mod(Math.round(this.target), count), count);
      if (delta > count / 2) delta -= count;
      this.step(delta);
    }

    onItemClick(item) {
      if (item.classList.contains('is-active')) {
        if (item.dataset.link) window.location.href = item.dataset.link;
        return;
      }
      const total = this.items.length;
      const offset = mod(this.items.indexOf(item) - Math.round(this.target) + total / 2, total) - total / 2;
      this.step(Math.round(offset));
    }

    dropItem(item) {
      const index = this.originals.indexOf(item);
      if (index === -1) return;
      this.originals.splice(index, 1);
      item.remove();
      if (!this.originals.length) return this.hideSection();

      this.items = [];
      this.activeIndex = -1;
      this.target = Math.round(this.target);
      this.position = this.target;
      this.build();
    }

    hideSection() {
      clearInterval(this.timer);
      (this.closest('.shopify-section') || this.section || this).hidden = true;
    }

    startAutoplay() {
      clearInterval(this.timer);
      const inEditor = window.Shopify && window.Shopify.designMode;
      if (!this.delay || !this.inView || inEditor || reduceMotion.matches || this.originals.length < 2) return;
      if (this.matches(':hover') || this.contains(document.activeElement)) return;
      this.timer = setInterval(() => this.step(1), this.delay);
    }

    updateInfo(animate) {
      const count = this.originals.length;
      const item = this.originals[this.activeIndex];
      const { title, subtitle, link, accent } = item.dataset;

      if (this.titleEl) this.titleEl.textContent = title || '';
      if (this.subtitleEl) {
        this.subtitleEl.textContent = subtitle || '';
        this.subtitleEl.hidden = !subtitle;
      }
      if (this.buttonEl) {
        this.buttonEl.hidden = !link;
        if (link) this.buttonEl.href = link;
      }
      if (this.progressEl) {
        const progress = count > 1 ? (this.activeIndex / (count - 1)) * 100 : 100;
        this.progressEl.style.setProperty('--cm-arc-progress', `${progress}%`);
      }
      if (this.section) this.section.style.setProperty('--cm-arc-accent', accent || this.dataset.accent);

      if (!animate || reduceMotion.matches) return;
      [this.titleEl, this.subtitleEl]
        .filter((el) => el && !el.hidden)
        .forEach((el, i) => {
          el.animate(
            [
              { opacity: 0, transform: 'translateY(24px)', filter: 'blur(6px)' },
              { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
            ],
            { duration: 650, delay: i * 70, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' }
          );
        });
    }
  }

  customElements.define('cm-arc-carousel', CmArcCarousel);
})();
