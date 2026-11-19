/* Scroll-in reveal for 34interactv.com. Decorative only; skipped when the visitor prefers reduced motion. */
(function () {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var els = document.querySelectorAll("main h2, main .cards article, main .shots figure, main .board, main .cta, .app main > ol > li, .app main > ul > li, .faq details, main table");
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  var vh = window.innerHeight || 800;
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (el.getBoundingClientRect().top < vh) continue; // never hide what is already on screen
    el.classList.add("rv");
    el.style.transitionDelay = (i % 4) * 60 + "ms";
    io.observe(el);
  }
})();
