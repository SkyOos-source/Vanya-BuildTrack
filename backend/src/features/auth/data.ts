function requiredOwnerPassword(variable: "OWNER_PASSWORD" | "OWNER2_PASSWORD") {
  const password = process.env[variable];
  if (!password) throw new Error(`${variable} must be configured before initializing owner accounts.`);
  return password;
}

export function getInitialOwnerAccounts() {
  const accounts = [
  {
    email: process.env.OWNER_EMAIL?.trim() || "varun@vanya.com",
    password: requiredOwnerPassword("OWNER_PASSWORD"),
    name: process.env.OWNER_NAME?.trim() || "Varun"
  },
  {
    email: process.env.OWNER2_EMAIL?.trim() || "chaitanya@vanya.com",
    password: requiredOwnerPassword("OWNER2_PASSWORD"),
    name: process.env.OWNER2_NAME?.trim() || "Chaitanya"
  }
  ];

  if (accounts[0].email.toLowerCase() === accounts[1].email.toLowerCase()) {
    throw new Error("OWNER_EMAIL and OWNER2_EMAIL must be different.");
  }
  return accounts;
}
