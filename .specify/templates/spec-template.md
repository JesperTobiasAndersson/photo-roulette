# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

---

# 1. User Scenarios & Testing *(MANDATORY)*

<!--
User stories MUST be prioritized (P1, P2, P3...).
Each story MUST be independently testable and deliver standalone value.
Each story MUST be deployable independently.
-->

## User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain why this is the highest value slice]

**Independent Test**:  
[Describe how this can be tested independently and what value it delivers]

### Acceptance Scenarios

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

## User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value]

**Independent Test**:  
[Describe how this can be tested independently]

### Acceptance Scenarios

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

## User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value]

**Independent Test**:  
[Describe how this can be tested independently]

### Acceptance Scenarios

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

# 2. Edge Cases *(MANDATORY)*

- What happens when [boundary condition]?
- What happens when there is no internet?
- How does the system handle backend failure?
- What happens with invalid or malformed input?
- What happens if required data is missing?

---

# 3. Non-Goals *(MANDATORY)*

This feature WILL NOT:

- Modify unrelated systems
- Introduce major refactors outside scope
- Change monetization logic unless explicitly stated
- Introduce new architectural patterns

---

# 4. Constitution Compliance *(MANDATORY)*

This feature MUST comply with `PROJECT_CONSTITUTION.md`.

## Engineering Compliance

- Business logic is separated from UI.
- No direct Supabase/API calls exist inside UI components.
- Single-responsibility principle is respected.
- Code remains simple and explicit.

## UX Compliance

- Loading states are implemented.
- Clear error states are implemented.
- Mobile-first layout is preserved.
- No silent failures exist.

## Security Compliance

- Input validation exists on client and server.
- No secrets are logged.
- No sensitive data is logged.
- Environment variables are not exposed.

---

# 5. Requirements *(MANDATORY)*

## 5.1 Functional Requirements

- **FR-001**: System MUST [specific capability]
- **FR-002**: System MUST [specific capability]
- **FR-003**: Users MUST be able to [interaction]
- **FR-004**: System MUST persist required data correctly
- **FR-005**: System MUST handle failure scenarios gracefully

If unclear, mark explicitly:

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION]
- **FR-007**: System MUST retain data for [NEEDS CLARIFICATION]

---

# 6. Key Entities *(If Feature Involves Data)*

- **[Entity 1]**: Description and key attributes (no implementation details)
- **[Entity 2]**: Description and relationships

---

# 7. Technical Constraints *(MANDATORY)*

- Must follow Expo architecture.
- Must use service layer for backend access.
- Must not introduce large dependencies without justification.
- Must not increase bundle size significantly.
- Must not break ad flow or monetization logic.
- Must follow existing folder structure conventions.

---

# 8. Success Criteria *(MANDATORY)*

## Measurable Outcomes

- **SC-001**: [Measurable metric]
- **SC-002**: [Performance or reliability metric]
- **SC-003**: [User success metric]
- **SC-004**: [Business or monetization metric]
