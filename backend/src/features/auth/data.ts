export const initialOwnerAccount = {
  email: process.env.OWNER_EMAIL?.trim() || "owner@vanya.com",
  password: process.env.OWNER_PASSWORD || "owner123",
  name: process.env.OWNER_NAME?.trim() || "John Smith"
};
