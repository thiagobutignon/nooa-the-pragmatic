export interface GuardResult {
	blocked: boolean;
	reason?: string;
}

interface DangerousPattern {
	pattern: RegExp;
	description: string;
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
	{
		pattern:
			/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive\s+--force|-[a-zA-Z]*f[a-zA-Z]*r)\b/i,
		description: "Recursive force delete (rm -rf)",
	},
	{
		pattern: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+[/~]/i,
		description: "Recursive delete from root/home",
	},
	{ pattern: /\bformat\s+[A-Z]:/i, description: "Disk format (Windows)" },
	{ pattern: /\bmkfs\b/i, description: "Filesystem create (mkfs)" },
	{ pattern: /\bdiskpart\b/i, description: "Disk partition tool" },
	{ pattern: /\bdd\s+if=/i, description: "Disk image/write (dd)" },
	{ pattern: /\/dev\/sd[a-z]/i, description: "Direct disk device access" },
	{ pattern: /:\(\)\{\s*:\|:&\s*\};:/i, description: "Fork bomb" },
	{ pattern: /\bshutdown\b/i, description: "System shutdown" },
	{ pattern: /\breboot\b/i, description: "System reboot" },
	{ pattern: /\bpoweroff\b/i, description: "System poweroff" },
	{ pattern: /\bdel\s+\/[fF]\b/i, description: "Force delete (Windows)" },
	{
		pattern: /\brmdir\s+\/[sS]\b/i,
		description: "Recursive directory removal (Windows)",
	},
];

export class DangerousCommandGuard {
	check(command: string): GuardResult {
		for (const { pattern, description } of DANGEROUS_PATTERNS) {
			if (pattern.test(command)) {
				return {
					blocked: true,
					reason: `Blocked: ${description} - "${command}"`,
				};
			}
		}

		return { blocked: false };
	}
}
