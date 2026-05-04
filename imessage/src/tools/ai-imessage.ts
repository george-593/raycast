import { Tool } from "@raycast/api";
import { getContacts, sendMessage, Contact } from "../utils";

type Input = {
  /** The name of the contact to send the message to */
  contactName: string;
  /** The message to send */
  message: string;
};

export default async function (input: Input) {
  const { contactName, message } = input;

  const contacts = await getContacts();

  const matches = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactName.toLowerCase())
  );

  if (matches.length === 0) throw new Error(`No contact found matching "${contactName}", if this is a new contact try refreshing contacts cache.`);

  // Prefer exact match over partial
  const exact = matches.find((c) => c.name.toLowerCase() === contactName.toLowerCase());
  const contact = exact ?? matches[0];

  await sendMessage(message, contact.handle);
  return `Message sent to ${contact.name} (${contact.handle})`;
}

export const confirmation: Tool.Confirmation<Input> = async ({ contactName, message }) => {
  // Resolve the contact so we can show the actual handle in the confirmation
  const contacts = await getContacts();
  const matches = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactName.toLowerCase())
  );
  const exact = matches.find((c) => c.name.toLowerCase() === contactName.toLowerCase());
  const contact = exact ?? matches[0];

  return {
    title: "Send iMessage",
    message: "Do you want to send this message?",
    info: [
      { name: "To", value: contact ? `${contact.name} (${contact.handle})` : contactName },
      { name: "Message", value: message },
    ],
  };
};
