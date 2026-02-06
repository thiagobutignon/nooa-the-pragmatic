import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { telemetry, type TelemetryRow } from "../core/telemetry";
import type { NOOAEvent } from "../core/events/schema";



import { reconstituteState, type WorkerView } from "./shared/state";

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
                    Last Gate: {worker.lastGate.id} {worker.lastGate.status === "pass" ? "✅" : "❌"}
                </Text>
            )}
            {worker.gates.length > 0 && (
                <Text>Passed: {worker.gates.join(" -> ")}</Text>
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
