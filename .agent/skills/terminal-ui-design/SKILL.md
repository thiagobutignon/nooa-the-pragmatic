---
name: terminal-ui-design
description: Use when building or redesigning CLI tools, TUI applications, or terminal-based interfaces where visual quality and interaction polish matter
---

# Terminal UI Design

## Overview

This skill helps create **distinctive, production-grade terminal UIs** (CLI/TUI) that feel intentional, branded, and memorable — not generic. It treats the terminal as a design canvas with typography, layout, rhythm, and motion, while staying practical for real command-line workflows.

**Core principle:** A terminal UI must be **legible, fast, and aesthetically deliberate**. Minimal doesn’t mean bland; maximal doesn’t mean chaotic. Every element earns its place.

**REQUIRED BACKGROUND:** You MUST understand test-driven-development before using this skill.

## When to Use

Use this skill when:
- Building or redesigning a CLI/TUI interface.
- Creating a terminal prototype to validate product UX.
- The UI must carry brand or product identity (ex: “NOOA hypergrowth console”).
- The terminal UX is part of the product experience, not just a debug tool.

Do NOT use when:
- You’re printing quick debug logs.
- A minimal one-off CLI output is sufficient.

## Design Thinking (Decision Order)

1) **Purpose**  
What workflow are we optimizing? Who is the user (agent/human)? What is the expected session length?

2) **Tone (Choose an extreme)**  
Pick one:  
- hacker/cyberpunk  
- retro-computing (80s/90s)  
- minimalist zen  
- maximalist dashboard  
- synthwave neon  
- monochrome brutalist  
- corporate mainframe  
- playful/whimsical  
- matrix-style  
- steampunk terminal  
- vaporwave  
- military/tactical  
- art deco  
- paper‑tape nostalgic  

3) **Constraints**  
Library & platform: Ink, Blessed, Bubbletea, Ratatui, Rich, ANSI-only, ncurses.  
Also: TTY requirements, performance, accessibility, OS quirks.

4) **Differentiation**  
One unforgettable element (signature palette, header treatment, motion style, panel layout, or input feel).

## Box Drawing & Borders

Pick borders that fit the aesthetic. Avoid default single-line boxes unless minimalism is intentional.

Options:
- Single line: ┌─┐│└┘ (clean, modern)
- Double line: ╔═╗║╚╝ (bold, retro-mainframe)
- Rounded: ╭─╮│╰╯ (soft, modern)
- Heavy: ┏━┓┃┗┛ (industrial)
- Dashed/Dotted: ┄┆ (light, informal)
- ASCII: +-+| (retro, universal)
- Block: █▀▄▌▐ (chunky, brutalist)
- Custom: ◢◣◤◥ ●○ ◐◑ ▲▼ ◀▶

## Color & Theme

Commit to a cohesive palette and use it consistently:
- ANSI 16: for maximal compatibility
- 256‑color: for richer palettes
- True color: for gradients and subtle tones
- Monochrome: single hue + intensity (dim/bold/invert)

Atmosphere techniques:
- Background blocks for sections
- Gradient headers or separators
- Dim secondary info
- Inverse video for focus states

## Typography & Text Styling

Terminal UI = typography. Use:
- Case for hierarchy (ALL CAPS headers, lowercase body)
- Symbols for bullets: ▸ ◉ ✓ ⬢ ›
- Unicode accents: → ◆ ★ ⚡ λ ∴ ⌘
- Structured spacing for readability

## Layout & Composition

Avoid single-column dumps. Prefer:
- Panels, columns, and clear regions
- Intentional whitespace
- Balanced density: dashboard vs. wizard
- Visual hierarchy: primary vs secondary vs chrome

## Motion & Animation

Motion adds life but must be restrained:
- Spinners: ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏
- Progress: ▓░ / █▒ / ◐◓◑◒
- Typing effects for key moments
- Live updates only where needed

## Data Display Patterns

Use compact, information-dense UI patterns:
- Sparklines: ▁▂▃▄▅▆▇█
- Bars: ███░░
- Trees: ├── └── │
- Status: ● ○ ◐ ✓ ✗

## Anti‑Patterns (Avoid)

Never ship:
- Plain text without hierarchy
- Default palettes with no intent
- Overly verbose walls of text
- Generic “INFO/ERROR” without styling
- Unstructured, unaligned layouts

## Implementation Checklist

- [ ] Chosen tone + palette + signature element  
- [ ] Panels and layout match the workflow  
- [ ] Clear hierarchy (header / main / input / side panels)  
- [ ] Motion minimal but purposeful  
- [ ] Resize behavior clean (no scroll artifacts)  
- [ ] TTY guardrails handled  

## Example: Minimal Agent Console (Ink)

```tsx
<Box flexDirection="column" height={rows}>
  <Header />
  <BodyPanels />
  <InputBar />
</Box>
```

## Final Principle

**The terminal is a canvas.**  
Don’t just print output — **craft an experience**.
