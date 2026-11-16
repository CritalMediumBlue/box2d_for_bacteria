#!/bin/sh
# Assemble the static web version of the simulation (run from the repository root, after
# `npm run build-bacteria`). Used by .github/workflows/deploy-pages.yml; also works locally:
#
#   npm run build-bacteria-site            # -> _site/
#   npx http-server _site                  # open http://127.0.0.1:8080/bacteria/index.html
#
# The page loads its modules by relative paths (bacteria/build/*.js -> ../../build/esm/,
# and the import map in index.html -> ../node_modules/...), so the repository layout is kept and
# the site works under any subpath, e.g. https://<user>.github.io/<repo>/bacteria/index.html.
set -eu
out="${1:-_site}"
rapier=node_modules/@dimforge/rapier2d-compat/dist/rapier.mjs  # self-contained (WebAssembly inlined)

for f in bacteria/index.html bacteria/build/viewer.js build/esm/index.js "$rapier"; do
  [ -f "$f" ] || { echo "missing $f: run 'npm install' and 'npm run build-bacteria' first" >&2; exit 1; }
done

rm -rf "$out"
mkdir -p "$out/bacteria/build" "$out/build" "$out/$(dirname "$rapier")"
site=$(cd "$out" && pwd)
cp bacteria/index.html "$out/bacteria/"
cp bacteria/build/*.js "$out/bacteria/build/"
# The Box2D library as ES modules (JavaScript only)
(cd build && find esm -name '*.js' -exec sh -c 'mkdir -p "$0/$(dirname "$1")" && cp "$1" "$0/$1"' "$site/build" {} \;)
cp "$rapier" "$out/$rapier"
# The site root forwards to the simulation
cat > "$out/index.html" <<'EOF'
<!doctype html>
<meta charset="utf-8">
<title>Microfluidic Biofilm</title>
<meta http-equiv="refresh" content="0; url=bacteria/index.html">
<a href="bacteria/index.html">Microfluidic biofilm simulation</a>
EOF
echo "site in $out/ ($(du -sh "$out" | cut -f1)); open $out/bacteria/index.html through a web server"
