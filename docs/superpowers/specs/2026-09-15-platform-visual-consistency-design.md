# Platform Visual Consistency Design

## Goal

Make the existing Control de Gestión platform feel like one coherent product without redesigning its identity, changing workflows, altering permissions, or touching Supabase/data behavior.

## Scope

The pass covers the visible surfaces of the current application in `auditoria-codex-parcial`:

- Login / access shell
- Dashboard shell, sidebar and top bar
- Planning landing / period and unit selectors
- Configuration accordions and catalog surfaces
- Permissions and permission modals
- Strategic guidelines for CENTRAL, HU, VS, DEP and HOT
- Guideline support documents
- Unit and CENTRAL matrix workspaces
- Matrix summary/history/restore dialogs
- Empty, loading, success and error states

The pass is visual-only. Existing behavior, route/navigation semantics, `guideline_id` targeting, permission rules, RLS, storage behavior and Supabase migrations are out of scope.

## Visual Direction

Keep the current Los Portales-style corporate look: white surfaces, dark navy text, blue as the global action color, subtle neutral borders, restrained shadows, and unit-specific accents where already used.

The objective is consistency, not novelty. No gradients or decorative effects should be introduced into work surfaces unless they already belong to the login experience.

## Shared Visual Rules

### Typography

- Keep `Inter` as the platform font.
- Default working text should normally be 11–13 px.
- Do not use 7–8 px for important labels, controls or permission descriptions.
- 9–10 px is allowed only for compact metadata, eyebrow labels and tertiary status text.
- Main module titles should remain around 20–24 px.
- Section titles should remain around 16–18 px.
- Use consistent line heights so dense tables remain readable.

### Spacing

Use a small repeatable spacing scale rather than arbitrary values:

- 6 px: compact internal gaps
- 8 px: control gaps
- 12 px: small section gaps
- 16 px: card/control padding
- 20 px: medium section padding
- 24 px: major panel padding

Existing layouts may keep their dimensions when required by dense matrix tables, but adjacent controls should align to this rhythm.

### Controls

- Standard text buttons: 38–40 px minimum height.
- Compact toolbar buttons: 36–38 px minimum height.
- Icon-only buttons: 34–38 px square.
- Standard radius: 9–11 px.
- Primary buttons: filled blue unless the action is unit-specific and already intentionally uses another semantic color.
- Secondary buttons: white background, neutral border, dark slate text.
- Positive/navigation-to-matrix actions may retain green where already established.
- Destructive actions remain red and visually secondary until confirmation.
- Every interactive control must have a visible hover state and keyboard focus state.

### Cards and Panels

- Standard panel border: light blue/neutral gray.
- Standard radius: 14–16 px for cards and panels; 18–20 px only for larger dialogs or top-level containers.
- Shadows should be subtle and used for hierarchy, not decoration.
- Nested panels should avoid stacking multiple strong shadows.

### Tables

- Keep current unit-specific header colors and CENTRAL styling.
- Make header typography and row typography consistent across modules.
- Keep row separators clear but light.
- Align action buttons consistently within action columns.
- Preserve the recent guideline column-width adjustments for HU/VS/DEP/HOT.
- Do not reduce strategic guideline text width again.

### Modals and Dialogs

- Consistent header spacing, close button size, body padding and footer layout.
- Primary action on the right, secondary/cancel before it.
- Consistent backdrop opacity and blur.
- Long modal bodies must scroll internally while header/footer remain visually stable where practical.

### States

- Empty states: icon + concise title/message, soft neutral background.
- Loading states: same spinner treatment and typography across modules.
- Success states: soft green.
- Error/destructive states: soft red.
- Informational states: soft blue.

## Module-Specific Decisions

### Login

The current login is visually cohesive already. Only fix inconsistencies that are clearly shared-system issues such as button focus, input focus, radius or typography drift. Do not redesign the login artwork.

### Dashboard

Preserve the sidebar/topbar structure. Normalize button/icon sizing, content spacing and card hierarchy so dashboard navigation becomes the reference visual language for the rest of the platform.

### Configuration

All configuration sections should use the same accordion header height, icon treatment, title/subtitle hierarchy and open/closed states. The existing Periodos and Gerentes responsables accordions are the reference pattern.

### Permissions

This is the highest-priority visual cleanup because it currently contains the smallest typography and densest controls.

- Increase important labels/descriptions to readable sizes.
- Keep CENTRAL and non-CENTRAL permission models visually distinct but structurally aligned.
- Maintain lineamiento accordions closed by default.
- Keep Access/Edit toggles grouped and aligned.
- Do not alter permission behavior.

### Guidelines

Preserve all recent guideline visual work:

- `Ir a matriz` text and arrow stay inside one button.
- HU/VS/DEP/HOT keep widened strategic guideline columns.
- CENTRAL remains visually independent where intended.
- HOT/DEP special table structures remain intact.

Only normalize surrounding toolbar spacing, action button dimensions, table typography and panel hierarchy where inconsistent.

### Support Documents

Keep the shortened support context (`DOCUMENTOS DE SOPORTE · L1`, etc.). Normalize upload/view/delete buttons, empty state spacing and viewer dialog against the shared control/dialog rules.

### Matrices

Do not restructure matrix behavior or column models.

- Harmonize toolbar button dimensions and spacing across CENTRAL and unit workspaces.
- Preserve Excel-like density.
- Normalize editor cards, summary cards, history dialogs and restore confirmation dialogs.
- Avoid broad CSS overrides that could alter column sizing or row alignment.

## Implementation Strategy

Use conservative, layered CSS changes rather than rewriting components.

1. Introduce/normalize a small set of shared visual CSS variables in the global stylesheet for control heights, radii, borders, text colors and spacing.
2. Update module CSS files to consume those shared values where doing so is safe.
3. Prefer targeted selectors over broad element selectors.
4. Keep unit-specific and matrix-specific layout rules intact.
5. Avoid deleting legacy CSS during this pass unless a rule is proven unused and directly conflicts with the consistency work.

## Testing and Safety

- Start with RED regression tests for the new visual invariants where static assertions are practical.
- Run the existing regression suite after each major visual area.
- Run TypeScript and production build after each batch.
- Run complete CI at the end.
- No Supabase migrations or backend changes.
- Do not modify `main`.
- Work only on `auditoria-codex-parcial`.

## Success Criteria

The work is complete when:

- The platform preserves its current identity and workflows.
- Buttons, labels, cards, modals and states look intentionally related across modules.
- Important permission/configuration text is no longer visually too small.
- No recent guideline improvements regress.
- Matrix density and alignment remain intact.
- Responsive behavior remains usable.
- Regression tests, TypeScript, production build and CI are green.
