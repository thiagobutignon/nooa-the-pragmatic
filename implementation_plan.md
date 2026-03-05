# Ralph Loop Landing Demo Implementation Plan

## Goal

Build an isolated educational landing page demo about the Ralph Loop using only HTML, CSS, and JavaScript, without touching the main product surface.

## Constraints

- Keep the implementation inside a dedicated fixture/demo directory.
- Use static HTML/CSS/JS only.
- No framework, no backend, no package-level complexity unless strictly necessary for local preview.
- The page should teach the Ralph Loop clearly and stay responsive on desktop and mobile.

## Delivery Sequence

### Story US-001 - Scaffold a static demo shell

- Create an isolated demo directory for the landing page fixture.
- Add `index.html`, `styles.css`, and `script.js`.
- Ensure the page opens directly in a browser without a build step.
- Label the page clearly as a Ralph Loop educational demo.

### Story US-002 - Explain the Ralph Loop in the hero and overview

- Add a hero section with a plain-language definition of the Ralph Loop.
- Add short overview copy explaining fresh context, peer review, and CLI-first verification.
- Keep the tone educational and concrete.

### Story US-003 - Visualize the macro-loop and micro-loop

- Add a section showing the macro-loop: planning, peer review rounds, and approved backlog.
- Add a section showing the micro-loop: story selection, TDD, implementation, verification, peer review, and approval.
- Make the flow understandable in both desktop and mobile layouts.

### Story US-004 - Teach the key Ralph principles

- Add sections explaining why worker and reviewer must be different.
- Add sections explaining TDD, CLI-first verification, and learning promotion.
- Use concrete language and small examples where helpful.

### Story US-005 - Polish the demo for real dogfooding

- Improve layout, spacing, contrast, and focus states.
- Add lightweight JavaScript only for progressive enhancement.
- Add a final section with local Ralph-related command examples.

## Verification

- Open the final `index.html` directly in a browser and verify the page renders correctly.
- Check the layout at desktop and mobile widths.
- Verify the copy explains the Ralph Loop without depending on external context.
- Confirm the fixture remains isolated from the main product.
