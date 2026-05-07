// Generate complementary visual assets for Supergana using Gemini 2.5 Flash Image (Nano Banana).
// Run: `node scripts/generate-assets.mjs` (regenerates only missing assets)
//      `node scripts/generate-assets.mjs --force` (regenerates everything)
//
// Output: public/generated/<name>.png

import { GoogleGenAI } from "@google/genai";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(PROJECT_ROOT, "public", "generated");

// Load .env.local manually (Node has no built-in dotenv before --env-file).
async function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  try {
    const text = await fs.readFile(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* ignore — fall back to ambient env */
  }
}

const STYLE_BASE =
  "Vintage 1930s rubber-hose cartoon style, thick black ink outlines (4-6px equivalent), bold flat saturated colors, retro halftone subtle texture, Cuphead-inspired playful aesthetic, fully transparent background. Crisp vector-like edges. No drop shadow. No text. No watermark.";

const PALETTE_HINT =
  "Use the brand palette: warm yellow #FFD93D, energetic red #FF4757, ocean blue #1E90FF, fresh green #2ECC71, deep ink black #0A0A0A, with off-white #FAF7F0 only when needed. Avoid gradients.";

const ASSETS = [
  {
    name: "icon-whistle",
    prompt: `Single referee whistle on lanyard, slight upward tilt, mouthpiece on the left. ${STYLE_BASE} ${PALETTE_HINT} The whistle body is yellow #FFD93D, the lanyard is red #FF4757. Centered, fills 70% of the canvas.`,
  },
  {
    name: "icon-ball",
    prompt: `Single classic black-and-white pentagonal soccer ball, slightly bouncing pose with motion lines. ${STYLE_BASE} ${PALETTE_HINT} Centered, fills 70% of the canvas. No background.`,
  },
  {
    name: "icon-trophy",
    prompt: `Single championship cup trophy with two ornate handles, on a small base. Gold-yellow body #FFD93D with red ribbon #FF4757 across it that says nothing (blank). ${STYLE_BASE} ${PALETTE_HINT} Centered, fills 70% of the canvas.`,
  },
  {
    name: "icon-yellow-card",
    prompt: `Single referee yellow card held up by a stylized cartoon hand from below. The card is bright yellow #FFD93D with thick black border. ${STYLE_BASE} ${PALETTE_HINT} Centered, fills 70% of the canvas.`,
  },
  {
    name: "icon-goal-net",
    prompt: `Single soccer goal post with net, slight three-quarter perspective, with a soccer ball about to enter the net. White goal frame with bold black outlines, the net drawn as a crosshatched black-line mesh. ${STYLE_BASE} ${PALETTE_HINT} Centered, fills 70% of the canvas.`,
  },
  {
    name: "icon-megaphone",
    prompt: `Single old-school megaphone tilted upward to the right, with three speech curls coming out of the cone (no text). Body in red #FF4757, mouthpiece in yellow #FFD93D. ${STYLE_BASE} ${PALETTE_HINT} Centered, fills 70% of the canvas.`,
  },
  {
    name: "ornament-confetti",
    prompt: `Scattered confetti and small stars across the canvas, playful celebration burst. Mix of yellow #FFD93D, red #FF4757, blue #1E90FF, green #2ECC71, pink #FF6B9D. Small triangles, squares, squiggles, and 5-point stars. Each piece has thick black outline. Spread across full canvas, varied sizes. ${STYLE_BASE} Background fully transparent.`,
  },
  {
    name: "ornament-stars",
    prompt: `Three to five chunky pop-art 5-point stars at different sizes, tilted at different angles, scattered across canvas. Mix of yellow #FFD93D and pink #FF6B9D fills. Thick black outlines. ${STYLE_BASE} Background fully transparent.`,
  },
  {
    name: "ornament-motion-lines",
    prompt: `A horizontal cluster of cartoon speed lines / motion streaks, drawn as six to eight short bold black tapered strokes of varying lengths, suggesting fast movement to the right. Pure black on transparent background. ${STYLE_BASE.replace(
      "fully transparent background",
      "background fully transparent"
    )}`,
  },
  {
    name: "pattern-field",
    aspectRatio: "16:9",
    prompt: `Top-down soccer field, full bleed edge-to-edge. The white field markings (sidelines, goal lines, halfway line, center circle, two large penalty boxes, two goal boxes) MUST extend all the way to the very edges of the canvas — there is NO grass margin outside the playing field, the playing field IS the entire canvas. Bright green #2ECC71 grass with subtle alternating mowed stripes running vertically. White lines have thick black outlines (4-5px equivalent). Wide cinematic 16:9 framing. ${STYLE_BASE.replace(
      "fully transparent background",
      "no transparency, no margin, completely opaque from edge to edge"
    )} ${PALETTE_HINT} Avoid any gradient or vignette darkening near edges.`,
  },
  {
    name: "pattern-halftone",
    prompt: `Repeating retro halftone polka-dot pattern across full canvas. Dots are pure black #0A0A0A on a yellow #FFD93D background. Dot size varies subtly across the canvas in a wavy gradient. Square tile, seamless. ${STYLE_BASE.replace(
      "fully transparent background",
      "no transparency, full bleed yellow background"
    )}`,
  },
  {
    name: "kit-box",
    prompt: `An open cardboard delivery box (3/4 perspective) overflowing with marketing campaign goodies: a small soccer ball, a folded rulebook with "REGLAS" label, a stack of post-its, a smartphone showing a generic quiniela bracket, a paper banner that's mostly blank, all spilling out playfully. Cartoon kraft-brown box with thick black outlines. The contents in mixed yellow / red / blue / green palette colors. ${STYLE_BASE} ${PALETTE_HINT} Centered, fills 80% of canvas. Transparent background outside the box and items.`,
  },
  {
    name: "stadium-silhouette",
    aspectRatio: "16:9",
    prompt: `Wide cinematic 16:9 cartoon silhouette of a packed soccer stadium at night, edge-to-edge full bleed. A curved sweep of stylized crowd silhouettes (raised-hand bumps) spans the ENTIRE WIDTH of the canvas, from the far-left edge to the far-right edge — no gaps, no transparent margins. Two tall light pylons frame the scene at the left and right edges, each radiating dotted halftone shine into the night sky. Above the stadium: a deep navy night sky #152844 fills all remaining space up to the top edge, with a small crescent moon and a few sparse stars. The bottom of the canvas is the front row of crowd. Pure black ink silhouettes with thick outlines. ${STYLE_BASE.replace(
      "fully transparent background",
      "no transparency anywhere, completely opaque, the navy sky and black silhouettes together cover 100% of the canvas"
    )} The stadium silhouette MUST reach both the left and right edges of the canvas.`,
  },
  {
    name: "pennants",
    prompt: `A horizontal string of seven triangular pennant flags hanging from a thin black cord that gently dips in the middle. Alternating colors: yellow #FFD93D, red #FF4757, blue #1E90FF, green #2ECC71, pink #FF6B9D, yellow, red. Each pennant has a thick black outline. ${STYLE_BASE} Background fully transparent. Wide aspect ratio.`,
  },
  {
    name: "scribble-arrow",
    prompt: `A single hand-drawn cartoon arrow that curves like a check-mark, pointing diagonally down-right, drawn in thick wobbly black ink with two tiny motion dashes near the tip. ${STYLE_BASE.replace(
      "bold flat saturated colors",
      "pure solid black on transparent"
    )} Background fully transparent.`,
  },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function generateOne(ai, asset) {
  const request = {
    model: "gemini-2.5-flash-image",
    contents: asset.prompt,
  };
  if (asset.aspectRatio) {
    request.config = {
      imageConfig: { aspectRatio: asset.aspectRatio },
    };
  }
  const response = await ai.models.generateContent(request);

  // Walk the response to find the inline image bytes.
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) {
      const buf = Buffer.from(inline.data, "base64");
      const outPath = path.join(OUT_DIR, `${asset.name}.png`);
      await fs.writeFile(outPath, buf);
      return outPath;
    }
  }

  const blockReason =
    response?.promptFeedback?.blockReason ??
    response?.candidates?.[0]?.finishReason;
  throw new Error(
    `No image returned for "${asset.name}"${
      blockReason ? ` (reason: ${blockReason})` : ""
    }. Raw response keys: ${Object.keys(response ?? {}).join(", ")}`
  );
}

async function main() {
  await loadEnv();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY in .env.local");
    process.exit(1);
  }

  const force = process.argv.includes("--force");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyNames = onlyArg
    ? onlyArg.replace("--only=", "").split(",").map((s) => s.trim())
    : null;

  await ensureDir(OUT_DIR);

  const ai = new GoogleGenAI({ apiKey });

  const queue = ASSETS.filter(
    (a) => !onlyNames || onlyNames.includes(a.name)
  );

  console.log(`Generating ${queue.length} asset(s) -> ${OUT_DIR}`);
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of queue) {
    const outPath = path.join(OUT_DIR, `${asset.name}.png`);
    if (!force && (await fileExists(outPath))) {
      console.log(`  - skip   ${asset.name}.png (already exists)`);
      skipped += 1;
      continue;
    }
    process.stdout.write(`  - gen    ${asset.name}.png ... `);
    try {
      const t0 = Date.now();
      await generateOne(ai, asset);
      const ms = Date.now() - t0;
      console.log(`done (${ms}ms)`);
      ok += 1;
    } catch (err) {
      console.log("FAILED");
      console.error(`      ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\nResult: ${ok} generated, ${skipped} skipped, ${failed} failed`);
  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
