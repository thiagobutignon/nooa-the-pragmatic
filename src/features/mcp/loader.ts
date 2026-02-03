export async function loadCommand(name: string) {
    switch (name) {
        case "init": return (await import("./init")).initCommand;
        case "alias": return (await import("./alias")).aliasCommand;
        case "list": return (await import("./list")).listCommand;
        case "install": return (await import("./install")).installCommand;
        case "enable": return (await import("./enable")).enableCommand;
        case "disable": return (await import("./disable")).disableCommand;
        case "call": return (await import("./call")).callCommand;
        case "resource": return (await import("./resource")).resourceCommand;
        case "health": return (await import("./health")).healthCommand;
        case "marketplace": return (await import("./marketplace")).marketplaceCommand;
        case "info": return (await import("./info")).infoCommand;
        case "configure": return (await import("./configure")).configureCommand;
        case "uninstall": return (await import("./uninstall")).uninstallCommand;
        case "test": return (await import("./test")).testCommand;
        default: return null;
    }
}
