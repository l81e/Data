# Changelog

All notable changes to the MedicineBank Data platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.0] - 2026-10-23

### Fixed
- **Move Deck Flow**: Resolved `PGRST204 Could not find the 'academic_year' column of 'materials'` by finding/auto-creating the `lectures` container for the target academic year (`year_of_view`) and updating `lecture_id` along with caption JSON metadata and normalized columns.
- **Swipe Touch Handlers**: Resolved `TypeError: null is not an object (evaluating 'dayViewport.clientWidth')` by guarding `mainEl` touch listeners and validating `dayViewport` and `dateBig` before animating.
- **Deck & Card Inspector**: Fixed `ReferenceError: zip is not defined` by loading archive blob asynchronously (`const zip = await JSZip.loadAsync(blob)`) before querying `collection.anki21b` / `collection.anki2` databases.
- **Default Year Bug**: Corrected `adminUploadYearSelect` defaulting to `'second year'`; now dynamically defaults to `currentYear || 'first year'`.
- **Database Schema Mismatch**: Fixed repo `schema.sql` to match production reality (text display-name uploaders, anon-compatible RLS policies, nullable semester without default, and ON DELETE CASCADE on foreign keys).
- **Client Syntax**: Fixed missing listener closure brace in `flash.html` `cramLapsedBtn`.

### Added
- **Single Write Path (`saveMaterialRow`)**: Unified helper in `js/supabaseClient.js` used by Publish, Edit Material, Move Deck, Inspector, and flashmake uploads with automated fallback retry when normalized columns are absent (`PGRST204` / `42703`).
- **File Size Gate**: Single source of truth `MAX_FLASH_UPLOAD_BYTES = 50 * 1024 * 1024` (50 MB standard Supabase limit) enforcing client-side validation before network transmission in `index.html` and `flashmake.html`.
- **Enhanced Error Surfacing**: Standardized console logging and user toasts surfacing `error.code` and `error.message`, with HTTP 413 / payload-too-large mapping to clear human-readable limit notices.
- **Curriculum Cache Invalidation**: Explicit cache invalidation (`delete curriculumHierarchyData[oldYear]`, `delete curriculumHierarchyData[newYear]`) on deck move.
- **Automated Verification Suite 43**: Added 31 test checks covering `saveMaterialRow` fallback execution, size gate constraints, full 5-year coverage, and DOM null guards (suite now passes 726/726 checks).

### Security
- **Security Hardening Proposal**: Formulated comprehensive architectural migration plan (`security_hardening_proposal.md`) for Supabase Auth, `profiles.role` RBAC, and `public.is_admin_or_editor()` RLS policy enforcement.
