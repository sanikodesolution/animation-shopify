(() => {
  const root = document.documentElement;
  const release = () => root.classList.remove('gsap-pending');

  if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    release();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  const hasSplitText = typeof window.SplitText !== 'undefined';
  if (hasSplitText) gsap.registerPlugin(SplitText);

  const CLEAR = 'transform,opacity,visibility,clip-path,letter-spacing';
  const contexts = new WeakMap();

  const all = (scope, selector) => (scope ? Array.from(scope.querySelectorAll(selector)) : []);
  const visible = (elements) => elements.filter((el) => el.getClientRects().length > 0);
  const hasText = (el) => el.textContent.trim().length > 0;
  const unique = (elements) => Array.from(new Set(elements));

  const onceAt = (trigger, start = 'top 85%') => ({ trigger, start, once: true });

  const timeline = (trigger, start) =>
    gsap.timeline({
      scrollTrigger: onceAt(trigger, start),
      defaults: { ease: 'power3.out', clearProps: CLEAR },
    });

  function add(tl, targets, vars, position) {
    const list = gsap.utils.toArray(targets);
    if (list.length) tl.from(list, vars, position);
    return tl;
  }

  // ScrollTrigger.refresh() drops the start state of scroll-triggered fromTo tweens,
  // so the start state is set up front and the tween only animates to the end state.
  function setThenTo(tl, targets, fromVars, toVars, position) {
    gsap.set(targets, fromVars);
    return tl ? tl.to(targets, toVars, position) : gsap.to(targets, toVars);
  }

  function reveal(targets, vars = {}, trigger, start) {
    const list = gsap.utils.toArray(targets);
    if (!list.length) return;
    gsap.from(list, {
      autoAlpha: 0,
      y: 40,
      duration: 0.9,
      ease: 'power3.out',
      clearProps: CLEAR,
      ...vars,
      scrollTrigger: onceAt(trigger || list[0], start),
    });
  }

  function addSplitHeading(tl, heading, position) {
    if (!heading || !hasText(heading)) return;
    if (!hasSplitText) {
      add(tl, heading, { autoAlpha: 0, y: 30, duration: 0.9 }, position);
      return;
    }
    const split = SplitText.create(heading, { type: 'lines,words', mask: 'lines' });
    tl.from(
      split.words,
      {
        yPercent: 110,
        rotate: 4,
        duration: 1,
        ease: 'power4.out',
        stagger: 0.05,
        onComplete: () => split.revert(),
      },
      position
    );
  }

  function bgParallax(images, section) {
    if (!images.length) return;
    images.forEach((image) => image.classList.add('gsap-bg-parallax'));
    const overflow = () => parseFloat(getComputedStyle(images[0]).getPropertyValue('--gsap-bg-parallax')) || 70;
    gsap.fromTo(
      images,
      { y: () => -overflow() },
      {
        y: () => overflow(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      }
    );
  }

  function toLocationPins(paragraph) {
    const names = paragraph.textContent
      .split('📍')
      .map((name) => name.trim())
      .filter(Boolean);
    paragraph.textContent = '';
    paragraph.classList.add('gsap-pins');
    return names.map((name) => {
      const pin = document.createElement('span');
      pin.className = 'gsap-pin';
      pin.textContent = `📍 ${name}`;
      paragraph.appendChild(pin);
      return pin;
    });
  }

  function wrapCheckmarks(paragraphs) {
    const checks = [];
    paragraphs.forEach((paragraph) => {
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const index = node.data.indexOf('✓');
        if (index === -1) continue;
        const rest = node.splitText(index);
        rest.data = rest.data.slice(1);
        const check = document.createElement('span');
        check.className = 'gsap-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';
        rest.parentNode.insertBefore(check, rest);
        checks.push(check);
        break;
      }
    });
    return checks;
  }

  function announcementBar(section) {
    const messages = all(section, '.announcement-bar__message');
    if (!messages.length) return;
    gsap.from(messages, {
      yPercent: -120,
      autoAlpha: 0,
      duration: 0.8,
      delay: 0.1,
      ease: 'power3.out',
      clearProps: CLEAR,
    });
    all(section, '.announcement-bar__message svg').forEach((arrow) => {
      gsap.to(arrow, { x: 5, duration: 0.7, ease: 'sine.inOut', repeat: -1, yoyo: true });
    });
  }

  function header(section) {
    const tl = gsap.timeline({ delay: 0.15, defaults: { ease: 'power3.out', duration: 0.7, clearProps: CLEAR } });
    add(tl, all(section, '.header__heading-link'), {
      autoAlpha: 0,
      scale: 0.6,
      rotate: -8,
      duration: 0.9,
      ease: 'back.out(1.8)',
    });
    add(tl, all(section, '.header__inline-menu .list-menu > li'), { autoAlpha: 0, y: -16, stagger: 0.06 }, '-=0.5');
    add(
      tl,
      unique(all(section, 'header-drawer, .header__search, .header__icons > *')),
      { autoAlpha: 0, y: -10, stagger: 0.08 },
      '<'
    );
  }

  function imageBanner(section) {
    const box = section.querySelector('.banner__box');
    const images = all(section, '.banner__media img');
    const transparentBox = !!section.querySelector('.banner--desktop-transparent');

    const fixedBackground = !!section.querySelector('.banner__media.animate--fixed');
    if (images.length && !fixedBackground) {
      setThenTo(
        null,
        images,
        { scale: 1.2 },
        { scale: 1, duration: 2, ease: 'power2.out', scrollTrigger: onceAt(section, 'top 80%') }
      );
      bgParallax(images, section);
    }

    if (!box) return;
    const tl = timeline(section, 'top 80%');
    if (!transparentBox) add(tl, box, { autoAlpha: 0, y: 60, scale: 0.96, duration: 1 }, 0);

    let pins = [];
    const subtitles = all(box, '.banner__text').filter((text) => {
      const paragraph = text.querySelector('p');
      if (paragraph && paragraph.textContent.includes('📍')) {
        pins = pins.concat(toLocationPins(paragraph));
        return false;
      }
      return true;
    });

    add(tl, subtitles, { autoAlpha: 0, y: 20, letterSpacing: '0.4em', duration: 1.1 }, 0.2);
    addSplitHeading(tl, box.querySelector('.banner__heading'), 0.3);
    add(
      tl,
      pins,
      { autoAlpha: 0, y: 20, scale: 0.6, duration: 0.5, stagger: 0.04, ease: 'back.out(2)' },
      '-=0.6'
    );
    add(
      tl,
      all(box, '.banner__buttons .button'),
      { autoAlpha: 0, y: 30, scale: 0.9, duration: 0.8, stagger: 0.12, ease: 'back.out(1.7)' },
      '-=0.5'
    );
  }

  function featureGrid(section) {
    const boxes = all(section, '.wrapper-box > .box');
    if (!boxes.length) return;

    const iconsOnly = !!section.querySelector('[data-icon-motion]');
    const tl = timeline(section, 'top 80%');
    if (iconsOnly) {
      add(tl, all(section, '.box__image'), { autoAlpha: 0, y: 70, duration: 0.9, stagger: 0.15 }, 0);
      add(tl, all(section, '.box__image img, .box__image svg'), { scale: 0, rotate: -20, duration: 0.8, stagger: 0.15, ease: 'back.out(1.8)' }, 0.15);
    } else {
      add(tl, boxes, { autoAlpha: 0, y: 70, duration: 0.9, stagger: 0.15 }, 0);
      add(tl, all(section, '.box__image'), { scale: 0, rotate: -20, duration: 0.8, stagger: 0.15, ease: 'back.out(1.8)' }, 0.15);
      add(
        tl,
        all(section, '.box__title, .box__description').filter(hasText),
        { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.08 },
        0.4
      );
    }

    const badges = iconsOnly
      ? boxes
      : boxes.filter((box) => !box.querySelector('.box__title') || !hasText(box.querySelector('.box__title')));
    tl.call(() => {
      badges.forEach((box, index) => {
        const image = box.querySelector('.box__image img, .box__image svg');
        if (!image) return;
        gsap.to(image, {
          y: -8,
          duration: 2 + index * 0.3,
          delay: index * 0.2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    });

    boxes.forEach((box) => {
      const icon = box.querySelector('.box__image');
      if (!icon) return;
      box.addEventListener('mouseenter', () => {
        gsap.to(icon, { scale: 1.08, rotate: -3, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
      });
      box.addEventListener('mouseleave', () => {
        gsap.to(icon, { scale: 1, rotate: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
      });
    });
  }

  function imageWithText(section) {
    const media = section.querySelector('.image-with-text__media');
    const image = media && media.querySelector('img');
    const content = section.querySelector('.image-with-text__content');
    const reversed = !!section.querySelector('.image-with-text__grid--reverse');

    const tl = timeline(section, 'top 75%');
    if (media) {
      setThenTo(
        tl,
        media,
        { clipPath: reversed ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut' },
        0
      );
    }
    if (image) {
      setThenTo(
        null,
        image,
        { scale: 1.4 },
        { scale: 1.22, duration: 1.6, ease: 'power3.out', scrollTrigger: onceAt(section, 'top 75%') }
      );
      gsap.fromTo(
        image,
        { yPercent: -8 },
        {
          yPercent: 8,
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        }
      );
    }

    const overlay = media && media.querySelector('.iwt-overlay');
    if (overlay) {
      add(tl, all(overlay, '.iwt-overlay__box'), { scaleY: 0, duration: 0.9, ease: 'power4.inOut' }, 0.75);
      add(tl, all(overlay, '.iwt-overlay__line > span'), { yPercent: 110, duration: 0.9, stagger: 0.12, ease: 'power4.out' }, 1.2);
      add(tl, all(overlay, '.iwt-overlay__sub'), { autoAlpha: 0, y: 20, filter: 'blur(6px)', duration: 0.8, clearProps: `${CLEAR},filter` }, 1.45);
      const text = overlay.querySelector('.iwt-overlay__text');
      if (text) {
        gsap.fromTo(
          text,
          { y: 14 },
          {
            y: -14,
            ease: 'none',
            scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
          }
        );
      }
    }
    if (!content) return;

    const offset = reversed ? -50 : 50;
    const children = Array.from(content.children);
    const heading = children.find((el) => el.matches('.image-with-text__heading'));
    const items = children.flatMap((el) => {
      if (el === heading) return [];
      if (el.matches('.image-with-text__text') && el.querySelector('p')) return all(el, 'p');
      return [el];
    });
    const checks = wrapCheckmarks(items);

    addSplitHeading(tl, heading, 0.3);
    add(tl, items, { autoAlpha: 0, x: offset, duration: 0.8, stagger: 0.12 }, 0.35);
    add(tl, checks, { scale: 0, rotate: -90, duration: 0.6, stagger: 0.12, ease: 'back.out(3)' }, 0.6);
  }

  function product(section) {
    const media = section.querySelector('.product__media-wrapper');
    const info = section.querySelector('.product__info-container');
    const mediaRight = !!section.querySelector('.product--right');

    const tl = timeline(section, 'top 75%');
    add(tl, media, { autoAlpha: 0, x: mediaRight ? 60 : -60, duration: 1.1 }, 0);
    if (info) add(tl, visible(Array.from(info.children)), { autoAlpha: 0, y: 30, duration: 0.7, stagger: 0.07 }, 0.2);
  }

  function footer(section) {
    reveal(all(section, '.footer-block'), { y: 50, stagger: 0.12 }, section, 'top 90%');
    reveal(all(section, '.footer__content-bottom'), { y: 20 }, null, 'top 98%');
  }

  function richText(section) {
    const blocks = all(section, '.rich-text__blocks > *');
    const tl = timeline(section, 'top 80%');
    const heading = blocks.find((el) => el.matches('.rich-text__heading'));
    addSplitHeading(tl, heading, 0);
    add(tl, blocks.filter((el) => el !== heading), { autoAlpha: 0, y: 30, duration: 0.8, stagger: 0.12 }, 0.2);
  }

  function cardGrid(section) {
    all(section, '.title-wrapper-with-link, .title-wrapper').forEach((wrapper) => {
      const tl = timeline(wrapper, 'top 88%');
      const heading = wrapper.querySelector('h2, .title');
      addSplitHeading(tl, heading, 0);
      add(tl, Array.from(wrapper.children).filter((el) => el !== heading && !el.contains(heading)), { autoAlpha: 0, y: 20, duration: 0.6 }, 0.2);
    });

    const items = all(section, '.grid > .grid__item');
    if (items.length) {
      gsap.set(items, { autoAlpha: 0, y: 50 });
      ScrollTrigger.batch(items, {
        start: 'top 92%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', clearProps: CLEAR }),
      });
    }

    reveal(all(section, '.center .button, .collection__view-all'), { y: 20, duration: 0.6 });
  }

  function cmIntro(tl, container, position = 0) {
    if (!container) return;
    add(tl, all(container, ':scope > .cm-label'), { autoAlpha: 0, y: 14, letterSpacing: '0.5em', duration: 0.9 }, position);
    addSplitHeading(tl, container.querySelector(':scope > .cm-heading'), position + 0.1);
    add(
      tl,
      all(container, ':scope > .cm-body, :scope > .cm-form__cost, :scope > .cm-btn'),
      { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.12 },
      position + 0.35
    );
  }

  function cmHero(root) {
    const tl = timeline(root, 'top 90%');
    add(tl, all(root, '.cm-hero__glow'), { autoAlpha: 0, scale: 1.4, duration: 1.8, ease: 'power2.out' }, 0);
    add(tl, all(root, '.cm-hero__eyebrow'), { autoAlpha: 0, y: 12, letterSpacing: '0.6em', duration: 1 }, 0.1);
    addSplitHeading(tl, root.querySelector('.cm-hero__heading'), 0.2);
    add(tl, all(root, '.cm-hero__sub'), { autoAlpha: 0, y: 20, duration: 0.8 }, '-=0.5');
    add(tl, all(root, '.cm-ticker'), { autoAlpha: 0, yPercent: 100, duration: 0.8 }, '-=0.6');
    add(tl, all(root, '.cm-chip'), { autoAlpha: 0, y: 18, duration: 0.5, stagger: 0.04 }, '-=0.4');
  }

  function cmStory(root) {
    const tl = timeline(root, 'top 75%');
    cmIntro(tl, root.querySelector('.cm-story__text'), 0);

    const media = root.querySelector('.cm-story__media');
    if (!media) return;
    setThenTo(
      tl,
      media,
      { clipPath: 'inset(100% 0% 0% 0% round 12px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 12px)', duration: 1.3, ease: 'power4.inOut' },
      0.1
    );
    add(tl, all(media, 'video, img'), { scale: 1.25, duration: 1.6 }, 0.1);
    add(tl, all(media, '.cm-story__quote > *'), { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.15 }, 0.9);
  }

  function cmUsp(root) {
    const tl = timeline(root, 'top 80%');
    cmIntro(tl, root.querySelector('.cm-usp__intro'), 0);

    all(root, '.cm-usp__row').forEach((row, index) => {
      const rowTl = timeline(row, 'top 78%');
      const media = row.querySelector('.cm-usp__media');
      const fromRight = index % 2 === 1 && window.matchMedia('(min-width: 750px)').matches;
      add(rowTl, media, { autoAlpha: 0, x: fromRight ? 80 : -80, rotate: fromRight ? 2 : -2, duration: 1.1 }, 0);
      add(rowTl, all(row, '.cm-usp__media img'), { scale: 1.15, duration: 1.4 }, 0);
      add(rowTl, all(row, '.cm-usp__text > *'), { autoAlpha: 0, y: 30, duration: 0.8, stagger: 0.12 }, 0.25);
    });
  }

  function cmSteps(root) {
    const tl = timeline(root, 'top 75%');
    cmIntro(tl, root.querySelector('.cm-center'), 0);
    add(tl, all(root, '.cm-step'), { autoAlpha: 0, y: 60, duration: 0.9, stagger: 0.15 }, 0.3);
    add(
      tl,
      all(root, '.cm-step__num'),
      { scale: 0, rotate: -180, duration: 0.8, stagger: 0.15, ease: 'back.out(2)' },
      0.5
    );
    add(tl, all(root, '.cm-step__title, .cm-step__text'), { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.07 }, 0.7);
  }

  function cmMap(root) {
    const tl = timeline(root, 'top 75%');
    cmIntro(tl, root.querySelector('.cm-center'), 0);
    add(tl, all(root, '.cm-map'), { autoAlpha: 0, y: 70, scale: 0.96, duration: 1.1 }, 0.3);
    add(tl, all(root, '.cm-map__head > *'), { autoAlpha: 0, y: -12, duration: 0.6, stagger: 0.1 }, 0.8);
    add(tl, all(root, '.cm-map__foot'), { autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.12 }, 0.9);
  }

  function cmPlans(root) {
    const tl = timeline(root, 'top 78%');
    cmIntro(tl, root.querySelector('.cm-center'), 0);
    add(tl, all(root, '.cm-plan'), { autoAlpha: 0, y: 50, duration: 0.8, stagger: 0.12 }, 0.3);
    add(tl, all(root, '.cm-plan__cta'), { autoAlpha: 0, scale: 0.6, duration: 0.6, stagger: 0.12, ease: 'back.out(2)' }, 0.7);

    all(root, '.cm-plan__num').forEach((number, index) => {
      const text = number.textContent.trim();
      const target = parseInt(text, 10);
      if (!/^\d+$/.test(text) || !target) return;
      const counter = { value: 0 };
      number.textContent = '0';
      tl.to(
        counter,
        {
          value: target,
          duration: 1.2,
          ease: 'power2.out',
          onUpdate: () => (number.textContent = Math.round(counter.value)),
          onComplete: () => (number.textContent = text),
        },
        0.4 + index * 0.12
      );
    });
  }

  function cmCta(root) {
    const tl = timeline(root, 'top 85%');
    const container = root.querySelector('.cm-center');
    if (!container) return;
    add(tl, all(container, ':scope > .cm-label'), { autoAlpha: 0, y: 14, letterSpacing: '0.5em', duration: 0.9 }, 0);
    addSplitHeading(tl, container.querySelector(':scope > .cm-heading'), 0.1);
    add(tl, all(container, ':scope > .cm-body'), { autoAlpha: 0, y: 20, duration: 0.8 }, 0.35);
    add(tl, all(container, ':scope > .cm-btn'), { autoAlpha: 0, y: 20, scale: 0.8, duration: 0.8, ease: 'back.out(2)' }, 0.5);
  }

  function cmForm(root) {
    const tl = timeline(root, 'top 80%');
    add(tl, all(root, '.cm-form'), { autoAlpha: 0, y: 60, duration: 1 }, 0);
    cmIntro(tl, root.querySelector('.cm-form__header'), 0.2);
    add(
      tl,
      all(root, '.cm-form__fields > *, .cm-form__submit'),
      { autoAlpha: 0, y: 24, duration: 0.6, stagger: 0.07 },
      0.5
    );
  }

  function cmGallery(root) {
    const tl = timeline(root, 'top 80%');
    cmIntro(tl, root.querySelector('.cm-pg__intro'), 0);

    const desktop = window.matchMedia('(min-width: 990px)').matches;
    const overflow = () => parseFloat(getComputedStyle(root).getPropertyValue('--cm-pg-overflow')) || 60;
    const scrubbed = (trigger) => ({
      trigger,
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.8,
      invalidateOnRefresh: true,
    });

    all(root, '.cm-pg__item').forEach((item, index) => {
      const frame = item.querySelector('.cm-pg__frame');
      const image = frame && frame.querySelector('img, svg');
      const number = item.querySelector('.cm-pg__num');
      const fromRight = desktop && index % 2 === 1;

      const itemTl = timeline(item, 'top 80%');
      if (frame) {
        setThenTo(
          itemTl,
          frame,
          { clipPath: fromRight ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power4.inOut' },
          0
        );
      }
      add(itemTl, all(item, '.cm-pg__text > *'), { autoAlpha: 0, y: 30, duration: 0.8, stagger: 0.12 }, 0.5);

      if (image) {
        gsap.fromTo(
          image,
          { y: () => -overflow() },
          { y: () => overflow(), ease: 'none', scrollTrigger: scrubbed(frame) }
        );
      }
      if (number) {
        gsap.from(number, { autoAlpha: 0, duration: 1.2, ease: 'power2.out', scrollTrigger: onceAt(item, 'top 85%') });
        gsap.fromTo(
          number,
          { yPercent: -62, y: 90 },
          { yPercent: -62, y: -90, ease: 'none', scrollTrigger: scrubbed(item) }
        );
      }
    });
  }

  function cmArc(root) {
    const tl = timeline(root, 'top 75%');
    add(tl, all(root, '.cm-arc__glow'), { autoAlpha: 0, scale: 0.4, duration: 1.6, ease: 'power2.out' }, 0);
    cmIntro(tl, root.querySelector('.cm-center'), 0.1);
    add(tl, all(root, '.cm-arc__stage-wrap'), { autoAlpha: 0, y: 90, scale: 0.9, duration: 1.4, ease: 'power4.out' }, 0.3);
    add(tl, all(root, '.cm-arc__info'), { autoAlpha: 0, y: 30, duration: 0.8 }, 0.8);
  }

  const cmHandlers = {
    arc: cmArc,
    gallery: cmGallery,
    hero: cmHero,
    story: cmStory,
    usp: cmUsp,
    steps: cmSteps,
    map: cmMap,
    plans: cmPlans,
    cta: cmCta,
    form: cmForm,
  };

  function chefMatt(section) {
    const root = section.querySelector('[data-cm]');
    const run = root && cmHandlers[root.dataset.cm];
    if (run) run(root);
    else generic(section);
  }

  function generic(section) {
    const container = section.querySelector('.page-width, .page-width--narrow');
    const items = container ? visible(Array.from(container.children)) : [];
    reveal(items.length ? items : section, { y: 40, stagger: 0.12 }, section, 'top 85%');
  }

  const handlers = [
    { match: '[data-cm]', run: chefMatt },
    { match: '.announcement-bar-section', run: announcementBar },
    { match: '.section-header', run: header },
    { match: '.feature-type1', run: featureGrid },
    { match: '.image-with-text', run: imageWithText },
    { match: '.banner', run: imageBanner },
    { match: '.product__media-wrapper', run: product },
    { match: '.footer', run: footer },
    { match: '.rich-text', run: richText },
    { match: '.grid > .grid__item', run: cardGrid },
  ];

  function initSection(section) {
    if (contexts.has(section)) contexts.get(section).revert();
    const handler = handlers.find(({ match }) => section.matches(match) || section.querySelector(match));
    try {
      contexts.set(
        section,
        gsap.context(() => (handler ? handler.run : generic)(section), section)
      );
    } catch (error) {
      console.warn('GSAP animation skipped for', section.id, error);
    }
  }

  function scrollProgress() {
    const bar = document.createElement('div');
    bar.className = 'gsap-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  }

  function init() {
    document.querySelectorAll('.shopify-section').forEach(initSection);
    scrollProgress();
    release();
    ScrollTrigger.refresh();
  }

  const fontsReady = document.fonts
    ? Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 800))])
    : Promise.resolve();
  fontsReady.then(init);

  window.addEventListener('load', () => ScrollTrigger.refresh());

  document.addEventListener('shopify:section:load', (event) => {
    initSection(event.target);
    ScrollTrigger.refresh();
  });

  document.addEventListener('shopify:section:unload', (event) => {
    const context = contexts.get(event.target);
    if (context) context.revert();
    contexts.delete(event.target);
  });
})();
