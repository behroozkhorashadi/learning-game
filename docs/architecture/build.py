"""Builds learning-game-architecture.html from the .mmd diagram sources.

    python3 docs/architecture/build.py              # writes the standalone page
    python3 docs/architecture/build.py --check      # fails if the committed page is stale (preflight + CI)
    python3 docs/architecture/build.py --fragment   # page body only, for publishing as a claude.ai artifact

Mermaid is rendered by the page itself (UMD build from jsdelivr) rather than by
any host, so the pan/zoom code always finds the SVG it attaches to.
"""

import html
import sys
from pathlib import Path

HERE = Path(__file__).parent

SECTIONS = [
    (
        "1-system.mmd",
        "Level 1",
        "System",
        "A React SPA in the kid's browser talks to one FastAPI process through the Vite proxy. All state "
        "lives in a local SQLite file; OpenAI is the only external call, used for story illustrations and "
        "profile-photo remixes. Adaptive difficulty is decided server-side. The backend's OpenAPI schema "
        "generates the frontend's API types, and <code>make preflight</code> (run again by CI) enforces the "
        "architecture below.",
    ),
    (
        "2-backend.mmd",
        "Level 2 · backend",
        "Backend code (FastAPI, Python 3.12)",
        "Every route group is a feature folder under <code>app/</code> (<code>app/todo/</code> is the worked "
        "example): pure schemas and rules, effect repositories, clients, services and routes built by factories, "
        "and wired only in <code>app/composition/</code>. Features never import each other; assembly passes each "
        "one what it needs from the others (a profile lookup, the event log, badge awarding). "
        "<code>app/main.py</code> is just the uvicorn entry. The Loop A engine and the game item generators are "
        "pure; the play service runs them over storage and the append-only event log.",
    ),
    (
        "3-frontend.mmd",
        "Level 2 · frontend",
        "Frontend code (React 19, Vite, Three.js)",
        "Every file lives in a feature folder and carries its layer in its name. <code>src/main/</code> is the "
        "shell: one navigation value routes between screens (no router library), and every screen is bound "
        "with injected capabilities and assembled once at startup. Screens reach the server through "
        "<code>src/api/</code> adapters (zod-parsed, typed from the backend's OpenAPI schema) and "
        "<code>useQuery</code>; browser globals are named only in <code>*.assembly.*</code> files. Game rules "
        "are pure libraries inside their features.",
    ),
]

STYLE = """
/* Layout: single reading column; each diagram in its own pan/zoom plate */
:root { --bg:#f6f7f4; --fg:#1d2420; --muted:#5b665f; --plate:#ffffff; --line:#d9ded8; --accent:#2f7a5b;
  --display:"Fraunces",Georgia,serif; --body:"IBM Plex Sans",system-ui,sans-serif; --mono:"IBM Plex Mono",ui-monospace,monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#131815; --fg:#e4e9e5; --muted:#9aa69e; --plate:#1b211d; --line:#2c352f; --accent:#6cc39b; color-scheme:dark; } }
:root[data-theme="dark"] { --bg:#131815; --fg:#e4e9e5; --muted:#9aa69e; --plate:#1b211d; --line:#2c352f; --accent:#6cc39b; color-scheme:dark; }
body { background:var(--bg); color:var(--fg); font:15px/1.6 var(--body); padding-inline:16px; padding-block:32px 64px; }
main { max-width:1200px; margin:0 auto; display:grid; gap:40px; }
h1 { font:600 2.2rem/1.1 var(--display); margin:0; text-wrap:balance; }
h2 { font:600 1.4rem/1.2 var(--display); margin:0; }
.eyebrow { font:600 .75rem var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--accent); }
p { max-width:68ch; margin:0; color:var(--muted); }
section { display:grid; gap:12px; min-width:0; }
.plate { position:relative; background:var(--plate); border:1px solid var(--line); border-radius:6px; height:min(75vh, 760px); overflow:hidden; touch-action:none; cursor:grab; user-select:none; }
.plate.dragging { cursor:grabbing; }
.plate:fullscreen { height:100%; border-radius:0; }
.stage { position:absolute; top:0; left:0; transform-origin:0 0; }
.stage svg { display:block; max-width:none !important; }
.status { position:absolute; inset:0; display:grid; place-items:center; font:.85rem var(--mono); color:var(--muted); }
.zoombar { position:absolute; top:10px; right:10px; z-index:1; display:flex; gap:4px; cursor:default; }
.zoombar button { font:600 .85rem var(--mono); min-width:34px; height:34px; padding:0 8px; color:var(--fg); background:var(--bg); border:1px solid var(--line); border-radius:4px; cursor:pointer; }
.zoombar button:hover { border-color:var(--accent); color:var(--accent); }
.zoombar button:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
.zoombar output { font:.75rem var(--mono); color:var(--muted); align-self:center; padding-inline:6px; font-variant-numeric:tabular-nums; }
.hint { font:.75rem var(--mono); color:var(--muted); }
details summary { cursor:pointer; font:.8rem var(--mono); color:var(--muted); }
details pre { font:.75rem/1.5 var(--mono); background:var(--plate); border:1px solid var(--line); padding:12px; overflow-x:auto; }
code { font-family:var(--mono); font-size:.9em; }
"""

SCRIPT = r"""
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>
(async () => {
  const dark = document.documentElement.dataset.theme === 'dark' ||
    (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict',
    flowchart: { htmlLabels: true } });

  const plates = [...document.querySelectorAll('.plate')];
  for (const [i, plate] of plates.entries()) {
    const src = plate.parentElement.querySelector('details pre').textContent;
    const stage = plate.querySelector('.stage');
    const status = plate.querySelector('.status');
    try {
      const { svg } = await mermaid.render('arch-diagram-' + i, src);
      stage.innerHTML = svg;
      status.remove();
      setUpZoom(plate, stage);
    } catch (err) {
      status.textContent = 'Diagram failed to render: ' + err.message;
    }
  }

  function setUpZoom(plate, stage) {
    const svg = stage.querySelector('svg');
    const vb = svg.viewBox.baseVal;
    const w = vb && vb.width ? vb.width : svg.getBBox().width;
    const h = vb && vb.height ? vb.height : svg.getBBox().height;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.style.width = w + 'px';
    svg.style.height = h + 'px';

    const readout = plate.querySelector('output');
    let k = 1, x = 0, y = 0, fitK = 1;
    const MIN = 0.1, MAX = 12;
    const apply = () => {
      stage.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      readout.textContent = Math.round(k / fitK * 100) + '%';
    };
    const fit = () => {
      const pw = plate.clientWidth, ph = plate.clientHeight, pad = 24;
      fitK = k = Math.min((pw - pad * 2) / w, (ph - pad * 2) / h);
      x = (pw - w * k) / 2;
      y = (ph - h * k) / 2;
      apply();
    };
    // Zoom by `f` keeping the plate point (px, py) fixed under the cursor.
    const zoomAt = (f, px, py) => {
      const nk = Math.min(MAX, Math.max(MIN, k * f));
      x = px - (px - x) * (nk / k);
      y = py - (py - y) * (nk / k);
      k = nk;
      apply();
    };
    const zoomCenter = (f) => zoomAt(f, plate.clientWidth / 2, plate.clientHeight / 2);
    const local = (e) => { const r = plate.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    plate.querySelector('.zoombar').addEventListener('click', (e) => {
      const z = e.target.closest('button')?.dataset.z;
      if (z === 'in') zoomCenter(1.4);
      else if (z === 'out') zoomCenter(1 / 1.4);
      else if (z === 'fit') fit();
      else if (z === 'full') {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else plate.requestFullscreen?.().catch(() => {});
      }
    });

    // Ctrl/Cmd + wheel (also what a trackpad pinch sends) zooms; plain wheel scrolls the page.
    plate.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.01), ...local(e));
    }, { passive: false });

    plate.addEventListener('dblclick', (e) => {
      if (e.target.closest('.zoombar')) return;
      zoomAt(e.shiftKey ? 1 / 1.6 : 1.6, ...local(e));
    });

    // Drag to pan with one pointer, pinch with two.
    const pointers = new Map();
    let pinchDist = 0;
    plate.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.zoombar')) return;
      plate.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      plate.classList.add('dragging');
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      }
    });
    plate.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      const cur = local(e);
      pointers.set(e.pointerId, cur);
      if (pointers.size === 1) {
        x += cur[0] - prev[0];
        y += cur[1] - prev[1];
        apply();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinchDist) zoomAt(d / pinchDist, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        pinchDist = d;
      }
    });
    const release = (e) => {
      pointers.delete(e.pointerId);
      pinchDist = 0;
      if (!pointers.size) plate.classList.remove('dragging');
    };
    plate.addEventListener('pointerup', release);
    plate.addEventListener('pointercancel', release);

    plate.addEventListener('fullscreenchange', () => requestAnimationFrame(fit));
    new ResizeObserver(() => fit()).observe(plate);
    fit();
  }
})();
</script>
"""

ZOOMBAR = (
    '<div class="zoombar">'
    '<output aria-live="polite">100%</output>'
    '<button type="button" data-z="in" aria-label="Zoom in">+</button>'
    '<button type="button" data-z="out" aria-label="Zoom out">−</button>'
    '<button type="button" data-z="fit" aria-label="Fit to view">Fit</button>'
    '<button type="button" data-z="full" aria-label="Full screen">Full</button>'
    "</div>"
)


def body() -> str:
    sections = []
    for filename, eyebrow, heading, blurb in SECTIONS:
        src = html.escape((HERE / filename).read_text())
        sections.append(f"""<section>
  <div class="eyebrow">{eyebrow}</div>
  <h2>{heading}</h2>
  <p>{blurb}</p>
  <div class="plate">{ZOOMBAR}<div class="stage"></div><div class="status">Rendering diagram…</div></div>
  <div class="hint">Drag to pan · pinch or Ctrl/⌘ + scroll to zoom · double-click to zoom in (Shift to zoom out)</div>
  <details><summary>Mermaid source ({filename})</summary><pre>{src}</pre></details>
</section>""")
    return f"""<title>Learning Game Architecture</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono&display=swap">
<style>{STYLE}</style>
<main>
<header style="display:grid;gap:10px">
  <div class="eyebrow">Adaptive Learning Games · architecture</div>
  <h1>Learning Game Architecture</h1>
  <p>Two levels. The system view shows what runs where and how requests flow. The code views break the FastAPI backend and the React frontend into their layers.</p>
</header>
{chr(10).join(sections)}
</main>
{SCRIPT}"""


def page() -> str:
    return (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        + body().replace("</style>\n<main>", "</style>\n</head>\n<body>\n<main>", 1)
        + "</body>\n</html>\n"
    )


OUTPUT = HERE / "learning-game-architecture.html"

if __name__ == "__main__":
    if "--fragment" in sys.argv:
        sys.stdout.write(body())
    elif "--check" in sys.argv:
        if not OUTPUT.exists() or OUTPUT.read_text() != page():
            sys.stderr.write(
                f"{OUTPUT.name} is stale: a .mmd source or build.py changed without rebuilding the page.\n"
                "Run `python3 docs/architecture/build.py` and commit the result. See docs/architecture/AGENTS.md.\n"
            )
            sys.exit(1)
    else:
        OUTPUT.write_text(page())
