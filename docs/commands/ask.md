# nooa ask

Query your indexed code and memory using semantic similarity. Unlike `nooa search` (which uses exact patterns), `ask` finds information based on the mathematical meaning of your query.

## Usage

```bash
nooa ask <query> [flags]
```

## Arguments

- `<query>`: Your question or the concept you are looking for.

## Flags

- `--limit <n>`: The maximum number of results to return (default: 5).
- `--json`: Output results as a structured JSON object.
- `-h, --help`: Show the help message.

## How it works

1. **Embed Query**: Generates an embedding vector for your search query.
2. **Similarity Search**: Performs a cosine similarity search against the local vector database.
3. **Rank**: Returns the most relevant chunks of code or documentation, ranked by similarity score.

## Examples

```bash
# Find how something works
nooa ask "how does the policy engine handle ignores?"

# Limit results and get JSON
nooa ask "database schema" --limit 3 --json
```
