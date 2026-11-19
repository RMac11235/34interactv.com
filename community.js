/* Community boards for 34interactv.com: feedback (every app) and message boards (games).
   Backed by GitHub Discussions in RMac11235/34interactv.com through giscus.
   Nothing loads from giscus.app or GitHub until the visitor clicks "Open". */
(function () {
  var REPO = "RMac11235/34interactv.com";
  var REPO_ID = "R_kgDOVwhkdg";
  var CATS = {
    feedback: { name: "Ideas", id: "DIC_kwDOVwhkds4DLdSq" },
    board: { name: "General", id: "DIC_kwDOVwhkds4DLdSo" }
  };
  function load(box) {
    var kind = box.getAttribute("data-board");
    var cat = CATS[kind];
    if (!cat) return;
    var s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    var a = {
      "data-repo": REPO, "data-repo-id": REPO_ID,
      "data-category": cat.name, "data-category-id": cat.id,
      "data-mapping": "specific", "data-term": box.getAttribute("data-term"),
      "data-strict": "1", "data-reactions-enabled": "1", "data-emit-metadata": "0",
      "data-input-position": "top", "data-theme": "light", "data-lang": "en"
    };
    for (var k in a) s.setAttribute(k, a[k]);
    var holder = box.querySelector(".giscus-holder");
    holder.className = "giscus-holder giscus";
    holder.innerHTML = "";
    holder.appendChild(s);
    var btn = box.querySelector(".board-open");
    if (btn) btn.parentNode.removeChild(btn);
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("board-open")) {
      e.preventDefault();
      load(t.closest("[data-board]"));
    }
  });
})();
