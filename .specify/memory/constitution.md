# PROJECT CONSTITUTION
Version: 1.0
Status: NON-NEGOTIABLE
Authority: This document overrides specs, plans, and implementations.

If any spec, plan, or implementation conflicts with this document,
THIS DOCUMENT PREVAILS.

---

# 1. ENGINEERING RULES

## 1.1 Simplicity

- MUST prefer simple and explicit solutions.
- MUST NOT introduce clever abstractions without clear justification.
- MUST avoid premature optimization.
- Every function MUST have a single responsibility.

## 1.2 Code Structure

- Components MUST be small and readable.
- Business logic MUST NOT be mixed with UI logic.
- Supabase or API calls MUST NOT exist inside UI components.
- Shared logic MUST live in `/services`, `/lib`, or `/features`.

## 1.3 Testing

- Core game logic MUST have test coverage.
- Every bug fix MUST include a regression test.
- Critical flows MUST be testable without UI interaction.

---

# 2. UX RULES

## 2.1 Mobile First

- UI MUST work on small screens first.
- Layout MUST NOT require horizontal scrolling unless intentional.
- Touch targets MUST meet minimum accessibility size standards.

## 2.2 Feedback

- Every async action MUST display a loading state.
- Errors MUST be shown clearly to the user.
- Silent failures are FORBIDDEN.

## 2.3 Accessibility

- Interactive elements MUST have accessible labels.
- Color contrast MUST meet accessibility baseline standards.
- Focus states MUST exist for interactive elements.

---

# 3. PERFORMANCE RULES

## 3.1 Rendering

- MUST avoid unnecessary re-renders.
- MUST memoize expensive computations when justified.
- Lists MUST use optimized list components (e.g., FlatList).

## 3.2 Dependencies

- MUST NOT add large dependencies without documented justification.
- MUST remove unused code and packages.
- Bundle size MUST be kept minimal.

---

# 4. SECURITY & PRIVACY

## 4.1 Data

- MUST NOT store user photos unless explicitly required by product specification.
- MUST NOT collect unnecessary personal data.

## 4.2 Validation

- MUST validate inputs on both client and server.
- MUST NOT rely solely on client-side validation.

## 4.3 Secrets

- MUST NOT log secrets.
- MUST NOT log user images.
- Environment variables MUST NOT be exposed in client bundles.

---

# 5. WORKFLOW RULES

## 5.1 Feature Flow (MANDATORY)

Every feature MUST follow this order:

1. Spec
2. Implementation Plan
3. Task Breakdown
4. Implementation
5. Review

Coding without a spec is FORBIDDEN.

## 5.2 PR Scope

- PRs MUST be small and focused.
- Refactoring MUST be separate from feature development.
- Large, mixed PRs are NOT allowed.

---

# 6. PRIORITY ORDER (WHEN TRADE-OFFS EXIST)

When trade-offs arise, decisions MUST prioritize in this order:

1. Security
2. Simplicity
3. UX Clarity
4. Performance
5. Developer Convenience