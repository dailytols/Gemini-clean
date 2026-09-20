# Gemini Clean ✦
> Fast browser-side image reconstruction & logo cleaning. 

Gemini Clean is a premium, client-only React and WebAssembly application designed to identify, segment, and inpaint visible watermark/logo overlays from image files. Everything runs directly in the client browser, securing user privacy with no remote server uploads by default.

## ✦ Core Features
- **Intelligent Queue Engines**: Upload up to 20 images simultaneously and process them in sequence. Supports Balanced, Quality, and Low RAM safety profiles.
- **Precision Detection Sandbox**: Implements a cascading multi-stage logo detector:
  1. *Template Matching*: Scans corners for the exact pixel signature of the Gemini double-sparkle logo.
  2. *Watermark Segmentation*: Performs high-contrast thresholding and connected component analysis to isolate watermark shapes.
  3. *Estimated Fallback*: Bounding-box estimates with user fine-tuning flags.
- **Advanced Brush Fine-Tuning**: Built-in HTML Canvas paint editor with dynamic brush sizes, smooth touch controls, and infinite Undo/Redo historical stacks.
- **High-Quality Local Inpainting**: Custom texture-diffusion inpainting combined with noise/sensor-grain matching to blend reconstructions seamlessly. Supports OpenCV.js native Telea & Navier-Stokes when loaded.
- **Lossless Exports & Bulk ZIP packing**: Preserves full image width, height, and color fidelity. Download files individually or compile them into a single structured ZIP via JSZip.

---

## 📁 Technical Architecture
The project is built on Vite, React 19, TypeScript, and Tailwind CSS:
- `/src/components/`: Modular dashboard widgets (UploadDropzone, SettingsPanel, ComparisonSlider, MaskEditor, ZipProgress).
- `/src/core/detector/`: Cascading detection orchestrators.
- `/src/inpainting/`: Reconstructive math libraries.
- `/src/hooks/`: Reactive state hooks (`useQueue`, `useProcessor`, `useComparison`).
- `/src/utils/`: Pixel helpers and URL registries to prevent RAM leaks.

---

## 🚀 Free Deployment Guide

Since Gemini Clean operates entirely client-side, you can host it for free on global edge networks with zero server infrastructure!

### Option A: Deploy on Cloudflare Pages (Recommended)
1. Install the Cloudflare Wrangler CLI or log into your Cloudflare Dashboard.
2. Select **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Point to your repository and configure these build parameters:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
4. Click **Save and Deploy**. Your app is live globally on the Cloudflare edge network in seconds!

### Option B: Deploy on GitHub Pages
1. Install the `gh-pages` helper package:
   ```bash
   npm install gh-pages --save-dev
   ```
2. Open your `vite.config.ts` and set the base directory:
   ```typescript
   export default defineConfig({
     base: '/YOUR_GITHUB_REPO_NAME/',
     // other configs...
   });
   ```
3. Add deployment scripts to `package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -p dist"
   }
   ```
4. Run the deploy sequence in your terminal:
   ```bash
   npm run deploy
   ```
   
---

## 🔒 Privacy Notice
Your images never leave your local environment. Reconstructions utilize standard sandboxed Canvas contexts, meaning files are never transmitted to outside networks unless the user explicitly opts into the background server-processing mode.
This app only removes visible watermark overlays and does not modify invisible digital provenance watermarks (such as SynthID) to preserve legal content authenticity.
