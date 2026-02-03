# SDK: doctor

Run environment/tooling checks programmatically.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.doctor.run();
if (result.ok) {
	console.log(result.data.ok);
}
```

## API

### `sdk.doctor.run()`

**Returns**
- `SdkResult<DoctorResult>`

**Errors**
- `doctor_error` when the check fails
