---
name: frontend-development
description: Frontend development guidelines for the wingfox monorepo (React 19, Vite, shadcn/ui, TanStack Router, Tailwind CSS v4, Biome). Use when creating components, pages, routes, or styling in apps/web.
---

# Frontend Development

## Project Structure

```
apps/web/src/
├── components/       # Custom components
│   └── ui/           # shadcn/ui primitives (auto-generated)
├── routes/           # TanStack Router file-based routes
├── hooks/            # Custom React hooks
├── lib/              # Utilities (cn, helpers)
├── assets/           # Static assets
├── api-client.ts     # Hono RPC client
├── main.tsx          # Entry point
└── styles.css        # Global styles + Tailwind
```

Path alias: `@/*` maps to `src/*`.

## Components

### shadcn/ui

- Style: **New York**, Icon library: **Lucide React**
- Add components via CLI: `pnpm dlx shadcn@latest add <component> --cwd apps/web`
- UI primitives go in `@/components/ui/` (do not manually edit)
- Custom components go in `@/components/`

### Component Conventions

```tsx
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
	status: "active" | "inactive";
	className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
				status === "active"
					? "bg-green-100 text-green-700"
					: "bg-gray-100 text-gray-500",
				className,
			)}
		>
			{status}
		</span>
	);
}
```

Rules:
- Named exports (no default exports)
- `cn()` for conditional/merged class names
- Accept `className` prop for composability
- Use tabs for indentation, double quotes for strings (Biome)
- Props interface defined above the component
- Trailing commas in function arguments

## Routing (TanStack Router)

File-based routing with auto code-splitting (via Vite plugin).

### Route File Patterns

| Pattern | File Path | URL |
|---------|-----------|-----|
| Index | `routes/index/route.tsx` | `/` |
| Static | `routes/about/route.tsx` | `/about` |
| Dynamic | `routes/users/$userId/route.tsx` | `/users/:userId` |
| Layout | `routes/_layout/route.tsx` | (layout wrapper) |

### Route Template

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/path")({
	loader: async () => {
		// Data fetching
	},
	component: RouteComponent,
});

function RouteComponent() {
	const data = Route.useLoaderData();
	return <div>{/* UI */}</div>;
}
```

- `routeTree.gen.ts` is auto-generated. Never edit it manually.
- Use `loader` for data fetching, not `useEffect`.
- Use `Route.useLoaderData()` for type-safe data access.

## Styling (Tailwind CSS v4)

### Key Differences from v3

- Config via CSS (`styles.css`), not `tailwind.config.js`
- OKLCH color space for CSS variables
- `@theme` directive for custom tokens
- No `@apply` in most cases; use utility classes directly

### Responsive Design

Mobile-first breakpoints:

| Prefix | Min Width | Target |
|--------|-----------|--------|
| (none) | 0px | Mobile |
| `sm:` | 640px | Small tablet |
| `md:` | 768px | Tablet |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Large desktop |

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
	{items.map((item) => (
		<Card key={item.id} {...item} />
	))}
</div>
```

- Always start with mobile layout, then add breakpoint modifiers
- Use `container mx-auto px-4` for page-level layout
- Prefer CSS Grid (`grid`) for 2D layouts, Flexbox (`flex`) for 1D

### Dark Mode

Uses `next-themes` with class strategy. Use Tailwind's `dark:` variant:

```tsx
<div className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-50">
```

Prefer semantic CSS variables (defined in `styles.css`) over hardcoded colors for theme consistency.

## State Management

### Local State

Use React hooks (`useState`, `useReducer`) for component-local state.

### Server State

Use TanStack Router's `loader` for route-level data. For complex server state caching, adopt TanStack Query:

```tsx
import { useQuery } from "@tanstack/react-query";
import { client } from "@/api-client";

export function useUsers() {
	return useQuery({
		queryKey: ["users"],
		queryFn: () => client.api.users.$get().then((r) => r.json()),
	});
}
```

- Custom hooks in `@/hooks/` with `use` prefix
- Colocate query hooks with their feature when possible

### Client State

For global UI state (modals, sidebars), prefer React Context or TanStack Store over external libraries.

## Code Quality (Biome)

### Enforced Rules

| Rule | Value |
|------|-------|
| Indent | Tabs |
| Quotes | Double quotes |
| Organize imports | Enabled |
| Linter rules | Recommended |

### Commands

```bash
pnpm biome check --write apps/web/src/  # Fix lint + format
pnpm biome format --write apps/web/src/ # Format only
```

### Turborepo Tasks

```bash
pnpm dev         # Start dev servers (web + api)
pnpm build       # Build all apps
pnpm lint        # Run Biome lint
pnpm format      # Run Biome format
```

## Anti-Patterns

- `useEffect` for data fetching (use route `loader` instead)
- Default exports for components
- Manual editing of `routeTree.gen.ts` or `ui/` components
- Inline styles instead of Tailwind utilities
- `px` values in Tailwind (use spacing scale: `p-4`, not `p-[16px]`)
- State libraries for server-cacheable data (use TanStack Query)
