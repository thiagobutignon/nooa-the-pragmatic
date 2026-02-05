# commit

## Description

Commit staged changes with validation

## CLI Usage

```text
Usage: nooa commit -m <message> [flags]

Commit staged changes with validation (TDD, no forbidden markers).

Flags:
  -m <message>   Commit message (required).
  --no-test      Skip automatic test verification.
  --allow-lazy   Allow TODO/MOCK markers in the code. // nooa-ignore
  -h, --help     Show help message.

Examples:
  nooa commit -m "feat: user authentication"
  nooa commit -m "docs: api reference" --allow-lazy // nooa-ignore

Exit Codes:
  0: Success
  1: Runtime Error (git failure or tests failed)
  2: Validation Error (missing message or local guards failed)

Error Codes:
  commit.missing_message: Commit message is required
  commit.not_git_repo: Not a git repository
  commit.no_changes: No changes to commit
  commit.no_staged: No staged changes
  commit.policy_violation: Zero-Preguiça violations found
  commit.tests_failed: Tests failed
  commit.git_failed: Git commit failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="commit">
  <purpose>Commit staged changes with validation</purpose>
  <usage>
    <cli>nooa commit -m &lt;message&gt; [flags]</cli>
    <sdk>await commit.run({ message: "feat: x" })</sdk>
    <tui>CommitConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="message" type="string" required="true" />
      <field name="no-test" type="boolean" required="false" />
      <field name="allow-lazy" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="traceId" type="string" />
      <field name="message" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa commit -m "feat: user authentication"</input>
      <output>Commit</output>
    </example>
    <example>
      <input>nooa commit -m "docs: api reference" --allow-lazy</input>
      <output>Commit with allow-lazy</output>
    </example>
  </examples>
  <errors>
    <error code="commit.missing_message">Commit message is required.</error>
    <error code="commit.not_git_repo">Not a git repository.</error>
    <error code="commit.no_changes">No changes to commit.</error>
    <error code="commit.no_staged">No staged changes.</error>
    <error code="commit.policy_violation">Zero-Preguiça violations found.</error>
    <error code="commit.tests_failed">Tests failed.</error>
    <error code="commit.git_failed">Git commit failed.</error>
  </errors>
  <changelog>
    <version number="1.0.0">
      <change>Initial release</change>
    </version>
  </changelog>
</instruction>
```

## SDK

```text
SDK Usage:
  const result = await commit.run({ message: "feat: x", allowLazy: true });
  if (result.ok) console.log(result.data.message);
```

## Changelog

  1.0.0: Initial release