import { createTraceId } from "../../core/logger";
import type {
	ReplayGraph as GraphData,
	ReplayEdge,
	ReplayNode,
} from "./storage";

export class ReplayGraph {
	private nodes: Map<string, ReplayNode>;
	private edges: ReplayEdge[];

	constructor(data?: GraphData) {
		this.nodes = new Map(data?.nodes.map((n) => [n.id, n]) ?? []);
		this.edges = data?.edges ?? [];
	}

	addNode(
		label: string,
		type: ReplayNode["type"] = "step",
		meta?: ReplayNode["meta"],
	): ReplayNode {
		if (!label) {
			throw new Error("Label is required");
		}
		const node: ReplayNode = {
			id: createTraceId(),
			label,
			type,
			createdAt: new Date().toISOString(),
			meta,
		};
		this.nodes.set(node.id, node);
		return node;
	}

	addEdge(from: string, to: string, kind: ReplayEdge["kind"]): void {
		if (!this.nodes.has(from)) throw new Error(`Node ${from} not found`);
		if (!this.nodes.has(to)) throw new Error(`Node ${to} not found`);

		if (kind === "next") {
			if (this.detectCycle(from, to)) {
				throw new Error("Cycle detected");
			}
		}

		this.edges.push({ from, to, kind });
	}

	addFix(targetId: string, label: string): ReplayNode {
		if (!this.nodes.has(targetId))
			throw new Error(`Node ${targetId} not found`);

		const fixNode = this.addNode(label, "fix", {});
		// Fix node conceptually "fixes" the target, but we track impact downstream
		// Store relation if needed, maybe in meta or specialized edge?
		// storage.ts definition has `fixOf?: string` on ReplayNode.
		fixNode.fixOf = targetId;
		this.edges.push({ from: fixNode.id, to: targetId, kind: "fixes" });

		const impacted = this.findImpactedNodes(targetId);
		for (const id of impacted) {
			this.edges.push({ from: fixNode.id, to: id, kind: "impact" });
		}

		return fixNode;
	}

	getSummary() {
		return {
			nodes: this.nodes.size,
			edges: this.edges.length,
		};
	}

	toJSON(): GraphData {
		return {
			version: "1.0.0",
			nodes: Array.from(this.nodes.values()),
			edges: this.edges,
		};
	}

	getNode(id: string) {
		return this.nodes.get(id);
	}

	private detectCycle(from: string, to: string): boolean {
		// Attempting to add A -> B. Cycle if path B -> ... -> A exists.
		const startNode = to;
		const endNode = from;

		const nextEdges = this.edges.filter((e) => e.kind === "next");
		const adjacency = new Map<string, string[]>();
		for (const edge of nextEdges) {
			if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
			adjacency.get(edge.from)?.push(edge.to);
		}

		const stack = [startNode];
		const visited = new Set<string>();

		while (stack.length > 0) {
			const current = stack.pop()!;
			if (visited.has(current)) continue;
			if (current === endNode) return true;

			visited.add(current);
			const neighbors = adjacency.get(current) ?? [];
			for (const neighbor of neighbors) {
				stack.push(neighbor);
			}
		}

		return false;
	}

	private findImpactedNodes(startId: string): Set<string> {
		const nextEdges = this.edges.filter((e) => e.kind === "next");
		const adjacency = new Map<string, string[]>();
		for (const edge of nextEdges) {
			if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
			adjacency.get(edge.from)?.push(edge.to);
		}

		const impacted = new Set<string>();
		const stack = [startId];
		// BFS/DFS to find all downstream nodes
		// Note: fix logic in cli.ts excluded self?
		// cli.ts: "if (!impacted.has(neighbor)) { impacted.add(neighbor); stack.push(neighbor); }"
		// It starts with stack=[targetId], pops current, looks at neighbors.
		// So targetId itself is NOT in impacted unless there's a loop (which shouldn't exist for 'next' edges).

		while (stack.length > 0) {
			const current = stack.pop()!;
			const neighbors = adjacency.get(current) ?? [];
			for (const neighbor of neighbors) {
				if (!impacted.has(neighbor)) {
					impacted.add(neighbor);
					stack.push(neighbor);
				}
			}
		}
		return impacted;
	}
}
