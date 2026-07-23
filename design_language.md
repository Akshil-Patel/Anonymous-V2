# ANONYMOUS HQ — Design System & Visual Guidelines

**Version:** 1.0.0  
**Target Audience:** Front-End Developers, UI/UX Engineers, Design Contributors  
**Core Aesthetic:** Swiss Editorial / Cinematic Cyber Minimalist Dark Mode  

---

## 1. Brand Identity & Design Philosophy

The **ANONYMOUS** visual identity balances tactical high-tech minimalism with refined editorial typography. The system avoids cliché retro-green "hacker" tropes, favoring instead a **sleek, dark, atmospheric HUD aesthetic** built with modern glassmorphism, dynamic glow fields, monospaced metadata overlays, and subtle noise textures.

### Design Principles
1. **Precision & Restraint:** Dark background bases with selective, high-impact accent lighting. Avoid visually overwhelming colors.
2. **Editorial Meets Cyber:** Pair high-end serif titles (`Cormorant Garamond`) and clean sans-serif UI (`Plus Jakarta Sans`) with monospaced terminal accents (`Share Tech Mono`).
3. **Layered Depth:** Use backdrop filters, dynamic SVG canvas backgrounds, volumetric ambient fog, and subtle noise overlays to achieve a multi-dimensional HUD feeling.
4. **Micro-Interactions over Heavy Motion:** Transitions should feel fluid and deliberate (`cubic-bezier(0.16, 1, 0.3, 1)`), giving elements a responsive, weightless physical feel.

---

## 2. Color Palette & Token System

All values must be referenced via standard CSS custom properties (`var(--token)`). Do **not** hardcode raw Hex or RGB values in component stylesheets.

### Base Color Tokens
| CSS Variable Name | Color Value / Hex | Usage / Purpose |
| :--- | :--- | :--- |
| `--bg-primary` | `#000000` | Main canvas background, deepest base surface |
| `--bg-secondary` | `#050505` | Card backgrounds, elevated container bases |
| `--text-primary` | `#F8FAFC` | Primary headings, active nav items, key text |
| `--text-secondary` | `#64748B` | Secondary descriptions, subheadings, metadata |
| `--text-muted` | `#334155` | Borders, subtle gridlines, dormant metadata tags |

### Accent Tokens
| CSS Variable Name | Value | Usage / Purpose |
| :--- | :--- | :--- |
| `--accent-color` | `#3B82F6` | Muted Electric Blue accent (Buttons, highlights, active nodes) |
| `--accent-rgba` | `rgba(59, 130, 246, 0.4)` | Soft glowing borders & shadow highlights |
| `--accent-faint` | `rgba(59, 130, 246, 0.08)` | Background highlights, subtle ambient glow fields |

### Status Colors
- **Secure / Nominal:** `#64748B` (Muted Slate)
- **Active / Connected:** `#3B82F6` (Electric Blue)
- **Warning / Testing:** `#828CA1` (Medium Steel)
- **Restricted / Critical:** `#E11D48` (Crimson Pulse)

---

## 3. Typography & Hierarchy

Font stacks are pulled via Google Fonts. Standardize on the following three typefaces across all new pages or modules:

```css
:root {
  --font-ui: 'Plus Jakarta Sans', sans-serif;
  --font-mono: 'Share Tech Mono', monospace;
  --font-editorial: 'Cormorant Garamond', serif;
}
```

### Type Hierarchy Specification
| Role | Font Family | Size Range | Weight / Style | Letter Spacing | Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Title (`.main-title`)** | `--font-ui` | `clamp(2rem, 8vw, 5.5rem)` | 300 (Light) | `0.4em` | UPPERCASE |
| **Hero Subtitle (`.main-subtitle`)** | `--font-editorial` | `clamp(0.95rem, 2.4vw, 1.45rem)` | 300 / Italic | `2px` | Sentence / Title |
| **Section Header (`.grid-title`)** | `--font-ui` | `1.75rem` - `2.25rem` | 400 (Regular) | `0.25em` | UPPERCASE |
| **Bento Title (`.bento-title`)** | `--font-ui` | `1.1rem` - `1.25rem` | 500 (Medium) | `1px` | Title Case |
| **HUD Navigation / Metadata** | `--font-mono` | `0.6rem` - `0.8rem` | 400 - 500 | `2px - 3px` | UPPERCASE |
| **Terminal Code / Inputs** | `--font-mono` | `0.85rem` - `0.9rem` | 400 | `2px` | lowercase/mixed |

---

## 4. Layout, Spacing & Container Grid

### Floating Glass Navigation Bar (`.glass-nav`)
- **Positioning:** Fixed top, centered (`top: 0.75rem`, `left: 50%`, `transform: translateX(-50%)`).
- **Width:** `width: 90%`, `max-width: 900px`.
- **Surface Styling:**
  ```css
  background: rgba(10, 10, 12, 0.28);
  backdrop-filter: saturate(180%) blur(45px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 17px;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.08), 0 8px 30px rgba(0, 0, 0, 0.5);
  ```

### Modular Bento Grid System (`.bento-grid`)
For content cards, division showcases, and operational feeds, use the asymmetric Bento layout pattern:
- **Layout:** CSS Grid (`grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`, `gap: 1.5rem`).
- **Card Base (`.bento-card`):**
  ```css
  background: rgba(15, 23, 42, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 1.75rem;
  backdrop-filter: blur(12px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  ```
- **Card Hover State:**
  ```css
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(59, 130, 246, 0.05);
  transform: translateY(-4px);
  ```

---

## 5. Components & Interactive Patterns

### 1. Terminal Command Loader / Dormant State (`#dormant-screen`)
- Full-screen dark overlay (`#000000`) displayed on initial site load.
- Displays interactive terminal line with custom cursor blinking (`animation: cursor-blink 0.9s step-end infinite`).
- Smooth cubic-bezier reveal sequence (`transition: opacity 1.8s cubic-bezier(0.16, 1, 0.3, 1)`).

### 2. Network Navigation Nodes (`.nav-node`)
- Absolute positioned nodes connected over interactive background canvas.
- Structure: Includes a `.node-ring` indicator, `.node-label`, and hover-triggered `.node-card` preview popup.
- Hover Interaction: Ring scales `1.4x`, switches border and background to `--accent-color`, and emits a localized glow (`box-shadow: 0 0 14px var(--accent-color)`).

### 3. Ambient Visualizer Controls (`#audio-toggle`)
- Interactive header component featuring live audio wave indicator bars (`.audio-wave`).
- When active, bars trigger staggered keyframe bounce (`animation: bounce-wave 0.8s ease-in-out infinite alternate`).

---

## 6. Animation & Motion Design

Maintain consistent timing and easing across all page transitions and micro-interactions:

### Custom Easing Standard
```css
/* Core Reveal & Movement Curves */
--ease-cinematic: cubic-bezier(0.16, 1, 0.3, 1);
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Key Animations

#### Title Breathe Effect (`elegant-breathe-title`)
Provides a slow, subtle floating motion to central hero titles without causing layout shifts:
```css
@keyframes elegant-breathe-title {
  0% { transform: translateY(0px) scale(1); }
  100% { transform: translateY(-8px) scale(1.02); }
}
```

#### Status Indicator Pulse (`pulse-indicator`)
```css
@keyframes pulse-indicator {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.6); opacity: 1; }
}
```

#### Page Transition / Zoom Zoom Shift (`.nav-clicked-transition`)
When moving between major operational sectors:
```css
.nav-clicked-transition {
  opacity: 0 !important;
  transform: scale(1.08) !important;
  transition: opacity 1.8s cubic-bezier(0.16, 1, 0.3, 1),
              transform 1.8s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
```

---

## 7. Developer Rules & Best Practices

1. **Vanilla CSS First:** Maintain clean CSS tokenization in [style.css](file:///d:/IMPORTANT/ANONYMOUS/WEBSITE/style.css). Do not introduce heavy utility frameworks (e.g. Tailwind) without team alignment.
2. **Semantic & Accessible Markup:** Every interactive element must possess a clear `id`, descriptive `aria-label` (e.g. audio toggles, node links), and explicit semantic tag (`<header>`, `<main>`, `<nav>`, `<section>`).
3. **No Hardcoded Static Offsets:** Always utilize CSS variables, flex layout alignment, or grid properties rather than fixed pixel offsets for responsive adaptation.
4. **Performance Bounds:** Keep background SVG canvas rendering light. Avoid overlapping heavy blur filters (`blur(80px)+`) on low-power device viewports.
5. **Asset Linking:** Iconography uses inline clean SVG paths with `stroke-width="1.5"` or `2.0`. Store all brand media in root or dedicated `/assets/` directory.

---
*ANONYMOUS HQ Front-End Engineering Team*
