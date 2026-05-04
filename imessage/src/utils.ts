import { showToast, Toast, Cache, confirmAlert, Alert } from "@raycast/api";
import { runAppleScript } from "run-applescript";

const cache = new Cache();
const CACHE_KEY = "contacts_cache";
const CACHE_TTL = 1000 * 60 * 60 * 24; // 1 day

export interface Contact {
    name: string;
    handle: string;
}

interface CachedContacts {
    timestamp: number;
    contacts: Contact[];
}

export async function getContacts(): Promise<Contact[]> {
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

export function refreshCache() {
    cache.remove(CACHE_KEY);
}

function escapeAppleScript(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function sendMessage(message: string, recipient: string) {
    const appleScript = `
    tell application "Messages"
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${escapeAppleScript(recipient)}" of targetService
      send "${escapeAppleScript(message)}" to targetBuddy
    end tell
  `;

    if (!message.trim()) {
        await showToast({ style: Toast.Style.Failure, title: "Message cannot be empty" });
        return;
    }

    await runAppleScript(appleScript);
}
