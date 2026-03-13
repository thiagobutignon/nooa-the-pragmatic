function computeValue() {
	const base = 1;
	return base + 1;
}

setInterval(() => {
	const value = computeValue();
	if (!value) {
		throw new Error("unreachable");
	}
}, 10);
