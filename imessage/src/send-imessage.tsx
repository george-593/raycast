import { Detail, Form, ActionPanel, Action, showToast, Toast, popToRoot, Cache, confirmAlert, Alert } from "@raycast/api";
import { runAppleScript } from "run-applescript";
import { useState, useEffect } from "react";

const cache = new Cache();
const CACHE_KEY = "contacts_cache";
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

interface Contact {
  name: string;
  handle: string;
}

interface CachedContacts {
  timestamp: number;
  contacts: Contact[];
}

async function getContacts(): Promise<Contact[]> {
  // Return cached contacts if still fresh
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    const parsed: CachedContacts = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_TTL) {
      return parsed.contacts;
    }
  }


  const result = await runAppleScript(`
    tell application "Contacts"
      set allPeople to every person
      set output to {}
      set peopleCount to count of allPeople
      
      repeat with i from 1 to peopleCount
        set p to item i of allPeople
        set personName to name of p
        
        if personName is not "SPAM" then
          repeat with ph in (phone of p)
            set end of output to (personName & "|" & (value of ph))
          end repeat
          
          repeat with em in (email of p)
            set end of output to (personName & "|" & (value of em))
          end repeat
        end if
      end repeat
      
      set AppleScript's text item delimiters to "@@@"
      set outputText to output as text
      set AppleScript's text item delimiters to ""
      return outputText
    end tell
  `);

  if (!result) throw new Error("No contacts returned");

  const contacts = result
    .split("@@@")
    .filter(Boolean)
    .map((line) => {
      const [name, handle] = line.split("|");
      return { name, handle };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Store in cache with current timestamp
  const payload: CachedContacts = { timestamp: Date.now(), contacts };
  cache.set(CACHE_KEY, JSON.stringify(payload));

  return contacts;
}


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
            cache.remove(CACHE_KEY);
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

function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function handleSubmit(values: { message: string, recipient: string }) {
  const { message, recipient } = values;
  const appleScript = `
    tell application "Messages"
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${escapeAppleScript(recipient)}" of targetService
      send "${escapeAppleScript(message)}" to targetBuddy
    end tell
  `;

  const confirmed = await confirmAlert({
    title: "Send Message?",
    message: `Send to ${values.recipient}?`,
    primaryAction: { title: "Send", style: Alert.ActionStyle.Default },
  });
  if (!confirmed) return;
  const result = await runAppleScript(appleScript);
  await showToast({ style: Toast.Style.Success, title: `Result: ${result}` });
  await popToRoot()

}