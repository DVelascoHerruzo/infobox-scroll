import esbuild from "esbuild";
import { builtinModules } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const prod = process.argv[2] === "production";
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

// Where the built plugin is copied for testing. Override with OBSIDIAN_VAULT=<vault path>.
const vault = process.env.OBSIDIAN_VAULT ?? "../../Tarot";
const deployDir = join(vault, ".obsidian", "plugins", manifest.id);

const deploy = {
  name: "deploy",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length) return;
      if (!existsSync(join(vault, ".obsidian"))) {
        console.warn(`[deploy] vault not found at ${vault}, skipping copy`);
        return;
      }
      mkdirSync(deployDir, { recursive: true });
      for (const f of ["main.js", "manifest.json", "styles.css"]) copyFileSync(f, join(deployDir, f));
      console.log(`[deploy] copied to ${deployDir}`);
    });
  },
};

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  plugins: [deploy],
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
