const esbuild = require("esbuild");
const fs = require("fs");

async function build() {
  fs.mkdirSync("assets/js", { recursive: true });
  fs.mkdirSync("assets/css", { recursive: true });

  await esbuild.build({
    entryPoints: {
      home: "src/js/entry-home.js",
      qaime: "src/js/entry-qaime.js"
    },
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2019",
    legalComments: "none",
    outdir: "assets/js"
  });

  await esbuild.build({
    entryPoints: { style: "src/css/style.css" },
    bundle: true,
    minify: true,
    legalComments: "none",
    outdir: "assets/css"
  });

  console.log("build complete");
}

build().catch(err => { console.error(err); process.exit(1); });
