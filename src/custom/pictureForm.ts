import { FONT_BODY, FONT_DISPLAY } from '../config';
import { loadImage, readFile } from './cutout';

// The one part of CREATE FIGHTER that needs real HTML: choosing a picture (the device's photo picker)
// and typing a name and handle (the on-screen keyboard on phones). A small panel over the game.

export interface PictureFormResult {
  /** the picture, scaled down to at most 640 px (data URL) */
  photo: string;
  name: string;
  handle: string;
}

const MAX_SIDE = 640;

/** shrink a picture so it fits on the device and over the network */
async function shrink(src: string): Promise<string> {
  const img = await loadImage(src);
  const s = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  // PNG keeps transparent pictures transparent; JPEG is much smaller for photos
  const png = c.toDataURL('image/png');
  return png.length < 400_000 ? png : c.toDataURL('image/jpeg', 0.88);
}

// the font stacks contain double quotes, which would end a style="…" attribute early
const DISPLAY = FONT_DISPLAY.replace(/"/g, "'");
const BODY = FONT_BODY.replace(/"/g, "'");

export function openPictureForm(current: Partial<PictureFormResult>): Promise<PictureFormResult | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);padding:16px;box-sizing:border-box;';
    const panel = document.createElement('div');
    panel.style.cssText = `width:min(440px,100%);max-height:100%;overflow:auto;background:#120b07;border:3px solid #f5c542;border-radius:10px;padding:18px 20px;box-sizing:border-box;color:#e8e2d0;font-family:${BODY};letter-spacing:1px;`;
    panel.innerHTML = `
      <div style="font-family:${DISPLAY};color:#f5c542;font-size:30px;text-align:center;margin-bottom:10px">YOUR FIGHTER</div>
      <label style="display:block;text-align:center;cursor:pointer">
        <img data-k="preview" alt="" style="width:140px;height:140px;object-fit:contain;background:#2a1a10;border:2px solid #6b4d16;border-radius:8px;display:block;margin:0 auto 8px">
        <span style="display:inline-block;background:#8a5a00;color:#fff;border:2px solid #f5c542;border-radius:6px;padding:8px 16px;font-size:22px">CHOOSE PICTURE</span>
        <input data-k="file" type="file" accept="image/*" style="display:none">
      </label>
      <div style="font-size:15px;color:#a89f88;text-align:center;margin:6px 0 12px">A PFP or a full-body picture. Plain backgrounds cut out best.</div>
      <div style="font-size:20px">NAME</div>
      <input data-k="name" maxlength="16" autocomplete="off" style="width:100%;box-sizing:border-box;font-size:22px;padding:8px;margin:4px 0 10px;background:#000;color:#fff;border:2px solid #6b4d16;border-radius:6px;font-family:${BODY};letter-spacing:1px">
      <div style="font-size:20px">X HANDLE <span style="color:#a89f88;font-size:16px">(optional)</span></div>
      <div style="display:flex;align-items:center;margin:4px 0 14px"><span style="font-size:22px;padding-right:6px">@</span>
      <input data-k="handle" maxlength="20" autocomplete="off" autocapitalize="off" style="flex:1;box-sizing:border-box;font-size:22px;padding:8px;background:#000;color:#fff;border:2px solid #6b4d16;border-radius:6px;font-family:${BODY};letter-spacing:1px"></div>
      <div data-k="err" style="color:#ff5a5a;font-size:18px;min-height:22px;text-align:center"></div>
      <div style="display:flex;gap:12px;justify-content:center;margin-top:6px">
        <button data-k="cancel" style="font-family:${DISPLAY};font-size:22px;padding:8px 18px;background:#2a1a10;color:#e8e2d0;border:2px solid #6b4d16;border-radius:6px;cursor:pointer">CANCEL</button>
        <button data-k="ok" style="font-family:${DISPLAY};font-size:22px;padding:8px 26px;background:#8a5a00;color:#fff;border:2px solid #f5c542;border-radius:6px;cursor:pointer">DONE</button>
      </div>`;
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    const q = <T extends HTMLElement>(k: string) => panel.querySelector(`[data-k="${k}"]`) as T;
    const preview = q<HTMLImageElement>('preview');
    const file = q<HTMLInputElement>('file');
    const name = q<HTMLInputElement>('name');
    const handle = q<HTMLInputElement>('handle');
    const err = q<HTMLDivElement>('err');
    let photo = current.photo ?? '';
    if (photo) preview.src = photo;
    name.value = current.name ?? '';
    handle.value = current.handle ?? '';
    // keys typed here are for the form, not the game
    const stop = (e: Event) => e.stopPropagation();
    panel.addEventListener('keydown', stop);
    panel.addEventListener('keyup', stop);

    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      err.textContent = 'Loading…';
      try {
        photo = await shrink(await readFile(f));
        preview.src = photo;
        err.textContent = '';
      } catch (e) {
        err.textContent = (e as Error).message;
      }
    });

    const close = (r: PictureFormResult | null) => {
      wrap.remove();
      resolve(r);
    };
    q<HTMLButtonElement>('cancel').addEventListener('click', () => close(null));
    q<HTMLButtonElement>('ok').addEventListener('click', () => {
      const n = name.value.trim().replace(/\s+/g, ' ');
      const h = handle.value.trim().replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
      if (!photo) return void (err.textContent = 'Choose a picture first.');
      if (!n) return void (err.textContent = 'Give your fighter a name.');
      close({ photo, name: n.slice(0, 16), handle: h.slice(0, 20) });
    });
    // focus the first empty field (not on phones' first open: it would pop the keyboard over the picker)
    if (photo && !name.value) name.focus();
  });
}
