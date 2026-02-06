import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { telemetry, type TelemetryRow } from "../core/telemetry";
import type { NOOAEvent } from "../core/events/schema";

// --- State Definitions (Mirrors TUI_STATE_MACHINE.md) ---

interface WorkerView {
    id: string; // traceId
    goal: string;
    currentStep?: string;
    lastGate?: { id: string; status: "pass" | "fail" };
    lastEventTime: number;
    status: "active" | "completed" | "failed";
}

// --- Logic ---

function parseMetadata(row: TelemetryRow): Record<string, unknown> {
    if (!row.metadata) return {};
    if (typeof row.metadata === "string") {
        try {
            const parsed = JSON.parse(row.metadata);
            if (parsed && typeof parsed === "object") {
                return parsed as Record<string, unknown>;
            }
            return {};
        } catch {
            return {};
        }
    }
    if (typeof row.metadata === "object") {
        return row.metadata as Record<string, unknown>;
    }
    return {};
}

export function reconstituteState(rows: TelemetryRow[]): WorkerView[] {
    const workers = new Map<string, WorkerView>();

    // Process in chronological order
    const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);

    for (const row of sorted) {
        // We expect the event payload to be flattened or inside metadata
        // The telemetry system likely stores unstructured metadata.
        // We assume 'event' column matches NOOAEvent type.

        const traceId = row.trace_id;
        if (!traceId) continue;

        let worker = workers.get(traceId);
        // We implicitly assume any event with a new traceId might qualify as a worker if it looks like a workflow start
        // For now, let's look for known start events.
        const eventType = row.event ?? "";
        const metadata = parseMetadata(row);

        if (eventType === "workflow.started" || eventType === "act.started") {
            const goal = (metadata as any)?.goal || "Unknown Goal";
            worker = {
                id: traceId,
                goal,
                lastEventTime: row.timestamp,
                status: "active",
            };
            workers.set(traceId, worker);
        }

        if (!worker && (eventType.startsWith("workflow.") || eventType.startsWith("act."))) {
            // Discovered a worker mid-stream (maybe started before tail)
            worker = {
                id: traceId,
                goal: "Unknown (Attached)",
                lastEventTime: row.timestamp,
                status: "active"
            };
            workers.set(traceId, worker);
        }

        if (!worker) continue;

        worker.lastEventTime = row.timestamp;

        if (eventType === "workflow.step.start") {
            worker.currentStep = (metadata as any)?.stepId;
        }
        if (eventType === "workflow.gate.pass") {
            worker.lastGate = { id: (metadata as any)?.gateId, status: "pass" };
        }
        if (eventType === "workflow.gate.fail") {
            worker.lastGate = { id: (metadata as any)?.gateId, status: "fail" };
            worker.status = "failed"; // Or maybe just stalled?
        }
        if (eventType === "workflow.completed" || eventType === "act.completed") {
            // Check result?
            worker.status = "completed";
        }
    }

    return Array.from(workers.values());
}

// --- Components ---

function WorkerCard({ worker }: { worker: WorkerView }) {
    const color = worker.status === "active" ? "green" : worker.status === "failed" ? "red" : "gray";

    return (
        <Box borderStyle="round" borderColor={color} flexDirection="column" paddingX={1}>
            <Box justifyContent="space-between">
                <Text bold color={color}>{worker.status.toUpperCase()}</Text>
                <Text dimColor>{worker.id.slice(0, 8)}</Text>
            </Box>
            <Text>Goal: {worker.goal}</Text>
            {worker.currentStep && <Text>Step: {worker.currentStep}</Text>}
            {worker.lastGate && (
                <Text>
                    Gate: {worker.lastGate.id} {worker.lastGate.status === "pass" ? "✅" : "❌"}
                </Text>
            )}
        </Box>
    );
}

export function DashboardView() {
    const { exit } = useApp();
    const [workers, setWorkers] = useState<WorkerView[]>([]);
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    useInput((input, key) => {
        if (input === "q" || key.escape) {
            exit();
        }
    });

    useEffect(() => {
        const refresh = () => {
            const rows = telemetry.list({ limit: 500 }); // Fetch last 500 events
            const nextWorkers = reconstituteState(rows);
            // Filte for "Active" or recently completed?
            // For now show all found in the buffer
            setWorkers(nextWorkers.reverse()); // Newest first for list? Or explicit sort?
            setLastUpdate(Date.now());
        };

        refresh();
        const timer = setInterval(refresh, 500);
        return () => clearInterval(timer);
    }, []);

    const activeCount = workers.filter(w => w.status === "active").length;

    return (
        <Box flexDirection="column" padding={1}>
            <Box justifyContent="space-between" marginBottom={1}>
                <Text bold>NOOA Hypergrowth Dashboard</Text>
                <Text>Active Workers: {activeCount}</Text>
            </Box>

            <Box flexDirection="column" gap={1}>
                {workers.length === 0 ? (
                    <Text dimColor>No active workers found in telemetry tail.</Text>
                ) : (
                    workers.map((w) => <WorkerCard key={w.id} worker={w} />)
                )}
            </Box>

            <Box marginTop={1}>
                <Text dimColor>Last update: {new Date(lastUpdate).toISOString().split("T")[1]} (Press q to quit)</Text>
            </Box>
        </Box>
    );
}

// Standalone runner if executed directly
if (import.meta.main) {
    const { render } = await import("ink");
    render(<DashboardView />);
}
