"""Build the shared Frank README assets into <repo>/.github/brand.

Usage, from the frank/ folder that holds all six repos:
    python3 <repo>/.github/brand/build_readme_assets.py <repo>

Writes lockup-light.svg / lockup-dark.svg (README hero), frank-signature-light/dark.svg
and series/<project>.svg (footer tiles). Sources are each project's own brand files.
"""
import re, sys, pathlib

F = pathlib.Path(__file__).resolve().parents[3]
repo = sys.argv[1].strip("/")
out = F / repo / ".github/brand"
(out / "series").mkdir(parents=True, exist_ok=True)


def inner(source):
    s = source if isinstance(source, str) else source.read_text()
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    body = re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", s, flags=re.S)
    return vb, re.sub(r"<title>.*?</title>", "", body, flags=re.S)


def tile(name, title, bg, source, pad, edge):
    vb, body = inner(source)
    box = 256 - 2 * pad
    stroke = {"ink": ' stroke="#1f1e1b" stroke-opacity="0.14" stroke-width="4"',
              "paper": ' stroke="#f4efe6" stroke-opacity="0.28" stroke-width="4"'}.get(edge, "")
    (out / "series" / f"{name}.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img"><title>{title}</title>'
        f'<rect x="2" y="2" width="252" height="252" rx="56" fill="{bg}"{stroke}/>'
        f'<svg x="{pad}" y="{pad}" width="{box}" height="{box}" viewBox="{vb}">{body}</svg></svg>\n')


def without_bg(path):  # a favicon's foreground only
    return re.sub(r"<rect[^>]*/>", "", (F / path).read_text(), count=1)


vd_g = re.search(r"(<g transform.*?</g>)", (F / "visdelta/website/components/logo.tsx").read_text(), re.S).group(1)
vd_mark = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 44 232 167">{vd_g}</svg>'

tile("syuze", "syuze 叙仄", "#f4f1ea", F / "syuze/public/brand/syuze-mark.svg", 70, "ink")
tile("news-metro", "News Metro", "#ffffff", F / "news-metro/src/app/icon.svg", 60, "ink")
tile("ttng", "ttng", "#ffffff", F / "narrative-graph/apps/web/public/brand/ttng-icon.svg", 30, "ink")
tile("visdelta", "VisDelta", "#ffffff", vd_mark, 52, "ink")
tile("cytocausal", "cytocausal", "#FBC92B", without_bg("cytocausal/apps/docs/public/favicon.svg"), 0, None)
tile("aethel", "Aethel", "#141414", without_bg("aethel/explorer_app/public/favicon.svg"), 0, "paper")

sig = (F / "news-metro/public/frank-signature.svg").read_text()
(out / "frank-signature-light.svg").write_text(sig)
(out / "frank-signature-dark.svg").write_text(sig.replace("#171916", "#f4efe6"))


def recolour(path, old, new):
    return (F / path).read_text().replace(old, new)


def cytocausal_lockup(wordmark):
    b = "cytocausal/apps/docs/public/brand/"
    mvb, mark = inner(F / b / "mark.svg")
    wvb, word = inner(F / b / wordmark)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 511.15 100.8" role="img"><title>cytocausal</title>'
            f'<svg width="100.8" height="100.8" viewBox="{mvb}">{mark}</svg>'
            f'<svg x="124.8" y="8.4" width="386.35" height="84" viewBox="{wvb}">{word}</svg></svg>\n')


kit = "output/brand-kit/lockups/"
lockups = {
    "syuze": lambda: ((F / f"syuze/{kit}syuze-lockup-horizontal-mono-1f1e1b.svg").read_text(),
                      recolour(f"syuze/{kit}syuze-lockup-horizontal-mono-1f1e1b.svg", "#1f1e1b", "#f4f1ea")),
    "news-metro": lambda: ((F / f"news-metro/{kit}newsmetro-lockup-horizontal-black.svg").read_text(),
                           (F / f"news-metro/{kit}newsmetro-lockup-horizontal-white.svg").read_text()),
    "narrative-graph": lambda: ((F / "narrative-graph/apps/web/public/brand/ttng-wordmark.svg").read_text(),
                                recolour("narrative-graph/apps/web/public/brand/ttng-wordmark.svg", "#1a1a1a", "#ffffff")),
    "visdelta": lambda: ((F / f"visdelta/{kit}visdelta-lockup-horizontal.svg").read_text(),
                         (F / f"visdelta/{kit}visdelta-lockup-horizontal-reversed.svg").read_text()),
    "cytocausal": lambda: (cytocausal_lockup("wordmark.svg"), cytocausal_lockup("wordmark-dark.svg")),
    "aethel": lambda: ((F / f"aethel/{kit}aethel-lockup.svg").read_text(),
                       (F / f"aethel/{kit}aethel-lockup-light.svg").read_text()),
}
light, dark = lockups[repo]()
(out / "lockup-light.svg").write_text(light)
(out / "lockup-dark.svg").write_text(dark)
print(f"{repo}: wrote {sorted(str(p.relative_to(out)) for p in out.rglob('*.svg'))}")
