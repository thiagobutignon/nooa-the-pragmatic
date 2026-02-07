import { describe, expect, it } from "bun:test";
import { ReplayGraph } from "./graph";

describe("ReplayGraph", () => {
	it("should initialize empty", () => {
		const graph = new ReplayGraph();
		expect(graph.getSummary()).toEqual({ nodes: 0, edges: 0 });
	});

	it("should add a node", () => {
		const graph = new ReplayGraph();
		const node = graph.addNode("A");
		expect(node.label).toBe("A");
		expect(graph.getSummary().nodes).toBe(1);
	});

	it("should reject empty labels", () => {
		const graph = new ReplayGraph();
		expect(() => graph.addNode("")).toThrow("Label is required");
	});

	it("should detect cycles in addEdge", () => {
		const graph = new ReplayGraph();
		const a = graph.addNode("A");
		const b = graph.addNode("B");

		graph.addEdge(a.id, b.id, "next");
		expect(() => graph.addEdge(b.id, a.id, "next")).toThrow("Cycle detected");
	});

	it("should allow impact edges (no cycle check enforced for impact yet)", () => {
		// Impact edges are conceptually DAG too, but usually parallel to `next`.
		// We might want to enforce DAG nature eventually, but for now just check they are added.
		const graph = new ReplayGraph();
		const a = graph.addNode("A");
		const b = graph.addNode("B");
		graph.addEdge(a.id, b.id, "impact");
		expect(graph.getSummary().edges).toBe(1);
	});

	it("should find impacted nodes for fix", () => {
		const graph = new ReplayGraph();
		const a = graph.addNode("A");
		const b = graph.addNode("B");
		const c = graph.addNode("C");

		// A -> B -> C
		graph.addEdge(a.id, b.id, "next");
		graph.addEdge(b.id, c.id, "next");

		// Fix B. Should impact C.
		const fix = graph.addFix(b.id, "Fix B");
		expect(fix.type).toBe("fix");

		// Validation: verify edges
		const json = graph.toJSON();
		const impactEdges = json.edges.filter((e) => e.kind === "impact");
		expect(impactEdges.length).toBe(1); // Should point to C
		expect(impactEdges[0].to).toBe(c.id);
		expect(impactEdges[0].from).toBe(fix.id);

		const fixesEdges = json.edges.filter((e) => e.kind === "fixes");
		expect(fixesEdges.length).toBe(1);
		expect(fixesEdges[0].from).toBe(fix.id);
		expect(fixesEdges[0].to).toBe(b.id);
	});
});
