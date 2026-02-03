import { executeDoctorCheck } from "../features/doctor/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export async function run(): Promise<SdkResult<Awaited<ReturnType<typeof executeDoctorCheck>>>> {
	try {
		const result = await executeDoctorCheck();
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("doctor_error", "Doctor check failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const doctor = {
	run,
};
