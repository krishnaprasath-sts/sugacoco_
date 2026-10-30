# Sugacoco Design System (Master)

Visual style follows the **Chola CRM** reference screenshots supplied by the client (2026-10-28):
dashboard, Manage Customer table, and Invoice Report filter form. Only the look is copied; screens and data are Sugacoco's.
This replaces the earlier green / triple-colour style. Page-specific rules go in `pages/<page>.md`.
Tokens live in `client/src/theme.ts` (BRAND, SIDEBAR_GRADIENT, ACTIVE_PILL, STAT_GRADIENTS).

## Product
Internal B2B order workflow (PI → payment → QC → packaging → documentation → closure) for 6 roles.
Daily desktop tool; MD/Admin also uses it on mobile.

## Size (compact, client request 2026-10-28)
- Base font 13px (MUI typography.fontSize 13); page title ~22px; nav items 40px tall, 13.5px text.
- Sidebar 236px, top bar 64px, page padding 24px desktop.
- Buttons 36px tall, inputs ~40px, table cells 10px/14px padding, stat cards ~116px tall with 28px numbers.
- Do not add hard-coded heights above 40px on desktop.

## Layout
- **Sidebar** (280px): dark plum vertical gradient #4B1863 → #2A1036, white text.
  Logo in a white rounded box. Uppercase letter-spaced section labels (HOME, ADMINISTRATION).
  Active item = violet gradient pill (#8E3FB0 → #7C5CE6) with soft glow. Footer line with app + role.
  Hamburger hides the sidebar on desktop (remembered per browser) and opens a drawer on mobile.
- **Top bar** (84px, white, thin bottom border): grey rounded-square hamburger, centred date-time pill (#F1F0F6),
  right side name + role and a plum avatar with shadow.
- **Background** #F4F5FA. Page padding 36px desktop, 16px mobile.
- **Page header**: small grey overline (section name) above a bold 28px title; primary action on the right.

## Colour
| Token | Value | Use |
|---|---|---|
| primary (plum) | #6B2170 | Buttons, table header, avatar, focus |
| primary.dark | #4A1650 | Hover |
| secondary (violet) | #7C5CE6 | Active nav pill end |
| background | #F4F5FA | App background |
| paper | #FFFFFF | Cards |
| text | #111827 / #4B5563 | Body / secondary |
| error / warning / info / success | #DC2626 / #B45309 / #2563EB / #15803D | Status |
Stat card gradients: green, olive, pink, violet, teal (white text passes contrast on all).
Status chips always show a text label, never colour alone.

## Shape & surfaces
- Cards: 24px radius, white, soft shadow `0 10px 30px rgba(31,16,56,0.06)`, faint 1px border.
- Buttons: pill (999px). Primary is solid plum with a plum shadow; outlined is white with light border.
- Inputs: 14px radius, white, 48px tall, light border #E3DFEA, plum focus ring. **Label above the input** (not floating).
- Tables: plum header row, white bold header text, rounded top corners, light row dividers, lavender row hover.
  Row actions are tinted square icon buttons (edit = blue tint, destructive = red tint).
- Dialogs: 24px radius, large soft shadow.
- In `sx`, write radius as a px string ('24px'): numeric values are multiplied by the 14px theme radius.

## Typography
- DM Sans (self-hosted via @fontsource-variable/dm-sans). Titles 700, body 400/500.
- Body 14–16px, never below 12px. Tabular numbers for money.

## Interaction
- Touch targets ≥ 44px. Async buttons show a loading state and are disabled while saving.
- Visible focus rings (sidebar items use a white outline).
- Errors under the field; required fields show a red asterisk.
- Transitions 150–250ms; prefers-reduced-motion respected.
