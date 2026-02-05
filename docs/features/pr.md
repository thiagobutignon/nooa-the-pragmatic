# pr

## Description

Manage GitHub Pull Requests

## CLI Usage

```text
Usage: nooa pr <subcommand> [flags]

Manage GitHub Pull Requests.

Subcommands:
  create --title <t> --body <b>    Create a new PR from current branch.
  list                            List open PRs for the repository.
  review <number>                 Review a specific PR.
  merge <number> --method <m>     Merge a PR (merge|squash|rebase).
  close <number>                  Close a PR without merging.
  comment <number> --body <md>    Add a markdown comment to a PR.
  status <number>                 Show checks, labels, approvals for a PR.

Flags:
  --repo <owner/repo>   Specify repository (otherwise inferred from remote).
  --method <m>          Merge method: merge, squash, rebase.
  --title <t>           Merge commit title (merge only).
  --message <m>         Merge commit message (merge only).
  --body <md>           Comment body in markdown (or via stdin).
  --json                Output as JSON.
  -h, --help            Show help.

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  pr.missing_action: Missing subcommand
  pr.missing_number: PR number required
  pr.missing_title: Missing --title
  pr.missing_body: Missing --body
  pr.missing_comment: Comment body required
  pr.invalid_method: Invalid merge method
  pr.unknown_action: Unknown subcommand
  pr.runtime_error: Unexpected error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="pr">
  <purpose>Manage GitHub Pull Requests</purpose>
  <usage>
    <cli>nooa pr &lt;subcommand&gt; [flags]</cli>
    <sdk>await pr.run({ action: "list" })</sdk>
    <tui>PrConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="number" type="number" required="false" />
      <field name="title" type="string" required="false" />
      <field name="body" type="string" required="false" />
      <field name="method" type="string" required="false" />
      <field name="message" type="string" required="false" />
      <field name="repo" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="action" type="string" />
      <field name="result" type="string" />
      <field name="prs" type="string" />
      <field name="review" type="string" />
      <field name="status" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa pr list</input>
      <output>List PRs</output>
    </example>
    <example>
      <input>nooa pr review 12</input>
      <output>Review PR</output>
    </example>
    <example>
      <input>nooa pr create --title T --body B</input>
      <output>Create PR</output>
    </example>
  </examples>
  <errors>
    <error code="pr.missing_action">Missing subcommand.</error>
    <error code="pr.missing_number">PR number required.</error>
    <error code="pr.missing_title">Missing --title.</error>
    <error code="pr.missing_body">Missing --body.</error>
    <error code="pr.missing_comment">Comment body required.</error>
    <error code="pr.invalid_method">Invalid merge method.</error>
    <error code="pr.unknown_action">Unknown subcommand.</error>
    <error code="pr.runtime_error">Unexpected error.</error>
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
  const result = await pr.run({ action: "list" });
  if (result.ok) console.log(result.data.prs);
```

## Changelog

  1.0.0: Initial release