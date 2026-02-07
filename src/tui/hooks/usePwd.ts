import { useEffect, useState } from "react";
import type { SdkError } from "../../core/types";
import { run } from "../../features/pwd/cli";

export interface UsePwdState {
	cwd?: string;
	error?: SdkError;
	status: "idle" | "loading" | "success" | "error";
}

export function usePwd(): UsePwdState {
	const [state, setState] = useState<UsePwdState>({ status: "idle" });

	useEffect(() => {
		let active = true;
		setState({ status: "loading" });

		run()
			.then((result) => {
				if (!active) return;
				if (!result.ok) {
					setState({ status: "error", error: result.error });
					return;
				}
				setState({ status: "success", cwd: result.data.cwd });
			})
			.catch((error) => {
				if (!active) return;
				setState({
					status: "error",
					error: {
						code: "tui.pwd_failed",
						message: error instanceof Error ? error.message : String(error),
					},
				});
			});

		return () => {
			active = false;
		};
	}, []);

	return state;
}
