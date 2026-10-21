This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## SpeakUp Voice Studio design system

The UI uses Tailwind v4, locally owned shadcn-style components in `components/ui`, and Radix primitives for dialogs, menus, and progress. `components.json` configures the registry aliases. Existing module state and API integrations remain in their original owners.

- Fonts: local variable Outfit for headings and Plus Jakarta Sans for body text, loaded with `next/font/local`. Files and OFL licenses live in `app/fonts`; builds do not download fonts.
- Themes: Light, Dark, and System through `next-themes`, persisted under `speakup-theme`. The provider applies the theme before paint; theme changes do not remount practice modules.
- Tokens: semantic colors, surfaces, borders, spacing conventions, and motion in `app/globals.css`. Use `bg-card`, `text-muted-foreground`, `text-primary`, and related tokens rather than hard-coded palette shades.
- Modules: `studio-shadowing`, `studio-circumlocution`, `studio-ping-pong`, and `studio-compressor` set `--module`. Their icon tiles, banners, and progress indicators inherit the accent.
- Icons: original React SVG artwork in `components/icons/studio-icons.tsx`. Interaction animations use CSS; `active` follows existing activity state. Reduced-motion preferences disable movement.
- Shared presentation: brand, studio banners, account illustration, and expandable vocabulary suggestions live in `components/shared`.
- Controls: preserve explicit `type="submit"` on form submissions. Other shared Buttons default to `type="button"`. Prefer associated labels, descriptive progress names, and visible focus indicators.

### Verification

```powershell
npm.cmd run build
npm.cmd run lint
node scripts/check-design-contrast.mjs
node scripts/check-ui-preservation.mjs
```

The contrast check covers foreground/surface pairs, tinted feedback text, and input boundaries in both themes; it is not a replacement for a browser accessibility audit. The preservation check compares existing state, effects, API calls, timers, and navigation against Git HEAD, and flags backend changes for review. The UI migration began with 34 existing lint errors and 17 warnings; lint output should be compared by finding, not just total count.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
