(() => {
  if (customElements.get('cm-gift-card')) return;

  const MESSAGE_LIMIT = 200;

  class CmGiftCard extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('[data-gc-form]');
      this.big = this.querySelector('[data-gc-big]');
      this.price = this.querySelector('[data-gc-price]');
      this.hint = this.querySelector('[data-gc-hint]');
      this.giftToggle = this.querySelector('[data-gc-gift]');
      this.giftFields = this.querySelector('[data-gc-fields]');
      this.button = this.querySelector('[data-gc-add]');
      this.toastEl = this.querySelector('[data-gc-toast]');
      this.hints = this.parseHints(this.dataset.hints || '');

      this.form.addEventListener('change', (event) => {
        if (event.target.matches('.cm-gc__chips input')) this.update();
      });
      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.addToCart();
      });
      if (this.giftToggle) {
        this.giftToggle.addEventListener('change', () => this.toggleGift(this.giftToggle.checked));
      }

      this.initTilt();
      this.update();
    }

    parseHints(text) {
      return text.split(/\r?\n/).reduce((map, line) => {
        const [amount, ...rest] = line.split('|');
        const key = parseFloat((amount || '').replace(/[^\d.]/g, ''));
        const hint = rest.join('|').trim();
        if (!Number.isNaN(key) && hint) map[key] = hint;
        return map;
      }, {});
    }

    get selected() {
      return this.form.querySelector('.cm-gc__chips input:checked');
    }

    update() {
      const input = this.selected;
      if (!input) return;
      if (this.big) this.big.textContent = input.dataset.big;
      if (this.price) {
        const currency = this.price.querySelector('small');
        this.price.textContent = `${input.dataset.price} `;
        if (currency) this.price.appendChild(currency);
      }
      if (this.hint) this.hint.textContent = this.hints[parseFloat(input.dataset.amount)] || '';
    }

    toggleGift(on) {
      this.giftFields.hidden = !on;
      this.giftFields.querySelectorAll('input, textarea').forEach((field) => {
        field.disabled = !on;
      });
      const email = this.giftFields.querySelector('[data-gc-email]');
      if (email) email.required = on;
      const date = this.giftFields.querySelector('[data-gc-date]');
      if (date && on) date.min = new Date().toISOString().slice(0, 10);
      const offset = this.giftFields.querySelector('[data-gc-offset]');
      if (offset) offset.value = new Date().getTimezoneOffset().toString();
      if (on && email) email.focus();
    }

    buildFormData() {
      const data = new FormData(this.form);
      const sender = this.querySelector('[data-gc-sender]');
      if (this.giftToggle && this.giftToggle.checked && sender && sender.value.trim()) {
        const signature = `\n- ${sender.value.trim()}`;
        const message = (data.get('properties[Message]') || '').toString().trim();
        data.set('properties[Message]', message.slice(0, MESSAGE_LIMIT - signature.length) + signature);
      }
      if (!data.get('properties[Send on]')) data.delete('properties[Send on]');
      data.set('quantity', '1');
      return data;
    }

    async addToCart() {
      const input = this.selected;
      if (!input || input.name !== 'id') {
        this.toast(this.dataset.unavailable || 'Gift cards are coming soon.');
        return;
      }
      if (!this.form.reportValidity()) return;

      const drawer = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
      const sections =
        drawer && typeof drawer.getSectionsToRender === 'function'
          ? drawer.getSectionsToRender().map((section) => section.id)
          : ['cart-icon-bubble'];

      const body = this.buildFormData();
      body.append('sections', sections.join(','));
      body.append('sections_url', window.location.pathname);

      this.button.classList.add('is-loading');
      try {
        const response = await fetch(`${(window.routes && window.routes.cart_add_url) || '/cart/add'}.js`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body,
        });
        const data = await response.json();
        if (!response.ok || data.status) throw new Error(this.errorText(data));

        if (drawer && typeof drawer.renderContents === 'function') {
          drawer.classList.remove('is-empty');
          drawer.renderContents(data);
        } else {
          this.updateCartBubble(data.sections);
          this.toast(`${input.dataset.big} ${this.dataset.added || 'gift card added to your cart'}`, true);
        }
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cm-gift-card', productVariantId: input.value, cartData: data });
        }
      } catch (error) {
        this.toast(error.message);
      } finally {
        this.button.classList.remove('is-loading');
      }
    }

    errorText(data) {
      if (data.errors && typeof data.errors === 'object') {
        const messages = Object.values(data.errors).flat().filter(Boolean);
        if (messages.length) return messages.join(' ');
      }
      return data.description || data.message || 'Could not add to cart';
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
        link.textContent = 'View cart';
        toast.appendChild(link);
      }
      toast.classList.add('is-visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
    }

    initTilt() {
      const stage = this.querySelector('[data-gc-stage]');
      const label = this.querySelector('[data-gc-label]');
      if (!stage || !label || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      stage.addEventListener('pointermove', (event) => {
        const rect = stage.getBoundingClientRect();
        label.style.setProperty('--ry', `${((event.clientX - rect.left) / rect.width - 0.5) * 14}deg`);
        label.style.setProperty('--rx', `${(0.5 - (event.clientY - rect.top) / rect.height) * 10}deg`);
      });
      stage.addEventListener('pointerleave', () => {
        label.style.setProperty('--ry', '0deg');
        label.style.setProperty('--rx', '0deg');
      });
    }
  }

  customElements.define('cm-gift-card', CmGiftCard);
})();
