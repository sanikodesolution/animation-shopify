(() => {
  if (customElements.get('cm-arc-carousel')) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  class CmArcCarousel extends HTMLElement {
    connectedCallback() {
      this.stage = this.querySelector('.cm-arc__stage');
      this.items = Array.from(this.querySelectorAll('.cm-arc__item'));
      if (!this.stage || !this.items.length) return;

      this.section = this.closest('.cm-arc');
      this.titleEl = this.querySelector('.cm-arc__title');
      this.subtitleEl = this.querySelector('.cm-arc__subtitle');
      this.buttonEl = this.querySelector('.cm-arc__btn');
      this.curve = parseFloat(this.dataset.curve) || 0;
      this.tilt = parseFloat(this.dataset.tilt) || 0;
      this.gap = parseFloat(this.dataset.gap) || 0;
      this.delay = (parseFloat(this.dataset.autoplay) || 0) * 1000;
      this.active = 0;

      this.resizeObserver = new ResizeObserver(() => this.layout(true));
      this.resizeObserver.observe(this.stage);

      this.querySelector('[data-arc-prev]')?.addEventListener('click', () => this.go(this.active - 1));
      this.querySelector('[data-arc-next]')?.addEventListener('click', () => this.go(this.active + 1));

      this.items.forEach((item) => {
        item.addEventListener('click', () => {
          if (this.dragged) return;
          const index = this.items.indexOf(item);
          if (index !== this.active) this.go(index);
          else if (item.dataset.link) window.location.href = item.dataset.link;
        });

        const img = item.querySelector('img.cm-arc__img');
        if (!img) return;
        if (img.complete && img.naturalWidth === 0 && img.currentSrc) this.removeItem(item, false);
        else img.addEventListener('error', () => this.removeItem(item, true), { once: true });
      });
      if (!this.items.length) return;

      this.stage.addEventListener('pointerdown', (event) => {
        this.startX = event.clientX;
        this.dragged = false;
      });
      this.stage.addEventListener('pointerup', (event) => {
        if (this.startX == null) return;
        const distance = event.clientX - this.startX;
        this.startX = null;
        if (Math.abs(distance) < 40) return;
        this.dragged = true;
        this.go(this.active + (distance < 0 ? 1 : -1));
        setTimeout(() => (this.dragged = false), 50);
      });

      this.stage.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') this.go(this.active - 1);
        if (event.key === 'ArrowRight') this.go(this.active + 1);
      });

      this.pause = () => clearInterval(this.timer);
      this.resume = () => this.startAutoplay();
      this.addEventListener('mouseenter', this.pause);
      this.addEventListener('mouseleave', this.resume);
      this.addEventListener('focusin', this.pause);
      this.addEventListener('focusout', this.resume);

      this.visibility = new IntersectionObserver(([entry]) => {
        this.inView = entry.isIntersecting;
        if (this.inView) this.startAutoplay();
        else this.pause();
      });
      this.visibility.observe(this);

      this.onBlockSelect = (event) => {
        const index = this.items.indexOf(event.target);
        if (index > -1) this.go(index);
      };
      document.addEventListener('shopify:block:select', this.onBlockSelect);

      this.layout(true);
      this.updateInfo(false);
    }

    disconnectedCallback() {
      clearInterval(this.timer);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.visibility) this.visibility.disconnect();
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
    }

    removeItem(item, relayout) {
      const index = this.items.indexOf(item);
      if (index === -1) return;
      this.items.splice(index, 1);
      item.remove();

      if (!this.items.length) {
        clearInterval(this.timer);
        (this.closest('.shopify-section') || this.section || this).hidden = true;
        return;
      }

      if (index < this.active || this.active >= this.items.length) this.active = Math.max(0, this.active - 1);
      if (!relayout) return;
      this.layout(true);
      this.updateInfo(false);
    }

    startAutoplay() {
      clearInterval(this.timer);
      const inEditor = window.Shopify && window.Shopify.designMode;
      if (!this.delay || !this.inView || inEditor || reduceMotion.matches || this.items.length < 2) return;
      this.timer = setInterval(() => this.go(this.active + 1), this.delay);
    }

    go(index) {
      const count = this.items.length;
      const next = ((index % count) + count) % count;
      if (next === this.active) return;
      this.active = next;
      this.layout(false);
      this.updateInfo(true);
    }

    layout(instant) {
      const count = this.items.length;
      const width = this.stage.clientWidth;
      const itemWidth = this.items[0].offsetWidth;
      const gap = this.gap * (width < 750 ? 0.5 : 1);
      const scaleAt = (distance) => (distance === 0 ? 1.2 : Math.max(0.5, 1 - distance * 0.09));

      const positions = [0];
      let side = 0;
      for (let d = 1; d <= Math.ceil(count / 2); d++) {
        positions[d] = positions[d - 1] + ((scaleAt(d - 1) + scaleAt(d)) / 2) * itemWidth + gap;
        if (positions[d] - (scaleAt(d) * itemWidth) / 2 < width / 2) side = d;
      }
      side = Math.max(side, 1);
      this.style.setProperty('--cm-arc-gap', `${gap}px`);

      this.items.forEach((item, index) => {
        let offset = index - this.active;
        if (offset > count / 2) offset -= count;
        else if (offset < -count / 2) offset += count;

        const distance = Math.abs(offset);
        const wrapped = item.cmOffset !== undefined && Math.abs(offset - item.cmOffset) > count / 2;
        item.cmOffset = offset;

        const x = Math.sign(offset) * positions[distance];
        const y = -this.curve * Math.pow(distance / side, 2);
        const scale = scaleAt(distance);
        const hidden = distance > side;

        item.style.transition = instant || wrapped ? 'none' : '';
        item.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) rotate(${-offset * this.tilt}deg) scale(${scale})`;
        item.style.opacity = hidden ? '0' : '1';
        item.style.visibility = hidden ? 'hidden' : 'visible';
        item.style.filter =
          distance === 0
            ? 'none'
            : `brightness(${Math.max(0.3, 1 - distance * 0.17)}) saturate(${Math.max(0.4, 1 - distance * 0.12)})`;
        item.style.zIndex = String(100 - Math.round(distance * 2));
        item.classList.toggle('is-active', distance === 0);
      });
    }

    updateInfo(animate) {
      const item = this.items[this.active];
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
      if (this.section) this.section.style.setProperty('--cm-arc-accent', accent || this.dataset.accent);

      if (!animate || reduceMotion.matches) return;
      [this.titleEl, this.subtitleEl, this.buttonEl]
        .filter((el) => el && !el.hidden)
        .forEach((el, i) => {
          el.animate(
            [
              { opacity: 0, transform: 'translateY(24px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            { duration: 700, delay: i * 80, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' }
          );
        });
    }
  }

  customElements.define('cm-arc-carousel', CmArcCarousel);
})();
