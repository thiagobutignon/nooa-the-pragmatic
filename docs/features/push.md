# push

## Description

Push changes to remote repository

## CLI Usage

```text
Usage: nooa push [remote] [branch] [flags]

Push committed changes to the remote repository.

Arguments:
  [remote]       Git remote name (default: origin).
  [branch]       Git branch name (default: current branch).

Flags:
  --no-test      Skip automatic test verification before pushing.
  --json         Output result as JSON.
  -h, --help     Show help message.

Examples:
  nooa push
  nooa push origin feat/auth --no-test

Exit Codes:
  0: Success
  1: Runtime Error (git push failed)
  2: Validation Error (not a git repo or dirty tree)
  3: Test Failure (pre-push tests failed)

Error Codes:
  push.not_git_repo: Not a git repository
  push.dirty_tree: Uncommitted changes detected
  push.policy_violation: Policy violations found
  push.tests_failed: Tests failed
  push.push_failed: Git push failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="push">
  <purpose>Push changes to remote repository</purpose>
  <usage>
    <cli>nooa push [remote] [branch] [flags]</cli>
    <sdk>await push.run({ remote: "origin", branch: "main" })</sdk>
    <tui>PushConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="remote" type="string" required="false" />
      <field name="branch" type="string" required="false" />
      <field name="no-test" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="traceId" type="string" />
      <field name="message" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
    <code value="3">Test failure</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa push</input>
      <output>Pushes current branch</output>
    </example>
    <example>
      <input>nooa push origin feat/auth --no-test</input>
      <output>Pushes without running tests</output>
    </example>
  </examples>
  <errors>
    <error code="push.not_git_repo">Not a git repository.</error>
    <error code="push.dirty_tree">Uncommitted changes detected.</error>
    <error code="push.policy_violation">Policy violations found in the project.</error>
    <error code="push.tests_failed">Tests failed.</error>
    <error code="push.push_failed">Git push failed.</error>
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
  const result = await push.run({ remote: "origin", branch: "main" });
  if (result.ok) console.log(result.data.message);
```

## Changelog

  1.0.0: Initial release