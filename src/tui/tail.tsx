import { Box, Text, useApp, useInput } from "ink";
import { useEffect, useState } from "react";
import type { TelemetryRow } from "../core/telemetry";
import { telemetry } from "../core/telemetry";

export type TailViewProps = {
	events: TelemetryRow[];
	limit?: number;
};

const formatEvent = (row: TelemetryRow) => {
	const ts = new Date(row.timestamp).toISOString();
	const meta = row.metadata ? ` ${row.metadata}` : "";
	return `${ts} ${row.level.toUpperCase()} ${row.event}${meta}`;
};

export function TailView({ events, limit = 20 }: TailViewProps) {
	const visible = events.slice(0, limit);
	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>NOOA Event Tail</Text>
			<Text dimColor>Pressione q ou Esc para sair</Text>
			<Box flexDirection="column" marginTop={1}>
				{visible.length === 0 ? (
					<Text dimColor>Nenhum evento ainda.</Text>
				) : (
					visible.map((row) => (
						<Text key={`${row.id}-${row.timestamp}`}>{formatEvent(row)}</Text>
					))
				)}
			</Box>
		</Box>
	);
}

export function TailApp() {
	const { exit } = useApp();
	const [events, setEvents] = useState<TelemetryRow[]>([]);

	useInput((input, key) => {
		if (input === "q" || key.escape) {
			exit();
		}
	});

	useEffect(() => {
		const refresh = () => {
			const rows = telemetry.list();
			setEvents(rows);
		};

		refresh();
		const timer = setInterval(refresh, 500);
		return () => clearInterval(timer);
	}, []);

	return <TailView events={events} />;
}

if (import.meta.main) {
	const { render } = await import("ink");
	render(<TailApp />);
}
