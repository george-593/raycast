import { Form, ActionPanel, Action, showToast, Toast, popToRoot } from "@raycast/api";
import { useState, useEffect } from "react";
import { getContacts, Contact, sendMessage, refreshCache } from "./utils";

export default function Command() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getContacts()
      .then(setContacts)
      .catch(() => showToast({ style: Toast.Style.Failure, title: "Failed to load contacts" }))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <Form isLoading={isLoading} actions={
      <ActionPanel>
        <Action.SubmitForm title="Send" onSubmit={handleSubmit} />
        <Action
          title="Refresh Contacts"
          onAction={() => {
            refreshCache();
            setIsLoading(true);
            getContacts().then(setContacts).finally(() => setIsLoading(false));
          }}
        />
      </ActionPanel>
    }>
      {/* Dropdown populated from contacts */}
      <Form.Dropdown id="recipient" title="Recipient" isLoading={isLoading}>
        {contacts.map((contact, i) => (
          <Form.Dropdown.Item
            key={i}
            value={contact.handle}
            title={`${contact.name} — ${contact.handle}`}
          />
        ))}
      </Form.Dropdown>
      <Form.TextArea id="message" title="Message" placeholder="Enter your message here" />
    </Form>
  );
}

async function handleSubmit(values: { message: string, recipient: string }) {
  sendMessage(values.message, values.recipient);
  await showToast({ style: Toast.Style.Success, title: "Message sent successfully" });
  await popToRoot()
};