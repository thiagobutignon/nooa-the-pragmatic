# nooa push

Push a clean working tree to a remote, with optional test enforcement.

## Usage

```bash
nooa push [remote] [branch] [--no-test]
```

## Description

Runs preflight checks (clean working tree) and optionally runs tests, then executes `git push`.

## Flags

- `--no-test` skip running tests before push
- `-h, --help` show help

## Exit Codes

- `0` success
- `1` git push failed
- `2` invalid usage or dirty working tree
- `3` tests failed

## Examples

```bash
nooa push                    # push to default remote/branch
nooa push origin main         # push to specific remote/branch
nooa push --no-test           # skip tests
```

## Troubleshooting

- **Uncommitted changes detected**: commit or stash first
- **Tests failed**: fix and re-run, or use `--no-test` if appropriate
- **Push failed**: check remote/branch permissions
