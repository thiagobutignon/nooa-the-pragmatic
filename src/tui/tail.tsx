import { Box, Text, useApp, useInput } from "ink";
import React, { useEffect, useState } from "react";
import { telemetry, type TelemetryRow } from "../core/telemetry";

type TailEvent = TelemetryRow;

export function TailView({ events }: { events: TailEvent[] }) {
	return (
		<Box flexDirection="column">
			<Text>NOOA TUI — Event Tail (q to quit)</Text>
			{events.length === 0 ? (
				<Text color="yellow">No events yet.</Text>
			) : (
				events.map((evt) => (
					<Text key={`${evt.id}-${evt.timestamp}`}>
						[{new Date(evt.timestamp).toISOString()}] {evt.event}{" "}
						{evt.trace_id ? `(${evt.trace_id})` : ""}
					</Text>
				))
			)}
		</Box>
	);
}

export function TailApp({ limit = 20 }: { limit?: number }) {
	const { exit } = useApp();
	const [events, setEvents] = useState<TailEvent[]>([]);

	useInput((input, key) => {
		if (input === "q" || key.escape) exit();
	});

	useEffect(() => {
		const refresh = () => {
			const rows = telemetry.list().slice(0, limit);
			setEvents(rows);
		};
		refresh();
		const interval = setInterval(refresh, 500);
		return () => clearInterval(interval);
	}, [limit]);

	return <TailView events={events} />;
}

if (import.meta.main) {
	const { render } = await import("ink");
	render(<TailApp />);
}
