import paystack from "./paystack.js";
import flutterwave from "./flutterwave.js";

const providers = { paystack, flutterwave };

// Which processor is actually live is controlled by PAYMENT_PROVIDER in
// .env, not hardcoded — set it to whichever of Paystack/Flutterwave you
// actually have a secret key for (both adapters are implemented; only one
// needs to be configured). Neither key set, or PAYMENT_PROVIDER unset, means
// checkout stays in "payments not configured" mode (see routes/checkout.js)
// rather than guessing which provider to use or silently failing.
export function getActiveProvider() {
  const name = process.env.PAYMENT_PROVIDER;
  const provider = name && providers[name];
  if (!provider || !provider.isConfigured()) return null;
  return provider;
}

export function getProviderByName(name) {
  return providers[name] || null;
}
