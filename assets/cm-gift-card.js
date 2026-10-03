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
      this.initReviews();
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

    initReviews() {
      const root = this.querySelector('[data-gc-reviews]');
      if (!root) return;

      const MAX = 3;
      const MAX_MB = 5;
      const OK = ['image/jpeg', 'image/png', 'image/webp'];
      const form = root.querySelector('[data-gc-rv-form]');
      const list = root.querySelector('[data-gc-rv-list]');
      const empty = root.querySelector('[data-gc-rv-empty]');
      const sum = root.querySelector('[data-gc-rv-sum]');
      const thumbs = root.querySelector('[data-gc-rv-thumbs]');
      const filesInput = root.querySelector('[data-gc-rv-files]');
      const err = root.querySelector('[data-gc-rv-err]');
      if (!form || !list || !sum) return;

      let picked = [];
      const ratings = [...list.querySelectorAll('[data-gc-rv-card]')]
        .map((card) => parseInt(card.dataset.rating, 10))
        .filter((n) => n >= 1 && n <= 5);

      const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

      const drawThumbs = () => {
        if (!thumbs) return;
        thumbs.replaceChildren();
        picked.forEach((item, index) => {
          const wrap = document.createElement('div');
          wrap.className = 'cm-gc__thumb';
          const img = document.createElement('img');
          img.src = item.url;
          img.alt = `Selected photo ${index + 1}`;
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = '×';
          button.setAttribute('aria-label', `Remove photo ${index + 1}`);
          button.addEventListener('click', () => {
            URL.revokeObjectURL(item.url);
            picked.splice(index, 1);
            drawThumbs();
          });
          wrap.append(img, button);
          thumbs.append(wrap);
        });
      };

      const renderSummary = () => {
        if (!ratings.length) {
          sum.textContent = 'No reviews yet';
          return;
        }
        const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        sum.replaceChildren();
        const strong = document.createElement('strong');
        strong.textContent = avg.toFixed(1);
        const starEl = document.createElement('span');
        starEl.className = 'cm-gc__stars';
        starEl.setAttribute('aria-hidden', 'true');
        starEl.textContent = stars(Math.round(avg));
        const count = document.createElement('span');
        count.textContent = `${ratings.length} review${ratings.length === 1 ? '' : 's'}`;
        sum.append(strong, starEl, count);
      };

      if (filesInput) {
        filesInput.addEventListener('change', () => {
          if (err) err.textContent = '';
          for (const file of filesInput.files) {
            if (picked.length >= MAX) {
              if (err) err.textContent = `You can add up to ${MAX} photos.`;
              break;
            }
            if (!OK.includes(file.type)) {
              if (err) err.textContent = 'Only JPG, PNG or WebP images are allowed.';
              continue;
            }
            if (file.size > MAX_MB * 1048576) {
              if (err) err.textContent = `${file.name} is larger than ${MAX_MB} MB.`;
              continue;
            }
            picked.push({ file, url: URL.createObjectURL(file) });
          }
          filesInput.value = '';
          drawThumbs();
        });
      }

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const ratingInput = form.querySelector('[data-gc-rate]:checked');
        const nameInput = form.querySelector('[data-gc-rv-name]');
        const textInput = form.querySelector('[data-gc-rv-text]');
        const name = (nameInput && nameInput.value.trim()) || '';
        const text = (textInput && textInput.value.trim()) || '';

        if (!ratingInput) {
          if (err) err.textContent = 'Choose a star rating.';
          return;
        }
        if (!name) {
          if (err) err.textContent = 'Enter your name.';
          if (nameInput) nameInput.focus();
          return;
        }
        if (text.length < 10) {
          if (err) err.textContent = 'Write at least 10 characters in your review.';
          if (textInput) textInput.focus();
          return;
        }

        if (err) err.textContent = '';
        const rating = parseInt(ratingInput.value, 10);
        const card = document.createElement('article');
        card.className = 'cm-gc__rv-card';
        card.dataset.gcRvCard = '';
        card.dataset.rating = String(rating);

        const top = document.createElement('div');
        top.className = 'cm-gc__rv-top';
        const author = document.createElement('b');
        author.textContent = name;
        const time = document.createElement('time');
        time.textContent = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        top.append(author, time);

        const starEl = document.createElement('div');
        starEl.className = 'cm-gc__stars';
        starEl.setAttribute('role', 'img');
        starEl.setAttribute('aria-label', `${rating} out of 5 stars`);
        starEl.textContent = stars(rating);

        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        card.append(top, starEl, paragraph);

        if (picked.length) {
          const photos = document.createElement('div');
          photos.className = 'cm-gc__rv-photos';
          picked.forEach((item, index) => {
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = `Photo ${index + 1} from ${name}`;
            photos.append(img);
          });
          card.append(photos);
        }

        if (empty) empty.remove();
        list.prepend(card);
        ratings.push(rating);
        renderSummary();
        picked = [];
        drawThumbs();
        form.reset();
        this.toast(root.dataset.thanks || 'Thanks! Your review is posted');
      });
    }
  }

  customElements.define('cm-gift-card', CmGiftCard);
})();
