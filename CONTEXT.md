# Blazor Server Template

A GitHub template repository that scaffolds a Blazor Web App (server-rendered) with Tailwind CSS theming and Auth0 authentication/authorization baked in.

## Language

**Template**:
This repository itself, used via GitHub's "Use this template" button to create a new repository seeded with its contents. Distinct from the app that repository becomes.
_Avoid_: Project, solution (when referring to the repository itself)

**Generated App**:
The Blazor Web App created by using the Template via GitHub's "Use this template" button. What a template consumer actually builds, runs, and deploys.
_Avoid_: Instance, output, the app (when the distinction from Template matters)

**Palette**:
The color scale that tints the Generated App's UI: its accent (buttons, links, highlights) and its surfaces and borders, in both Themes. Text stays neutral.
Chosen by the visitor at runtime from a dropdown in the Generated App's menu.
Offers a curated set of Tailwind CSS hue scales (e.g. Rose, Blue, Violet — the full set minus the gray-family scales, which are visually redundant for this purpose).
Persisted in a cookie, the same mechanism as Theme.
Defaults to a single fixed hue until the visitor picks one; there is no OS-level signal to default from.
Orthogonal to Theme — Palette decides the hue, while Theme decides light or dark.
_Avoid_: Theme, color scheme, skin

**Theme**:
The light/dark rendering mode: Light, Dark, or System (follow the OS `prefers-color-scheme`).
Chosen by the visitor at runtime from a control in the Generated App, persisted in a cookie (read during server-side prerender to avoid a flash of the wrong theme on first paint), and System until the
visitor picks one. Choosing System again returns to following the OS.
_Avoid_: Palette, mode, color scheme

**Visitor**:
An unauthenticated caller of the Generated App. Can see public pages (e.g. Home) but not the Profile or Admin pages.
_Avoid_: Guest, anonymous user

**User**:
A Visitor who has authenticated through Auth0. Can see the Profile page, showing their own claims.
_Avoid_: Account, member

**Admin**:
A User whose Auth0 claims include the Admin role. The only audience for the Admin page, which demonstrates role-based authorization.
_Avoid_: Administrator, superuser

**Shared Kernel**:
The set of building blocks every Generated App needs no matter what it does or where it stores data: operation
outcomes (success or failure, with a failure category) and the names the Template itself relies on (authorization
policy, role, cookie names). It carries no business concepts and assumes no persistence technology.
_Avoid_: Common, Core, Utilities

**Release**:
A published, versioned snapshot of the Generated App (`vX.Y.Z`), cut each time a change merges to `main`.
The footer shows the Release the running build is, or the nearest Release before it.
_Avoid_: Version, build, deploy
