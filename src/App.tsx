import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Crop as CropIcon, Download, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { toJpeg } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clamp, DEFAULT_CROP, PHOTO_HEIGHT, PHOTO_WIDTH, photoGeometry, POSTER_HEIGHT, POSTER_WIDTH, SAMPLE_PHOTO, type Crop, type Photo } from "@/lib/poster-layout";

type Fields = { title: string; leader: string; date: string; time: string; location: string };
const INITIAL_FIELDS: Fields = {
  title: "標題",
  leader: "王小明 弟兄",
  date: "1/1 (六)",
  time: "17:00 - 17:50",
  location: "三樓會議室 (2)",
};
const DETAIL_FIELDS = [
  { key: "leader", label: "講員" },
  { key: "date", label: "日期" },
  { key: "time", label: "時間" },
  { key: "location", label: "地點" },
] as const;

function FittedText({ text, width, height, maxSize, singleLine = false, className = "", style, onFit }: {
  text: string; width: number; height: number; maxSize: number; singleLine?: boolean;
  className?: string; style?: CSSProperties; onFit?: (size: number) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    let active = true;
    function fit() {
      if (!active || !ref.current) return;
      const el = ref.current;
      let low = 1, high = maxSize * 10;
      while (low < high) {
        const size = Math.ceil((low + high) / 2);
        el.style.fontSize = `${size / 10}px`;
        if (el.scrollWidth <= width && el.scrollHeight <= height) low = size;
        else high = size - 1;
      }
      el.style.fontSize = `${low / 10}px`;
      onFit?.(low / 10);
    }
    fit();
    void document.fonts.ready.then(fit);
    return () => { active = false; };
  }, [text, width, height, maxSize, singleLine, onFit]);
  return <div className={`fitted-text ${className}`} style={{ width: singleLine ? "auto" : width, maxWidth: width, height, ...style }}>
    <span ref={ref} style={{ fontSize: maxSize, display: singleLine ? "inline-block" : "block", width: singleLine ? "max-content" : "100%", whiteSpace: singleLine ? "pre" : "pre-wrap", overflowWrap: singleLine ? "normal" : "anywhere" }}>{text}</span>
  </div>;
}

function PhotoView({ photo, crop }: { photo: Photo; crop: Crop }) {
  const g = photoGeometry(photo, crop);
  return <img alt="海報照片" src={photo.src} draggable={false} className="cropped-photo" style={{
    width: `${g.width / PHOTO_WIDTH * 100}%`, height: `${g.height / PHOTO_HEIGHT * 100}%`,
    left: `${g.left / PHOTO_WIDTH * 100}%`, top: `${g.top / PHOTO_HEIGHT * 100}%`,
  }} />;
}

async function preparePhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * ratio));
    const height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const buffer = document.createElement("canvas");
    buffer.width = width; buffer.height = height;
    const ctx = buffer.getContext("2d");
    if (!ctx) throw new Error("無法讀取圖片");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return { src: buffer.toDataURL("image/jpeg", 0.97), name: file.name, width, height, region: { x: 0, y: 0, width, height } };
  } finally { URL.revokeObjectURL(url); }
}

export default function App() {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [photo, setPhoto] = useState<Photo>(SAMPLE_PHOTO);
  const [crop, setCrop] = useState<Crop>(DEFAULT_CROP);
  const [draft, setDraft] = useState<{ photo: Photo; crop: Crop } | null>(null);
  const [titleSize, setTitleSize] = useState(52);
  const [maxSize, setMaxSize] = useState(52);
  const [quality, setQuality] = useState(95);
  const [filename, setFilename] = useState("聚會海報");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const [imageError, setImageError] = useState("");
  const [scale, setScale] = useState(0.4);
  const canvas = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; crop: Crop; displayWidth: number; overflowX: number; overflowY: number } | null>(null);
  const exportLock = useRef(false);
  const updateField = (key: keyof Fields, value: string) => { setFields(current => ({ ...current, [key]: value })); setMessage(""); };

  useLayoutEffect(() => {
    if (!preview.current) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / POSTER_WIDTH));
    observer.observe(preview.current);
    return () => observer.disconnect();
  }, []);

  // Preserve the existing agent action, using the same title field as the form.
  useEffect(() => {
    type ModelContext = { registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "set_image_title", description: "設定海報主題，文字會自動縮放以符合版面。",
        inputSchema: { type: "object", properties: { title: { type: "string", maxLength: 500 } }, required: ["title"], additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: async (input: { title?: unknown }) => {
          if (!input || typeof input.title !== "string" || input.title.length > 500) throw new Error("主題須為 500 字以內的文字。");
          if (exportLock.current) throw new Error("正在匯出，請稍後再試。");
          setFields(current => ({ ...current, title: input.title as string }));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return { title: input.title, width: POSTER_WIDTH, height: POSTER_HEIGHT };
        },
      }, { signal: controller.signal })).catch(() => {});
    } catch { /* Older browsers do not expose this optional API. */ }
    return () => controller.abort();
  }, []);

  async function selectPhoto(file?: File) {
    if (!file) return;
    setImageError("");
    if (file.size > 20 * 1024 * 1024 || !(/image\/(jpeg|png|webp)/.test(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name)))) {
      setImageError("請選擇 JPG、PNG 或 WebP 圖片（上限 20 MB）。"); return;
    }
    setReading(true);
    try { setDraft({ photo: await preparePhoto(file), crop: { ...DEFAULT_CROP } }); }
    catch { setImageError("無法讀取這張圖片，請改用 JPG、PNG 或 WebP 格式。"); }
    finally { setReading(false); }
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!draft || (event.pointerType === "mouse" && event.button !== 0)) return;
    const g = photoGeometry(draft.photo, draft.crop);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, crop: draft.crop, displayWidth: event.currentTarget.clientWidth, overflowX: g.overflowX, overflowY: g.overflowY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointerId) return;
    const scale = PHOTO_WIDTH / start.displayWidth;
    setDraft(current => current && ({ ...current, crop: { ...current.crop,
      x: start.overflowX > 0 ? clamp(start.crop.x - (event.clientX - start.x) * scale / start.overflowX) : start.crop.x,
      y: start.overflowY > 0 ? clamp(start.crop.y - (event.clientY - start.y) * scale / start.overflowY) : start.crop.y,
    } }));
  }
  const adjustCrop = (key: keyof Crop, value: number) => setDraft(current => current && ({ ...current, crop: { ...current.crop, [key]: value } }));

  async function download() {
    if (!canvas.current || exportLock.current || reading || !fields.title.trim()) return;
    exportLock.current = true; setBusy(true); setMessage("");
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(canvas.current.querySelectorAll("img")).map(async img => {
        await img.decode();
        if (!img.naturalWidth) throw new Error("圖片載入失敗");
      }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const data = await toJpeg(canvas.current, {
        width: POSTER_WIDTH, height: POSTER_HEIGHT, canvasWidth: POSTER_WIDTH, canvasHeight: POSTER_HEIGHT,
        pixelRatio: 1, quality: quality / 100, backgroundColor: "#dbd6d0",
        style: { transform: "none", margin: "0" },
      });
      const check = new Image(); check.src = data; await check.decode();
      if (check.naturalWidth !== POSTER_WIDTH || check.naturalHeight !== POSTER_HEIGHT) throw new Error("匯出尺寸不符");
      const a = document.createElement("a"); a.href = data;
      const safeName = filename.trim().replace(/\.jpe?g$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "");
      a.download = (safeName || "聚會海報") + ".jpg";
      document.body.appendChild(a); a.click(); a.remove();
      setMessage("已產生 1920 × 1080 JPG，請查看下載項目。");
    } catch { setMessage("匯出失敗，請確認圖片已載入後再試一次。"); }
    finally { exportLock.current = false; setBusy(false); }
  }
  const draftGeometry = draft ? photoGeometry(draft.photo, draft.crop) : null;

  return <div className="app-shell">
    <header className="app-header"><h1>海報生成器</h1><Button onClick={download} disabled={busy || reading || !fields.title.trim()} className="header-download">{busy ? <Loader2 className="animate-spin" /> : <Download />}{busy ? "匯出中…" : "下載 JPG"}</Button></header>
    <div className="editor-layout">
      <aside className="editor-controls" aria-label="海報設定">
        <fieldset disabled={busy} className="space-y-6 min-w-0">
          <section className="control-section"><h2>海報內容</h2>
            <div className="form-field"><div className="label-row"><label htmlFor="title">主題</label><span>{fields.title.length} / 500</span></div><Textarea id="title" value={fields.title} maxLength={500} onChange={e => updateField("title", e.target.value)} className="title-input"/><p className="field-hint">自動縮放字體，可按 Enter 換行。</p></div>
            {DETAIL_FIELDS.map(({ key, label }) => <div className="form-field" key={key}><label htmlFor={key}>{label}</label><Input id={key} value={fields[key]} maxLength={80} onChange={e => updateField(key, e.target.value)} /></div>)}
            <div className="form-field"><div className="label-row"><label id="size-label">主題最大字級</label><span>{maxSize} px</span></div><Slider aria-labelledby="size-label" min={28} max={80} step={1} value={[maxSize]} onValueChange={([value]) => setMaxSize(value)} disabled={busy} /></div>
          </section>
          <section className="control-section photo-controls"><h2>右側照片</h2><p className="photo-name" title={photo.name}>{photo.name}</p>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="選擇照片檔案" disabled={busy || reading} onChange={e => { void selectPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="photo-actions"><Button variant="outline" disabled={reading || busy} onClick={() => fileInput.current?.click()}>{reading ? <Loader2 className="animate-spin"/> : <ImagePlus/>}{reading ? "讀取中…" : "選擇照片"}</Button><Button variant="outline" disabled={reading || busy} onClick={() => setDraft({ photo, crop: { ...crop } })}><CropIcon/>裁切／縮放</Button></div>
            {imageError && <p role="alert" className="error-message">{imageError}</p>}
          </section>
        </fieldset>
      </aside>
      <main className="preview-column">
        <section className="preview-section" aria-label="海報預覽"><div className="preview-toolbar"><h2>預覽</h2><span>1920 × 1080</span></div>
          <div className="preview-frame" ref={preview}>
            <div ref={canvas} className="poster" style={{ transform: `scale(${scale})` }} aria-label="海報內容">
              <div className="poster-header"><div className="poster-heading"><img src={`${import.meta.env.BASE_URL}assets/dove.png`} alt="鴿子" width={88} height={88}/><FittedText text="中堅團契共習聚會" width={1450} height={84} maxSize={50} singleLine className="poster-heading-name" /></div></div>
              <div className="poster-sidebar"><img className="poster-qr" src={`${import.meta.env.BASE_URL}assets/qrcode.png`} alt="聚會 QR code" width={218} height={214}/>
                <FittedText text={fields.title} width={538} height={254} maxSize={maxSize} className="poster-title" onFit={setTitleSize}/>
                <div className="poster-details">{DETAIL_FIELDS.map(({ key, label }) => <FittedText key={key} text={fields[key].trim() ? `${label}：${fields[key]}` : ""} width={514} height={77} maxSize={50} singleLine className="poster-detail"/>)}</div>
              </div>
              <div className="poster-photo"><PhotoView photo={photo} crop={crop}/></div>
            </div>
          </div><div className="preview-note"><span>主題字級：{titleSize} px</span><span>JPG</span></div>
        </section>
        <section className="export-section" aria-label="匯出設定"><fieldset disabled={busy} className="export-grid"><div><label htmlFor="filename">檔案名稱</label><div className="filename-wrap"><Input id="filename" value={filename} maxLength={100} onChange={e => setFilename(e.target.value)}/><span>.jpg</span></div></div><div><div className="label-row"><label id="quality-label">圖片品質</label><span>{quality}%</span></div><Slider aria-labelledby="quality-label" min={60} max={100} step={1} value={[quality]} onValueChange={([value]) => setQuality(value)} disabled={busy}/></div></fieldset><p role="status" className="export-status">{message || (!fields.title.trim() ? "請輸入主題後再下載。" : "")}</p></section>
      </main>
    </div>
    <Dialog open={!!draft} onOpenChange={open => { if (!open) { setDraft(null); drag.current = null; } }}>
      <DialogContent className="crop-dialog" showCloseButton={false}>
        <DialogHeader><DialogTitle>裁切／縮放照片</DialogTitle><DialogDescription>拖曳照片調整範圍，或使用下方滑桿。</DialogDescription></DialogHeader>
        <DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="關閉裁切視窗"><X/></Button></DialogClose>
        {draft && <>
          <div className="crop-stage" role="group" tabIndex={0} aria-label="照片裁切範圍，可使用方向鍵移動照片" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault(); const step = event.shiftKey ? 0.1 : 0.02;
            if (event.key === "ArrowLeft") adjustCrop("x", clamp(draft.crop.x + step));
            if (event.key === "ArrowRight") adjustCrop("x", clamp(draft.crop.x - step));
            if (event.key === "ArrowUp") adjustCrop("y", clamp(draft.crop.y + step));
            if (event.key === "ArrowDown") adjustCrop("y", clamp(draft.crop.y - step));
          }}><PhotoView photo={draft.photo} crop={draft.crop}/><div className="crop-grid" aria-hidden="true"/></div>
          <div className="crop-sliders"><div className="crop-slider-row"><label id="zoom-label">縮放</label><Slider aria-labelledby="zoom-label" min={1} max={4} step={0.01} value={[draft.crop.zoom]} onValueChange={([v]) => adjustCrop("zoom", v)}/><output>{Math.round(draft.crop.zoom * 100)}%</output></div>
            <div className="crop-slider-row"><label id="x-label">水平位置</label><Slider aria-labelledby="x-label" min={0} max={1} step={0.01} value={[draft.crop.x]} onValueChange={([v]) => adjustCrop("x", v)} disabled={!draftGeometry?.overflowX}/><output>{Math.round(draft.crop.x * 100)}%</output></div>
            <div className="crop-slider-row"><label id="y-label">垂直位置</label><Slider aria-labelledby="y-label" min={0} max={1} step={0.01} value={[draft.crop.y]} onValueChange={([v]) => adjustCrop("y", v)} disabled={!draftGeometry?.overflowY}/><output>{Math.round(draft.crop.y * 100)}%</output></div></div>
          <DialogFooter className="crop-footer"><Button variant="ghost" onClick={() => setDraft(current => current && ({ ...current, crop: { ...DEFAULT_CROP } }))}><RotateCcw/>重設</Button><div className="flex gap-2"><DialogClose asChild><Button variant="outline">取消</Button></DialogClose><Button onClick={() => { setPhoto(draft.photo); setCrop(draft.crop); setDraft(null); setMessage(""); }}>套用裁切</Button></div></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
