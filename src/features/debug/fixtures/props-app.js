globalThis.payload = {
	nested: true,
	count: 2,
};

setInterval(() => {
	if (!globalThis.payload) {
		throw new Error("unreachable");
	}
}, 1000);
