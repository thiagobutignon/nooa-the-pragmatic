# nooa push

Push a clean working tree to a remote, with optional test enforcement.

## Usage

```bash
nooa push [remote] [branch] [flags]
```

## Arguments

- `[remote]` - Git remote name (default: `origin`)
- `[branch]` - Git branch name (default: current branch)

## Flags

- `--no-test` - Skip automatic test verification before pushing
- `-h, --help` - Show help message

## Examples

### Basic push
```bash
nooa push
```

### Push to specific remote/branch without tests
```bash
nooa push origin feat/auth --no-test
```

## Exit Codes

- `0` - Success
- `1` - Runtime Error (git push failed)
- `2` - Validation Error (not a git repo or dirty tree)
- `3` - Test Failure (pre-push tests failed)

## Troubleshooting

- **Uncommitted changes detected**: commit or stash first
- **Tests failed**: fix and re-run, or use `--no-test` if appropriate
- **Push failed**: check remote/branch permissions
