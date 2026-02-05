# skills

## Description

Manage NOOA skills

## CLI Usage

```text
Usage: nooa skills [subcommand] [flags]

Manage NOOA skills.

Subcommands:
  list                 List all available skills.
  add <name> [desc]    Create a new skill.
  remove <name>        Delete a skill.
  show <name>          Show skill details.
  enable <name>        Enable a skill.
  disable <name>       Disable a skill.
  update <name>        Update a skill.
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="skills">
  <purpose>Manage NOOA skills</purpose>
  <usage>
    <cli>nooa skills [subcommand] [flags]</cli>
    <sdk>await skills.run({ action: "list" })</sdk>
    <tui>SkillsPanel()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="name" type="string" required="false" />
      <field name="description" type="string" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="skills" type="string" />
      <field name="skill" type="string" />
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
      <input>nooa skills list</input>
      <output>List skills</output>
    </example>
    <example>
      <input>nooa skills add my-skill "desc"</input>
      <output>Create skill</output>
    </example>
  </examples>
  <errors>
    <error code="skills.missing_action">Action is required.</error>
    <error code="skills.missing_name">Skill name required.</error>
    <error code="skills.runtime_error">Runtime error.</error>
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
  await skills.run({ action: "list" });
  await skills.run({ action: "add", name: "my-skill", description: "..." });
```

## Changelog

  1.0.0: Initial release