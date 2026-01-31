import runCommand from "../run/cli";

export default {
    ...runCommand,
    name: "combine",
    description: "Alias for 'run' - Execute multiple commands in a pipeline",
};
