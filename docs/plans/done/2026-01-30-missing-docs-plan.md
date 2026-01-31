# Missing Subcommands Documentation Plan

**Goal:** Provide comprehensive documentation for all CLI subcommands and ensure consistency across the entire documentation set.

## Proposed Changes

### 1. New Documentation
Create detailed markdown files in `docs/commands/` for:
- [NEW] `read.md`: Reading file contents.
- [NEW] `code.md`: Creating, overwriting, or patching files.
- [NEW] `commit.md`: Staged changes validation and commit.

### 2. Standardizing Existing Documentation
Update existing files to match the new standardized help strings and exit codes (0: Success, 1: Runtime Error, 2: Validation Error):
- [MODIFY] `message.md`: Update exit codes and usage.
- [MODIFY] `push.md`: Update exit codes and usage.
- [MODIFY] `search.md`: Update exit codes and usage.
- [MODIFY] `worktree.md`: Update exit codes and usage.

---

## Verification Plan

### Manual Verification
- **Link Check**: Ensure all links in `README.md` and between documentation files are correct.
- **Content Accuracy**: Compare the documentation against the actual `--help` output of the CLI tools.
- **Formatting**: Verify that all files follow the same structure: Overview, Usage, Arguments, Flags, Examples, Exit Codes.
