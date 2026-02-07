import { execa } from "execa";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

interface InitScreenProps {
	onBack: () => void;
}

export function InitScreen({ onBack }: InitScreenProps) {
	const [step, setStep] = useState(0);
	const [formData, setFormData] = useState({
		name: "",
		vibe: "",
		userName: "",
		userRole: "",
		workingStyle: "",
		architecture: "",
	});
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<string | null>(null);

	const fields = [
		{ key: "name", label: "Agent Name", placeholder: "NOOA" },
		{ key: "vibe", label: "Vibe", placeholder: "resourceful" },
		{ key: "userName", label: "User Name", placeholder: "Developer" },
		{ key: "userRole", label: "User Role", placeholder: "Lead Developer" },
		{ key: "workingStyle", label: "Working Style", placeholder: "TDD" },
		{
			key: "architecture",
			label: "Architecture",
			placeholder: "Vertical Slice",
		},
	];

	const [inputValue, setInputValue] = useState("");

	useInput((_input, key) => {
		if (key.escape) onBack();
	});

	const handleSubmit = async (value: string) => {
		const currentField = fields[step];
		const newData = {
			...formData,
			[currentField.key]: value || currentField.placeholder,
		};
		setFormData(newData);
		setInputValue("");

		if (step < fields.length - 1) {
			setStep(step + 1);
		} else {
			// Submit
			setLoading(true);
			try {
				const args = [
					"init",
					"--non-interactive",
					"--name",
					newData.name,
					"--vibe",
					newData.vibe,
					"--user-name",
					newData.userName,
					"--user-role",
					newData.userRole,
					"--working-style",
					newData.workingStyle,
					"--architecture",
					newData.architecture,
					"--force",
				];

				const { stdout } = await execa("bun", ["run", "index.ts", ...args]);
				setResult(stdout);
			} catch (err) {
				setResult(`Error: ${(err as Error).message}`);
			} finally {
				setLoading(false);
			}
		}
	};

	if (result) {
		return (
			<Box flexDirection="column" padding={1} borderStyle="single">
				<Text color="green">Initialization Complete!</Text>
				<Text>{result}</Text>
				<Text color="gray" dimColor>
					Press ESC to go back
				</Text>
			</Box>
		);
	}

	if (loading) {
		return (
			<Box padding={1}>
				<Text>Initializing Agent OS...</Text>
			</Box>
		);
	}

	const currentField = fields[step];

	return (
		<Box flexDirection="column" padding={1} borderStyle="single">
			<Text bold>
				Deep Bootstrap Interview ({step + 1}/{fields.length})
			</Text>

			<Box marginTop={1} flexDirection="column">
				<Text color="green">{currentField.label}:</Text>
				<Box borderStyle="round" borderColor="dim">
					<TextInput
						value={inputValue}
						onChange={setInputValue}
						placeholder={currentField.placeholder}
						onSubmit={handleSubmit}
					/>
				</Box>
			</Box>

			<Box marginTop={1}>
				<Text color="gray" dimColor>
					Press Enter to confirm • ESC to cancel
				</Text>
			</Box>
		</Box>
	);
}
