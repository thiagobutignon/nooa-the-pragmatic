function busySpin(iterations) {
	let total = 0;
	for (let i = 0; i < iterations; i += 1) {
		total += Math.sqrt(i % 1000);
	}
	return total;
}

function main() {
	const result = busySpin(2_500_000);
	console.log(`done:${Math.round(result)}`);
}

main();
