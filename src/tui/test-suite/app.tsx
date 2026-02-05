#!/usr/bin/env bun
import React, { useState } from "react";
import { Box, Text, useApp, useInput, render } from "ink";
import { InitScreen } from "./InitScreen";
import { ActScreen } from "./ActScreen";

function App() {
    const { exit } = useApp();
    const [screen, setScreen] = useState<"menu" | "init" | "act">("menu");
    const [cursor, setCursor] = useState(0);

    const menuItems = [
        { id: "init", label: "Deep Bootstrap (nooa init)" },
        { id: "act", label: "Orchestrate (nooa act)" },
        { id: "exit", label: "Exit" },
    ];

    useInput((input, key) => {
        if (screen === "menu") {
            if (key.upArrow) {
                setCursor(Math.max(0, cursor - 1));
            }
            if (key.downArrow) {
                setCursor(Math.min(menuItems.length - 1, cursor + 1));
            }
            if (key.return) {
                const item = menuItems[cursor];
                if (item.id === "exit") exit();
                if (item.id === "init") setScreen("init");
                if (item.id === "act") setScreen("act");
            }
            if (key.escape || input === "q") {
                exit();
            }
        }
    });

    if (screen === "init") {
        return <InitScreen onBack={() => setScreen("menu")} />;
    }

    if (screen === "act") {
        return <ActScreen onBack={() => setScreen("menu")} />;
    }

    return (
        <Box flexDirection="column" padding={1} borderStyle="double" borderColor="magenta">
            <Text bold color="magenta">NOOA Verification Suite</Text>
            <Text dimColor>Model: qwen2.5-coder (Groq)</Text>

            <Box marginTop={1} flexDirection="column">
                {menuItems.map((item, index) => (
                    <Box key={item.id}>
                        <Text color={index === cursor ? "green" : "white"}>
                            {index === cursor ? "> " : "  "}
                            {item.label}
                        </Text>
                    </Box>
                ))}
            </Box>

            <Box marginTop={1}>
                <Text dimColor>Use arrow keys to navigate, Enter to select, q to quit.</Text>
            </Box>
        </Box>
    );
}

// Clear screen
console.log("\x1Bc");

render(<App />);
