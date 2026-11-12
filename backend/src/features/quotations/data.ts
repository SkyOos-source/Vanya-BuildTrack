import { people, quotations } from "../../data/store";

export { quotations };

export function listQuotationsWithClientEmails() {
  return quotations.map((quote) => {
    const client = people.find((person) => person.role === "Client" && person.project === quote.project);
    return {
      ...quote,
      ...(client ? { clientEmail: client.email.toLowerCase() } : {})
    };
  });
}
