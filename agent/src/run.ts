import "dotenv/config";

// Demo agent skeleton — implemented in Phase 3.
// Will use Gemini function-calling with a single tool, `submit_purchase_request`,
// that POSTs to the Palpay Rail server's /requests endpoint. The agent never
// calls PayPal directly; the server is the only thing that talks to PayPal.

async function main() {
    console.log("Palpay Rail demo agent — scaffold only, see Phase 3 for the real implementation.");
}

main();
