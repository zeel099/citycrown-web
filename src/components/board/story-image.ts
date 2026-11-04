// 1080×1920 story image of a board, drawn on a canvas (no image library).

export type StoryData = {
  boardName: string; // "Surat · Cafes"
  headline: string; // "The Kettle Room is #1 in Surat · Cafes"
  rows: { rank: number; name: string; total: string }[];
  url: string; // "bestinthecity.in/surat/cafes"
};

const W = 1080;
const H = 1920;
const PAD = 96;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export async function storyImage(d: StoryData): Promise<Blob> {
  await document.fonts?.ready;
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const head = token("--font-outfit", "system-ui, sans-serif");
  const body = token("--font-figtree", "system-ui, sans-serif");
  const c = {
    bg: token("--bg", "#FBF9F7"),
    surface: token("--surface", "#FFFFFF"),
    line: token("--line", "#ECE6DF"),
    ink: token("--ink", "#221E1B"),
    muted: token("--muted", "#736D67"),
    accent: token("--accent", "#E5603F"),
    soft: token("--accent-soft", "#FBE8E1"),
    softLine: token("--accent-line", "#F5D3C7"),
  };

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't draw the story image in this browser.");
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "middle";

  // Brand
  box(ctx, PAD, 140, 96, 96, 28);
  ctx.fillStyle = c.accent;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 40px ${head}`;
  ctx.textAlign = "center";
  ctx.fillText("#1", PAD + 48, 190);
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = `700 56px ${head}`;
  ctx.fillText("Best in the City", PAD + 124, 190);

  // Headline
  ctx.fillStyle = c.muted;
  ctx.font = `600 34px ${body}`;
  ctx.fillText(d.boardName.toUpperCase(), PAD, 360);
  ctx.fillStyle = c.ink;
  ctx.font = `700 88px ${head}`;
  let y = 470;
  for (const line of wrap(ctx, d.headline, W - PAD * 2).slice(0, 4)) {
    ctx.fillText(line, PAD, y);
    y += 100;
  }

  // Ranking
  y += 40;
  for (const r of d.rows.slice(0, 5)) {
    const first = r.rank === 1;
    box(ctx, PAD, y, W - PAD * 2, 140, 36);
    ctx.fillStyle = first ? c.soft : c.surface;
    ctx.fill();
    ctx.strokeStyle = first ? c.softLine : c.line;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.font = `700 44px ${head}`;
    ctx.fillText(`#${r.rank}`, PAD + 40, y + 70);
    ctx.textAlign = "right";
    ctx.fillText(r.total, W - PAD - 40, y + 70);
    const totalWidth = ctx.measureText(r.total).width;
    ctx.textAlign = "left";
    ctx.fillStyle = c.ink;
    ctx.font = `600 44px ${head}`;
    ctx.fillText(fit(ctx, r.name, W - PAD * 2 - 200 - totalWidth), PAD + 150, y + 70);
    y += 164;
  }

  // Footer
  ctx.fillStyle = c.muted;
  ctx.font = `500 34px ${body}`;
  ctx.fillText("Sponsored ranking · order is set by total amount paid.", PAD, H - 220);
  ctx.fillStyle = c.accent;
  ctx.font = `700 44px ${head}`;
  ctx.fillText(d.url, PAD, H - 150);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the story image in this browser."))), "image/png"),
  );
}
