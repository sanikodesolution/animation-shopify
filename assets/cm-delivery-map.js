(() => {
  if (customElements.get('cm-delivery-map')) return;

  const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet';
  let leafletPromise;

  function loadLeaflet() {
    if (!leafletPromise) {
      const load = (tag, attrs) =>
        new Promise((resolve, reject) => {
          const el = Object.assign(document.createElement(tag), attrs);
          el.onload = resolve;
          el.onerror = reject;
          document.head.appendChild(el);
        });
      const css = document.querySelector(`link[href="${LEAFLET}.css"]`)
        ? Promise.resolve()
        : load('link', { rel: 'stylesheet', href: `${LEAFLET}.css` });
      const js = window.L ? Promise.resolve() : load('script', { src: `${LEAFLET}.js`, async: true });
      leafletPromise = Promise.all([css, js]).then(() => window.L);
    }
    return leafletPromise;
  }

  const pinSvg = (fill) =>
    `<svg width="26" height="36" viewBox="0 0 26 36" aria-hidden="true"><path d="M13 0C5.8 0 0 5.8 0 13c0 9.8 13 23 13 23s13-13.2 13-23C26 5.8 20.2 0 13 0z" fill="${fill}"/><circle cx="13" cy="13" r="5" fill="#fff"/></svg>`;

  const starSvg = (fill) =>
    `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="${fill}" stroke="#fff" stroke-width="2"/><path d="M20 9l3.2 6.9 7.5.9-5.6 5.1 1.5 7.4L20 25.6l-6.6 3.7 1.5-7.4-5.6-5.1 7.5-.9z" fill="#fff"/></svg>`;

  class CmDeliveryMap extends HTMLElement {
    connectedCallback() {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          this.observer.disconnect();
          this.init();
        },
        { rootMargin: '300px 0px' }
      );
      this.observer.observe(this);
    }

    disconnectedCallback() {
      if (this.observer) this.observer.disconnect();
      if (this.map) this.map.remove();
      this.map = null;
    }

    async init() {
      const source = this.querySelector('script[type="application/json"]');
      if (!source) return;
      const config = JSON.parse(source.textContent);

      let L;
      try {
        L = await loadLeaflet();
      } catch (error) {
        console.warn('Delivery map could not load Leaflet', error);
        return;
      }
      if (!this.isConnected || this.map) return;

      const color = getComputedStyle(this).getPropertyValue('--cm-brand').trim() || '#f5a623';
      const num = (value) => parseFloat(value);
      const map = L.map(this.querySelector('.cm-map__canvas'), { scrollWheelZoom: false }).setView(
        [num(config.center[0]), num(config.center[1])],
        num(config.zoom)
      );
      this.map = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const bounds = [];
      config.pins.forEach((pin, index) => {
        const lat = num(pin.lat);
        const lng = num(pin.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;
        const icon = L.divIcon({
          className: 'cm-pin',
          html: `<div style="--cm-pin-delay:${(0.3 + index * 0.06).toFixed(2)}s">${pinSvg(color)}</div>`,
          iconSize: [26, 36],
          iconAnchor: [13, 36],
          tooltipAnchor: [0, -34],
        });
        L.marker([lat, lng], { icon, title: pin.name })
          .addTo(map)
          .bindTooltip(pin.name, { direction: 'top', className: 'cm-tip', permanent: !!config.labels });
        bounds.push([lat, lng]);
      });

      const hq = config.hq;
      if (hq && !Number.isNaN(num(hq.lat)) && !Number.isNaN(num(hq.lng))) {
        const icon = L.divIcon({
          className: 'cm-pin cm-pin--hq',
          html: starSvg(config.hqColor || '#0d1a2e'),
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          tooltipAnchor: [0, -20],
        });
        const marker = L.marker([num(hq.lat), num(hq.lng)], { icon, zIndexOffset: 1000, title: hq.name }).addTo(map);
        marker.bindTooltip(hq.name, { direction: 'top', className: 'cm-tip', permanent: true });
        if (hq.popup) marker.bindPopup(hq.popup);
      }

      if (config.fit && bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
      requestAnimationFrame(() => map.invalidateSize());
    }
  }

  customElements.define('cm-delivery-map', CmDeliveryMap);
})();
