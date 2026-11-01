# sina-portfolio

My personal portfolio site: plain HTML, CSS and JavaScript, no build step.
Dark ink theme, one lime accent, a drifting data graph in the hero.

## Files

```
index.html          all the content (edit text here)
styles.css          design: colors, fonts, layout
script.js           hero graph animation, scroll effects, nav highlight
assets/favicon.svg  browser tab icon
assets/images/      optimized photos + og-image.jpg (link preview)
photos/             original photos — git-ignored, never uploaded
```

## Preview locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Swapping photos

Export new images at ~1100–1400px on the long side, under ~250 KB, with
metadata stripped (phone photos can contain GPS location). Keep the same
file names in `assets/images/` or update the `src` in `index.html`.

## Publish

### Option A — GitHub Pages (free needs a public repo)
Repo named **`sina-778.github.io`** → live at **https://sina-778.github.io**.
Settings → Pages → Source: Deploy from a branch → `main` / `(root)`.
GitHub Pages from a *private* repo requires a paid GitHub plan (Pro).

### Option B — private repo + Netlify / Cloudflare Pages / Vercel (free)
Keep the repo private, connect it in the host's dashboard, no build command,
publish directory `/`. You get a free `*.netlify.app` / `*.pages.dev` URL.

## To-do before sharing

- [ ] Add your CV as `assets/Ebna_Sina_CV.pdf` and uncomment the two CV links
- [ ] If not hosting at sina-778.github.io, update `og:url` / `og:image` in index.html
