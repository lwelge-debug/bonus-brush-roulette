const DEFAULT_BRUSHES = [
  "Soft Sketcher (BB1)",
  "Chunky Charcoal (BB1)",
  "Velvet Ink (BB2)",
  "Rough Gouache (BB2)",
  "Magic Pencil (BB3)",
  "Painterly Wash (BB3)",
  "Grainy Marker (BB4)",
  "Cloudy Crayon (BB4)"
];

const DEFAULT_SUBJECTS = [
  "a cozy kitchen",
  "a sleepy cat",
  "a magical storefront",
  "a field of wildflowers",
  "a tiny dragon",
  "a rainy city street",
  "a birthday cake",
  "a bouquet in a mug"
];

const WHEEL_COLORS = [
  "#f35d3f",
  "#ffbd4a",
  "#36a66a",
  "#2477d4",
  "#a463d8",
  "#ef6fa6",
  "#18a7a5",
  "#f48731"
];

const FULL_LABEL_LIMIT = 10;
const COMPACT_LABEL_LIMIT = 16;

const els = {
  brushCanvas: document.getElementById("brush-wheel"),
  subjectCanvas: document.getElementById("subject-wheel"),
  brushPicked: document.getElementById("brush-picked"),
  subjectPicked: document.getElementById("subject-picked"),
  brushCount: document.getElementById("brush-count"),
  subjectCount: document.getElementById("subject-count"),
  spinButton: document.getElementById("spin-button"),
  result: document.getElementById("result"),
  editor: document.getElementById("editor"),
  closeEditor: document.getElementById("close-editor"),
  brushInput: document.getElementById("brush-input"),
  subjectInput: document.getElementById("subject-input"),
  applyLists: document.getElementById("apply-lists"),
  resetLists: document.getElementById("reset-lists"),
  embedUrl: document.getElementById("embed-url"),
  embedCode: document.getElementById("embed-code")
};

const params = new URLSearchParams(window.location.search);
const isEditorMode = params.get("edit") === "1";

let brushItems = readListParam("brushes", DEFAULT_BRUSHES);
let subjectItems = readListParam("subjects", DEFAULT_SUBJECTS);
let isSpinning = false;

const wheels = {
  brush: {
    canvas: els.brushCanvas,
    ctx: els.brushCanvas.getContext("2d"),
    centerLabel: "BRUSH",
    rotation: 0,
    items: brushItems,
    pickedIndex: null
  },
  subject: {
    canvas: els.subjectCanvas,
    ctx: els.subjectCanvas.getContext("2d"),
    centerLabel: "SUBJECT",
    rotation: 0,
    items: subjectItems,
    pickedIndex: null
  }
};

function readListParam(key, fallback) {
  const raw = params.get(key);
  if (!raw) return [...fallback];

  try {
    const decoded = JSON.parse(decodeURIComponent(raw));
    if (Array.isArray(decoded)) {
      const clean = decoded.map((item) => String(item).trim()).filter(Boolean);
      if (clean.length) return clean;
    }
  } catch (_) {
    const clean = raw.split("|").map((item) => item.trim()).filter(Boolean);
    if (clean.length) return clean;
  }

  return [...fallback];
}

function writeListParam(items) {
  return encodeURIComponent(JSON.stringify(items));
}

function splitLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatBrush(brush) {
  const match = brush.match(/^(.*?)\s*\(BB\s*(\d+)\)\s*$/i);
  if (!match) {
    return { name: brush.trim(), volume: "" };
  }

  return {
    name: match[1].trim(),
    volume: match[2].trim()
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function makePromptHtml(subject, brush) {
  const parsed = formatBrush(brush);
  const volume = parsed.volume ? escapeHtml(parsed.volume) : "";
  const suffix = volume
    ? ` <span class="prompt-light">from</span> <span>Bonus Brushes Vol.${volume}</span>`
    : "";

  return `<span class="prompt-light">Draw</span> <span>${escapeHtml(subject)}</span> <span class="prompt-light">using</span> <span>${escapeHtml(parsed.name)}</span>${suffix}`;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  });

  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function truncateLabel(label, maxLength) {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function drawWheel(wheel) {
  const { canvas, ctx, items, rotation, pickedIndex, centerLabel } = wheel;
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 18;
  const slice = (Math.PI * 2) / items.length;
  const hasFullLabels = items.length <= FULL_LABEL_LIMIT;
  const hasCompactLabels = !hasFullLabels && items.length <= COMPACT_LABEL_LIMIT;
  const hasLabels = hasFullLabels || hasCompactLabels;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(rotation);

  items.forEach((item, index) => {
    const start = index * slice - Math.PI / 2;
    const end = start + slice;
    const selected = pickedIndex === index;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[index % WHEEL_COLORS.length];
    ctx.fill();
    ctx.lineWidth = selected ? 7 : items.length > COMPACT_LABEL_LIMIT ? 1.5 : 3;
    ctx.strokeStyle = selected ? "#fff8d8" : "#fff";
    ctx.stroke();

    if (!hasLabels) {
      const markerAngle = start + slice / 2;
      const outerX = Math.cos(markerAngle) * (radius - 16);
      const outerY = Math.sin(markerAngle) * (radius - 16);
      ctx.beginPath();
      ctx.arc(outerX, outerY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#171411";
    ctx.font = hasCompactLabels
      ? "800 15px Figtree, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      : "800 20px Figtree, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const label = formatBrush(item).name.length < item.length ? formatBrush(item).name : item;
    const lines = hasCompactLabels
      ? [truncateLabel(label, 18)]
      : wrapText(ctx, label, radius * 0.48);
    const lineHeight = hasCompactLabels ? 17 : 22;
    lines.forEach((line, lineIndex) => {
      ctx.fillText(line, radius - (hasCompactLabels ? 16 : 22), (lineIndex - (lines.length - 1) / 2) * lineHeight);
    });
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(0, 0, 54, 0, Math.PI * 2);
  ctx.fillStyle = "#fffaf1";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#201914";
  ctx.stroke();
  ctx.fillStyle = "#201914";
  ctx.font = "900 18px Figtree, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(centerLabel, 0, 0);
  ctx.restore();
}

function selectedIndexForRotation(wheel) {
  const slice = (Math.PI * 2) / wheel.items.length;
  const normalized = ((wheel.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const pointerAngle = (Math.PI * 2 - normalized) % (Math.PI * 2);
  return Math.floor(pointerAngle / slice) % wheel.items.length;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function spinWheel(wheel, forcedIndex, duration) {
  const slice = (Math.PI * 2) / wheel.items.length;
  const targetAtPointer = forcedIndex * slice + slice / 2;
  const normalizedTarget = (Math.PI * 2 - targetAtPointer) % (Math.PI * 2);
  const current = wheel.rotation;
  const currentNormalized = ((current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const delta = (normalizedTarget - currentNormalized + Math.PI * 2) % (Math.PI * 2);
  const fullTurns = (5 + Math.floor(Math.random() * 3)) * Math.PI * 2;
  const start = performance.now();
  const target = current + fullTurns + delta;

  wheel.pickedIndex = null;

  return new Promise((resolve) => {
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      wheel.rotation = current + (target - current) * easeOutCubic(progress);
      drawWheel(wheel);

      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }

      wheel.rotation = target;
      wheel.pickedIndex = selectedIndexForRotation(wheel);
      drawWheel(wheel);
      resolve(wheel.items[wheel.pickedIndex]);
    }

    requestAnimationFrame(frame);
  });
}

async function spinBoth() {
  if (isSpinning || !brushItems.length || !subjectItems.length) return;

  isSpinning = true;
  els.spinButton.disabled = true;
  els.result.textContent = "Choosing your prompt...";
  els.brushPicked.textContent = "Spinning...";
  els.subjectPicked.textContent = "Spinning...";

  const brushIndex = Math.floor(Math.random() * brushItems.length);
  const subjectIndex = Math.floor(Math.random() * subjectItems.length);
  const [brush, subject] = await Promise.all([
    spinWheel(wheels.brush, brushIndex, 3100),
    spinWheel(wheels.subject, subjectIndex, 3600)
  ]);

  els.brushPicked.textContent = brush;
  els.subjectPicked.textContent = subject;
  els.result.innerHTML = makePromptHtml(subject, brush);
  els.spinButton.textContent = "Spin again";
  isSpinning = false;
  els.spinButton.disabled = false;
}

function updateEditor() {
  if (!isEditorMode) return;

  els.brushInput.value = brushItems.join("\n");
  els.subjectInput.value = subjectItems.join("\n");
  els.embedUrl.value = makeEmbedUrl();
  els.embedCode.value = makeEmbedCode();
}

function makeEmbedUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("edit");
  url.searchParams.set("brushes", writeListParam(brushItems));
  url.searchParams.set("subjects", writeListParam(subjectItems));
  return url.toString();
}

function makeEmbedCode() {
  const embedUrl = makeEmbedUrl();
  return `<iframe src="${embedUrl}" width="100%" height="820" style="border:0;" loading="lazy" title="Bonus Brushes drawing prompt wheel"></iframe>`;
}

function applyLists(nextBrushes, nextSubjects) {
  brushItems = nextBrushes.length ? nextBrushes : [...DEFAULT_BRUSHES];
  subjectItems = nextSubjects.length ? nextSubjects : [...DEFAULT_SUBJECTS];
  wheels.brush.items = brushItems;
  wheels.subject.items = subjectItems;
  wheels.brush.pickedIndex = null;
  wheels.subject.pickedIndex = null;
  els.brushCount.textContent = `${brushItems.length} options`;
  els.subjectCount.textContent = `${subjectItems.length} options`;
  els.brushPicked.textContent = "";
  els.subjectPicked.textContent = "";
  els.spinButton.textContent = "Spin both wheels";
  els.result.textContent = "Your prompt will appear here.";
  drawWheel(wheels.brush);
  drawWheel(wheels.subject);
  updateEditor();
}

function init() {
  els.brushCount.textContent = `${brushItems.length} options`;
  els.subjectCount.textContent = `${subjectItems.length} options`;
  els.spinButton.addEventListener("click", spinBoth);

  if (isEditorMode) {
    els.editor.hidden = false;
    els.applyLists.addEventListener("click", () => {
      applyLists(splitLines(els.brushInput.value), splitLines(els.subjectInput.value));
    });
    els.resetLists.addEventListener("click", () => {
      applyLists([...DEFAULT_BRUSHES], [...DEFAULT_SUBJECTS]);
    });
    els.closeEditor.addEventListener("click", () => {
      els.editor.hidden = true;
    });
  }

  applyLists(brushItems, subjectItems);
}

init();

if (document.fonts) {
  document.fonts.ready.then(() => {
    drawWheel(wheels.brush);
    drawWheel(wheels.subject);
  });
}
