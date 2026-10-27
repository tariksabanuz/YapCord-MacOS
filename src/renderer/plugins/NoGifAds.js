

(function () {
  function byXPath(path) {
    try {
      const r = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return r && r.singleNodeValue;
    } catch (_) {
      return null;
    }
  }

  function adCardFor(el) {
    if (!el) return null;
    const card = el.parentElement;
    if (!card) return null;

    if (card.querySelectorAll('*').length > 40) return null;
    return card;
  }

  function sweep() {
    const seen = new Set();

    const xpathHit = adCardFor(byXPath('/html/body/div[2]/div[2]/div/main/div/div/div/div[2]/div/div/div/div[2]/div[1]/span'));
    if (xpathHit) seen.add(xpathHit);

    document.querySelectorAll('span, div').forEach((el) => {
      if (seen.size > 20) return;
      const text = (el.textContent || '').trim();
      if (text !== 'Sponsored') return;
      const card = adCardFor(el);
      if (card) seen.add(card);
    });

    seen.forEach((card) => {
      if (card.dataset.ymGifAdHidden) return;
      card.dataset.ymGifAdHidden = '1';
      card.style.display = 'none';
    });
  }

  YM.definePlugin({
    name: 'NoGifAds',
    description: 'Hides the sponsored product banner (e.g. an AliExpress ad) that Yapper\'s own GIF picker shows above the search results.',
    authors: ['YapCord'],
    tags: ['Chat', 'Utility'],
    alwaysOn: true,
    start(ctx) {
      ctx.onMutate(sweep);
      ctx.interval(sweep, 1000);
      sweep();
    },
  });
})();
